import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join, resolve, sep } from 'path';
import { homedir } from 'os';

export const PROFILES_DIR = join(homedir(), '.copilot', 'plugin-data', 'skills-budget', 'profiles');
export const ACTIVE_FILE  = join(homedir(), '.copilot', 'plugin-data', 'skills-budget', 'active-profile.json');

function ensureDir() {
  mkdirSync(PROFILES_DIR, { recursive: true });
}

function validateProfileName(name) {
  const resolved = resolve(PROFILES_DIR, `${name}.json`);
  if (!resolved.startsWith(PROFILES_DIR + sep)) {
    throw new Error(`Invalid profile name: "${name}"`);
  }
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
  validateProfileName(name);
  try {
    return JSON.parse(readFileSync(join(PROFILES_DIR, `${name}.json`), 'utf8'));
  } catch (_) {
    return null;
  }
}

export function saveProfile(name, enabledSkills) {
  validateProfileName(name);
  ensureDir();
  writeFileSync(
    join(PROFILES_DIR, `${name}.json`),
    JSON.stringify({ name, enabledSkills }, null, 2) + '\n',
    'utf8'
  );
}

export function listProfiles() {
  ensureDir();
  return readdirSync(PROFILES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace(/\.json$/, ''));
}

export function deleteProfile(name) {
  validateProfileName(name);
  rmSync(join(PROFILES_DIR, `${name}.json`), { force: true });
}

export function ensureDefaultProfile(allInstalledSkillNames, disabledSkills) {
  if (loadProfile('default')) return; // already exists
  const disabled = disabledSkills instanceof Set ? disabledSkills : new Set(disabledSkills);
  const enabledSkills = allInstalledSkillNames.filter(n => !disabled.has(n));
  saveProfile('default', enabledSkills);
  if (!loadActiveProfile()) saveActiveProfile('default');
}
