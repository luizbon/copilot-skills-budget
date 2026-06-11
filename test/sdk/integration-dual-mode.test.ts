import { describe, expect, it } from "vitest";
import { createSkillsBudgetPlugin } from "../../src/sdk/plugin";

describe("sdk dual-mode refresh integration", () => {
  it("updates warning confidence from estimated at startup to full on first request", () => {
    const notifications: string[] = [];

    const plugin = createSkillsBudgetPlugin({
      contextWindowTokens: 1000,
      thresholdPct: 0.1,
      skills: [
        {
          name: "integration:large",
          description: "x".repeat(2000),
        },
      ],
      notify: (message) => notifications.push(message),
      setContextNode: () => {},
    });

    const startupResult = plugin.onStartup();
    const firstRequestResult = plugin.onFirstRequest();

    expect(startupResult.warning).toBeTruthy();
    expect(firstRequestResult.warning).toBeTruthy();
    expect(startupResult.confidence).toBe("estimated");
    expect(firstRequestResult.confidence).toBe("full");
    expect(notifications).toHaveLength(2);
    expect(notifications[0]).toBe(startupResult.warning);
    expect(notifications[1]).toBe(firstRequestResult.warning);
  });
});
