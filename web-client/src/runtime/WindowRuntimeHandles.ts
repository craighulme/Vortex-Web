import type { VortexRuntime } from "./types";

type VortexWindow = Window & {
  VortexRuntime?: VortexRuntime;
  __vwebRuntime?: VortexRuntime;
};

export function installWindowRuntimeHandles(target: Window, runtime: VortexRuntime): void {
  const win = target as VortexWindow;
  win.VortexRuntime = runtime;
  win.__vwebRuntime = runtime;
}
