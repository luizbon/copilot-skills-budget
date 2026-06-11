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
  - `skills` — array of skill metadata ({ name, description, whenToUse }).
 
- Optional runtime flag (behavior-changing):
  - `supportsFullSkillApi?` (boolean) — when true the plugin may call the host's full skill API to perform a precise "full" recompute; enables more accurate results at runtime cost.
 
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

