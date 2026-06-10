export type WarningContributor = {
  name: string;
  tokens: number;
};

export type RenderWarningInput = {
  usagePct: number;
  thresholdPct: number;
  topContributors: WarningContributor[];
};

export function renderWarning({
  usagePct,
  thresholdPct,
  topContributors,
}: RenderWarningInput): string {
  return [
    `Skill descriptions use ${usagePct.toFixed(2)}% of context (threshold ${thresholdPct.toFixed(2)}%).`,
    "Top contributors:",
    ...topContributors.map((contributor) => `- ${contributor.name}: ${contributor.tokens} tokens`),
    "Disable hints:",
    "- disable bundled skills in config",
    "- disable specific plugin skills",
    "- set disable-model-invocation: true for manual-only skills",
  ].join("\n");
}
