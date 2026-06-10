export type BudgetSkill = {
  name: string;
  tokens: number;
};

export type EvaluateBudgetInput = {
  contextWindowTokens: number;
  thresholdPct: number;
  skills: BudgetSkill[];
};

export function evaluateBudget({
  contextWindowTokens,
  thresholdPct,
  skills,
}: EvaluateBudgetInput) {
  const totalTokens = skills.reduce((sum, skill) => sum + skill.tokens, 0);
  const usagePct = (totalTokens / contextWindowTokens) * 100;

  const topContributors = [...skills]
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 5);

  return {
    totalTokens,
    usagePct,
    isOverThreshold: usagePct > thresholdPct,
    topContributors,
  };
}
