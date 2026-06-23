import { createVortexRuntime } from "./runtime/createRuntime";
import { installCompatibilityShim } from "./runtime/compatibility";

declare const __V22_RUNTIME_VERSION__: string;

declare global {
  interface Window {
    VortexRuntime?: ReturnType<typeof createVortexRuntime>;
    __v22Runtime?: ReturnType<typeof createVortexRuntime>;
  }
}

(() => {
  if (window.__v22Runtime) return;

  const runtime = createVortexRuntime({
    version: __V22_RUNTIME_VERSION__,
    document,
    location
  });

  installCompatibilityShim(window, runtime);
  runtime.diagnostics.info("runtime.boot", {
    version: runtime.version,
    protocolVersion: runtime.protocol.version
  });
  window.dispatchEvent(new CustomEvent("v22-runtime-ready", { detail: runtime }));
})();
