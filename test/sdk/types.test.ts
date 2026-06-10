import { describe, expect, it } from "vitest";
import type { PluginWarningPayload } from "../../src/index.js";

describe("sdk types", () => {
  it("supports confidence mode and non-blocking contract", () => {
    const payload: PluginWarningPayload = {
      usagePct: 1.2,
      thresholdPct: 1,
      confidence: "estimated",
      blocksExecution: false,
      topContributors: [],
      message: "warn"
    };
    expect(payload.blocksExecution).toBe(false);
  });
});
