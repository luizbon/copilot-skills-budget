import { describe, expect, it, vi } from "vitest";
import { createSkillsBudgetPlugin } from "skills-context-budget-guard/sdk/plugin";

describe("createSkillsBudgetPlugin", () => {
  it("runs budget checks on startup and first request lifecycle hooks", () => {
    const notifyFn = vi.fn();
    const setContextNodeFn = vi.fn();

    const plugin = createSkillsBudgetPlugin({
      contextWindowTokens: 1000,
      thresholdPct: 0.1,
      skills: [
        {
          name: "plugin:large",
          description: "x".repeat(2000),
        },
      ],
      notify: notifyFn,
      setContextNode: setContextNodeFn,
    });

    const startupResult = plugin.onStartup();
    const firstRequestResult = plugin.onFirstRequest();

    expect(startupResult.confidence).toBe("estimated");
    expect(firstRequestResult.confidence).toBe("full");
    expect(notifyFn).toHaveBeenCalledTimes(2);
    expect(setContextNodeFn).toHaveBeenCalledTimes(2);

    expect(notifyFn).toHaveBeenNthCalledWith(1, startupResult.warning);
    expect(notifyFn).toHaveBeenNthCalledWith(2, firstRequestResult.warning);
    expect(setContextNodeFn).toHaveBeenNthCalledWith(
      1,
      "skills-budget",
      startupResult.contextPayload,
    );
    expect(setContextNodeFn).toHaveBeenNthCalledWith(
      2,
      "skills-budget",
      firstRequestResult.contextPayload,
    );
  });
});
