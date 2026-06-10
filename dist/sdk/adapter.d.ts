import type { PluginWarningPayload } from "./types.js";
export interface SdkAdapterDeps {
    notify: (message: string) => void;
    setContextNode: (key: string, payload: unknown) => void;
}
export interface SdkAdapter {
    publishWarning: (payload: PluginWarningPayload) => void;
}
export declare function createSdkAdapter(deps: SdkAdapterDeps): SdkAdapter;
//# sourceMappingURL=adapter.d.ts.map