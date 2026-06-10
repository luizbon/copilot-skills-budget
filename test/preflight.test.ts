import { describe, expect, it } from "vitest";
import { runSkillsBudgetPreflight } from "../src/index";

describe("runSkillsBudgetPreflight", () => {
  it("excludes disable-model-invocation skills from startup budget", () => {
    const result = runSkillsBudgetPreflight({
      contextWindowTokens: 200000,
      thresholdPct: 1,
      skills: [
        {
          name: "auto-skill",
          description: "x".repeat(3000),
          disableModelInvocation: false,
        },
        {
          name: "manual-skill",
          description: "x".repeat(3000),
          disableModelInvocation: true,
        },
      ],
    });

    expect(result.countedSkills).toBe(1);
  });
});
