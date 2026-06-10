import { evaluateBudget } from "./budget-guard";
import { buildContextReportPayload } from "./context-report";
import { buildSkillIndexText } from "./skill-index";
import { renderWarning } from "./warning";

const DEFAULT_SKILL_TEXT_CHAR_CAP = 1536;

export type PreflightSkill = {
  name: string;
  description?: string;
  whenToUse?: string;
  disableModelInvocation?: boolean;
};

export type PreflightInput = {
  contextWindowTokens: number;
  thresholdPct: number;
  skills: PreflightSkill[];
};

export type PreflightResult = {
  countedSkills: number;
  warning: string | null;
  contextPayload: ReturnType<typeof buildContextReportPayload>;
};

function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4);
}

export function runSkillsBudgetPreflight(input: PreflightInput): PreflightResult {
  const countedSkills = input.skills.filter((skill) => !skill.disableModelInvocation);

  const budgetSkills = countedSkills.map((skill) => ({
    name: skill.name,
    tokens: estimateTokensFromText(
      buildSkillIndexText({
        description: skill.description,
        whenToUse: skill.whenToUse,
        charCap: DEFAULT_SKILL_TEXT_CHAR_CAP,
      }),
    ),
  }));

  const budget = evaluateBudget({
    contextWindowTokens: input.contextWindowTokens,
    thresholdPct: input.thresholdPct,
    skills: budgetSkills,
  });

  return {
    countedSkills: countedSkills.length,
    warning: budget.isOverThreshold
      ? renderWarning({
          usagePct: budget.usagePct,
          thresholdPct: input.thresholdPct,
          topContributors: budget.topContributors,
        })
      : null,
    contextPayload: buildContextReportPayload({
      totalTokens: budget.totalTokens,
      usagePct: budget.usagePct,
      thresholdPct: input.thresholdPct,
      isOverThreshold: budget.isOverThreshold,
      topContributors: budget.topContributors,
    }),
  };
}
