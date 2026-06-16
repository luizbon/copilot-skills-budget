---
name: switch-profile
description: Switch to a named skill profile, enabling and disabling skills accordingly. Usage /skills-budget:switch-profile <name>
---

Switch to a named skill profile. Skills in the profile will be enabled; all others will be disabled.

The profile name comes from the argument after the command. For example, if the user ran `/skills-budget:switch-profile work`, the name is `work`.

If no name was provided, respond: `❌ Usage: /skills-budget:switch-profile <name>`

## Steps

1. Read the profile file from `~/.copilot/plugin-data/skills-budget/profiles/<name>.json`.
   - If it doesn't exist, respond: `❌ Profile **<name>** not found. Use /skills-budget:list-profiles to see available profiles.`
   - Parse the JSON and extract the `enabledSkills` array.

2. Find all installed skill names by scanning `~/.copilot/installed-plugins/` recursively for directories that contain a `SKILL.md` file. The skill name is the directory name containing `SKILL.md`.

3. Compute disabled skills = all skill names NOT in `enabledSkills`.

4. Read `~/.copilot/settings.json` (create it as `{}` if absent). Update the `disabledSkills` field with the computed disabled list and write it back:
   ```json
   {
     "disabledSkills": ["skill3", "skill4"]
   }
   ```
   Preserve all other existing fields in settings.json.

5. Write the active profile pointer to `~/.copilot/plugin-data/skills-budget/active-profile.json`:
   ```json
   {"name": "<name>"}
   ```

6. Respond: `✅ Switched to profile **<name>**. N skills enabled, M skills disabled.`
