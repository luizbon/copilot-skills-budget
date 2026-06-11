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
    expect(result).toHaveProperty("confidence", "estimated");
    expect(result).toHaveProperty("countedSkills", 1);
    expect(result).toHaveProperty("warning");
    expect(result).toHaveProperty("contextPayload");
  });

  it("dist sdk/plugin entrypoint exports createSkillsBudgetPlugin as a function", async () => {
    const mod = await import("../dist/sdk/plugin.js");
    expect(typeof mod.createSkillsBudgetPlugin).toBe("function");
  });

  it("createSkillsBudgetPlugin from dist returns onStartup and onFirstRequest hooks", async () => {
    const { createSkillsBudgetPlugin } = await import("../dist/sdk/plugin.js");
    const plugin = createSkillsBudgetPlugin({
      notify: () => {},
      setContextNode: () => {},
      contextWindowTokens: 200_000,
      skills: [{ name: "test-skill", description: "A test skill" }],
    });
    expect(typeof plugin.onStartup).toBe("function");
    expect(typeof plugin.onFirstRequest).toBe("function");
  });

  it("createSkillsBudgetPlugin onStartup returns BudgetGuardResult shape", async () => {
    const { createSkillsBudgetPlugin } = await import("../dist/sdk/plugin.js");
    const plugin = createSkillsBudgetPlugin({
      notify: () => {},
      setContextNode: () => {},
      contextWindowTokens: 200_000,
      skills: [{ name: "test-skill", description: "A test skill" }],
    });
    const result = plugin.onStartup();
    expect(result).toHaveProperty("confidence", "estimated");
    expect(result).toHaveProperty("contextPayload");
    expect(result).toHaveProperty("countedSkills", 1);
  });
});
