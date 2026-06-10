export function createSdkAdapter(deps) {
    return {
        publishWarning(warningPayload, contextPayload) {
            try {
                deps.notify(warningPayload.message);
            }
            catch { }
            try {
                deps.setContextNode("skills-budget", contextPayload);
            }
            catch { }
        },
    };
}
//# sourceMappingURL=adapter.js.map