import { describe, expect, it } from "vitest";
import { renderWarning } from "../src/warning";

describe("renderWarning", () => {
  it("renders usage, threshold, top contributors, and disable hints", () => {
    const msg = renderWarning({
      usagePct: 1.42,
      thresholdPct: 1,
      topContributors: [{ name: "plugin:big-skill", tokens: 1200 }],
    });

    expect(msg).toContain("1.42%");
    expect(msg).toContain("plugin:big-skill");
    expect(msg).toContain("disable");
  });
});
