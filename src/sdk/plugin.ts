import { createSdkAdapter, type SdkAdapterDeps } from "./adapter.js";
import { runBudgetGuard, type BudgetGuardMode, type BudgetGuardResult, type BudgetGuardSkill } from "./budget-guard-service.js";
import type { PluginWarningPayload } from "./types.js";

export interface SkillsBudgetPluginDeps extends SdkAdapterDeps {
  supportsFullSkillApi?: boolean;
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
  let startupResult: BudgetGuardResult | null = null;

  function compute(mode: BudgetGuardMode): BudgetGuardResult {
    return runBudgetGuard({
      mode,
      supportsFullSkillApi: deps.supportsFullSkillApi,
      contextWindowTokens: deps.contextWindowTokens,
      thresholdPct: deps.thresholdPct,
      skillsContextWarningThresholdPct: deps.skillsContextWarningThresholdPct,
      skillsDescriptionCharCap: deps.skillsDescriptionCharCap,
      skills: deps.skills,
    });
  }

  function publish(result: BudgetGuardResult): BudgetGuardResult {
    adapter.publishContext(result.contextPayload);

    if (result.warning) {
      const warningPayload: PluginWarningPayload = {
        usagePct: result.contextPayload.usagePct,
        thresholdPct: result.contextPayload.thresholdPct,
        confidence: result.confidence,
        blocksExecution: false,
        topContributors: result.contextPayload.topContributors,
        message: result.warning,
      };

      adapter.publishWarning(warningPayload);
    }

    return result;
  }

  return {
    onStartup: () => {
      if (!startupResult) {
        startupResult = compute("startup");
      }
      return publish(startupResult);
    },
    onFirstRequest: () => {
      if (deps.supportsFullSkillApi === false) {
        // Compat mode: compute once, re-publish the cached result on each hook call
        // so adapter call semantics are consistent regardless of hook invocation order.
        if (!startupResult) {
          startupResult = compute("startup");
        }
        return publish(startupResult);
      }

      return publish(compute("firstRequest"));
    },
  };
}
