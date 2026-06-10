export type BudgetSkill = {
    name: string;
    tokens: number;
};
export type EvaluateBudgetInput = {
    contextWindowTokens: number;
    thresholdPct: number;
    skills: BudgetSkill[];
};
export declare function evaluateBudget({ contextWindowTokens, thresholdPct, skills, }: EvaluateBudgetInput): {
    totalTokens: number;
    usagePct: number;
    isOverThreshold: boolean;
    topContributors: BudgetSkill[];
};
//# sourceMappingURL=budget-guard.d.ts.map