import { describe, expect, it } from "vitest";
import { buildSkillIndexText } from "../src/skill-index";

describe("buildSkillIndexText", () => {
  it("caps description+whenToUse at configured char cap", () => {
    const text = buildSkillIndexText({
      description: "a".repeat(1200),
      whenToUse: "b".repeat(1200),
      charCap: 1536,
    });
    expect(text.length).toBe(1536);
  });

  it("normalizes missing metadata fields without undefined text", () => {
    const text = buildSkillIndexText({
      charCap: 1536,
    });

    expect(text).toBe("");
    expect(text).not.toContain("undefined");
  });

  it("trims normalized text before applying char cap", () => {
    const text = buildSkillIndexText({
      whenToUse: "  needs help  ",
      charCap: 4,
    });

    expect(text).toBe("need");
  });
});
