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
