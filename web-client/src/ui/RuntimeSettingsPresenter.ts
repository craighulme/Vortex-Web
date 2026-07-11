import type { AudioService } from "../audio/AudioService";
import type { InputService } from "../input/InputService";
import { matchesKeybind } from "../input/KeybindSettings";
import type { SettingsMenuService } from "./SettingsMenuService";

type RuntimeSettingsElementMap = {
  panel: HTMLElement;
  overlay: HTMLElement | null;
  chat: HTMLElement | null;
  output: HTMLElement | null;
  status: HTMLElement | null;
  reloadNotice: HTMLElement | null;
  title: HTMLElement | null;
  audioOutput: HTMLSelectElement | null;
  audioInput: HTMLSelectElement | null;
  audioStatus: HTMLElement | null;
      targets: {
        audio: HTMLElement;
        controls: HTMLElement;
        graphics: HTMLElement;
        advanced: HTMLElement;
        dev: HTMLElement;
  };
};

export type RuntimeSettingsPresenterOptions = {
  document: Document;
  windowRef: Window;
  localStorage: Storage;
  runtime: Record<string, any>;
  input: InputService;
  audio: AudioService;
  menu: SettingsMenuService;
  renderer: any;
  rendererService: any;
  shadows: any;
  shadowConfig: any;
  perf: any;
  readStorageFlag(key: string, fallback?: boolean): boolean;
  runtimeAsset(path: string, fallbackKey?: string | null): string | null;
  requestPointerLock(): void;
  resetCharacterToSpawn(): boolean;
  readCharacterPosition(): { x: number; y: number; z: number } | null;
  readFogSettings(): { enabled: boolean; far: number };
  readToneMappingMode(): string;
  readShadowsEnabled(): boolean;
  readStudTexturesEnabled(): boolean;
  setShadowsEnabled(value: boolean): boolean;
  setShadowQuality(value: string): any;
  setToneMappingMode(value: string): string;
  setRenderFog(value: boolean): any;
  setFogDistance(value: number): any;
  setRenderDistance(value: number, profile?: "performance" | "balanced" | "visual"): any;
  refreshStudMaterialTextures(): void;
  markSceneMaterialsForShaderUpdate(): void;
};

export type RuntimeSettingsPresenterRuntimeDeps = Pick<
  RuntimeSettingsPresenterOptions,
  "document" | "windowRef" | "localStorage" | "input" | "audio" | "menu"
>;

export type RuntimeSettingsPresenterMountOptions = Omit<RuntimeSettingsPresenterOptions, keyof RuntimeSettingsPresenterRuntimeDeps>;

export class RuntimeSettingsPresenterService {
  private presenter: RuntimeSettingsPresenter | null = null;

  constructor(private readonly deps: RuntimeSettingsPresenterRuntimeDeps) {}

  mount(options: RuntimeSettingsPresenterMountOptions): RuntimeSettingsPresenter {
    this.presenter = new RuntimeSettingsPresenter({ ...this.deps, ...options }).mount();
    return this.presenter;
  }

  current(): RuntimeSettingsPresenter | null {
    return this.presenter;
  }
}

export class RuntimeSettingsPresenter {
  private elements: RuntimeSettingsElementMap | null = null;
  private open = false;
  private gameSounds: Record<string, unknown> = {};
  private graphicsControls: {
    shadows?: HTMLInputElement;
    shadowQuality?: HTMLSelectElement;
    toneMapping?: HTMLSelectElement;
    studTextures?: HTMLInputElement;
    fog?: HTMLInputElement;
    fogDistance?: ReturnType<SettingsMenuService["createSlider"]>;
    renderDistance?: ReturnType<SettingsMenuService["createSlider"]>;
  } = {};

  constructor(private readonly options: RuntimeSettingsPresenterOptions) {}

  mount(): this {
    const elements = this.queryElements();
    this.elements = elements;
    elements.panel.style.cursor = "auto";
    if (elements.chat) elements.chat.style.cursor = "auto";
    this.options.menu.attach({
      panel: elements.panel,
      overlay: elements.overlay,
      title: elements.title,
      reloadNotice: elements.reloadNotice,
      status: elements.status,
      targets: elements.targets
    });
    this.options.audio.attach({
      outputSelect: elements.audioOutput,
      inputSelect: elements.audioInput,
      status: elements.audioStatus
    });
    this.gameSounds = this.options.audio.registerGameSounds({
      oof: this.options.runtimeAsset("sounds.oofSound", "oofSound") || undefined
    });
    this.installWindowApi();
    this.installMenuHandlers();
    this.installHudHandlers();
    this.buildControls();
    void this.options.audio.populateDevices().catch(() => {});
    this.setOpen(false);
    return this;
  }

  isOpen(): boolean {
    return this.open;
  }

  panel(): HTMLElement | null {
    return this.elements?.panel ?? null;
  }

  startGameSession(): void {
    this.options.audio.markCanPlaySounds();
    this.options.input.markGameStarted();
    this.options.document.body.classList.add("vw-game-started");
    this.options.requestPointerLock();
  }

  setOpen(open: boolean, options: { resume?: boolean; immediate?: boolean } = {}): void {
    this.open = Boolean(open);
    this.options.menu.setOpen(this.open);
    this.options.input.setPauseOpen(this.open);
    if (this.open) {
      this.refreshStatus();
      void this.options.audio.populateDevices().catch(() => {});
      if (this.options.document.pointerLockElement) this.options.document.exitPointerLock?.();
    } else if (options.resume) {
      if (!this.options.audio.canPlay()) this.startGameSession();
      else this.options.input.requestResume({ immediate: Boolean(options.immediate) });
    }
    this.syncOverlay();
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  setTab(tabName: string): void {
    this.options.menu.setTab(tabName || "game");
    this.refreshStatus();
  }

  syncOverlay(): void {
    this.options.menu.syncOverlay(this.options.input.overlayState());
  }

  routeClickUnderCursor(cursorOver: (element: Element) => boolean): boolean {
    return this.options.menu.routeCursorClick(cursorOver);
  }

  showReloadNotice(): void {
    this.options.menu.showReloadNotice();
  }

  hideReloadNotice(): void {
    this.options.menu.hideReloadNotice();
  }

  refreshStatus(): void {
    const quality = (this.options.windowRef as any).VortexQuality?.get?.();
    const pos = this.options.readCharacterPosition();
    const config = this.options.runtime.platform?.bridgeConfig;
    const gameId = config?.officialGameId || new URLSearchParams(this.options.windowRef.location.search).get("VortexGameId") || "-";
    const playerCount = this.options.document.querySelectorAll("#lb-body [data-player-id]").length || 1;
    const fog = this.options.readFogSettings();
    const renderChunks = quality?.caches?.renderChunks;
    const profile = this.readGraphicsPreset(quality);
    this.options.menu.renderStatus([
      ["Game", `#${gameId}`],
      ["Players", String(playerCount)],
      ["Position", pos ? `${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)}` : "-"],
      ["Avatar", "GLB"],
      ["Renderer", this.options.renderer.userData?.vwebBackend || this.options.rendererService.detectRendererBackend(this.options.renderer)],
      ["Shadows", this.options.shadows.snapshot().technique],
      ["Fog", fog.enabled ? `${fog.far} studs` : "Off"],
      ["Render distance", renderChunks?.cullDistance ? `${renderChunks.cullDistance} studs` : "-"],
      ["Graphics", formatPresetLabel(profile)]
    ]);
  }

  private installWindowApi(): void {
    (this.options.windowRef as any).VortexMenu = {
      open: () => this.setOpen(true),
      close: () => this.setOpen(false),
      toggle: () => this.toggle(),
      isOpen: () => this.open,
      tab: (tab: string) => this.setTab(tab)
    };
  }

  private installMenuHandlers(): void {
    const elements = this.requireElements();
    elements.panel.addEventListener("click", (event) => {
      const target = event.target as Element | null;
      const tabButton = target?.closest?.("[data-settings-tab]") as HTMLElement | null;
      if (tabButton) {
        this.setTab(tabButton.dataset.settingsTab || "game");
        return;
      }
      const action = (target?.closest?.("[data-menu-action]") as HTMLElement | null)?.dataset.menuAction;
      if (!action) return;
      if (action === "resume") this.setOpen(false, { resume: true, immediate: true });
      if (action === "reset-character") {
        this.options.resetCharacterToSpawn();
        this.refreshStatus();
      }
      if (action === "leave") this.options.windowRef.location.href = this.gamePageUrl();
      if (action === "reload-now") this.reloadGamePage();
    });

    this.options.document.addEventListener("keydown", (event) => {
      if (!matchesKeybind(event, "settings", this.options.localStorage)) return;
      if ((this.options.windowRef as any)._chatFocused) return;
      event.preventDefault();
      if (this.open) this.setOpen(false, { resume: true });
      else if (this.options.input.gameHasFocus()) this.setOpen(true);
    }, true);
  }

  private installHudHandlers(): void {
    this.options.document.getElementById("settings-btn")?.addEventListener("click", () => {
      this.setOpen(true);
    });
  }

  private buildControls(): void {
    const elements = this.requireElements();
    const menu = this.options.menu;
    const audio = this.options.audio;
    const makeSlider = (label: string, min: number, max: number, value: number, step: number, onChange: (input: HTMLInputElement, value: number) => void, config: { target?: HTMLElement; storageKey?: string; formatter?: (value: number) => string } = {}) => {
      return menu.createSlider({
        label,
        min,
        max,
        defaultValue: value,
        step,
        storageKey: config.storageKey || label,
        formatter: config.formatter || ((next) => String(next)),
        target: config.target || menu.inferTarget(label),
        onChange: (input, next) => {
          onChange(input, next);
          this.refreshStatus();
        }
      });
    };
    const makeToggle = (label: string, checked: boolean, onChange: (checked: boolean, input: HTMLInputElement) => void, target = elements.targets.advanced) => {
      return menu.createToggle({
        label,
        checked,
        target,
        onChange: (next, input) => {
          onChange(next, input);
          this.refreshStatus();
        }
      });
    };
    const makeSelect = (label: string, value: string, options: Array<{ value: string; label: string }>, onChange: (value: string, input: HTMLSelectElement) => void, target = elements.targets.advanced) => {
      return menu.createSelect({
        label,
        value,
        options,
        target,
        onChange: (next, input) => {
          onChange(next, input);
          this.refreshStatus();
        }
      });
    };
    const makeButtons = (buttons: Parameters<SettingsMenuService["createButtonRow"]>[0], target = elements.targets.dev) => menu.createButtonRow(buttons, target);

    const shadowDisabledReason = this.options.shadows.snapshot().disabledReason;
    let shadowQualitySelect: HTMLSelectElement | null = null;
    const syncShadowControls = (enabled = this.options.readShadowsEnabled()) => {
      const field = shadowQualitySelect?.closest(".vw-field") as HTMLElement | null;
      if (field) field.hidden = !enabled;
    };
    this.graphicsControls.shadows = menu.createToggle({
      label: shadowDisabledReason ? "Dynamic shadows (disabled for WebGPU)" : "Dynamic shadows",
      checked: this.options.readShadowsEnabled(),
      target: elements.targets.graphics,
      disabled: Boolean(shadowDisabledReason),
      onChange: (checked, input) => {
        input.checked = this.options.setShadowsEnabled(checked);
        syncShadowControls(input.checked);
        this.refreshStatus();
      }
    });
    shadowQualitySelect = makeSelect("Shadow quality", this.options.rendererService?.getShadowQuality?.() || this.options.shadowConfig.quality || "medium", [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
      { value: "ultra", label: "Ultra" }
    ], (value) => this.options.setShadowQuality(value), elements.targets.graphics);
    this.graphicsControls.shadowQuality = shadowQualitySelect;
    shadowQualitySelect.title = "Applies immediately. Higher quality uses larger cascaded shadow maps.";
    shadowQualitySelect.closest(".vw-field")?.classList.add("vw-dependent-setting");
    syncShadowControls();

    makeSlider("Master volume", 0, 1, 1, 0.05, (_slider, value) => audio.setMasterVolume(value), { target: elements.targets.audio, storageKey: "Master volume", formatter: (value) => audio.volumeLabel(value) });
    makeSlider("Music volume", 0, 1, 0.9, 0.05, (_slider, value) => audio.setMusicVolume(value), { target: elements.targets.audio, storageKey: "Music volume", formatter: (value) => audio.volumeLabel(value) });
    makeSlider("Sfx volume", 0, 1, 1, 0.05, (_slider, value) => audio.setSfxVolume(value), { target: elements.targets.audio, storageKey: "Sfx volume", formatter: (value) => audio.volumeLabel(value) });
    makeSlider("Chat volume", 0, 1, 1, 0.05, (_slider, value) => audio.setChatVolume(value), { target: elements.targets.audio, storageKey: "Chat volume", formatter: (value) => audio.volumeLabel(value) });

    makeButtons([
      { label: "Refresh devices", onclick: async () => { await audio.populateDevices().catch(() => {}); } },
      { label: "Enable microphone list", onclick: async () => { await audio.requestMicrophoneDeviceList((message) => (this.options.windowRef as any).Chat?.warn?.(message)); }, requiresUserGesture: true },
      { label: "Test output", primary: true, onclick: () => audio.testOutput(), requiresUserGesture: true }
    ], elements.targets.audio);

    this.graphicsControls.toneMapping = makeSelect("Tone mapping", this.options.readToneMappingMode(), [
      { value: "none", label: "None - fastest" },
      { value: "agx", label: "AgX - richer colour" },
      { value: "aces", label: "ACES - cinematic" }
    ], (value) => this.options.setToneMappingMode(value), elements.targets.graphics);

    const presetRow = makeButtons([
      { label: "Performance", primary: this.readGraphicsPreset() === "performance", onclick: () => this.applyGraphicsPreset("performance") },
      { label: "Balanced", primary: this.readGraphicsPreset() === "balanced", onclick: () => this.applyGraphicsPreset("balanced") },
      { label: "Visual", primary: this.readGraphicsPreset() === "visual", onclick: () => this.applyGraphicsPreset("visual") }
    ], elements.targets.graphics);
    presetRow.classList.add("vw-preset-row");
    this.syncPresetButtons(this.readGraphicsPreset());

    this.graphicsControls.studTextures = makeToggle("Stud textures", this.options.readStudTexturesEnabled(), (checked) => {
      this.options.localStorage.setItem("vwebStudTextures", checked ? "1" : "0");
      this.options.refreshStudMaterialTextures();
      this.options.markSceneMaterialsForShaderUpdate();
    }, elements.targets.graphics);
    this.graphicsControls.studTextures.title = "Uses loaded stud diffuse/normal textures. Disable if texture state causes dark map rendering.";

    let fogDistanceControl: ReturnType<typeof makeSlider> | null = null;
    const syncFogControls = (enabled = this.options.readFogSettings().enabled) => {
      if (fogDistanceControl) fogDistanceControl.container.hidden = !enabled;
    };
    this.graphicsControls.fog = makeToggle("Render fog", this.options.readFogSettings().enabled, (checked) => {
      this.options.setRenderFog(checked);
      syncFogControls(checked);
    }, elements.targets.graphics);
    fogDistanceControl = makeSlider("Fog distance", 160, 4000, this.options.readFogSettings().far, 20, (_slider, value) => this.options.setFogDistance(value), {
      target: elements.targets.graphics,
      storageKey: "vwebFogDistance",
      formatter: (value) => `${Math.round(Number(value))} studs`
    });
    this.graphicsControls.fogDistance = fogDistanceControl;
    fogDistanceControl.container.classList.add("vw-dependent-setting");
    syncFogControls();
    const currentRenderDistance = Number((this.options.windowRef as any).VortexQuality?.get?.()?.caches?.renderChunks?.cullDistance)
      || Number(this.options.localStorage.getItem("vwebRenderDistance"))
      || 1200;
    const renderDistanceControl = makeSlider("Render distance", 200, 2600, currentRenderDistance, 50, (_slider, value) => {
      this.options.localStorage.setItem("vwebRenderDistance", String(Math.round(value)));
      this.options.setRenderDistance(value, this.readGraphicsPreset());
    }, {
      target: elements.targets.graphics,
      storageKey: "vwebRenderDistance",
      formatter: (value) => `${Math.round(Number(value))} studs`
    });
    this.graphicsControls.renderDistance = renderDistanceControl;
    renderDistanceControl.container.title = "Controls chunk streaming distance. Nearby chunks stay visible; farther chunks can hide outside camera view.";
    makeToggle("Hide first-person body", this.options.readStorageFlag("vwebHideFirstPersonBody", true), (checked) => {
      this.options.localStorage.setItem("vwebHideFirstPersonBody", checked ? "1" : "0");
    }, elements.targets.graphics).title = "Hides your local avatar and its shadow while the camera is in first person.";

    const graphicsApiSelect = makeSelect("Graphics API", "webgpu", [{ value: "webgpu", label: "WebGPU" }], () => {
      this.options.localStorage.setItem("vwebRendererBackend", "webgpu");
    }, elements.targets.advanced);
    graphicsApiSelect.disabled = true;
    graphicsApiSelect.title = "Vortex Web targets WebGPU only.";

    makeToggle("Antialias", this.options.readStorageFlag("vwebAntialias", false), (checked) => {
      this.options.localStorage.setItem("vwebAntialias", checked ? "1" : "0");
      this.showReloadNotice();
    }, elements.targets.advanced);

    makeToggle("Rapier diagnostics", this.options.localStorage.getItem("vwebRapierEnabled") === "1", (checked) => {
      this.options.localStorage.setItem("vwebRapierEnabled", checked ? "1" : "0");
      this.showReloadNotice();
    }, elements.targets.advanced).title = "Optional side-by-side physics diagnostics. Keep off for normal gameplay performance.";

    makeSlider("Pixel ratio cap", 0.5, 1, this.options.renderer.getPixelRatio(), 0.05, (_slider, value) => {
      this.options.renderer.setPixelRatio(Math.max(0.5, Math.min(1, value)));
    }, {
      target: elements.targets.advanced,
      storageKey: "vwebPixelRatioCap",
      formatter: (value) => `${Number(value).toFixed(2)}x`
    });

    makeToggle("Frame profiler", Boolean(this.options.perf.enabled), (checked) => this.options.perf.setEnabled(checked), elements.targets.dev);
    makeToggle("Console timing log", Boolean(this.options.perf.log), (checked) => this.options.perf.setLog(checked), elements.targets.dev);
    const luaAvailable = this.options.runtime.scripting.canUseLua();
    const luaToggle = makeToggle("Lua tools", this.options.runtime.scripting.isEnabled(), (checked) => {
      this.options.runtime.scripting.setEnabled(checked);
    }, elements.targets.dev);
    luaToggle.title = "Enables local-only Lua scripts. Scripts do not replicate to native Vortex clients.";
    luaToggle.classList.toggle("disabled", !luaAvailable);
    luaToggle.querySelector("input")?.toggleAttribute("disabled", !luaAvailable);

    const devRow = makeButtons([
      {
        label: "Sample FPS",
        primary: true,
        onclick: async () => this.sampleFps()
      },
      { label: luaAvailable ? "Open Lua explorer" : "Lua locked", onclick: () => this.options.runtime.scriptExplorer?.open?.() },
      { label: "Show runtime panel", onclick: () => {} },
      { label: "Chunk boxes", onclick: () => {} },
      { label: "Dump chunks", onclick: () => this.dumpChunks() },
      { label: "Scene diagnose", onclick: () => this.diagnoseScene() }
    ], elements.targets.dev);
    this.installDevToggleButton(devRow, 2, "Show runtime panel", "Hide runtime panel", (enabled) => {
      const tools = (this.options.windowRef as any).VortexRuntimeDevTools;
      if (enabled) tools?.enable?.();
      else tools?.disable?.();
    });
    this.installDevToggleButton(devRow, 3, "Show chunk boxes", "Hide chunk boxes", (enabled) => {
      const chunks = (this.options.windowRef as any).VortexChunkDebug;
      if (enabled) chunks?.show?.();
      else chunks?.hide?.();
    });

    const stressRow = makeButtons([
      { label: "Spawn football", onclick: () => this.options.runtime.sandbox?.spawnFootball?.(this.options.runtime) },
      { label: "Start stress 250/s", onclick: () => {} },
      { label: "Chunk view culling", onclick: () => this.toggleChunkViewCulling() }
    ], elements.targets.dev);
    this.installDevToggleButton(stressRow, 1, "Start stress 250/s", "Stop stress", (enabled) => {
      if (enabled) {
        (this.options.windowRef as any).VortexRuntimeDevTools?.enable?.();
        this.options.runtime.sandbox?.startStress?.(this.options.runtime, 250);
      } else {
        this.options.runtime.sandbox?.clear?.(this.options.runtime);
      }
    });
  }

  private installDevToggleButton(row: HTMLElement, index: number, offLabel: string, onLabel: string, apply: (enabled: boolean) => void): void {
    const button = row.querySelectorAll<HTMLButtonElement>("button").item(index);
    if (!button) return;
    let enabled = false;
    const sync = () => {
      button.textContent = enabled ? onLabel : offLabel;
      button.classList.toggle("primary", enabled);
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
    };
    button.onclick = () => {
      enabled = !enabled;
      apply(enabled);
      sync();
      this.refreshStatus();
    };
    sync();
  }

  private dumpChunks(): void {
    const chunks = (this.options.windowRef as any).VortexChunkDebug;
    const rows = chunks?.rows?.() || [];
    const snapshot = chunks?.snapshot?.() || this.options.runtime.world?.renderChunkSnapshot?.() || null;
    const output = this.elements?.output;
    if (output) {
      output.textContent = JSON.stringify({
        snapshot,
        rows: rows.slice?.(0, 30) || rows
      }, null, 2);
    }
  }

  private toggleChunkViewCulling(): void {
    const chunks = (this.options.windowRef as any).VortexChunkDebug;
    const snapshot = chunks?.snapshot?.() || this.options.runtime.world?.renderChunkSnapshot?.();
    const next = !snapshot?.viewCullingEnabled;
    const result = chunks?.setViewCulling?.(next);
    const output = this.elements?.output;
    if (output) output.textContent = JSON.stringify(result || { viewCullingEnabled: next }, null, 2);
    this.refreshStatus();
  }

  private async sampleFps(): Promise<void> {
    const output = this.elements?.output;
    if (!output) return;
    output.textContent = "Sampling...";
    try {
      const report = await this.options.perf.sample(2);
      output.textContent = JSON.stringify({
        fps: report.cadence.estimatedPresentedFps,
        frame: report.sections.frame,
        render: report.sections.render,
        calls: report.renderer.calls,
        triangles: report.renderer.triangles
      }, null, 2);
      this.refreshStatus();
    } catch (error: any) {
      output.textContent = `Sample failed: ${error?.message || error}`;
    }
  }

  private readGraphicsPreset(quality = (this.options.windowRef as any).VortexQuality?.get?.()): "performance" | "balanced" | "visual" {
    const value = this.options.localStorage.getItem("vwebRenderDistanceProfile") || quality?.renderDistanceProfile;
    return value === "performance" || value === "visual" ? value : "balanced";
  }

  private applyGraphicsPreset(profile: "performance" | "balanced" | "visual"): void {
    const quality = (this.options.windowRef as any).VortexQuality;
    if (profile === "performance") quality?.performance?.();
    else if (profile === "visual") quality?.visual?.();
    else quality?.balanced?.();
    this.syncPresetButtons(profile);
    this.syncGraphicsControls();
    this.refreshStatus();
  }

  private syncGraphicsControls(): void {
    const quality = (this.options.windowRef as any).VortexQuality?.get?.();
    const renderChunks = quality?.caches?.renderChunks;
    const controls = this.graphicsControls;

    if (controls.shadows) controls.shadows.checked = this.options.readShadowsEnabled();
    if (controls.shadowQuality) controls.shadowQuality.value = this.options.rendererService?.getShadowQuality?.() || this.options.shadowConfig.quality || "medium";
    if (controls.toneMapping) controls.toneMapping.value = this.options.readToneMappingMode();
    if (controls.studTextures) controls.studTextures.checked = this.options.readStudTexturesEnabled();

    const fog = this.options.readFogSettings();
    if (controls.fog) controls.fog.checked = fog.enabled;
    if (controls.fogDistance) {
      controls.fogDistance.container.hidden = !fog.enabled;
      controls.fogDistance.input.value = String(fog.far);
      controls.fogDistance.value.textContent = `${Math.round(Number(fog.far))} studs`;
    }

    const renderDistance = Number(renderChunks?.cullDistance)
      || Number(this.options.localStorage.getItem("vwebRenderDistance"))
      || 1200;
    if (controls.renderDistance) {
      controls.renderDistance.input.value = String(renderDistance);
      controls.renderDistance.value.textContent = `${Math.round(renderDistance)} studs`;
    }
  }

  private syncPresetButtons(profile: "performance" | "balanced" | "visual"): void {
    const row = this.elements?.targets.graphics.querySelector(".vw-preset-row");
    if (!row) return;
    for (const button of row.querySelectorAll<HTMLButtonElement>("button")) {
      const value = button.textContent?.trim().toLowerCase();
      const active = value === profile;
      button.classList.toggle("primary", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  private diagnoseScene(): void {
    const report = (this.options.windowRef as any).VortexQuality?.diagnoseScene?.();
    const output = this.elements?.output;
    if (!output) return;
    output.textContent = JSON.stringify({
      backend: report?.renderer?.backend,
      fog: report?.fog,
      shadows: report?.shadows,
      scene: report?.scene,
      darkSamples: report?.darkSamples?.slice?.(0, 5)
    }, null, 2);
  }

  private reloadGamePage(): void {
    this.options.localStorage.removeItem("vwebRuntimeDevTools");
    this.options.windowRef.location.reload();
  }

  private gamePageUrl(): string {
    const id = this.options.runtime.platform?.bridgeConfig?.officialGameId || new URLSearchParams(this.options.windowRef.location.search).get("VortexGameId") || 1;
    return `https://playvortex.io/games/${encodeURIComponent(id)}`;
  }

  private queryElements(): RuntimeSettingsElementMap {
    const panel = this.options.document.getElementById("settings-panel");
    if (!panel) throw new Error("[settings] settings panel is required.");
    return {
      panel,
      overlay: this.options.document.getElementById("overlay"),
      chat: this.options.document.getElementById("chat-window"),
      output: this.options.document.getElementById("vw-dev-output"),
      status: this.options.document.getElementById("vw-session-status"),
      reloadNotice: this.options.document.getElementById("vw-reload-notice"),
      title: this.options.document.getElementById("vw-menu-title"),
      audioOutput: this.options.document.getElementById("vw-audio-output") as HTMLSelectElement | null,
      audioInput: this.options.document.getElementById("vw-audio-input") as HTMLSelectElement | null,
      audioStatus: this.options.document.getElementById("vw-audio-status"),
      targets: {
        audio: this.options.document.getElementById("vw-audio-controls") || panel,
        controls: this.options.document.getElementById("vw-controls") || panel,
        graphics: this.options.document.getElementById("vw-graphics-controls") || panel,
        advanced: this.options.document.getElementById("vw-advanced-controls") || panel,
        dev: this.options.document.getElementById("vw-dev-controls") || panel
      }
    };
  }

  private requireElements(): RuntimeSettingsElementMap {
    if (!this.elements) throw new Error("[settings] RuntimeSettingsPresenter is not mounted.");
    return this.elements;
  }
}

function formatPresetLabel(value: "performance" | "balanced" | "visual"): string {
  return value === "performance" ? "Performance" : value === "visual" ? "Visual" : "Balanced";
}
