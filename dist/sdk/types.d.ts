export type ConfidenceMode = "estimated" | "full";
export interface PluginWarningPayload {
    usagePct: number;
    thresholdPct: number;
    confidence: ConfidenceMode;
    blocksExecution: false;
    topContributors: Array<{
        name: string;
        tokens: number;
    }>;
    message: string;
}
//# sourceMappingURL=types.d.ts.map