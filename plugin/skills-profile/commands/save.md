---
description: "Save current enabled skills as a named profile."
---
Extract the profile name from the user's message (any text after "save" or "/skills-profile:save"). If no name was provided, ask the user for one. Then use the bash tool to run:

```bash
"$HOME/.copilot/plugin-data/skills-profile/run.sh" save NAME
```

where NAME is the profile name. Display the output.
