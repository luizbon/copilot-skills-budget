# skills-context-budget-guard

Utility for estimating startup skill-description token usage and returning warning/report payloads.

## Usage

```ts
import { runSkillsBudgetPreflight } from "skills-context-budget-guard";

const result = runSkillsBudgetPreflight({
  contextWindowTokens: 200000,
  skills: [
    { name: "plugin:foo", description: "...", whenToUse: "..." },
  ],
});
```

`result.warning` is populated only when usage exceeds the configured threshold.

## Config options

- `skillsContextWarningThresholdPct` (default: `1`)
  - Warning threshold (% of model context window).
  - Backward-compatible alias: `thresholdPct`.
- `skillsDescriptionCharCap` (default: `1536`)
  - Per-skill max description/when-to-use characters counted toward token estimate.

## Payload contract

`result.contextPayload` includes:

- `kind: "skills-context-budget"`
- `totalTokens`, `usagePct`, `thresholdPct`, `isOverThreshold`
- `topContributors`
- `blocksExecution: false` (warning flow is non-blocking by design)
