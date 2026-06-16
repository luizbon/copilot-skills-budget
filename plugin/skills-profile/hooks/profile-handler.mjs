#!/usr/bin/env node
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  loadActiveProfile, loadProfile, saveProfile,
  listProfiles, deleteProfile, ensureDefaultProfile, applyProfile,
} from './profile.mjs';

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

function findSkills(dir, disabledSkills) {
  const skills = [];

  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch (_) { return; }

    const hasSkillMd = entries.some(e => !e.isDirectory() && e.name === 'SKILL.md');

    if (hasSkillMd) {
      const filePath = join(d, 'SKILL.md');
      const content = readFileSync(filePath, 'utf8');
      const skill = parseSkillFrontmatter(content);
      if (skill) skills.push(skill);
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

function respond(output) {
  process.stdout.write(JSON.stringify(output) + '\n');
  process.exit(0);
}

function respondProfileError(err) {
  const message = err instanceof Error ? err.message : String(err);
  respond({ handled: true, handledBy: 'skills-profile-guard', responseContent: `❌ ${message}` });
}

const ctx = await readStdin();
const prompt = (ctx.prompt ?? '').trim();

// Normalise colon format from CLI autocomplete: /skills-profile:list → /skills-profile list
const normalizedPrompt = prompt.replace(/^\/skills-profile:(\S*)(.*)/, '/skills-profile $1$2');

if (!normalizedPrompt.startsWith('/skills-profile ')) {
  respond({});
}

let allSkillNames;
let disabledForProfiles;
try {
  allSkillNames = getAllInstalledSkillNames();
  disabledForProfiles = loadDisabledSkills();
  ensureDefaultProfile(allSkillNames, disabledForProfiles);
} catch (err) {
  respondProfileError(err);
}

if (normalizedPrompt === '/skills-profile list') {
  try {
    const profiles = listProfiles();
    const active = loadActiveProfile();
    const lines = profiles.map(p => p === active ? `• **${p}** ← active` : `• ${p}`);
    respond({
      handled: true,
      handledBy: 'skills-profile-guard',
      responseContent: lines.length
        ? `**Skill profiles:**\n${lines.join('\n')}`
        : 'No profiles yet. Run `/skills-profile save <name>` to create one.',
    });
  } catch (err) { respondProfileError(err); }
}

if (normalizedPrompt.startsWith('/skills-profile save')) {
  try {
    const name = normalizedPrompt.slice('/skills-profile save'.length).trim();
    if (!name) respond({ handled: true, handledBy: 'skills-profile-guard', responseContent: '❌ Usage: `/skills-profile save <name>`' });
    const enabled = allSkillNames.filter(n => !disabledForProfiles.has(n));
    saveProfile(name, enabled);
    respond({ handled: true, handledBy: 'skills-profile-guard', responseContent: `✅ Profile **${name}** saved with ${enabled.length} enabled skills.` });
  } catch (err) { respondProfileError(err); }
}

if (normalizedPrompt === '/skills-profile update') {
  try {
    const active = loadActiveProfile();
    if (!active) respond({ handled: true, handledBy: 'skills-profile-guard', responseContent: '❌ No active profile. Run `/skills-profile save <name>` first.' });
    const enabled = allSkillNames.filter(n => !disabledForProfiles.has(n));
    saveProfile(active, enabled);
    respond({ handled: true, handledBy: 'skills-profile-guard', responseContent: `✅ Profile **${active}** updated with ${enabled.length} enabled skills.` });
  } catch (err) { respondProfileError(err); }
}

if (normalizedPrompt.startsWith('/skills-profile switch')) {
  try {
    const name = normalizedPrompt.slice('/skills-profile switch'.length).trim();
    if (!name) respond({ handled: true, handledBy: 'skills-profile-guard', responseContent: '❌ Usage: `/skills-profile switch <name>`' });
    if (!loadProfile(name)) respond({ handled: true, handledBy: 'skills-profile-guard', responseContent: `❌ Profile **${name}** not found. Use \`/skills-profile list\` to see available profiles.` });
    applyProfile(name, allSkillNames);
    const profile = loadProfile(name);
    respond({
      handled: true,
      handledBy: 'skills-profile-guard',
      responseContent: `✅ Switched to profile **${name}** (${profile.enabledSkills.length} skills enabled). Restart your session to apply the new skill set.`,
    });
  } catch (err) { respondProfileError(err); }
}

if (normalizedPrompt.startsWith('/skills-profile delete')) {
  try {
    const name = normalizedPrompt.slice('/skills-profile delete'.length).trim();
    if (!name) respond({ handled: true, handledBy: 'skills-profile-guard', responseContent: '❌ Usage: `/skills-profile delete <name>`' });
    const active = loadActiveProfile();
    if (name === active) respond({ handled: true, handledBy: 'skills-profile-guard', responseContent: `❌ Cannot delete the active profile **${name}**. Switch to another profile first.` });
    if (!loadProfile(name)) respond({ handled: true, handledBy: 'skills-profile-guard', responseContent: `❌ Profile **${name}** not found.` });
    deleteProfile(name);
    respond({ handled: true, handledBy: 'skills-profile-guard', responseContent: `✅ Profile **${name}** deleted.` });
  } catch (err) { respondProfileError(err); }
}

// No specific subcommand matched — show usage
respond({
  handled: true,
  handledBy: 'skills-profile-guard',
  responseContent: [
    '**skills-profile subcommands:**',
    '  • `/skills-profile list` — list all profiles',
    '  • `/skills-profile save <name>` — save current skills as a profile',
    '  • `/skills-profile switch <name>` — switch to a profile',
    '  • `/skills-profile update` — overwrite active profile with current skills',
    '  • `/skills-profile delete <name>` — delete a profile',
  ].join('\n'),
});
