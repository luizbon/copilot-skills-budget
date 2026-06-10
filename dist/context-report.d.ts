import type { WarningContributor } from "./warning.js";
export type BuildContextReportPayloadInput = {
    totalTokens: number;
    usagePct: number;
    thresholdPct: number;
    isOverThreshold: boolean;
    blocksExecution?: boolean;
    topContributors: WarningContributor[];
};
export type ContextReportPayload = {
    kind: "skills-context-budget";
    totalTokens: number;
    usagePct: number;
    thresholdPct: number;
    isOverThreshold: boolean;
    blocksExecution: boolean;
    topContributors: WarningContributor[];
};
export declare function buildContextReportPayload(input: BuildContextReportPayloadInput): ContextReportPayload;
//# sourceMappingURL=context-report.d.ts.map