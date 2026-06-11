export function createSdkAdapter(deps) {
    return {
        publishContext(contextPayload) {
            try {
                deps.setContextNode("skills-budget", contextPayload);
            }
            catch { }
        },
        publishWarning(warningPayload) {
            try {
                deps.notify(warningPayload.message);
            }
            catch { }
        },
    };
}
//# sourceMappingURL=adapter.js.map