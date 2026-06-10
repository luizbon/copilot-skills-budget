export function buildContextReportPayload(input) {
    return {
        kind: "skills-context-budget",
        totalTokens: input.totalTokens,
        usagePct: input.usagePct,
        thresholdPct: input.thresholdPct,
        isOverThreshold: input.isOverThreshold,
        blocksExecution: input.blocksExecution ?? false,
        topContributors: input.topContributors,
    };
}
//# sourceMappingURL=context-report.js.map