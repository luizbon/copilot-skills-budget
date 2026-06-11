import { createSdkAdapter } from "./adapter.js";
import { runBudgetGuard } from "./budget-guard-service.js";
export function createSkillsBudgetPlugin(deps) {
    const adapter = createSdkAdapter(deps);
    function run(mode) {
        const result = runBudgetGuard({
            mode,
            contextWindowTokens: deps.contextWindowTokens,
            thresholdPct: deps.thresholdPct,
            skillsContextWarningThresholdPct: deps.skillsContextWarningThresholdPct,
            skillsDescriptionCharCap: deps.skillsDescriptionCharCap,
            skills: deps.skills,
        });
        adapter.publishContext(result.contextPayload);
        if (result.warning) {
            const warningPayload = {
                usagePct: result.contextPayload.usagePct,
                thresholdPct: result.contextPayload.thresholdPct,
                confidence: result.confidence,
                blocksExecution: false,
                topContributors: result.contextPayload.topContributors,
                message: result.warning,
            };
            adapter.publishWarning(warningPayload);
        }
        return result;
    }
    return {
        onStartup: () => run("startup"),
        onFirstRequest: () => run("firstRequest"),
    };
}
//# sourceMappingURL=plugin.js.map