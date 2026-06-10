export type WarningContributor = {
    name: string;
    tokens: number;
};
export type RenderWarningInput = {
    usagePct: number;
    thresholdPct: number;
    topContributors: WarningContributor[];
};
export declare function renderWarning({ usagePct, thresholdPct, topContributors, }: RenderWarningInput): string;
//# sourceMappingURL=warning.d.ts.map