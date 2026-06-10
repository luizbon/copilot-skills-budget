import { runBudgetGuard } from "./sdk/budget-guard-service.js";
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

export function runSkillsBudgetPreflight(input: PreflightInput): PreflightResult {
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
