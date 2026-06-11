SDK Plugin Host Integration Notes

Setup

1. Install the SDK package and import the plugin factory:

```ts
import { createSkillsBudgetPlugin } from 'skills-context-budget-guard/sdk/plugin';
```

2. Create the plugin with required host adapter callbacks and runtime options:

```ts
const plugin = createSkillsBudgetPlugin({
  // Host adapter callbacks (required)
  notify: (message) => console.warn(message),
  setContextNode: (key, payload) => {/* attach context to host telemetry */},

  // Runtime options (required)
  contextWindowTokens: 200000,
  skills: [
    { name: 'plugin:foo', description: '...', whenToUse: '...'},
  ],

  // Optional tuning
  skillsContextWarningThresholdPct: 1, // default: 1 (alias: thresholdPct)
  skillsDescriptionCharCap: 1536, // caps combined `description + whenToUse` chars per-skill for token estimation

  // Optional (behavior-changing):
  // supportsFullSkillApi?: true,
  // When true and onFirstRequest() runs, `confidence` is reported as "full" rather than "estimated".
  // The token estimation path is identical; this flag signals that the skills list reflects the
  // actual runtime set, not an alternative computation.
  //
  // skills with disableModelInvocation: true are excluded from token counting entirely:
  // skills: [
  //   { name: 'plugin:foo', description: '...', whenToUse: '...'},
  //   { name: 'plugin:bar', disableModelInvocation: true }, // excluded from budget
  // ],
});
```

3. Register plugin with host lifecycle hooks:

- onStartup: run plugin preflight checks during host startup to compute initial usage and emit warnings.
- onFirstRequest: run an estimation on the host's first request when startup work is deferred. The plugin publishes warnings/reports via the provided adapter callbacks (notify/setContextNode); the returned BudgetGuardResult is for inspection/logging only.

Example (pseudo-host):

```ts
// register lifecycle (plugin publishes via adapter callbacks)
host.onStartup(() => {
  const res = plugin.onStartup(); // BudgetGuardResult
  // res is available for inspection or logging, e.g.:
  // if (res.warning) console.warn(res.warning);
});

host.onFirstRequest(() => {
  const res = plugin.onFirstRequest(); // BudgetGuardResult
  // res.confidence indicates estimate vs full recompute; plugin already published results via adapter callbacks
});
```

Operational guidance

- Warnings are non-blocking: the plugin emits a payload (warning/report) and does not block request execution by default. The emitted payload includes `blocksExecution` (boolean, default: `false`) to indicate if the host should block execution.
- Tune `skillsContextWarningThresholdPct` to control sensitivity; default is 1% of model context window (alias: `thresholdPct`).
- Monitor `topContributors` from the emitted payload to find large skill descriptions and trim or cap them.
- `skillsDescriptionCharCap` caps combined `description + whenToUse` characters per-skill when estimating tokens.
- Log/alert when `isOverThreshold` is true so operators can take action.


Notes

- Keep the integration lightweight; the plugin is intended for estimation and operational insight, not enforcement.
