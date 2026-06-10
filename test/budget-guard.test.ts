import { describe, expect, it } from "vitest";
import { evaluateBudget } from "../src/budget-guard";

describe("evaluateBudget", () => {
  it("returns over-threshold with top 5 contributors", () => {
    const result = evaluateBudget({
      contextWindowTokens: 200000,
      thresholdPct: 1,
      skills: Array.from({ length: 7 }, (_, i) => ({
        name: `s${i}`,
        tokens: 500 + i * 100,
      })),
    });

    expect(result.isOverThreshold).toBe(true);
    expect(result.topContributors).toHaveLength(5);
    expect(result.usagePct).toBeGreaterThan(1);
  });
});
