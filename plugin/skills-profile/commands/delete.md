---
description: "Delete a skill profile."
---
Extract the profile name from the user's message (any text after "delete" or "/skills-profile:delete"). If no name was provided, first run:

```bash
"$HOME/.copilot/plugin-data/skills-profile/run.sh" list
```

to show available profiles, then ask the user which one to delete. Then run:

```bash
"$HOME/.copilot/plugin-data/skills-profile/run.sh" delete NAME
```

using the bash tool. Display the output.
