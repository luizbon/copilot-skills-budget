import { describe, expect, it, vi } from "vitest";
import { createSdkAdapter } from "skills-context-budget-guard/sdk/adapter";
import type { PluginWarningPayload } from "skills-context-budget-guard/sdk/types";

describe("createSdkAdapter", () => {
  it("publishWarning sends warning message via notify and context payload via setContextNode", () => {
    const notifyFn = vi.fn();
    const setContextNodeFn = vi.fn();

    const adapter = createSdkAdapter({
      notify: notifyFn,
      setContextNode: setContextNodeFn,
    });

    const payload: PluginWarningPayload = {
      usagePct: 1.5,
      thresholdPct: 1,
      confidence: "estimated",
      blocksExecution: false,
      topContributors: [{ name: "test-skill", tokens: 1000 }],
      message: "Test warning message",
    };

    adapter.publishWarning(payload);

    expect(notifyFn).toHaveBeenCalledOnce();
    expect(notifyFn).toHaveBeenCalledWith(payload.message);

    expect(setContextNodeFn).toHaveBeenCalledOnce();
    expect(setContextNodeFn).toHaveBeenCalledWith("skills-budget", payload);
  });
});
