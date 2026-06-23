import type { VortexRuntime } from "./types";

type LegacyWindow = Window & {
  VortexRuntime?: VortexRuntime;
  __v22Runtime?: VortexRuntime;
  _vortex?: unknown;
};

export function installCompatibilityShim(target: Window, runtime: VortexRuntime): void {
  const win = target as LegacyWindow;
  win.VortexRuntime = runtime;
  win.__v22Runtime = runtime;

  const existing = Object.getOwnPropertyDescriptor(win, "_vortex");
  if (existing && existing.configurable === false) {
    runtime.legacy.setVortex(win._vortex ?? null);
    return;
  }

  let legacyValue: unknown = win._vortex ?? null;
  runtime.legacy.setVortex(legacyValue);

  Object.defineProperty(win, "_vortex", {
    configurable: true,
    enumerable: true,
    get() {
      return legacyValue;
    },
    set(value: unknown) {
      legacyValue = value;
      runtime.legacy.setVortex(value);
    }
  });
}
