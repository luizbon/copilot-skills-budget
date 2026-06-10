import { buildContextReportPayload } from "./context-report.js";
export type PreflightSkill = {
    name: string;
    description?: string;
    whenToUse?: string;
    disableModelInvocation?: boolean;
};
export type PreflightInput = {
    contextWindowTokens: number;
    thresholdPct?: number;
    skillsContextWarningThresholdPct?: number;
    skillsDescriptionCharCap?: number;
    skills: PreflightSkill[];
};
export type PreflightResult = {
    countedSkills: number;
    warning: string | null;
    contextPayload: ReturnType<typeof buildContextReportPayload>;
};
export declare function runSkillsBudgetPreflight(input: PreflightInput): PreflightResult;
//# sourceMappingURL=preflight.d.ts.map