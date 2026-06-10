import { describe, expect, it } from "vitest";
import { runBudgetGuard } from "../../src/sdk/budget-guard-service";

describe("runBudgetGuard", () => {
  it("returns estimated confidence in startup mode", () => {
    const result = runBudgetGuard({
      mode: "startup",
      contextWindowTokens: 200000,
      thresholdPct: 1,
      skills: [
        {
          name: "auto-skill",
          description: "x".repeat(3000),
          disableModelInvocation: false,
        },
      ],
    });

    expect(result.confidence).toBe("estimated");
  });

  it("returns full confidence in firstRequest mode", () => {
    const result = runBudgetGuard({
      mode: "firstRequest",
      contextWindowTokens: 200000,
      thresholdPct: 1,
      skills: [
        {
          name: "auto-skill",
          description: "x".repeat(3000),
          disableModelInvocation: false,
        },
      ],
    });

    expect(result.confidence).toBe("full");
  });
});
