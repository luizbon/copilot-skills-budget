import { describe, expect, it } from "vitest";
import { runSkillsBudgetPreflight } from "../src/index";

describe("smoke", () => {
  it("exports preflight function", () => {
    expect(typeof runSkillsBudgetPreflight).toBe("function");
  });
});
