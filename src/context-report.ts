import type { WarningContributor } from "./warning";

export type BuildContextReportPayloadInput = {
  totalTokens: number;
  usagePct: number;
  thresholdPct: number;
  isOverThreshold: boolean;
  topContributors: WarningContributor[];
};

export type ContextReportPayload = {
  kind: "skills-context-budget";
  totalTokens: number;
  usagePct: number;
  thresholdPct: number;
  isOverThreshold: boolean;
  topContributors: WarningContributor[];
};

export function buildContextReportPayload(
  input: BuildContextReportPayloadInput,
): ContextReportPayload {
  return {
    kind: "skills-context-budget",
    totalTokens: input.totalTokens,
    usagePct: input.usagePct,
    thresholdPct: input.thresholdPct,
    isOverThreshold: input.isOverThreshold,
    topContributors: input.topContributors,
  };
}
