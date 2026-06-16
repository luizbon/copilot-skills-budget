#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir, tmpdir } from 'os';
import { execFileSync } from 'child_process';
import {
  loadActiveProfile, saveActiveProfile, loadProfile, saveProfile,
  listProfiles, deleteProfile, ensureDefaultProfile, applyProfile,
} from './profile.mjs';

const STARTUP_PROMPT = 'Check my skills context budget and report any warnings';
const UPDATE_COMMAND = '/update-skills-budget';
const REPO = 'luizbon/copilot-skills-budget';
const GITHUB_API = `https://api.github.com/repos/${REPO}/releases/latest`;

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
  respond({
    handled: true,
    handledBy: 'skills-budget-guard',
    responseContent: `❌ ${message}`,
  });
}

// ── version helpers ──────────────────────────────────────────────────────────

function getCurrentVersion() {
  try {
    const root = process.env.COPILOT_PLUGIN_ROOT;
    if (!root) return '0.0.0';
    return JSON.parse(readFileSync(join(root, 'plugin.json'), 'utf8')).version ?? '0.0.0';
  } catch (_) { return '0.0.0'; }
}

function semverGt(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

async function fetchRelease() {
  const res = await fetch(GITHUB_API, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'copilot-skills-budget' },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

async function checkForUpdate() {
  try {
    const data = await fetchRelease();
    const latest = (data.tag_name ?? '').replace(/^v/, '');
    if (semverGt(latest, getCurrentVersion())) {
      return `\n\n💡 **Update available:** \`v${latest}\` — run \`${UPDATE_COMMAND}\` to upgrade`;
    }
  } catch (_) {}
  return '';
}

// ── update command ───────────────────────────────────────────────────────────

async function performUpdate() {
  const current = getCurrentVersion();
  let data;
  try { data = await fetchRelease(); }
  catch (err) { return `❌ Failed to fetch release info: ${err.message}`; }

  const latest = (data.tag_name ?? '').replace(/^v/, '');

  if (!semverGt(latest, current)) {
    return `✅ Already on the latest version \`v${current}\``;
  }

  const zipAsset = data.assets?.find(a => a.name === 'skills-budget-plugin.zip');
  if (!zipAsset) return '❌ Release zip not found in latest release assets';

  let zipRes;
  try { zipRes = await fetch(zipAsset.browser_download_url, { headers: { 'User-Agent': 'copilot-skills-budget' } }); }
  catch (err) { return `❌ Failed to download update: ${err.message}`; }
  if (!zipRes.ok) return `❌ Download failed (HTTP ${zipRes.status})`;

  const pluginRoot = process.env.COPILOT_PLUGIN_ROOT;
  if (!pluginRoot) return '❌ COPILOT_PLUGIN_ROOT not set — cannot determine install path';

  const tmpDir = join(tmpdir(), `skills-budget-update-${Date.now()}`);
  try {
    mkdirSync(tmpDir, { recursive: true });
    const zipPath = join(tmpDir, 'update.zip');
    writeFileSync(zipPath, Buffer.from(await zipRes.arrayBuffer()));

    const extractDir = join(tmpDir, 'extracted');
    mkdirSync(extractDir, { recursive: true });

    if (process.platform === 'win32') {
      execFileSync('pwsh', ['-Command', `Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${extractDir}'`]);
    } else {
      execFileSync('unzip', ['-o', zipPath, '-d', extractDir]);
    }

    cpSync(extractDir, pluginRoot, { recursive: true, force: true });
    return `✅ Updated \`v${current}\` → \`v${latest}\` — restart Copilot to apply`;
  } catch (err) {
    return `❌ Update failed: ${err.message}`;
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

const ctx = await readStdin();
const prompt = (ctx.prompt ?? '').trim();

// Handle update slash command
if (prompt === UPDATE_COMMAND) {
  const result = await performUpdate();
  respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: result });
}

// ── /skills trigger ───────────────────────────────────────────────────────────
const SKILLS_TRIGGER = /^\/skills(\s+(enable|disable|toggle)\s+\S+)?$/;
const isSkillsCommand = SKILLS_TRIGGER.test(prompt);

// ── profile commands ─────────────────────────────────────────────────────────

const budgetProfilePrompt =
  prompt === STARTUP_PROMPT ||
  prompt === '/skills-budget list-profiles' ||
  prompt === '/skills-budget update-profile' ||
  prompt.startsWith('/skills-budget save-profile') ||
  prompt.startsWith('/skills-budget switch-profile') ||
  prompt.startsWith('/skills-budget delete-profile');

if (!isSkillsCommand && prompt !== STARTUP_PROMPT && !budgetProfilePrompt) {
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

let shouldContinueToBudgetCheck = false;

if (prompt === '/skills-budget list-profiles') {
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
  } catch (err) {
    respondProfileError(err);
  }
}

if (prompt.startsWith('/skills-budget save-profile')) {
  try {
    const name = prompt.slice('/skills-budget save-profile'.length).trim();
    if (!name) respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: '❌ Usage: `/skills-budget save-profile <name>`' });
    const enabled = allSkillNames.filter(n => !disabledForProfiles.has(n));
    saveProfile(name, enabled);
    respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: `✅ Profile **${name}** saved with ${enabled.length} enabled skills.` });
  } catch (err) {
    respondProfileError(err);
  }
}

if (prompt === '/skills-budget update-profile') {
  try {
    const active = loadActiveProfile();
    if (!active) respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: '❌ No active profile. Run `/skills-budget save-profile <name>` first.' });
    const enabled = allSkillNames.filter(n => !disabledForProfiles.has(n));
    saveProfile(active, enabled);
    respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: `✅ Profile **${active}** updated with ${enabled.length} enabled skills.` });
  } catch (err) {
    respondProfileError(err);
  }
}

if (prompt.startsWith('/skills-budget switch-profile')) {
  try {
    const name = prompt.slice('/skills-budget switch-profile'.length).trim();
    if (!name) respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: '❌ Usage: `/skills-budget switch-profile <name>`' });
    if (!loadProfile(name)) respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: `❌ Profile **${name}** not found. Use \`/skills-budget list-profiles\` to see available profiles.` });
    applyProfile(name, allSkillNames);
    shouldContinueToBudgetCheck = true;
    // Fall through to budget check so user sees result immediately
  } catch (err) {
    respondProfileError(err);
  }
}

if (prompt.startsWith('/skills-budget delete-profile')) {
  try {
    const name = prompt.slice('/skills-budget delete-profile'.length).trim();
    if (!name) respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: '❌ Usage: `/skills-budget delete-profile <name>`' });
    const active = loadActiveProfile();
    if (name === active) respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: `❌ Cannot delete the active profile **${name}**. Switch to another profile first.` });
    if (!loadProfile(name)) respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: `❌ Profile **${name}** not found.` });
    deleteProfile(name);
    respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: `✅ Profile **${name}** deleted.` });
  } catch (err) {
    respondProfileError(err);
  }
}

// ── /skills trigger ───────────────────────────────────────────────────────────
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

// Run version check in parallel with the rest of message building
const updateNoticePromise = checkForUpdate();

if (totalTokens <= thresholdTokens) {
  const updateNotice = await updateNoticePromise;
  const activeProfile = loadActiveProfile();
  const profileSuffix = activeProfile ? ` (profile: **${activeProfile}**)` : '';
  respond({
    handled: true,
    handledBy: 'skills-budget-guard',
    responseContent: `✅ Skills context is within budget: ${totalTokens} tokens (${usagePct}% of ${contextWindowTokens.toLocaleString()} context window — limit is 1%). ${activeSkills.length} active skills.${profileSuffix}${updateNotice}`,
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

const updateNotice = await updateNoticePromise;
respond({
  handled: true,
  handledBy: 'skills-budget-guard',
  responseContent: warning + updateNotice,
});
