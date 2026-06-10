import { evaluateBudget } from "./budget-guard";
import { buildContextReportPayload } from "./context-report";
import { buildSkillIndexText } from "./skill-index";
import { renderWarning } from "./warning";

const DEFAULT_SKILL_TEXT_CHAR_CAP = 1536;
const DEFAULT_WARNING_THRESHOLD_PCT = 1;

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

function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4);
}

export function runSkillsBudgetPreflight(input: PreflightInput): PreflightResult {
  const thresholdPct =
    input.skillsContextWarningThresholdPct ?? input.thresholdPct ?? DEFAULT_WARNING_THRESHOLD_PCT;
  const skillTextCharCap = input.skillsDescriptionCharCap ?? DEFAULT_SKILL_TEXT_CHAR_CAP;
  const countedSkills = input.skills.filter((skill) => !skill.disableModelInvocation);

  const budgetSkills = countedSkills.map((skill) => ({
    name: skill.name,
    tokens: estimateTokensFromText(
      buildSkillIndexText({
        description: skill.description,
        whenToUse: skill.whenToUse,
        charCap: skillTextCharCap,
      }),
    ),
  }));

  const budget = evaluateBudget({
    contextWindowTokens: input.contextWindowTokens,
    thresholdPct,
    skills: budgetSkills,
  });

  return {
    countedSkills: countedSkills.length,
    warning: budget.isOverThreshold
      ? renderWarning({
          usagePct: budget.usagePct,
          thresholdPct,
          topContributors: budget.topContributors,
        })
      : null,
    contextPayload: buildContextReportPayload({
      totalTokens: budget.totalTokens,
      usagePct: budget.usagePct,
      thresholdPct,
      isOverThreshold: budget.isOverThreshold,
      blocksExecution: false,
      topContributors: budget.topContributors,
    }),
  };
}
