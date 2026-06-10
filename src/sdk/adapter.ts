import type { PluginWarningPayload } from "./types.js";
import type { ContextReportPayload } from "../context-report.js";

export interface SdkAdapterDeps {
  notify: (message: string) => void;
  setContextNode: (key: string, payload: unknown) => void;
}

export interface SdkAdapter {
  publishWarning: (warningPayload: PluginWarningPayload, contextPayload: ContextReportPayload) => void;
}

export function createSdkAdapter(deps: SdkAdapterDeps): SdkAdapter {
  return {
    publishWarning(warningPayload: PluginWarningPayload, contextPayload: ContextReportPayload) {
      deps.notify(warningPayload.message);
      deps.setContextNode("skills-budget", contextPayload);
    },
  };
}
