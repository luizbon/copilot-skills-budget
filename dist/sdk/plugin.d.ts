import { type SdkAdapterDeps } from "./adapter.js";
import { type BudgetGuardResult, type BudgetGuardSkill } from "./budget-guard-service.js";
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
export declare function createSkillsBudgetPlugin(deps: SkillsBudgetPluginDeps): SkillsBudgetPlugin;
//# sourceMappingURL=plugin.d.ts.map