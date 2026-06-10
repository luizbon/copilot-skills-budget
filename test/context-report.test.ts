import { describe, expect, it } from "vitest";
import { buildContextReportPayload } from "../src/context-report";

describe("buildContextReportPayload", () => {
  it("builds a context report payload with usage metrics", () => {
    const payload = buildContextReportPayload({
      totalTokens: 2840,
      usagePct: 1.42,
      thresholdPct: 1,
      isOverThreshold: true,
      topContributors: [{ name: "plugin:big-skill", tokens: 1200 }],
    });

    expect(payload).toMatchObject({
      kind: "skills-context-budget",
      usagePct: 1.42,
      thresholdPct: 1,
      isOverThreshold: true,
      totalTokens: 2840,
    });
    expect(payload.topContributors[0]?.name).toBe("plugin:big-skill");
  });
});
