# Copilot CLI SDK Skills Budget Integration Design

**Date:** 2026-06-10  
**Status:** Approved  
**Target:** Copilot CLI extension/plugin via SDK (not core patch)

## Goal

Run skills-context budget checks automatically when Copilot starts, then refresh with full accuracy on first request.

## Why SDK Plugin

Direct core patch risks being overwritten by updates unless merged upstream.  
SDK plugin keeps behavior modular, upgrade-friendly, and loadable by Copilot as an extension.

## Architecture (Dual-Mode)

Create plugin: `skills-context-budget`.

Plugin registers two lifecycle hooks:

1. **Startup hook (estimate mode):** Fast estimate from discoverable skill metadata index.  
2. **First-request hook (full mode):** Full recompute from resolved active skill set.

Shared service: `BudgetGuardService`.

Service outputs:
- usage percent
- threshold percent
- top five skill contributors
- warning message payload
- confidence mode (`estimated` or `full`)

## Data Flow

### Startup Estimate

1. Read available skill descriptors.
2. Build index text from `description + when_to_use`.
3. Exclude `disable-model-invocation` skills.
4. Cap each skill text at 1536 chars.
5. Estimate token usage and compare with threshold (default 1%).
6. If over threshold, show advisory warning.

### First-Request Full Check

1. Read resolved active skills for the request.
2. Recompute usage with full available data.
3. Refresh warning content and confidence marker.
4. Publish metrics node to context panel/API.

## UX Contract

Warning must include:
- current usage % and threshold %
- top five contributors
- concrete mitigation suggestions:
  - disable unneeded skills
  - mark manual-only skills `disable-model-invocation: true`
  - shorten verbose `description/when_to_use`

Warning is non-blocking.

## Reliability and Compatibility

- Never block startup or prompt execution.
- If skills API is unavailable, keep estimate-only path enabled.
- If context window is unknown, use model defaults and mark as estimated.
- If one skill fails parsing, skip it and log debug warning.
- Enforce minimum SDK version and feature-flag full-check path.

## Testing Strategy

### Unit
- cap behavior and normalization
- exclusion rules
- threshold boundaries (below/equal/above)
- top-five ranking stability

### Integration
- startup estimate warning path
- first-request full refresh path
- warning payload shape contract

### Contract
- plugin behavior against supported SDK versions

### E2E
- start Copilot with synthetic skill sets
- verify startup warning and refreshed first-request warning
- verify context metrics node shows computed values

## Out of Scope

- hard-blocking Copilot execution
- auto-disabling skills
- core Copilot CLI source patching

## Success Criteria

1. Startup warning appears when estimated skills budget exceeds threshold.  
2. First request recalculates and updates warning with full-confidence data.  
3. Warning includes actionable disable guidance and top contributors.  
4. Plugin remains update-safe across normal Copilot CLI upgrades.
