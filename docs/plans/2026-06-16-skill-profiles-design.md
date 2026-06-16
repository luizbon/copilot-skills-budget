# Skill Profiles Design

**Date:** 2026-06-16  
**Status:** Approved

## Overview

Add named skill profiles to the skills-budget plugin. A profile is an allowlist of enabled skills. Switching profiles recomputes `disabledSkills` in `~/.copilot/settings.json` so newly installed skills are never silently enabled by a profile that predates them.

## Storage

```
~/.copilot/plugin-data/skills-budget/
  profiles/
    default.json
    lightweight.json
    ...
  active-profile.json
```

**Profile file** (`profiles/<name>.json`):
```json
{ "name": "lightweight", "enabledSkills": ["skill-a", "skill-b"] }
```

**Active pointer** (`active-profile.json`):
```json
{ "name": "lightweight" }
```

On first use of any profile command, a `default` profile is auto-created from the current set of non-disabled skills.

## Activation logic

When switching to a profile:

1. Read `profile.enabledSkills`
2. Discover all currently installed skills
3. Set `disabledSkills = allSkills − enabledSkills` in `~/.copilot/settings.json`
4. Write the profile name to `active-profile.json`
5. Run and print the budget check inline

## Slash commands

| Command | Action |
|---|---|
| `/skills-budget save-profile <name>` | Create a new named profile from current enabled skills |
| `/skills-budget update-profile` | Overwrite the **active** profile with current enabled skills |
| `/skills-budget switch-profile <name>` | Activate profile, recompute `disabledSkills`, print budget |
| `/skills-budget list-profiles` | List all profiles, highlight the active one |
| `/skills-budget delete-profile <name>` | Delete a profile (blocked if it is the active profile) |

## Budget check triggers

The budget check runs automatically when:

- **Session start** — existing behaviour via startup prompt hook
- **`switch-profile` / `update-profile`** — printed inline as part of command output
- **`/skills enable|disable|toggle <name>`** — detected in `userPromptSubmitted` hook by matching the prompt pattern
- **`/skills` (no args)** — interactive picker; budget runs after submission, detected the same way

## Implementation notes

- All profile logic extracted to a new `profile.mjs` module, imported by `budget-check.mjs`
- Slash commands registered as `commands` entries in `plugin.json`, each calling `budget-check.mjs` with a subcommand argument dispatched internally
- The session-start budget output gains an active profile suffix: `✅ … (profile: lightweight)`
- `loadDisabledSkills()` gains a companion `loadActiveProfile()` — no breaking changes to existing behaviour
- Profile commands guard against missing/corrupt files and surface clear error messages

## Out of scope

- Profile import/export (future)
- Profile sharing between users (future)
- UI in VS Code (future)
