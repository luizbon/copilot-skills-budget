import { describe, expect, it, vi } from "vitest";
import { createSkillsBudgetPlugin } from "../../src/sdk/plugin";

describe("createSkillsBudgetPlugin compatibility", () => {
  it("degrades to estimate-only and re-publishes cached result on first request when full API is unsupported", () => {
    const notifyFn = vi.fn();
    const setContextNodeFn = vi.fn();

    const plugin = createSkillsBudgetPlugin({
      contextWindowTokens: 1000,
      thresholdPct: 0.9,
      skills: [{ name: "compat:skill", description: "short description" }],
      supportsFullSkillApi: false,
      notify: notifyFn,
      setContextNode: setContextNodeFn,
    });

    const startupResult = plugin.onStartup();
    const firstRequestResult = plugin.onFirstRequest();

    expect(startupResult.confidence).toBe("estimated");
    expect(firstRequestResult.confidence).toBe("estimated");
    expect(firstRequestResult.compatibilityNote).toContain("full skill API unavailable");
    expect(firstRequestResult.contextPayload.blocksExecution).toBe(false);
    // Both hooks publish — consistent adapter call semantics regardless of order
    expect(setContextNodeFn).toHaveBeenCalledTimes(2);
    expect(notifyFn).not.toHaveBeenCalled();
  });

  it("caches startup fallback result and does not recompute when first-request path is used twice without startup hook", () => {
    const notifyFn = vi.fn();
    const setContextNodeFn = vi.fn();

    const plugin = createSkillsBudgetPlugin({
      contextWindowTokens: 1000,
      thresholdPct: 0.9,
      skills: [{ name: "compat:skill", description: "short description" }],
      supportsFullSkillApi: false,
      notify: notifyFn,
      setContextNode: setContextNodeFn,
    });

    const firstRequestResult = plugin.onFirstRequest();
    const secondFirstRequestResult = plugin.onFirstRequest();

    expect(firstRequestResult.confidence).toBe("estimated");
    expect(secondFirstRequestResult.confidence).toBe("estimated");
    expect(secondFirstRequestResult.compatibilityNote).toContain("full skill API unavailable");
    expect(secondFirstRequestResult.contextPayload.blocksExecution).toBe(false);
    // Result object is identical (same cached instance)
    expect(secondFirstRequestResult).toBe(firstRequestResult);
    // Both calls publish (idempotent data), so adapter is called twice
    expect(setContextNodeFn).toHaveBeenCalledTimes(2);
    expect(notifyFn).not.toHaveBeenCalled();
  });

  it("does not recompute when onStartup is called after onFirstRequest in compat mode", () => {
    const setContextNodeFn = vi.fn();

    const plugin = createSkillsBudgetPlugin({
      contextWindowTokens: 1000,
      thresholdPct: 0.9,
      skills: [{ name: "compat:skill", description: "short description" }],
      supportsFullSkillApi: false,
      notify: vi.fn(),
      setContextNode: setContextNodeFn,
    });

    const firstRequestResult = plugin.onFirstRequest();
    const startupResult = plugin.onStartup();

    // Both return the same cached result (no double compute)
    expect(startupResult).toBe(firstRequestResult);
    // onFirstRequest published once, onStartup was already cached so also published once each = 2 total
    expect(setContextNodeFn).toHaveBeenCalledTimes(2);
  });
});
