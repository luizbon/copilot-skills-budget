# Copilot Instructions

## Project Overview

This repo has two deliverables that share the same source:

1. **SDK library** (`skills-context-budget-guard`) — TypeScript package that estimates skill-description token usage and emits warning/report payloads. Published from `src/`, built to `dist/`.
2. **Copilot CLI plugin** (`plugin/`) — A zero-model-call plugin that hooks into `userPromptSubmitted` to run the budget check and surface warnings on session start. Packaged as `skills-budget-plugin.zip` on GitHub Releases.

The plugin does **not** use the built `dist/` output — it ships its own standalone `hooks/budget-check.mjs`. The SDK and plugin are independently versioned (`package.json` vs `plugin/plugin.json`).

## Commands

```bash
npm install          # install dev dependencies
npm run build        # compile src/ → dist/ (tsc -p tsconfig.build.json)
npm run typecheck    # type-check without emitting
npm run lint         # eslint
npm test             # run unit tests (excludes release-smoke.test.ts)
npm run test:watch   # vitest watch mode

# Run a single test file
npx vitest run test/preflight.test.ts

# Run release smoke tests (requires a built dist/ first)
npm run test:release
```

## Architecture

```
src/
  budget-guard.ts          # pure evaluateBudget() — token math only
  skill-index.ts           # buildSkillIndexText() — normalises skill text with char cap
  warning.ts               # renderWarning() — formats the human-readable warning string
  context-report.ts        # buildContextReportPayload() — builds the structured context node
  preflight.ts             # runSkillsBudgetPreflight() — thin public entry point for SDK consumers
  sdk/
    budget-guard-service.ts # runBudgetGuard() — orchestrates the above, handles modes & confidence
    plugin.ts               # createSkillsBudgetPlugin() — lifecycle hooks (onStartup/onFirstRequest)
    adapter.ts              # createSdkAdapter() — publish context/warning via injected deps
    types.ts                # shared SDK types (ConfidenceMode, PluginWarningPayload)
  index.ts                 # re-exports everything; defines the public API surface

plugin/
  plugin.json              # plugin metadata (name, version, hooks ref, commands ref)
  hooks/hooks.json         # declares userPromptSubmitted → budget-check.mjs
  hooks/budget-check.mjs   # self-contained Node script; no dependency on dist/
  commands/skills-budget.md # slash command definition
```

Data flow: `runBudgetGuard` → `buildSkillIndexText` (cap text) → `estimateTokensFromText` (÷4 heuristic) → `evaluateBudget` (token math) → `renderWarning` + `buildContextReportPayload`.

## Key Conventions

- **Token estimation**: `Math.ceil(text.length / 4)`. This is intentionally approximate — confidence is `"estimated"` at startup and `"full"` only after `onFirstRequest` when the full skill API is available.
- **`disableModelInvocation` flag**: Skills with this flag set to `true` are excluded from the budget count entirely (they don't contribute to context).
- **Threshold config**: `skillsContextWarningThresholdPct` takes precedence over the legacy `thresholdPct` alias; both default to `1` (%).
- **`charCap`**: Combined `description + whenToUse` text is capped at `1536` chars per skill before token estimation (`DEFAULT_SKILL_TEXT_CHAR_CAP`).
- **ESM only**: `"type": "module"` in `package.json`; all imports in `src/` must use `.js` extensions (NodeNext resolution).
- **Test split**: `vitest.config.ts` runs all unit tests; `vitest.release.config.ts` runs only `test/release-smoke.test.ts` (imports from `dist/`, requires a build first).
- **Release**: Tag `vX.Y.Z` → GitHub Actions builds the plugin zip and publishes a release. SDK version is in `package.json`; plugin version is in `plugin/plugin.json` (patched during CI from the tag).
