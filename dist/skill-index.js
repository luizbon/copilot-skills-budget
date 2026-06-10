export function buildSkillIndexText({ description, whenToUse, charCap, }) {
    return `${description ?? ""}\n${whenToUse ?? ""}`.trim().slice(0, charCap);
}
//# sourceMappingURL=skill-index.js.map