---
name: delete-profile
description: Delete a named skill profile. Usage /skills-budget:delete-profile <name>
---

Delete a named skill profile permanently.

The profile name comes from the argument after the command. For example, if the user ran `/skills-budget:delete-profile work`, the name is `work`.

If no name was provided, respond: `❌ Usage: /skills-budget:delete-profile <name>`

## Steps

1. Read the active profile name from `~/.copilot/plugin-data/skills-budget/active-profile.json` (parse the `name` field).

2. If the name to delete matches the active profile, respond:
   `❌ Cannot delete the active profile **<name>**. Switch to another profile first.`

3. Check that `~/.copilot/plugin-data/skills-budget/profiles/<name>.json` exists.
   - If not, respond: `❌ Profile **<name>** not found.`

4. Delete the file `~/.copilot/plugin-data/skills-budget/profiles/<name>.json`.

5. Respond: `✅ Profile **<name>** deleted.`
