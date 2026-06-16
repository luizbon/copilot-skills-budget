---
name: update-profile
description: Overwrite the active skill profile with the current set of enabled skills.
---

Update the currently active profile to reflect the current set of enabled skills.

## Steps

1. Read the active profile name from `~/.copilot/plugin-data/skills-budget/active-profile.json` (parse the `name` field).
   - If the file doesn't exist or has no name, respond: `❌ No active profile. Run /skills-budget:save-profile <name> first.`

2. Read `~/.copilot/settings.json` and extract the `disabledSkills` array (may be absent — treat as empty).

3. Find all installed skill names by scanning `~/.copilot/installed-plugins/` recursively for directories that contain a `SKILL.md` file. The skill name is the directory name containing `SKILL.md`.

4. Compute enabled skills = all skill names NOT in `disabledSkills`.

5. Overwrite the profile file at `~/.copilot/plugin-data/skills-budget/profiles/<active-name>.json`:
   ```json
   {"name": "<active-name>", "enabledSkills": ["skill1", "skill2"]}
   ```

6. Respond: `✅ Profile **<active-name>** updated with N enabled skills.`
