import { describe, expect, it, vi } from "vitest";
import { createSkillsBudgetPlugin } from "../../src/sdk/plugin";

describe("createSkillsBudgetPlugin compatibility", () => {
  it("degrades to estimate-only and skips first request recompute when full API is unsupported", () => {
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
    expect(setContextNodeFn).toHaveBeenCalledTimes(1);
    expect(notifyFn).not.toHaveBeenCalled();
  });

  it("caches startup fallback when first-request path is used twice without startup hook", () => {
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
    expect(secondFirstRequestResult).toBe(firstRequestResult);
    expect(setContextNodeFn).toHaveBeenCalledTimes(1);
    expect(notifyFn).not.toHaveBeenCalled();
  });
});
