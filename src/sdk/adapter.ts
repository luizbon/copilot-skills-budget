import type { PluginWarningPayload } from "./types.js";

export interface SdkAdapterDeps {
  notify: (message: string) => void;
  setContextNode: (key: string, payload: unknown) => void;
}

export interface SdkAdapter {
  publishWarning: (payload: PluginWarningPayload) => void;
}

export function createSdkAdapter(deps: SdkAdapterDeps): SdkAdapter {
  return {
    publishWarning(payload: PluginWarningPayload) {
      deps.notify(payload.message);
      deps.setContextNode("skills-budget", payload);
    },
  };
}
