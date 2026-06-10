import type { BudgetGuardResult, BudgetGuardSkill } from "./sdk/budget-guard-service.js";
export type PreflightInput = {
    contextWindowTokens: number;
    thresholdPct?: number;
    skillsContextWarningThresholdPct?: number;
    skillsDescriptionCharCap?: number;
    skills: BudgetGuardSkill[];
};
export type PreflightResult = {
    confidence: BudgetGuardResult["confidence"];
    countedSkills: number;
    warning: string | null;
    contextPayload: BudgetGuardResult["contextPayload"];
};
export declare function runSkillsBudgetPreflight(input: PreflightInput): PreflightResult;
//# sourceMappingURL=preflight.d.ts.map