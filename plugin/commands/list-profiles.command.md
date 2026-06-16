---
name: list-profiles
description: List all saved skill profiles, highlighting the currently active one.
---

List all saved skill profiles stored by the skills-budget plugin.

## Steps

1. Read the active profile name from `~/.copilot/plugin-data/skills-budget/active-profile.json`
   - Parse the JSON and read the `name` field
   - If the file doesn't exist, there is no active profile

2. List all profile files in `~/.copilot/plugin-data/skills-budget/profiles/`
   - Each file is named `<profile-name>.json`
   - The profile name is the filename without the `.json` extension

3. Display the result:
   ```
   **Skill profiles:**
   • **work** ← active
   • personal
   • minimal
   ```
   Mark the active profile with `← active` and bold it. If no profiles exist, say:
   > No profiles yet. Run `/skills-budget:save-profile <name>` to create one.
