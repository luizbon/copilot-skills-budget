import { evaluateBudget } from "../budget-guard.js";
import { buildContextReportPayload } from "../context-report.js";
import { buildSkillIndexText } from "../skill-index.js";
import type { ConfidenceMode } from "./types.js";
import { renderWarning } from "../warning.js";

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

const DEFAULT_SKILL_TEXT_CHAR_CAP = 1536;
const DEFAULT_WARNING_THRESHOLD_PCT = 1;

function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4);
}

export function runBudgetGuard(input: BudgetGuardInput): BudgetGuardResult {
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
    confidence: input.mode === "startup" ? "estimated" : "full",
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
