import { describe, expect, it, vi } from "vitest";
import { createSdkAdapter } from "skills-context-budget-guard/sdk/adapter";
import type { PluginWarningPayload } from "skills-context-budget-guard/sdk/types";
import type { ContextReportPayload } from "../../src/context-report";

describe("createSdkAdapter", () => {
  const payload: PluginWarningPayload = {
    usagePct: 1.5,
    thresholdPct: 1,
    confidence: "estimated",
    blocksExecution: false,
    topContributors: [{ name: "test-skill", tokens: 1000 }],
    message: "Test warning message",
  };

  const contextPayload: ContextReportPayload = {
    kind: "skills-context-budget",
    totalTokens: 2500,
    usagePct: 1.5,
    thresholdPct: 1,
    isOverThreshold: true,
    blocksExecution: false,
    topContributors: [{ name: "test-skill", tokens: 1000 }],
  };

  it("publishContext sends context payload via setContextNode", () => {
    const notifyFn = vi.fn();
    const setContextNodeFn = vi.fn();

    const adapter = createSdkAdapter({
      notify: notifyFn,
      setContextNode: setContextNodeFn,
    });

    adapter.publishContext(contextPayload);

    expect(setContextNodeFn).toHaveBeenCalledOnce();
    expect(setContextNodeFn).toHaveBeenCalledWith("skills-budget", contextPayload);
    expect(notifyFn).not.toHaveBeenCalled();
  });

  it("publishWarning sends warning message via notify", () => {
    const notifyFn = vi.fn();
    const setContextNodeFn = vi.fn();

    const adapter = createSdkAdapter({
      notify: notifyFn,
      setContextNode: setContextNodeFn,
    });

    adapter.publishWarning(payload);

    expect(notifyFn).toHaveBeenCalledOnce();
    expect(notifyFn).toHaveBeenCalledWith(payload.message);
    expect(setContextNodeFn).not.toHaveBeenCalled();
  });

  it("publishWarning does not throw when notify throws", () => {
    const notifyFn = vi.fn(() => {
      throw new Error("notify failure");
    });
    const setContextNodeFn = vi.fn();

    const adapter = createSdkAdapter({
      notify: notifyFn,
      setContextNode: setContextNodeFn,
    });

    expect(() => adapter.publishWarning(payload)).not.toThrow();
    expect(notifyFn).toHaveBeenCalledOnce();
    expect(setContextNodeFn).not.toHaveBeenCalled();
  });

  it("publishContext does not throw when setContextNode throws", () => {
    const notifyFn = vi.fn();
    const setContextNodeFn = vi.fn(() => {
      throw new Error("setContextNode failure");
    });

    const adapter = createSdkAdapter({
      notify: notifyFn,
      setContextNode: setContextNodeFn,
    });

    expect(() => adapter.publishContext(contextPayload)).not.toThrow();
    expect(notifyFn).not.toHaveBeenCalled();
    expect(setContextNodeFn).toHaveBeenCalledOnce();
  });
});
