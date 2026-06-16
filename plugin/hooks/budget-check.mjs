#!/usr/bin/env node
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  loadActiveProfile, loadProfile, saveProfile,
  listProfiles, deleteProfile, ensureDefaultProfile, applyProfile,
} from './profile.mjs';

const STARTUP_PROMPT = 'Check my skills context budget and report any warnings';

function getBuiltinSkillsDir() {
  const pkgDir = join(homedir(), '.copilot', 'pkg', `${process.platform}-${process.arch}`);
  try {
    const versions = readdirSync(pkgDir).sort().reverse(); // newest first
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

function getAllInstalledSkillNames() {
  return SKILLS_DIRS
    .flatMap(d => findSkills(d, new Set()))
    .map(s => s.name)
    .filter((n, i, arr) => arr.indexOf(n) === i);
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

  // Collect total tokens for a subtree (sub-skills roll up to parent)
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
      // This directory is a root skill — aggregate tokens from all sub-skills
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
      // Do NOT recurse further — sub-skills are rolled up, not listed individually
    } else {
      // No SKILL.md here — keep descending, checking disabled dirs
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

// Estimate tokens for a skill (mirrors Claude Code's 1536-char cap on description)
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

function respondProfileError(err) {
  const message = err instanceof Error ? err.message : String(err);
  respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: `❌ ${message}` });
}

const ctx = await readStdin();
const prompt = (ctx.prompt ?? '').trim();

// ── /skills trigger ───────────────────────────────────────────────────────────
const SKILLS_TRIGGER = /^\/skills(\s+(enable|disable|toggle)\s+\S+)?$/;
const isSkillsCommand = SKILLS_TRIGGER.test(prompt);

// ── profile commands ─────────────────────────────────────────────────────────
// Normalise colon format from CLI autocomplete: /skills-budget:list-profiles → /skills-budget list-profiles
const normalizedPrompt = prompt.replace(/^\/skills-budget:(\S*)(.*)/, '/skills-budget $1$2');
const isProfileCommand = normalizedPrompt.startsWith('/skills-budget ');

if (!isSkillsCommand && normalizedPrompt !== STARTUP_PROMPT && !isProfileCommand) {
  respond({});
}

let shouldContinueToBudgetCheck = false;

if (isProfileCommand) {
  let allSkillNames;
  let disabledForProfiles;
  try {
    allSkillNames = getAllInstalledSkillNames();
    disabledForProfiles = loadDisabledSkills();
    ensureDefaultProfile(allSkillNames, disabledForProfiles);
  } catch (err) {
    respondProfileError(err);
  }

  if (normalizedPrompt === '/skills-budget list-profiles') {
    try {
      const profiles = listProfiles();
      const active = loadActiveProfile();
      const lines = profiles.map(p => p === active ? `• **${p}** ← active` : `• ${p}`);
      respond({
        handled: true,
        handledBy: 'skills-budget-guard',
        responseContent: lines.length
          ? `**Skill profiles:**\n${lines.join('\n')}`
          : 'No profiles yet. Run `/skills-budget save-profile <name>` to create one.',
      });
    } catch (err) { respondProfileError(err); }
  }

  if (normalizedPrompt.startsWith('/skills-budget save-profile')) {
    try {
      const name = normalizedPrompt.slice('/skills-budget save-profile'.length).trim();
      if (!name) respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: '❌ Usage: `/skills-budget save-profile <name>`' });
      const enabled = allSkillNames.filter(n => !disabledForProfiles.has(n));
      saveProfile(name, enabled);
      respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: `✅ Profile **${name}** saved with ${enabled.length} enabled skills.` });
    } catch (err) { respondProfileError(err); }
  }

  if (normalizedPrompt === '/skills-budget update-profile') {
    try {
      const active = loadActiveProfile();
      if (!active) respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: '❌ No active profile. Run `/skills-budget save-profile <name>` first.' });
      const enabled = allSkillNames.filter(n => !disabledForProfiles.has(n));
      saveProfile(active, enabled);
      respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: `✅ Profile **${active}** updated with ${enabled.length} enabled skills.` });
    } catch (err) { respondProfileError(err); }
  }

  if (normalizedPrompt.startsWith('/skills-budget switch-profile')) {
    try {
      const name = normalizedPrompt.slice('/skills-budget switch-profile'.length).trim();
      if (!name) respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: '❌ Usage: `/skills-budget switch-profile <name>`' });
      if (!loadProfile(name)) respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: `❌ Profile **${name}** not found. Use \`/skills-budget list-profiles\` to see available profiles.` });
      applyProfile(name, allSkillNames);
      shouldContinueToBudgetCheck = true;
    } catch (err) { respondProfileError(err); }
  }

  if (normalizedPrompt.startsWith('/skills-budget delete-profile')) {
    try {
      const name = normalizedPrompt.slice('/skills-budget delete-profile'.length).trim();
      if (!name) respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: '❌ Usage: `/skills-budget delete-profile <name>`' });
      const active = loadActiveProfile();
      if (name === active) respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: `❌ Cannot delete the active profile **${name}**. Switch to another profile first.` });
      if (!loadProfile(name)) respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: `❌ Profile **${name}** not found.` });
      deleteProfile(name);
      respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: `✅ Profile **${name}** deleted.` });
    } catch (err) { respondProfileError(err); }
  }

  // No specific subcommand matched — show usage rather than falling through to the model
  if (!shouldContinueToBudgetCheck) {
    respond({
      handled: true,
      handledBy: 'skills-budget-guard',
      responseContent: [
        '**skills-budget subcommands:**',
        '  • `/skills-budget list-profiles` — list all profiles',
        '  • `/skills-budget save-profile <name>` — save current skills as a profile',
        '  • `/skills-budget switch-profile <name>` — switch to a profile',
        '  • `/skills-budget update-profile` — overwrite active profile with current skills',
        '  • `/skills-budget delete-profile <name>` — delete a profile',
      ].join('\n'),
    });
  }
}

if (!isSkillsCommand && prompt !== STARTUP_PROMPT && !shouldContinueToBudgetCheck) {
  respond({});
}

const disabledSkills = loadDisabledSkills();
const allSkills = SKILLS_DIRS.flatMap((d) => findSkills(d, disabledSkills));

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
  const activeProfile = loadActiveProfile();
  const profileSuffix = activeProfile ? ` (profile: **${activeProfile}**)` : '';
  respond({
    handled: true,
    handledBy: 'skills-budget-guard',
    responseContent: `✅ Skills context is within budget: ${totalTokens} tokens (${usagePct}% of ${contextWindowTokens.toLocaleString()} context window — limit is 1%). ${activeSkills.length} active skills.${profileSuffix}`,
  });
}

// Over budget — build warning
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
