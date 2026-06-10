export function createSdkAdapter(deps) {
    return {
        publishWarning(payload) {
            deps.notify(payload.message);
            deps.setContextNode("skills-budget", payload);
        },
    };
}
//# sourceMappingURL=adapter.js.map