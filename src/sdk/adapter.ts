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

export function createSdkAdapter(deps: SdkAdapterDeps): SdkAdapter {
  return {
    publishContext(contextPayload: ContextReportPayload) {
      try {
        deps.setContextNode("skills-budget", contextPayload);
      } catch {
        // non-blocking: swallow adapter errors to preserve host stability
      }
    },

    publishWarning(warningPayload: PluginWarningPayload) {
      try {
        deps.notify(warningPayload.message);
      } catch {
        // non-blocking: swallow adapter errors to preserve host stability
      }
    },
  };
}
