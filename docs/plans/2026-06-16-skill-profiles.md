# Skill Profiles Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add named skill profiles to the skills-budget plugin — each profile is an allowlist of enabled skills, and switching profiles immediately rewrites `disabledSkills` in `~/.copilot/settings.json`.

**Architecture:** All profile logic lives in a new `plugin/hooks/profile.mjs` module imported by the existing `budget-check.mjs`. Five slash commands are added to `plugin.json`. The budget check is also triggered after `/skills` commands (detected by prompt pattern in the hook).

**Tech Stack:** Node.js ESM (`.mjs`), no new dependencies. Tests in Vitest + TypeScript under `test/`.

---

## Context

The existing hook (`plugin/hooks/budget-check.mjs`) intercepts every `userPromptSubmitted` event and:
- On the startup prompt → runs budget check
- On `/update-skills-budget` → self-updates the plugin

New commands follow the same dispatch pattern: read `ctx.prompt`, match it, handle it, call `respond()`.

Profile storage:
```
~/.copilot/plugin-data/skills-budget/
  profiles/
    default.json        ← { "name": "default", "enabledSkills": ["skill-a", ...] }
    lightweight.json
  active-profile.json   ← { "name": "default" }
```

---

## Task 1: Create `profile.mjs` — storage helpers

**Files:**
- Create: `plugin/hooks/profile.mjs`

### Step 1: Create the file with path constants and read/write helpers

```js
// plugin/hooks/profile.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export const PROFILES_DIR = join(homedir(), '.copilot', 'plugin-data', 'skills-budget', 'profiles');
export const ACTIVE_FILE  = join(homedir(), '.copilot', 'plugin-data', 'skills-budget', 'active-profile.json');

function ensureDir() {
  mkdirSync(PROFILES_DIR, { recursive: true });
}

export function loadActiveProfile() {
  try {
    return JSON.parse(readFileSync(ACTIVE_FILE, 'utf8')).name ?? null;
  } catch (_) {
    return null;
  }
}

export function saveActiveProfile(name) {
  ensureDir();
  writeFileSync(ACTIVE_FILE, JSON.stringify({ name }, null, 2) + '\n', 'utf8');
}

export function loadProfile(name) {
  try {
    return JSON.parse(readFileSync(join(PROFILES_DIR, `${name}.json`), 'utf8'));
  } catch (_) {
    return null;
  }
}

export function saveProfile(name, enabledSkills) {
  ensureDir();
  writeFileSync(
    join(PROFILES_DIR, `${name}.json`),
    JSON.stringify({ name, enabledSkills }, null, 2) + '\n',
    'utf8'
  );
}

export function listProfiles() {
  ensureDir();
  try {
    return readdirSync(PROFILES_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace(/\.json$/, ''));
  } catch (_) {
    return [];
  }
}

export function deleteProfile(name) {
  rmSync(join(PROFILES_DIR, `${name}.json`), { force: true });
}
```

### Step 2: Verify the file exists and has no syntax errors

```bash
node --input-type=module < plugin/hooks/profile.mjs
```
Expected: no output, exit 0.

### Step 3: Commit

```bash
git add plugin/hooks/profile.mjs
git commit -m "feat(profiles): add profile storage helpers"
```

---

## Task 2: Add `ensureDefaultProfile` helper

**Files:**
- Modify: `plugin/hooks/profile.mjs` (append)

When a profile command is run for the first time, auto-create a `default` profile from the current enabled skills.

### Step 1: Add the helper at the bottom of `profile.mjs`

```js
// Append to plugin/hooks/profile.mjs

export function ensureDefaultProfile(allInstalledSkillNames, disabledSkills) {
  if (loadProfile('default')) return; // already exists
  const enabledSkills = allInstalledSkillNames.filter(n => !disabledSkills.has(n));
  saveProfile('default', enabledSkills);
  if (!loadActiveProfile()) saveActiveProfile('default');
}
```

### Step 2: Verify syntax

```bash
node --input-type=module < plugin/hooks/profile.mjs
```
Expected: exit 0.

### Step 3: Commit

```bash
git add plugin/hooks/profile.mjs
git commit -m "feat(profiles): add ensureDefaultProfile auto-bootstrap"
```

---

## Task 3: Add `applyProfile` — write `disabledSkills` to settings.json

**Files:**
- Modify: `plugin/hooks/profile.mjs` (append)

### Step 1: Append to `profile.mjs`

```js
// Append to plugin/hooks/profile.mjs
import { existsSync } from 'fs';

const SETTINGS_PATH = join(homedir(), '.copilot', 'settings.json');

export function applyProfile(profileName, allInstalledSkillNames) {
  const profile = loadProfile(profileName);
  if (!profile) throw new Error(`Profile "${profileName}" not found`);

  const enabledSet = new Set(profile.enabledSkills);
  const disabledSkills = allInstalledSkillNames.filter(n => !enabledSet.has(n));

  let settings = {};
  try {
    settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
  } catch (_) {}

  settings.disabledSkills = disabledSkills;
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  saveActiveProfile(profileName);
}
```

### Step 2: Verify syntax

```bash
node --input-type=module < plugin/hooks/profile.mjs
```
Expected: exit 0.

### Step 3: Commit

```bash
git add plugin/hooks/profile.mjs
git commit -m "feat(profiles): add applyProfile — writes disabledSkills to settings.json"
```

---

## Task 4: Wire profile commands into `budget-check.mjs`

**Files:**
- Modify: `plugin/hooks/budget-check.mjs`

The five new commands:

| Prompt | Action |
|---|---|
| `/skills-budget save-profile <name>` | Create named profile from current enabled skills |
| `/skills-budget update-profile` | Overwrite active profile with current enabled skills |
| `/skills-budget switch-profile <name>` | Apply profile → rewrite settings.json → print budget |
| `/skills-budget list-profiles` | List all profiles, mark active |
| `/skills-budget delete-profile <name>` | Delete profile (guard: cannot delete active) |

### Step 1: Add import at top of `budget-check.mjs` (after existing imports)

```js
import {
  loadActiveProfile, saveActiveProfile, loadProfile, saveProfile,
  listProfiles, deleteProfile, ensureDefaultProfile, applyProfile,
  PROFILES_DIR,
} from './profile.mjs';
```

### Step 2: Add a helper to get all installed skill names (names only, ignoring disabled)

Add this function after `loadDisabledSkills()`:

```js
function getAllInstalledSkillNames() {
  // Scan all skill dirs with an empty disabled set to get every skill name
  return SKILLS_DIRS
    .flatMap(d => findSkills(d, new Set()))
    .map(s => s.name)
    .filter((n, i, arr) => arr.indexOf(n) === i); // dedupe
}
```

### Step 3: Add profile command handlers before the existing `if (prompt !== STARTUP_PROMPT)` guard

```js
// ── profile commands ─────────────────────────────────────────────────────────

const allSkillNames = getAllInstalledSkillNames();
const disabledForProfiles = loadDisabledSkills();
ensureDefaultProfile(allSkillNames, disabledForProfiles);

if (prompt === '/skills-budget list-profiles') {
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
}

if (prompt.startsWith('/skills-budget save-profile ')) {
  const name = prompt.slice('/skills-budget save-profile '.length).trim();
  if (!name) respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: '❌ Usage: `/skills-budget save-profile <name>`' });
  const enabled = allSkillNames.filter(n => !disabledForProfiles.has(n));
  saveProfile(name, enabled);
  respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: `✅ Profile **${name}** saved with ${enabled.length} enabled skills.` });
}

if (prompt === '/skills-budget update-profile') {
  const active = loadActiveProfile();
  if (!active) respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: '❌ No active profile. Run `/skills-budget save-profile <name>` first.' });
  const enabled = allSkillNames.filter(n => !disabledForProfiles.has(n));
  saveProfile(active, enabled);
  respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: `✅ Profile **${active}** updated with ${enabled.length} enabled skills.` });
}

if (prompt.startsWith('/skills-budget switch-profile ')) {
  const name = prompt.slice('/skills-budget switch-profile '.length).trim();
  if (!loadProfile(name)) respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: `❌ Profile **${name}** not found. Use \`/skills-budget list-profiles\` to see available profiles.` });
  applyProfile(name, allSkillNames);
  // Fall through to budget check so user sees the result immediately
}

if (prompt.startsWith('/skills-budget delete-profile ')) {
  const name = prompt.slice('/skills-budget delete-profile '.length).trim();
  const active = loadActiveProfile();
  if (name === active) respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: `❌ Cannot delete the active profile **${name}**. Switch to another profile first.` });
  if (!loadProfile(name)) respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: `❌ Profile **${name}** not found.` });
  deleteProfile(name);
  respond({ handled: true, handledBy: 'skills-budget-guard', responseContent: `✅ Profile **${name}** deleted.` });
}

// ── /skills trigger ───────────────────────────────────────────────────────────
const SKILLS_TRIGGER = /^\/skills(\s+(enable|disable|toggle)\s+\S+)?$/;
const isSkillsCommand = SKILLS_TRIGGER.test(prompt);
// For /skills commands, fall through to budget check (skip the startup-only guard below)
if (!isSkillsCommand && prompt !== STARTUP_PROMPT) {
  respond({});
}
```

### Step 4: Remove the old `if (prompt !== STARTUP_PROMPT)` guard

Find and remove this block (it's replaced by the logic above):

```js
// Only intercept the startup budget-check prompt
if (prompt !== STARTUP_PROMPT) {
  respond({});
}
```

### Step 5: Update the under-budget response to include active profile name

Find the line:
```js
responseContent: `✅ Skills context is within budget: ${totalTokens} tokens (${usagePct}% of ${contextWindowTokens.toLocaleString()} context window — limit is 1%). ${activeSkills.length} active skills.${updateNotice}`,
```

Replace with:
```js
const activeProfile = loadActiveProfile();
const profileSuffix = activeProfile ? ` (profile: **${activeProfile}**)` : '';
responseContent: `✅ Skills context is within budget: ${totalTokens} tokens (${usagePct}% of ${contextWindowTokens.toLocaleString()} context window — limit is 1%). ${activeSkills.length} active skills.${profileSuffix}${updateNotice}`,
```

### Step 6: Smoke test — check no syntax errors

```bash
node --check plugin/hooks/budget-check.mjs
```
Expected: exit 0, no output.

### Step 7: Commit

```bash
git add plugin/hooks/budget-check.mjs
git commit -m "feat(profiles): wire profile commands into budget-check hook"
```

---

## Task 5: Register slash commands in `plugin.json`

**Files:**
- Modify: `plugin/plugin.json`

### Step 1: Add `commands` array to `plugin.json`

```json
{
  "name": "skills-budget",
  "description": "Warns when installed skill descriptions exceed context budget (default 1% of context window)",
  "version": "0.1.5",
  "author": { "name": "Luiz Bon", "url": "https://github.com/luizbon" },
  "repository": "https://github.com/luizbon/copilot-skills-budget",
  "license": "MIT",
  "keywords": ["skills", "budget", "context-window", "copilot", "monitoring"],
  "hooks": "./hooks/hooks.json",
  "mcpServers": {},
  "commands": [
    {
      "name": "save-profile",
      "description": "Save current enabled skills as a named profile. Usage: /skills-budget save-profile <name>"
    },
    {
      "name": "update-profile",
      "description": "Overwrite the active profile with current enabled skills."
    },
    {
      "name": "switch-profile",
      "description": "Switch to a named skill profile. Usage: /skills-budget switch-profile <name>"
    },
    {
      "name": "list-profiles",
      "description": "List all skill profiles, highlighting the active one."
    },
    {
      "name": "delete-profile",
      "description": "Delete a named skill profile. Usage: /skills-budget delete-profile <name>"
    }
  ]
}
```

### Step 2: Also bump version in `marketplace.json`

In `.github/plugin/marketplace.json`, update the plugin entry's `"version"` to `"0.1.5"`.

### Step 3: Commit

```bash
git add plugin/plugin.json .github/plugin/marketplace.json
git commit -m "feat(profiles): register slash commands, bump version to 0.1.5"
```

---

## Task 6: Manual smoke test

### Step 1: Reinstall the plugin from local path temporarily

```bash
copilot plugin uninstall skills-budget
copilot plugin install ./plugin
```

### Step 2: Run each command in a new Copilot session

```
/skills-budget list-profiles
```
Expected: shows `default` profile marked as active (auto-created).

```
/skills-budget save-profile lightweight
```
Expected: `✅ Profile lightweight saved with N enabled skills.`

```
/skills-budget list-profiles
```
Expected: shows both `default` and `lightweight`, `default` still active.

```
/skills-budget switch-profile lightweight
```
Expected: budget check runs, output includes `(profile: **lightweight**)`.

```
/skills-budget update-profile
```
Expected: `✅ Profile lightweight updated with N enabled skills.`

```
/skills-budget delete-profile default
```
Expected: `✅ Profile default deleted.`

```
/skills-budget delete-profile lightweight
```
Expected: `❌ Cannot delete the active profile lightweight.`

### Step 3: Reinstall from marketplace

```bash
copilot plugin uninstall skills-budget
copilot plugin install skills-budget@luizbon-skills-budget
```

---

## Task 7: Tag and release

### Step 1: Tag

```bash
git tag -a v0.1.5 -m "v0.1.5: skill profiles"
git push && git push origin v0.1.5
```

Expected: GitHub Actions release pipeline fires, produces `skills-budget-plugin.zip`.
