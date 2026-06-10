import { runBudgetGuard } from "./sdk/budget-guard-service.js";
export function runSkillsBudgetPreflight(input) {
    const result = runBudgetGuard({
        mode: "startup",
        contextWindowTokens: input.contextWindowTokens,
        thresholdPct: input.thresholdPct,
        skillsContextWarningThresholdPct: input.skillsContextWarningThresholdPct,
        skillsDescriptionCharCap: input.skillsDescriptionCharCap,
        skills: input.skills,
    });
    return {
        confidence: result.confidence,
        countedSkills: result.countedSkills,
        warning: result.warning,
        contextPayload: result.contextPayload,
    };
}
//# sourceMappingURL=preflight.js.map