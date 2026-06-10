import { buildContextReportPayload } from "../context-report.js";
import type { ConfidenceMode } from "./types.js";
export type BudgetGuardMode = "startup" | "firstRequest";
export type BudgetGuardSkill = {
    name: string;
    description?: string;
    whenToUse?: string;
    disableModelInvocation?: boolean;
};
export type BudgetGuardInput = {
    mode: BudgetGuardMode;
    contextWindowTokens: number;
    thresholdPct?: number;
    skillsContextWarningThresholdPct?: number;
    skillsDescriptionCharCap?: number;
    skills: BudgetGuardSkill[];
};
export type BudgetGuardResult = {
    confidence: ConfidenceMode;
    countedSkills: number;
    warning: string | null;
    contextPayload: ReturnType<typeof buildContextReportPayload>;
};
export declare function runBudgetGuard(input: BudgetGuardInput): BudgetGuardResult;
//# sourceMappingURL=budget-guard-service.d.ts.map