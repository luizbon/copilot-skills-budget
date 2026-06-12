#!/usr/bin/env node
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const STARTUP_PROMPT = 'Check my skills context budget and report any warnings';

const SKILLS_DIRS = [
  join(homedir(), '.copilot', 'installed-plugins'),
  join(homedir(), '.copilot', 'skills'),
  join(homedir(), '.agents', 'skills'),
];

// Read stdin to get hook context (prompt, sessionId, cwd, etc.)
async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
    // Timeout fallback
    setTimeout(() => resolve({}), 2000);
  });
}

function loadDisabledSkills() {
  try {
    const settings = JSON.parse(readFileSync(join(homedir(), '.copilot', 'settings.json'), 'utf8'));
    return new Set(settings.disabledSkills ?? []);
  } catch (_) {
    return new Set();
  }
}

function parseSkillFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = match[1];
  const name = (fm.match(/^name:\s*(.+)$/m) || [])[1]?.trim();
  const desc = (fm.match(/^description:\s*(.+)$/m) || [])[1]?.trim();
  const when = (fm.match(/^when_to_use:\s*(.+)$/m) || [])[1]?.trim();
  const disableModelInvocation = /^disable-model-invocation:\s*true/m.test(fm);
  if (!name) return null;
  return { name, description: desc, whenToUse: when, disableModelInvocation };
}

function findSkills(dir) {
  const skills = [];
  try {
    const walk = (d) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(join(d, entry.name));
        else if (entry.name === 'SKILL.md') {
          const content = readFileSync(join(d, entry.name), 'utf8');
          const skill = parseSkillFrontmatter(content);
          if (skill) skills.push(skill);
        }
      }
    };
    walk(dir);
  } catch (_) {
    // skip unreadable dirs
  }
  return skills;
}

// Estimate tokens for a skill (mirrors Claude Code's 1536-char cap on description)
function estimateSkillTokens(skill) {
  if (skill.disableModelInvocation) return 0;
  const name = skill.name ?? '';
  const desc = (skill.description ?? '').slice(0, 1536);
  const when = (skill.whenToUse ?? '').slice(0, 1536);
  const text = [name, desc, when].filter(Boolean).join('\n');
  return Math.ceil(text.length / 4);
}

function respond(output) {
  process.stdout.write(JSON.stringify(output) + '\n');
  process.exit(0);
}

const ctx = await readStdin();
const prompt = ctx.prompt ?? '';

// Only intercept the startup budget-check prompt
if (prompt.trim() !== STARTUP_PROMPT) {
  respond({});
}

const disabledSkills = loadDisabledSkills();
const allSkills = SKILLS_DIRS.flatMap(findSkills);

// Filter disabled skills and deduplicate by name
const seen = new Set();
const activeSkills = allSkills.filter((s) => {
  if (disabledSkills.has(s.name) || seen.has(s.name)) return false;
  seen.add(s.name);
  return true;
});

const contextWindowTokens = parseInt(process.env.COPILOT_CONTEXT_WINDOW_TOKENS ?? '200000', 10);
const thresholdTokens = Math.floor(contextWindowTokens * 0.01); // 1%

const skillsWithTokens = activeSkills
  .map((s) => ({ ...s, tokens: estimateSkillTokens(s) }))
  .filter((s) => s.tokens > 0)
  .sort((a, b) => b.tokens - a.tokens);

const totalTokens = skillsWithTokens.reduce((sum, s) => sum + s.tokens, 0);
const usagePct = ((totalTokens / contextWindowTokens) * 100).toFixed(2);

if (totalTokens <= thresholdTokens) {
  respond({
    handled: true,
    handledBy: 'skills-budget-guard',
    responseContent: `✅ Skills context is within budget: ${totalTokens} tokens (${usagePct}% of ${contextWindowTokens.toLocaleString()} context window — limit is 1%). ${activeSkills.length} active skills.`,
  });
}

// Over budget — build warning
const top5 = skillsWithTokens.slice(0, 5);
const topList = top5.map((s) => `  • **${s.name}**: ~${s.tokens} tokens`).join('\n');

const warning = [
  `⚠️ **Skills Context Budget Exceeded**`,
  ``,
  `Active skills are using **${totalTokens} tokens** (${usagePct}% of context window). Limit is **1%** (~${thresholdTokens} tokens).`,
  ``,
  `Top contributors:`,
  topList,
  ``,
  `**To fix:** Add skill names to \`"disabledSkills"\` in \`~/.copilot/settings.json\`:`,
  `\`\`\`json`,
  `{`,
  `  "disabledSkills": [${top5.map((s) => `"${s.name}"`).join(', ')}]`,
  `}`,
  `\`\`\``,
].join('\n');

respond({
  handled: true,
  handledBy: 'skills-budget-guard',
  responseContent: warning,
});
