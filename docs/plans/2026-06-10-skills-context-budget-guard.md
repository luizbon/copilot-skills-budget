# Skills Context Budget Guard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Copilot CLI extension module that warns before task execution when startup skill descriptions exceed a configurable context budget (default 1%).

**Architecture:** Build a small TypeScript package with six core modules: skill catalog loader, description normalizer, token estimator, budget guard, warning renderer, and context reporter. Drive development with TDD: each module gets failing unit tests first, then minimal implementation. Wire a preflight entrypoint that returns a non-blocking warning payload and `/context` metrics data.

**Tech Stack:** Node.js 20+, TypeScript, Vitest, ESLint, npm. Use @test-driven-development and @verification-before-completion during execution.

---

### Task 1: Bootstrap project and test harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/index.ts`
- Create: `test/smoke.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { runSkillsBudgetPreflight } from "../src/index";

describe("smoke", () => {
  it("exports preflight function", () => {
    expect(typeof runSkillsBudgetPreflight).toBe("function");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run test/smoke.test.ts`  
Expected: FAIL with module/export missing error.

**Step 3: Write minimal implementation**

```ts
export function runSkillsBudgetPreflight(): null {
  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run test/smoke.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts src/index.ts test/smoke.test.ts
git commit -m "chore: bootstrap skills budget extension package"
```

### Task 2: Build skill index normalizer (Claude-like description cap)

**Files:**
- Create: `src/skill-index.ts`
- Create: `test/skill-index.test.ts`
- Modify: `src/index.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildSkillIndexText } from "../src/skill-index";

it("caps description+whenToUse at configured char cap", () => {
  const text = buildSkillIndexText({
    description: "a".repeat(1200),
    whenToUse: "b".repeat(1200),
    charCap: 1536
  });
  expect(text.length).toBe(1536);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run test/skill-index.test.ts`  
Expected: FAIL because `buildSkillIndexText` does not exist.

**Step 3: Write minimal implementation**

```ts
export function buildSkillIndexText(input: {
  description?: string;
  whenToUse?: string;
  charCap: number;
}): string {
  const combined = `${input.description ?? ""}\n${input.whenToUse ?? ""}`.trim();
  return combined.slice(0, input.charCap);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run test/skill-index.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/skill-index.ts test/skill-index.test.ts src/index.ts
git commit -m "feat: add skill index text normalizer with cap"
```

### Task 3: Implement budget math and top-5 contributor ranking

**Files:**
- Create: `src/budget-guard.ts`
- Create: `test/budget-guard.test.ts`
- Modify: `src/index.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { evaluateBudget } from "../src/budget-guard";

it("returns over-threshold with top 5 contributors", () => {
  const result = evaluateBudget({
    contextWindowTokens: 200000,
    thresholdPct: 1,
    skills: Array.from({ length: 7 }, (_, i) => ({ name: `s${i}`, tokens: 500 + i * 100 }))
  });
  expect(result.isOverThreshold).toBe(true);
  expect(result.topContributors).toHaveLength(5);
  expect(result.usagePct).toBeGreaterThan(1);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run test/budget-guard.test.ts`  
Expected: FAIL because `evaluateBudget` does not exist.

**Step 3: Write minimal implementation**

```ts
export function evaluateBudget(input: {
  contextWindowTokens: number;
  thresholdPct: number;
  skills: { name: string; tokens: number }[];
}) {
  const totalTokens = input.skills.reduce((sum, s) => sum + s.tokens, 0);
  const usagePct = (totalTokens / input.contextWindowTokens) * 100;
  const topContributors = [...input.skills]
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 5);
  return {
    totalTokens,
    usagePct,
    isOverThreshold: usagePct > input.thresholdPct,
    topContributors
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run test/budget-guard.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/budget-guard.ts test/budget-guard.test.ts src/index.ts
git commit -m "feat: add skills budget evaluation and top contributor ranking"
```

### Task 4: Add warning renderer and context report payload

**Files:**
- Create: `src/warning.ts`
- Create: `src/context-report.ts`
- Create: `test/warning.test.ts`
- Create: `test/context-report.test.ts`
- Modify: `src/index.ts`

**Step 1: Write the failing test**

```ts
import { it, expect } from "vitest";
import { renderWarning } from "../src/warning";

it("renders usage, threshold, top contributors, and disable hints", () => {
  const msg = renderWarning({
    usagePct: 1.42,
    thresholdPct: 1,
    topContributors: [{ name: "plugin:big-skill", tokens: 1200 }]
  });
  expect(msg).toContain("1.42%");
  expect(msg).toContain("plugin:big-skill");
  expect(msg).toContain("disable");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run test/warning.test.ts`  
Expected: FAIL because `renderWarning` does not exist.

**Step 3: Write minimal implementation**

```ts
export function renderWarning(input: {
  usagePct: number;
  thresholdPct: number;
  topContributors: { name: string; tokens: number }[];
}) {
  return [
    `Skill descriptions use ${input.usagePct.toFixed(2)}% of context (threshold ${input.thresholdPct.toFixed(2)}%).`,
    "Top contributors:",
    ...input.topContributors.map((x) => `- ${x.name}: ${x.tokens} tokens`),
    "Disable hints:",
    "- disable bundled skills in config",
    "- disable specific plugin skills",
    "- set disable-model-invocation: true for manual-only skills"
  ].join("\n");
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run test/warning.test.ts test/context-report.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/warning.ts src/context-report.ts test/warning.test.ts test/context-report.test.ts src/index.ts
git commit -m "feat: add warning and context metrics payload"
```

### Task 5: Wire preflight orchestrator and exclusion rules

**Files:**
- Create: `src/preflight.ts`
- Create: `test/preflight.test.ts`
- Modify: `src/index.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { runSkillsBudgetPreflight } from "../src/index";

it("excludes disable-model-invocation skills from startup budget", () => {
  const result = runSkillsBudgetPreflight({
    contextWindowTokens: 200000,
    thresholdPct: 1,
    skills: [
      { name: "auto-skill", description: "x".repeat(3000), disableModelInvocation: false },
      { name: "manual-skill", description: "x".repeat(3000), disableModelInvocation: true }
    ]
  });
  expect(result.countedSkills).toBe(1);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run test/preflight.test.ts`  
Expected: FAIL because orchestrator behavior is missing.

**Step 3: Write minimal implementation**

```ts
export function runSkillsBudgetPreflight(input: PreflightInput): PreflightResult {
  const eligible = input.skills.filter((s) => !s.disableModelInvocation);
  // normalize -> estimate -> evaluate -> render warning if over threshold
  return { countedSkills: eligible.length, warning: null, contextNode: {} };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run test/preflight.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/preflight.ts src/index.ts test/preflight.test.ts
git commit -m "feat: wire preflight budget guard orchestrator"
```

### Task 6: End-to-end verification and developer docs

**Files:**
- Create: `README.md`
- Create: `test/e2e-preflight.test.ts`
- Modify: `package.json`

**Step 1: Write the failing test**

```ts
import { it, expect } from "vitest";
import { runSkillsBudgetPreflight } from "../src";

it("returns non-blocking warning payload when over threshold", () => {
  const res = runSkillsBudgetPreflight(/* fixture over 1% */);
  expect(res.warning).toBeTruthy();
  expect(res.blocksExecution).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run test/e2e-preflight.test.ts`  
Expected: FAIL until full wiring is complete.

**Step 3: Write minimal implementation**

```md
## Configuration
- `skillsContextWarningThresholdPct` (default `1`)
- `skillsDescriptionCharCap` (default `1536`)
```

**Step 4: Run full test suite**

Run: `npm test`  
Expected: PASS all tests.

**Step 5: Commit**

```bash
git add README.md package.json test/e2e-preflight.test.ts
git commit -m "docs: add usage and verify end-to-end budget warning flow"
```

### Task 7: Release prep checklist

**Files:**
- Modify: `README.md`
- Modify: `package.json`

**Step 1: Verify lint and typecheck**

Run: `npm run lint && npm run typecheck`  
Expected: PASS.

**Step 2: Verify tests**

Run: `npm test`  
Expected: PASS.

**Step 3: Generate changelog entry**

```md
### Added
- Startup warning for skill description context over configurable threshold.
```

**Step 4: Tag release candidate**

Run: `npm version prerelease --preid=rc`  
Expected: version bump commit and tag.

**Step 5: Commit**

```bash
git add README.md package.json
git commit -m "chore: prepare rc for skills context budget guard"
```
