export type BuildSkillIndexTextOptions = {
  description: string;
  whenToUse: string;
  charCap: number;
};

export function buildSkillIndexText({
  description,
  whenToUse,
  charCap,
}: BuildSkillIndexTextOptions): string {
  return `${description}\n${whenToUse}`.slice(0, charCap);
}
