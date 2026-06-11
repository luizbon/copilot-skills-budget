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
  - Caps the combined `description + whenToUse` text per skill when estimating token usage.

## Payload contract

`result.contextPayload` includes:

- `kind: "skills-context-budget"`
- `totalTokens`, `usagePct`, `thresholdPct`, `isOverThreshold`
- `topContributors`
- `blocksExecution: false` (warning flow is non-blocking by design)

## Changelog

### Added
- Startup warning for skill description context over configurable threshold.

## SDK Plugin Integration

- Import (example):
  ```ts
  import { createSkillsBudgetPlugin } from 'skills-context-budget-guard/sdk/plugin';
  ```
- Required host adapter callbacks (concise):
  - `notify` — emits operational warnings/events (e.g., notify(message)).
  - `setContextNode` — attach telemetry/context (e.g., setContextNode(key, payload)).
  - `contextWindowTokens` — host model context window size (number).
  - `skills` — array of skill metadata (`BudgetGuardSkill[]`):
    - `name: string` — unique skill identifier.
    - `description?: string` — optional description text (zero tokens if absent).
    - `whenToUse?: string` — optional; combined with `description`, capped at `skillsDescriptionCharCap` chars for estimation.
    - `disableModelInvocation?: boolean` — when `true`, skill is **excluded from token counting** entirely.
 
- Optional runtime flag (behavior-changing):
  - `supportsFullSkillApi?` (boolean) — when true and `onFirstRequest()` is called, `confidence` in the result is reported as `"full"` rather than `"estimated"`. The token calculation uses the same estimation path regardless; this flag signals host intent (that the skills list reflects the actual runtime set) rather than triggering an alternative computation.

- Skills array shape (`skills: BudgetGuardSkill[]`):
  - `name: string` — unique skill identifier.
  - `description?: string` — skill description text (optional; contributes zero tokens if absent).
  - `whenToUse?: string` — when-to-use text (optional; combined with `description` and capped at `skillsDescriptionCharCap` chars per skill for estimation).
  - `disableModelInvocation?: boolean` — when `true` the skill is **excluded entirely** from token counting. Use for skills that are present in the registry but should not count toward the context budget.
 
- Register hooks on the host (example):
  - onStartup: run the plugin preflight check during host startup.
  - onFirstRequest: run an estimation on the host's first request when startup work is deferred. The plugin publishes warnings and context via the provided adapter callbacks (notify/setContextNode); the returned BudgetGuardResult is for inspection or logging only.
 
- Consuming the result (concise): both onStartup() and onFirstRequest() return a BudgetGuardResult. Consume and act on these fields:
  - `warning` — human-readable warning message (present only when over threshold).
  - `contextPayload` — detailed report: { kind, totalTokens, usagePct, thresholdPct, isOverThreshold, topContributors, blocksExecution }.
  - `confidence` — `"estimated" | "full"` indicating estimate vs full recompute confidence.

- Configuration defaults:
  - `skillsContextWarningThresholdPct`: `1` (1% of model context window; alias: `thresholdPct`)
  - `skillsDescriptionCharCap`: `1536` (caps combined `description + whenToUse` chars per-skill for token estimation)

- Minimal example (host wiring):
  ```ts
  const plugin = createSkillsBudgetPlugin({
    notify: (m) => console.warn(m),
    setContextNode: (k, p) => /* attach to telemetry */ null,
    contextWindowTokens: 200000,
    skills: [{ name: 'plugin:foo', description: '...', whenToUse: '...' }],
  });

  // register lifecycle
  host.onStartup(() => plugin.onStartup());
  host.onFirstRequest(() => plugin.onFirstRequest());
  ```

