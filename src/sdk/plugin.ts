import { createSdkAdapter, type SdkAdapterDeps } from "./adapter.js";
import { runBudgetGuard, type BudgetGuardMode, type BudgetGuardResult, type BudgetGuardSkill } from "./budget-guard-service.js";
import type { PluginWarningPayload } from "./types.js";

export interface SkillsBudgetPluginDeps extends SdkAdapterDeps {
  contextWindowTokens: number;
  thresholdPct?: number;
  skillsContextWarningThresholdPct?: number;
  skillsDescriptionCharCap?: number;
  skills: BudgetGuardSkill[];
}

export interface SkillsBudgetPlugin {
  onStartup: () => BudgetGuardResult;
  onFirstRequest: () => BudgetGuardResult;
}

export function createSkillsBudgetPlugin(deps: SkillsBudgetPluginDeps): SkillsBudgetPlugin {
  const adapter = createSdkAdapter(deps);

  function run(mode: BudgetGuardMode): BudgetGuardResult {
    const result = runBudgetGuard({
      mode,
      contextWindowTokens: deps.contextWindowTokens,
      thresholdPct: deps.thresholdPct,
      skillsContextWarningThresholdPct: deps.skillsContextWarningThresholdPct,
      skillsDescriptionCharCap: deps.skillsDescriptionCharCap,
      skills: deps.skills,
    });

    if (result.warning) {
      const warningPayload: PluginWarningPayload = {
        usagePct: result.contextPayload.usagePct,
        thresholdPct: result.contextPayload.thresholdPct,
        confidence: result.confidence,
        blocksExecution: false,
        topContributors: result.contextPayload.topContributors,
        message: result.warning,
      };

      adapter.publishWarning(warningPayload, result.contextPayload);
    }

    return result;
  }

  return {
    onStartup: () => run("startup"),
    onFirstRequest: () => run("firstRequest"),
  };
}
