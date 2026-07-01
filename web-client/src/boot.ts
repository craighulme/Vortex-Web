import { createVortexRuntime } from "./runtime/createRuntime";
import { installWindowRuntimeHandles } from "./runtime/WindowRuntimeHandles";
import { launchRuntime } from "./runtime/RuntimeLauncher";
import { readRuntimeDisplaySettings } from "./ui/RuntimeDisplaySettings";

declare const __VWEB_RUNTIME_VERSION__: string;

declare global {
  interface Window {
    VortexRuntime?: ReturnType<typeof createVortexRuntime>;
    __vwebRuntime?: ReturnType<typeof createVortexRuntime>;
    VortexRuntimeDevTools?: {
      enable(): boolean;
      disable(): boolean;
      active(): boolean;
    };
  }
}

(() => {
  if (window.__vwebRuntime) return;
  if (window.localStorage.getItem("vwebRuntimeDisabled") === "1") {
    window.dispatchEvent(new CustomEvent("vweb-runtime-disabled"));
    return;
  }

  const runtime = createVortexRuntime({
    version: __VWEB_RUNTIME_VERSION__,
    document,
    window,
    location
  });

  installWindowRuntimeHandles(window, runtime);
  hydrateCommunityCosmetics(runtime);
  applyRuntimeThemeCss();
  installRuntimeThemeListener();
  mountRuntimeUi(runtime);
  mountRuntimeMultiplayer(runtime);
  installRuntimeDevTools(runtime);
  runtime.diagnostics.info("runtime.boot", {
    version: runtime.version,
    protocolVersion: runtime.protocol.version
  });
  runtime.worldBootstrap.installGlobals(runtime);
  window.dispatchEvent(new CustomEvent("vweb-runtime-ready", { detail: runtime }));
  void launchRuntime(runtime)
    .then(() => runtime.worldBootstrap.boot(runtime, window.fetch.bind(window)))
    .catch((error) => {
      runtime.diagnostics.warn("runtime.launch.failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      console.error("[Vortex Web] runtime launch failed", error);
    });
})();

function applyRuntimeThemeCss(): void {
  setRuntimeThemeCss(readRuntimeDisplaySettings(document).runtimeThemeCss);
}

function installRuntimeThemeListener(): void {
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data as { vwebRuntimeTheme?: unknown; css?: unknown } | null;
    if (!data?.vwebRuntimeTheme) return;
    setRuntimeThemeCss(typeof data.css === "string" ? data.css : "");
  });
}

function setRuntimeThemeCss(value: string): void {
  const css = normalizeRuntimeThemeCss(value);
  const oldStyle = document.getElementById("vweb-custom-runtime-theme");
  if (!css) {
    oldStyle?.remove();
    return;
  }
  const style = document.createElement("style");
  style.id = "vweb-custom-runtime-theme";
  style.textContent = css;
  oldStyle?.remove();
  document.documentElement.appendChild(style);
}

function normalizeRuntimeThemeCss(value: string): string {
  const css = String(value || "").trim();
  if (!css) return "";
  if (!css.replace(/\/\*[\s\S]*?\*\//g, "").trim()) return "";
  return css;
}

function hydrateCommunityCosmetics(runtime: ReturnType<typeof createVortexRuntime>): void {
  const meta = document.getElementById("_vortexWebCosmetics") as HTMLMetaElement | null;
  if (!meta?.content) return;
  try {
    const parsed = JSON.parse(meta.content);
    if (Number.isFinite(Number(parsed?.ownUserId))) runtime.community.setOwnUserId(Number(parsed.ownUserId));
    const records = parsed?.records && typeof parsed.records === "object" ? parsed.records : {};
    for (const record of Object.values(records)) {
      if (record && typeof record === "object") runtime.community.applyCosmetics(record as never);
    }
  } catch {
    runtime.diagnostics.warn("community.cosmetics.hydrate.failed");
  }
}

function mountRuntimeUi(runtime: ReturnType<typeof createVortexRuntime>): void {
  const mount = () => {
    runtime.chat.mount();
    runtime.leaderboardDom.mount(runtime);
    mountCameraSensitivityControl(runtime);
  };
  mount();
  if (!runtime.chat.snapshot().mounted) {
    window.addEventListener("DOMContentLoaded", mount, { once: true });
  }
}

function mountCameraSensitivityControl(runtime: ReturnType<typeof createVortexRuntime>): void {
  const slider = document.getElementById("sp-sens") as HTMLInputElement | null;
  const value = document.getElementById("sp-sens-val");
  if (!slider || !value || slider.dataset.vortexRuntimeMounted === "true") return;
  slider.dataset.vortexRuntimeMounted = "true";

  const readStored = () => {
    const parsed = Number.parseFloat(localStorage.getItem("vortex_sens") || "1");
    return Number.isFinite(parsed) ? parsed : 1;
  };
  const apply = (next: number) => {
    value.textContent = `${next.toFixed(2)}x`;
    runtime.camera.setSensitivity(next);
  };

  const initial = readStored();
  slider.value = String(initial);
  apply(initial);
  runtime.events.on("runtime-api:ready", () => apply(readStored()));
  slider.addEventListener("input", () => {
    const next = Number.parseFloat(slider.value);
    const safeValue = Number.isFinite(next) ? next : 1;
    localStorage.setItem("vortex_sens", String(safeValue));
    apply(safeValue);
  });
}

function mountRuntimeMultiplayer(runtime: ReturnType<typeof createVortexRuntime>): void {
  const mount = () => {
    try {
      runtime.multiplayerBridge.mount(runtime);
    } catch (error) {
      runtime.diagnostics.warn("multiplayer.bridge.mount.failed", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };
  runtime.events.on("runtime-api:ready", mount);
  window.addEventListener("vweb-runtime-exports-ready", mount);
  if (runtime.renderer.getHandles().scene) mount();
}

function installRuntimeDevTools(runtime: ReturnType<typeof createVortexRuntime>): void {
  let active = false;
  let mounted = false;
  let timer: number | null = null;

  const clearTimer = () => {
    if (timer === null) return;
    window.clearTimeout(timer);
    timer = null;
  };

  const tick = () => {
    if (!active) return;
    runtime.slim.update(runtime);
    runtime.sandbox.update(runtime);
    runtime.ui.updateRuntimePanel(runtime);

    const uiVisible = runtime.ui.snapshot().runtimePanelVisible;
    const needsFrameLoop = uiVisible || runtime.sandbox.isActive() || runtime.slim.hasTargets();
    if (needsFrameLoop) {
      requestAnimationFrame(tick);
    } else {
      timer = window.setTimeout(tick, 250);
    }
  };

  window.VortexRuntimeDevTools = {
    enable() {
      if (!mounted) {
        runtime.ui.mountRuntimePanel(runtime);
        mounted = true;
      }
      runtime.ui.setRuntimePanelVisible(true);
      if (!active) {
        active = true;
        clearTimer();
        requestAnimationFrame(tick);
      }
      return active;
    },
    disable() {
      active = false;
      clearTimer();
      runtime.ui.setRuntimePanelVisible(false);
      runtime.sandbox.stopStress();
      return true;
    },
    active() {
      return active;
    }
  };

  document.addEventListener("keydown", (event) => {
    if (event.code !== "F9") return;
    event.preventDefault();
    if (!mounted || !active || !runtime.ui.snapshot().runtimePanelVisible) {
      window.VortexRuntimeDevTools?.enable();
    } else {
      window.VortexRuntimeDevTools?.disable();
    }
  }, true);

  window.addEventListener("beforeunload", () => {
    active = false;
    clearTimer();
  }, { once: true });

  if (window.localStorage.getItem("vwebRuntimeDevTools") === "1") {
    window.VortexRuntimeDevTools.enable();
  }
}
