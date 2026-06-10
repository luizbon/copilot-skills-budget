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
});
