---
description: "Switch to a named skill profile."
---
Extract the profile name from the user's message (any text after "switch" or "/skills-profile:switch"). If no name was provided, first run:

```bash
"$HOME/.copilot/plugin-data/skills-profile/run.sh" list
```

to show available profiles, then ask the user which one to switch to. Then run:

```bash
"$HOME/.copilot/plugin-data/skills-profile/run.sh" switch NAME
```

using the bash tool. Display the output.
