---
name: save-profile
description: Save current enabled skills as a named profile. Usage /skills-budget:save-profile <name>
---

Save the current set of enabled skills as a named profile.

The profile name comes from the argument after the command. For example, if the user ran `/skills-budget:save-profile work`, the name is `work`.

If no name was provided, respond: `❌ Usage: /skills-budget:save-profile <name>`

## Steps

1. Read `~/.copilot/settings.json` and extract the `disabledSkills` array (may be absent — treat as empty).

2. Find all installed skill names by scanning `~/.copilot/installed-plugins/` recursively for directories that contain a `SKILL.md` file. The skill name is the directory name containing `SKILL.md`.

3. Compute enabled skills = all skill names NOT in `disabledSkills`.

4. Ensure the directory exists: `~/.copilot/plugin-data/skills-budget/profiles/`

5. Write the profile file to `~/.copilot/plugin-data/skills-budget/profiles/<name>.json`:
   ```json
   {"name": "<name>", "enabledSkills": ["skill1", "skill2"]}
   ```

6. Write the active profile pointer to `~/.copilot/plugin-data/skills-budget/active-profile.json`:
   ```json
   {"name": "<name>"}
   ```

7. Respond: `✅ Profile **<name>** saved with N enabled skills.`

