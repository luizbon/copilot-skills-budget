import { describe, expect, it } from "vitest";
import { runSkillsBudgetPreflight } from "../src/index";

describe("e2e preflight", () => {
  it("returns a non-blocking warning payload when usage exceeds threshold", () => {
    const result = runSkillsBudgetPreflight({
      contextWindowTokens: 200000,
      thresholdPct: 1,
      skills: Array.from({ length: 6 }, (_, i) => ({
        name: `plugin:large-skill-${i}`,
        description: "x".repeat(10000),
        whenToUse: "Use this for everything.",
      })),
    });

    expect(result.warning).toBeTruthy();
    expect(result.contextPayload).toMatchObject({
      kind: "skills-context-budget",
      isOverThreshold: true,
      blocksExecution: false,
    });
  });
});
