export function createSdkAdapter(deps) {
    return {
        publishWarning(warningPayload, contextPayload) {
            deps.notify(warningPayload.message);
            deps.setContextNode("skills-budget", contextPayload);
        },
    };
}
//# sourceMappingURL=adapter.js.map