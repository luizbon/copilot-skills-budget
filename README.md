# skills-context-budget-guard

Warns when installed Copilot skill descriptions exceed 1% of the model context window.

Includes two integration paths:

- **Copilot CLI plugin** — shows a budget check on every session start (no model call)
- **SDK library** — TypeScript package for host integrations (e.g. VS Code extensions)

---

## Copilot CLI Plugin

### How it works

1. On session start, a startup prompt fires automatically before you type anything
2. A `userPromptSubmitted` hook intercepts it, computes the budget, and returns a warning or a green light — with no model invocation

### Quick install

**1. Add the marketplace (once)**

```bash
copilot plugin marketplace add luizbon/copilot-skills-budget
```

**2. Install the plugin**

```bash
copilot plugin install skills-budget@luizbon-skills-budget
```

**3. Create the startup hook file**

The startup prompt must live in `~/.copilot/hooks/` (user-level hooks dir, not the plugin dir):

```bash
mkdir -p ~/.copilot/hooks
cat > ~/.copilot/hooks/skills-budget.json << 'HOOK'
{
  "version": 1,
  "hooks": {
    "sessionStart": [
      {
        "type": "prompt",
        "prompt": "Check my skills context budget and report any warnings"
      }
    ]
  }
}
HOOK
```

**4. Start a new Copilot session**

```bash
copilot
```

You'll see the budget check result before your first message.

### Uninstall

```bash
copilot plugin uninstall skills-budget
rm ~/.copilot/hooks/skills-budget.json
```

### Managing skills

To disable a skill that contributes too many tokens, add its name to `~/.copilot/settings.json`:

```json
{
  "disabledSkills": [
    "some-heavy-skill",
    "another-skill"
  ]
}
```

Skill names come from the `name:` field in each skill's `SKILL.md` frontmatter.

### Example output

**Under budget:**
```
✅ Skills context is within budget: 1602 tokens (0.80% of 200,000 context window — limit is 1%). 35 active skills.
```

**Over budget:**
```
⚠️ Skills Context Budget Exceeded

Active skills are using 2,150 tokens (1.07% of context window). Limit is 1% (~2,000 tokens).

Top contributors:
  • some-heavy-skill: ~420 tokens
  • another-big-skill: ~380 tokens
  ...

To fix: Add skill names to "disabledSkills" in ~/.copilot/settings.json
```

---

## SDK Library

Utility for estimating startup skill-description token usage and returning warning/report payloads.

### Install

```bash
npm install skills-context-budget-guard
```

### Usage

```ts
import { runSkillsBudgetPreflight } from "skills-context-budget-guard";

const result = runSkillsBudgetPreflight({
  contextWindowTokens: 200000,
  skills: [
    { name: "plugin:foo", description: "...", whenToUse: "..." },
  ],
});

if (result.warning) {
  console.warn(result.warning);
}
```

### Config options

| Option | Default | Description |
|---|---|---|
| `skillsContextWarningThresholdPct` | `1` | Warning threshold (% of context window). Alias: `thresholdPct` |
| `skillsDescriptionCharCap` | `1536` | Cap on combined `description + whenToUse` chars per skill |

### Result shape

```ts
{
  warning?: string;           // human-readable warning, present only when over threshold
  contextPayload: {
    kind: "skills-context-budget";
    totalTokens: number;
    usagePct: number;
    thresholdPct: number;
    isOverThreshold: boolean;
    topContributors: { name: string; tokens: number }[];
    blocksExecution: false;   // warning-only, never blocks
  };
  confidence: "estimated" | "full";
}
```

### SDK Plugin

For host integrations with lifecycle hooks:

```ts
import { createSkillsBudgetPlugin } from 'skills-context-budget-guard/sdk/plugin';

const plugin = createSkillsBudgetPlugin({
  notify: (msg) => console.warn(msg),
  setContextNode: (key, payload) => telemetry.set(key, payload),
  contextWindowTokens: 200000,
  skills: [{ name: 'plugin:foo', description: '...', whenToUse: '...' }],
});

host.onStartup(() => plugin.onStartup());
host.onFirstRequest(() => plugin.onFirstRequest());
```

---

## Development

```bash
npm install
npm run build
npm test
```

### Release

Tag a commit to trigger the GitHub Actions release pipeline:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This builds and publishes `skills-budget-plugin.zip` + `install.sh` to GitHub Releases.
