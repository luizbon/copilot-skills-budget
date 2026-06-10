import { describe, expect, it } from "vitest";

describe("release smoke", () => {
  it("dist entrypoint exports runSkillsBudgetPreflight as a function", async () => {
    const mod = await import("../dist/index.js");
    expect(typeof mod.runSkillsBudgetPreflight).toBe("function");
  });

  it("runSkillsBudgetPreflight from dist returns expected shape", async () => {
    const { runSkillsBudgetPreflight } = await import("../dist/index.js");
    const result = runSkillsBudgetPreflight({
      contextWindowTokens: 200_000,
      skills: [{ name: "test-skill", description: "A test skill" }],
    });
    expect(result).toHaveProperty("countedSkills", 1);
    expect(result).toHaveProperty("warning");
    expect(result).toHaveProperty("contextPayload");
  });
});
