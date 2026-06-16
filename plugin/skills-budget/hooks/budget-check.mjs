#!/usr/bin/env node
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const STARTUP_PROMPT = 'Check my skills context budget and report any warnings';
const ACTIVE_PROFILE_FILE = join(homedir(), '.copilot', 'plugin-data', 'skills-profile', 'active-profile.json');

function getBuiltinSkillsDir() {
  const pkgDir = join(homedir(), '.copilot', 'pkg', `${process.platform}-${process.arch}`);
  try {
    const versions = readdirSync(pkgDir).sort().reverse();
    for (const v of versions) {
      const d = join(pkgDir, v, 'builtin-skills');
      try { readdirSync(d); return d; } catch (_) {}
    }
  } catch (_) {}
  return null;
}

const SKILLS_DIRS = [
  join(homedir(), '.copilot', 'installed-plugins'),
  join(homedir(), '.copilot', 'skills'),
  join(homedir(), '.agents', 'skills'),
];

const builtinDir = getBuiltinSkillsDir();
if (builtinDir) SKILLS_DIRS.push(builtinDir);

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
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

function loadActiveProfile() {
  try {
    return JSON.parse(readFileSync(ACTIVE_PROFILE_FILE, 'utf8')).name ?? null;
  } catch (_) {
    return null;
  }
}

function parseSkillFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const fm = match[1];
  const name = (fm.match(/^name:\s*(.+)$/m) || [])[1]?.trim();
  const desc = (fm.match(/^description:\s*(.+)$/m) || [])[1]?.trim();
  const when = (fm.match(/^when_to_use:\s*(.+)$/m) || [])[1]?.trim();
  const disableModelInvocation = /^disable-model-invocation:\s*true/m.test(fm);
  if (!name) return null;
  return { name, description: desc, whenToUse: when, disableModelInvocation };
}

function skillSource(filePath) {
  if (filePath.includes('/builtin-skills/')) return 'builtin';
  if (filePath.includes('/.agents/skills/')) return 'agents';
  if (filePath.includes('/.copilot/skills/')) return 'copilot';
  const m = filePath.match(/installed-plugins\/([^/]+)\//);
  return m ? `plugin:${m[1]}` : 'unknown';
}

function findSkills(dir, disabledSkills) {
  const skills = [];

  function collectSubTokens(d) {
    let total = 0;
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch (_) { return total; }
    for (const e of entries) {
      if (e.isDirectory()) total += collectSubTokens(join(d, e.name));
      else if (e.name === 'SKILL.md') {
        const c = readFileSync(join(d, e.name), 'utf8');
        const s = parseSkillFrontmatter(c);
        if (s) total += estimateSkillTokens(s);
      }
    }
    return total;
  }

  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch (_) { return; }

    const hasSkillMd = entries.some(e => !e.isDirectory() && e.name === 'SKILL.md');

    if (hasSkillMd) {
      const filePath = join(d, 'SKILL.md');
      const content = readFileSync(filePath, 'utf8');
      const skill = parseSkillFrontmatter(content);
      if (skill) {
        let tokens = estimateSkillTokens(skill);
        for (const e of entries) {
          if (e.isDirectory()) tokens += collectSubTokens(join(d, e.name));
        }
        skills.push({ ...skill, source: skillSource(filePath), precomputedTokens: tokens });
      }
    } else {
      for (const e of entries) {
        if (e.isDirectory()) {
          if (disabledSkills.has(e.name)) continue;
          walk(join(d, e.name));
        }
      }
    }
  }

  walk(dir);
  return skills;
}

function estimateSkillTokens(skill) {
  if (skill.disableModelInvocation) return 0;
  if ('precomputedTokens' in skill) return skill.precomputedTokens;
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
const prompt = (ctx.prompt ?? '').trim();

const SKILLS_TRIGGER = /^\/skills(\s+(enable|disable|toggle)\s+\S+)?$/;
const isSkillsCommand = SKILLS_TRIGGER.test(prompt);

if (!isSkillsCommand && prompt !== STARTUP_PROMPT) {
  respond({});
}

const disabledSkills = loadDisabledSkills();
const allSkills = SKILLS_DIRS.flatMap((d) => findSkills(d, disabledSkills));

const seen = new Set();
const activeSkills = allSkills.filter((s) => {
  if (disabledSkills.has(s.name) || seen.has(s.name)) return false;
  seen.add(s.name);
  return true;
});

const contextWindowTokens = parseInt(process.env.COPILOT_CONTEXT_WINDOW_TOKENS ?? '200000', 10);
const thresholdTokens = Math.floor(contextWindowTokens * 0.01);

const skillsWithTokens = activeSkills
  .map((s) => ({ ...s, tokens: estimateSkillTokens(s) }))
  .filter((s) => s.tokens > 0)
  .sort((a, b) => b.tokens - a.tokens);

const totalTokens = skillsWithTokens.reduce((sum, s) => sum + s.tokens, 0);
const usagePct = ((totalTokens / contextWindowTokens) * 100).toFixed(2);

if (totalTokens <= thresholdTokens) {
  const activeProfile = loadActiveProfile();
  const profileSuffix = activeProfile ? ` (profile: **${activeProfile}**)` : '';
  respond({
    handled: true,
    handledBy: 'skills-budget-guard',
    responseContent: `✅ Skills context is within budget: ${totalTokens} tokens (${usagePct}% of ${contextWindowTokens.toLocaleString()} context window — limit is 1%). ${activeSkills.length} active skills.${profileSuffix}`,
  });
}

const top5 = skillsWithTokens.slice(0, 5);
const topList = top5.map((s) => `  • **${s.name}** (${s.source}): ~${s.tokens} tokens`).join('\n');

const warning = [
  `⚠️ **Skills Context Budget Exceeded**`,
  ``,
  `Active skills are using **${totalTokens} tokens** (${usagePct}% of context window). Limit is **1%** (~${thresholdTokens} tokens).`,
  ``,
  `Top contributors:`,
  topList,
  ``,
  `**To fix:** Use \`/skills\` to toggle skills off, or add skill names to \`"disabledSkills"\` in \`~/.copilot/settings.json\`:`,
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
