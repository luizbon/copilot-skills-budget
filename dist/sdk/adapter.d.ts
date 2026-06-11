import type { PluginWarningPayload } from "./types.js";
import type { ContextReportPayload } from "../context-report.js";
export interface SdkAdapterDeps {
    notify: (message: string) => void;
    setContextNode: (key: string, payload: unknown) => void;
}
export interface SdkAdapter {
    publishContext: (contextPayload: ContextReportPayload) => void;
    publishWarning: (warningPayload: PluginWarningPayload) => void;
}
export declare function createSdkAdapter(deps: SdkAdapterDeps): SdkAdapter;
//# sourceMappingURL=adapter.d.ts.map