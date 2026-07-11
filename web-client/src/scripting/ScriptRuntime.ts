import type { DiagnosticsService } from "../diagnostics/DiagnosticsService";
import type { EventBus } from "../runtime/EventBus";
import type { RuntimeEventMap } from "../runtime/types";
import { LocalScriptStore, type LocalLuaScript } from "./LocalScriptStore";
import { LuaAdapter, type LuaScriptSession } from "./LuaAdapter";
import { PermissionSet, type ScriptPermission } from "./permissions";
import type { ScriptUiElementInput, ScriptUiService } from "./ScriptUiService";

export type ScriptLanguage = "js-module" | "lua";

export type ScriptPackage = {
  id: string;
  apiVersion: number;
  language: ScriptLanguage;
  sourceUrl?: string;
  source?: string;
  integrity?: string;
  permissions?: ScriptPermission[];
};

export const SCRIPT_API_VERSION = 1;

export type ScriptLogEntry = {
  at: number;
  level: "info" | "warn" | "error";
  message: string;
};

export type ScriptSessionInfo = {
  id: string;
  name: string;
};

export type ScriptPlayerInfo = {
  id: unknown;
  name: string;
  local: boolean;
};

export type ScriptVector3 = [number, number, number];

export type ScriptTransform = {
  position?: ScriptVector3;
  rotation?: ScriptVector3;
  scale?: ScriptVector3;
};

export type ScriptPlayerRoot = {
  position?: { x?: number; y?: number; z?: number };
  rotation?: { x?: number; y?: number; z?: number };
  scale?: { x?: number; y?: number; z?: number };
  userData?: Record<string, unknown>;
};

export type ScriptWorldPartInput = {
  position?: unknown;
  size?: unknown;
  rotation?: unknown;
  color?: unknown;
  transparency?: unknown;
  canCollide?: unknown;
  shape?: unknown;
  type?: unknown;
};

export type ScriptWorldPartInfo = {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
};

export type ScriptWorldPartSnapshot = {
  id: string;
  type: string;
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
  color?: number;
  transparency: number;
  canCollide: boolean;
  shape: string;
  batched: boolean;
};

export type ScriptRay = {
  origin: ScriptVector3;
  direction: ScriptVector3;
};

export type ScriptScreenPoint = {
  x: number;
  y: number;
  z: number;
  visible: boolean;
};

export type ScriptRayHit = {
  hit: boolean;
  point?: ScriptVector3;
  position?: ScriptVector3;
  normal?: ScriptVector3;
  distance?: number;
  collider?: unknown;
  partId?: string | null;
  part?: ScriptWorldPartSnapshot | null;
};

export type ScriptMouseButton = "left" | "middle" | "right";

export type ScriptInputEvent =
  | {
      type: "click";
      button: ScriptMouseButton;
      x: number;
      y: number;
    }
  | {
      type: "keydown" | "keyup";
      code: string;
      repeat: boolean;
      altKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      shiftKey: boolean;
    };

export type ScriptChatMessageEvent = {
  type: "incoming" | "outgoing";
  username?: string;
  playerId?: number;
  text: string;
  self?: boolean;
  staff?: boolean;
  owner?: boolean;
  booster?: boolean;
  cancel?: boolean;
};

export type ScriptRuntimeContext = {
  documentRef: Document;
  windowRef: Window;
  storage: Pick<Storage, "getItem" | "setItem">;
  getLocalPlayer(): ScriptPlayerInfo | null;
  getPlayers(): ScriptPlayerInfo[];
  getPlayerRoot(query?: unknown): ScriptPlayerRoot | null;
  setPlayerBodyColors(query: unknown, colors: unknown): boolean;
  setPlayerTexture(query: unknown, slot: unknown, url: unknown): boolean;
  getLocalPosition(): [number, number, number] | null;
  getCameraState(): Record<string, unknown>;
  setCameraDistanceOverride(distance: unknown): Record<string, unknown>;
  clearCameraDistanceOverride(): Record<string, unknown>;
  screenPointToRay(x: unknown, y: unknown): ScriptRay;
  worldToScreen(point: unknown): ScriptScreenPoint;
  raycast(origin: unknown, direction: unknown, maxDistance?: unknown): ScriptRayHit;
  getMousePosition(): { x: number; y: number };
  isKeyDown(code: unknown): boolean;
  spawnWorldPart(input: ScriptWorldPartInput): ScriptWorldPartInfo;
  removeWorldPart(id: string): boolean;
  listWorldParts(): ScriptWorldPartSnapshot[];
  getWorldPart(id: unknown): ScriptWorldPartSnapshot | null;
  setWorldPartColor(id: unknown, color: unknown): unknown;
  setWorldPartTransparency(id: unknown, transparency: unknown): unknown;
  setWorldPartCollision(id: unknown, canCollide: unknown): unknown;
  setWorldMarker(id: unknown, input: ScriptWorldPartInput): ScriptWorldPartInfo;
  clearWorldMarker(id: unknown): boolean;
  walkLocalTo(position: unknown, options?: unknown): { ok: boolean; reason?: string; target?: ScriptVector3 };
  stopLocalWalk(): boolean;
  setMouseLook(enabled: boolean): void;
  setCursorImage(options: ScriptCursorOptions): ScriptCursorState;
  clearCursor(): ScriptCursorState;
  resolveAssetUrl(path: unknown): string | null;
  ui: ScriptUiService;
  sendChatMessage(text: string): void;
  systemChatMessage(text: string): void;
  snapshot(): Record<string, unknown>;
  hasLuaAccess(): boolean;
};

export type ScriptCursorOptions = {
  url?: unknown;
  width?: unknown;
  height?: unknown;
  hotspot?: unknown;
};

export type ScriptCursorState = {
  mode: "default" | "image";
  url?: string;
  width?: number;
  height?: number;
  hotspot?: ScriptVector3;
};

export class ScriptRuntime {
  private readonly packages = new Map<string, ScriptPackage>();
  private readonly lua = new LuaAdapter();
  private context: ScriptRuntimeContext | null = null;
  private store: LocalScriptStore | null = null;
  private enabled = false;
  private running = false;
  private readonly logEntries: ScriptLogEntry[] = [];
  private readonly ownedWorldParts = new Set<string>();
  private readonly worldMarkers = new Map<string, ScriptWorldPartInfo>();
  private readonly playerTransformOverrides = new Map<string, ScriptTransform>();
  private readonly sessions = new Map<string, LuaScriptSession>();
  private readonly sessionNames = new Map<string, string>();
  private inputEventsAttached = false;

  constructor(
    private readonly events: EventBus<RuntimeEventMap>,
    private readonly diagnostics: DiagnosticsService
  ) {}

  configure(context: ScriptRuntimeContext): this {
    this.context = context;
    this.store = new LocalScriptStore(context.storage);
    this.enabled = context.storage.getItem("vwebLuaToolsEnabled") === "1";
    this.attachInputEvents(context.documentRef);
    return this;
  }

  registerPackage(pkg: ScriptPackage): boolean {
    const rejection = validateScriptPackage(pkg);
    if (rejection) {
      this.events.emit("script:package-rejected", { reason: rejection });
      this.diagnostics.warn("script.package.rejected", { id: pkg.id, reason: rejection });
      return false;
    }
    this.packages.set(pkg.id, pkg);
    return true;
  }

  permissionsFor(id: string): PermissionSet {
    return new PermissionSet(this.packages.get(id)?.permissions ?? []);
  }

  setEnabled(enabled: boolean): boolean {
    this.enabled = Boolean(enabled) && this.canUseLua();
    this.context?.storage.setItem("vwebLuaToolsEnabled", this.enabled ? "1" : "0");
    return this.enabled;
  }

  isEnabled(): boolean {
    return this.enabled && this.canUseLua();
  }

  canUseLua(): boolean {
    return Boolean(this.context?.hasLuaAccess());
  }

  listLocalScripts(): LocalLuaScript[] {
    return this.store?.list() ?? [];
  }

  saveLocalScript(input: Partial<LocalLuaScript> & Pick<LocalLuaScript, "name" | "source">): LocalLuaScript {
    if (!this.store) throw new Error("Lua Editor is not configured yet.");
    return this.store.upsert(input);
  }

  deleteLocalScript(id: string): boolean {
    return this.store?.remove(id) ?? false;
  }

  async runLocalScript(idOrSource: string, maybeSource?: string, displayName?: string): Promise<void> {
    this.assertRunnable();
    const script = maybeSource == null ? this.store?.get(idOrSource) : null;
    const source = maybeSource ?? script?.source ?? idOrSource;
    if (!source.trim()) throw new Error("Script is empty.");
    this.running = true;
    this.log("info", `running ${script?.name || displayName || "Lua script"}`);
    try {
      await this.lua.run(source, {
        api: this.createLuaApi(),
        log: (level, message) => this.log(level, message),
        timeoutMs: 1000
      });
      this.log("info", "finished");
    } catch (error) {
      this.log("error", error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      this.running = false;
    }
  }

  async startLocalScript(idOrSource: string, maybeSource?: string, displayName?: string): Promise<void> {
    this.assertRunnable();
    const script = maybeSource == null ? this.store?.get(idOrSource) : null;
    const source = maybeSource ?? script?.source ?? idOrSource;
    const id = script?.id ?? sanitizeSessionId(idOrSource || `inline-${hashString(source)}`);
    const name = script?.name || displayName || id;
    if (!source.trim()) throw new Error("Script is empty.");
    await this.stopLocalScript(id);
    this.log("info", `starting ${name}`);
    try {
      const session = await this.lua.createSession({
        id,
        source,
        api: this.createLuaApi(),
        log: (level, message) => this.log(level, message),
        timeoutMs: 1000
      });
      this.sessions.set(id, session);
      this.sessionNames.set(id, name);
      this.log("info", `started ${name}`);
    } catch (error) {
      this.log("error", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async stopLocalScript(id?: string): Promise<boolean> {
    if (id) {
      const sessionId = this.resolveSessionId(id);
      if (!sessionId) return false;
      const session = this.sessions.get(sessionId);
      if (!session) return false;
      this.sessions.delete(sessionId);
      const name = this.sessionNames.get(sessionId) || sessionId;
      this.sessionNames.delete(sessionId);
      this.context?.stopLocalWalk();
      await session.dispose();
      this.log("info", `stopped ${name}`);
      return true;
    }
    const sessions = [...this.sessions.entries()];
    this.sessions.clear();
    this.sessionNames.clear();
    this.context?.stopLocalWalk();
    for (const [, session] of sessions) await session.dispose();
    if (sessions.length) this.log("info", `stopped ${sessions.length} script session(s)`);
    return sessions.length > 0;
  }

  private resolveSessionId(id: string): string | null {
    const raw = String(id || "").trim();
    if (!raw) return null;
    if (this.sessions.has(raw)) return raw;
    const normalized = sanitizeSessionId(raw);
    if (this.sessions.has(normalized)) return normalized;
    for (const [sessionId, name] of this.sessionNames) {
      if (sanitizeSessionId(name) === normalized) return sessionId;
    }
    return null;
  }

  clearLog(): void {
    this.logEntries.length = 0;
  }

  snapshot(): { configured: boolean; available: boolean; enabled: boolean; running: boolean; sessions: ScriptSessionInfo[]; scripts: LocalLuaScript[]; log: ScriptLogEntry[] } {
    return {
      configured: Boolean(this.context),
      available: this.canUseLua(),
      enabled: this.isEnabled(),
      running: this.running,
      sessions: [...this.sessions.keys()].map((id) => ({ id, name: this.sessionNames.get(id) || id })),
      scripts: this.listLocalScripts(),
      log: [...this.logEntries]
    };
  }

  private assertRunnable(): void {
    if (!this.context) throw new Error("Lua Editor is not configured yet.");
    if (!this.canUseLua()) throw new Error("Lua Editor requires the lua license feature.");
    if (!this.isEnabled()) throw new Error("Lua Editor is disabled.");
  }

  private createLuaApi(): Record<string, unknown> {
    const context = this.context;
    if (!context) return {};
    return {
      "players.localPlayer": () => context.getLocalPlayer(),
      "players.all": () => context.getPlayers(),
      "players.find": (query: unknown) => {
        const normalized = String(query ?? "").trim().toLowerCase();
        if (!normalized || normalized === "me" || normalized === "local") return context.getLocalPlayer();
        return context.getPlayers().find((player) => String(player.id) === normalized || player.name.toLowerCase().includes(normalized)) ?? null;
      },
      "players.getTransform": (query: unknown) => readTransform(context.getPlayerRoot(query)),
      "players.setTransform": (query: unknown, transform: unknown, options: unknown) => {
        const root = context.getPlayerRoot(query);
        if (!root) return false;
        const normalized = normalizeTransform(transform);
        applyTransform(root, normalized);
        const persist = !options || typeof options !== "object" || (options as Record<string, unknown>).persist !== false;
        const key = this.playerKey(query);
        if (persist) this.playerTransformOverrides.set(key, normalized);
        else this.playerTransformOverrides.delete(key);
        return true;
      },
      "players.clearTransform": (query: unknown) => {
        this.playerTransformOverrides.delete(this.playerKey(query));
        return true;
      },
      "players.setBodyColors": (query: unknown, colors: unknown) => context.setPlayerBodyColors(query, colors),
      "players.setBodyColor": (query: unknown, slot: unknown, color: unknown) => {
        const current = readBodyColorPatch(slot, color);
        return context.setPlayerBodyColors(query, current);
      },
      "players.setTexture": (query: unknown, slot: unknown, url: unknown) => context.setPlayerTexture(query, slot, url),
      "players.setOutfit": (query: unknown, outfit: unknown) => {
        if (!outfit || typeof outfit !== "object") return false;
        const record = outfit as Record<string, unknown>;
        let changed = false;
        for (const slot of ["shirt", "pants", "face"]) {
          if (record[slot] !== undefined) changed = context.setPlayerTexture(query, slot, record[slot]) || changed;
        }
        return changed;
      },
      "players.walkTo": (query: unknown, position: unknown, options: unknown) => {
        const key = this.playerKey(query);
        if (key !== "me" && key !== "local" && key !== "self") {
          return { ok: false, reason: "walkTo-currently-local-only" };
        }
        return context.walkLocalTo(position, options);
      },
      "players.stopWalking": (query: unknown) => {
        const key = this.playerKey(query);
        if (key !== "me" && key !== "local" && key !== "self") return false;
        return context.stopLocalWalk();
      },
      "players.flip": (query: unknown, enabled: unknown) => {
        const active = enabled !== false;
        const root = context.getPlayerRoot(query);
        if (!root) return false;
        const transform = { rotation: [active ? Math.PI : 0, 0, 0] as ScriptVector3 };
        applyTransform(root, transform);
        this.playerTransformOverrides.set(this.playerKey(query), transform);
        return true;
      },
      "cursor.setMode": (mode: unknown) => {
        const value = String(mode || "default").toLowerCase();
        if (value === "default") return context.clearCursor();
        if (value === "classic" || value === "roblox") {
          context.documentRef.body.classList.add("vw-lua-cursor-classic");
          return { mode: "classic" };
        }
        return context.setCursorImage({ url: String(mode || "") });
      },
      "cursor.setImage": (options: unknown) => context.setCursorImage(normalizeCursorOptions(options)),
      "cursor.clear": () => context.clearCursor(),
      "cursor.setClickToWalk": (enabled: unknown) => {
        const active = enabled === true;
        context.documentRef.body.classList.toggle("vw-lua-click-to-walk", active);
        if (active) context.setMouseLook(false);
        return active;
      },
      "cursor.setWorldMarker": (input: unknown) => {
        const normalized = normalizeWorldPartInput(input);
        const record = input && typeof input === "object" ? input as Record<string, unknown> : {};
        const id = String(record.id || "cursor").trim() || "cursor";
        const marker = context.setWorldMarker(id, normalized);
        this.ownedWorldParts.add(marker.id);
        this.worldMarkers.set(id, marker);
        return marker;
      },
      "cursor.worldMarker": (id: unknown) => this.worldMarkers.get(String(id || "cursor").trim() || "cursor") ?? null,
      "camera.state": () => context.getCameraState(),
      "camera.setDistanceOverride": (distance: unknown) => context.setCameraDistanceOverride(distance),
      "camera.clearDistanceOverride": () => context.clearCameraDistanceOverride(),
      "camera.screenPointToRay": (x: unknown, y: unknown) => context.screenPointToRay(x, y),
      "camera.worldToScreen": (point: unknown) => context.worldToScreen(point),
      "input.mousePosition": () => context.getMousePosition(),
      "input.isDown": (code: unknown) => context.isKeyDown(code),
      "input.viewport": () => context.ui.viewport(),
      "assets.url": (path: unknown) => context.resolveAssetUrl(path),
      "assets.image": (path: unknown) => context.resolveAssetUrl(path),
      "physics.raycast": (origin: unknown, direction: unknown, maxDistance: unknown) => context.raycast(origin, direction, maxDistance),
      "ui.layer": (layer: unknown) => context.ui.layer(layer),
      "ui.clear": (layer: unknown) => context.ui.clear(layer),
      "ui.viewport": () => context.ui.viewport(),
      "ui.measureText": (text: unknown, options: unknown) => context.ui.measureText(text, normalizeUiInput(options)),
      "ui.text": (layer: unknown, input: unknown) => context.ui.text(layer, normalizeUiInput(input)),
      "ui.rect": (layer: unknown, input: unknown) => context.ui.rect(layer, normalizeUiInput(input)),
      "ui.image": (layer: unknown, input: unknown) => context.ui.image(layer, normalizeUiInput(input)),
      "ui.button": (layer: unknown, input: unknown) => context.ui.button(layer, normalizeUiInput(input)),
      "ui.panel": (layer: unknown, input: unknown) => context.ui.panel(layer, normalizeUiInput(input)),
      "ui.line": (layer: unknown, input: unknown) => context.ui.line(layer, normalizeUiInput(input)),
      "ui.polyline": (layer: unknown, input: unknown) => context.ui.polyline(layer, normalizeUiInput(input)),
      "ui.circle": (layer: unknown, input: unknown) => context.ui.circle(layer, normalizeUiInput(input)),
      "ui.progress": (layer: unknown, input: unknown) => context.ui.progress(layer, normalizeUiInput(input)),
      "ui.chart": (layer: unknown, input: unknown) => context.ui.chart(layer, normalizeUiInput(input)),
      "ui.update": (layer: unknown, id: unknown, input: unknown) => context.ui.update(layer, id, normalizeUiInput(input)),
      "ui.remove": (layer: unknown, id: unknown) => context.ui.remove(layer, id),
      "chat.send": (text: unknown) => {
        const value = String(text ?? "").trim();
        if (!value) return false;
        context.sendChatMessage(value);
        return true;
      },
      "chat.system": (text: unknown) => {
        context.systemChatMessage(String(text ?? ""));
        return true;
      },
      "world.localPosition": () => context.getLocalPosition(),
      "world.parts": () => context.listWorldParts(),
      "world.getPart": (id: unknown) => context.getWorldPart(id),
      "world.spawnPart": (input: unknown) => {
        const part = context.spawnWorldPart(normalizeWorldPartInput(input));
        this.ownedWorldParts.add(part.id);
        return part;
      },
      "world.setColor": (id: unknown, color: unknown) => context.setWorldPartColor(id, color),
      "world.setTransparency": (id: unknown, transparency: unknown) => context.setWorldPartTransparency(id, transparency),
      "world.setCollision": (id: unknown, canCollide: unknown) => context.setWorldPartCollision(id, canCollide),
      "world.setCanCollide": (id: unknown, canCollide: unknown) => context.setWorldPartCollision(id, canCollide),
      "world.setMarker": (id: unknown, input: unknown) => {
        const key = String(id || "marker").trim() || "marker";
        const marker = context.setWorldMarker(key, normalizeWorldPartInput(input));
        this.ownedWorldParts.add(marker.id);
        this.worldMarkers.set(key, marker);
        return marker;
      },
      "world.marker": (id: unknown) => this.worldMarkers.get(String(id || "marker").trim() || "marker") ?? null,
      "world.clearMarker": (id: unknown) => {
        const key = String(id || "marker").trim() || "marker";
        this.worldMarkers.delete(key);
        return context.clearWorldMarker(key);
      },
      "world.remove": (id: unknown) => {
        const value = String(id || "").trim();
        if (!value || !this.ownedWorldParts.has(value)) return false;
        const removed = context.removeWorldPart(value);
        if (removed) this.ownedWorldParts.delete(value);
        return removed;
      },
      "world.clearMine": () => {
        let removed = 0;
        for (const id of [...this.ownedWorldParts]) {
          if (context.removeWorldPart(id)) removed += 1;
          this.ownedWorldParts.delete(id);
        }
        return removed;
      },
      "debug.snapshot": () => context.snapshot()
    };
  }

  applyFrame(): void {
    const context = this.context;
    if (context && this.playerTransformOverrides.size) {
      for (const [query, transform] of this.playerTransformOverrides) {
        applyTransform(context.getPlayerRoot(query), transform);
      }
    }
  }

  update(dt: number): void {
    this.applyFrame();
    if (!this.sessions.size) return;
    for (const [id, session] of this.sessions) {
      void session.update(dt).catch((error) => {
        this.log("error", `[${id}] ${error instanceof Error ? error.message : String(error)}`);
      });
    }
  }

  dispatchInput(event: ScriptInputEvent): void {
    if (!this.sessions.size || !this.isEnabled()) return;
    for (const [id, session] of this.sessions) {
      void session.input(event).catch((error) => {
        this.log("error", `[${id}] ${error instanceof Error ? error.message : String(error)}`);
      });
    }
  }

  dispatchIncomingChat(event: ScriptChatMessageEvent): void {
    if (!this.sessions.size || !this.isEnabled()) return;
    const normalized = normalizeChatEvent(event);
    for (const [id, session] of this.sessions) {
      void session.chatIncoming(normalized).catch((error) => {
        this.log("error", `[${id}] ${error instanceof Error ? error.message : String(error)}`);
      });
    }
  }

  async dispatchOutgoingChat(text: string): Promise<{ cancel: boolean; text: string }> {
    if (!this.sessions.size || !this.isEnabled()) return { cancel: false, text };
    let event: ScriptChatMessageEvent = { type: "outgoing", text };
    for (const [id, session] of this.sessions) {
      try {
        event = normalizeChatEvent(await session.chatOutgoing(event), event);
        if (event.cancel) return { cancel: true, text: event.text };
      } catch (error) {
        this.log("error", `[${id}] ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return { cancel: Boolean(event.cancel), text: event.text };
  }

  private attachInputEvents(documentRef: Document): void {
    if (this.inputEventsAttached) return;
    this.inputEventsAttached = true;
    documentRef.addEventListener("mousedown", (event) => {
      if (shouldIgnoreScriptInput(event, documentRef, this.context?.windowRef)) return;
      this.dispatchInput({
        type: "click",
        button: pointerButtonName(event.button),
        x: event.clientX,
        y: event.clientY
      });
    });
    documentRef.addEventListener("vortex-input-keydown", (event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
      this.dispatchInput({
        type: "keydown",
        code: String(detail.code || ""),
        repeat: detail.repeat === true,
        altKey: detail.altKey === true,
        ctrlKey: detail.ctrlKey === true,
        metaKey: detail.metaKey === true,
        shiftKey: detail.shiftKey === true
      });
    });
    documentRef.addEventListener("vortex-input-keyup", (event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
      this.dispatchInput({
        type: "keyup",
        code: String(detail.code || ""),
        repeat: detail.repeat === true,
        altKey: detail.altKey === true,
        ctrlKey: detail.ctrlKey === true,
        metaKey: detail.metaKey === true,
        shiftKey: detail.shiftKey === true
      });
    });
  }

  private playerKey(query: unknown): string {
    const raw = String(query ?? "me").trim().toLowerCase();
    return raw || "me";
  }

  private log(level: ScriptLogEntry["level"], message: string): void {
    this.logEntries.push({ at: Date.now(), level, message });
    if (this.logEntries.length > 200) this.logEntries.splice(0, this.logEntries.length - 200);
    this.diagnostics[level === "error" ? "warn" : "info"]?.("script.lua", { level, message });
  }
}

function pointerButtonName(button: number): ScriptMouseButton {
  if (button === 1) return "middle";
  if (button === 2) return "right";
  return "left";
}

function normalizeChatEvent(value: unknown, fallback?: ScriptChatMessageEvent): ScriptChatMessageEvent {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const text = String(record.text ?? fallback?.text ?? "");
  const event: ScriptChatMessageEvent = {
    type: record.type === "incoming" ? "incoming" : "outgoing",
    text: text.slice(0, 500),
  };
  const username = record.username === undefined ? fallback?.username : String(record.username);
  const playerId = readOptionalPositiveNumber(record.playerId ?? record.id ?? fallback?.playerId);
  const self = record.self === undefined ? fallback?.self : record.self === true;
  const staff = record.staff === undefined ? fallback?.staff : record.staff === true;
  const owner = record.owner === undefined ? fallback?.owner : record.owner === true;
  const booster = record.booster === undefined ? fallback?.booster : record.booster === true;
  const cancel = record.cancel === undefined ? fallback?.cancel : record.cancel === true;
  if (username !== undefined) event.username = username;
  if (playerId !== undefined) event.playerId = playerId;
  if (self !== undefined) event.self = self;
  if (staff !== undefined) event.staff = staff;
  if (owner !== undefined) event.owner = owner;
  if (booster !== undefined) event.booster = booster;
  if (cancel !== undefined) event.cancel = cancel;
  return event;
}

function readOptionalPositiveNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function shouldIgnoreScriptInput(event: MouseEvent, documentRef: Document, windowRef: Window | undefined): boolean {
  if (documentRef.body.classList.contains("vw-menu-open")) return true;
  const chatActive = (windowRef as Window & { _chatFocused?: unknown; Chat?: { isActive?: () => boolean } } | undefined)?.Chat?.isActive;
  if (typeof chatActive === "function" && chatActive.call((windowRef as Window & { Chat?: unknown }).Chat)) return true;
  if ((windowRef as Window & { _chatFocused?: unknown } | undefined)?._chatFocused) return true;

  const target = event.target instanceof Element ? event.target : null;
  if (!target) return false;
  if (target.closest("#settings-panel, #chat-window, #chat-input-row, .vw-script-explorer, #vw-script-ui-root")) return true;
  if (target.closest("button, input, select, textarea, a, [contenteditable='true'], [role='button']")) return true;
  return false;
}

function readTransform(root: ScriptPlayerRoot | null): ScriptTransform | null {
  if (!root) return null;
  const transform: ScriptTransform = {};
  const position = readObjectVector(root.position);
  const rotation = readObjectVector(root.rotation);
  const scale = readObjectVector(root.scale);
  if (position) transform.position = position;
  if (rotation) transform.rotation = rotation;
  if (scale) transform.scale = scale;
  return transform;
}

function applyTransform(root: ScriptPlayerRoot | null, transform: ScriptTransform): void {
  if (!root) return;
  writeObjectVector(root.position, transform.position);
  writeObjectVector(root.rotation, transform.rotation);
  writeObjectVector(root.scale, transform.scale);
}

function readObjectVector(value: { x?: number; y?: number; z?: number } | undefined): ScriptVector3 | undefined {
  if (!value) return undefined;
  return [Number(value.x) || 0, Number(value.y) || 0, Number(value.z) || 0];
}

function writeObjectVector(target: { x?: number; y?: number; z?: number } | undefined, value: ScriptVector3 | undefined): void {
  if (!target || !value) return;
  target.x = value[0];
  target.y = value[1];
  target.z = value[2];
}

function normalizeTransform(input: unknown): ScriptTransform {
  if (!input || typeof input !== "object") return {};
  const record = input as Record<string, unknown>;
  const transform: ScriptTransform = {};
  const position = maybeVector(record.position ?? record.pos);
  const rotation = maybeVector(record.rotation ?? record.rot);
  const scale = maybeVector(record.scale);
  if (position) transform.position = position;
  if (rotation) transform.rotation = rotation;
  if (scale) transform.scale = scale;
  return transform;
}

function readBodyColorPatch(slot: unknown, color: unknown): Record<string, unknown> {
  return { slot, color };
}

function maybeVector(value: unknown): ScriptVector3 | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return [
    readFinite(value[0], 0),
    readFinite(value[1], 0),
    readFinite(value[2], 0)
  ];
  if (typeof value === "object") {
    const record = value as Record<string | number, unknown>;
    return [
      readFinite(record.x ?? record[1], 0),
      readFinite(record.y ?? record[2], 0),
      readFinite(record.z ?? record[3], 0)
    ];
  }
  return undefined;
}

function readFinite(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCursorOptions(input: unknown): ScriptCursorOptions {
  if (typeof input === "string") return { url: input };
  if (!input || typeof input !== "object") return {};
  const record = input as Record<string, unknown>;
  return {
    url: record.url ?? record.src,
    width: record.width,
    height: record.height,
    hotspot: record.hotspot
  };
}

function normalizeUiInput(input: unknown): ScriptUiElementInput {
  if (!input || typeof input !== "object") return {};
  return input as ScriptUiElementInput;
}

function normalizeWorldPartInput(input: unknown): ScriptWorldPartInput {
  if (!input || typeof input !== "object") return {};
  const record = input as Record<string, unknown>;
  return {
    position: record.position ?? record.pos ?? readVectorObject(record, "x", "y", "z"),
    size: record.size ?? readVectorObject(record, "sx", "sy", "sz"),
    rotation: record.rotation ?? record.rot,
    color: record.color,
    transparency: record.transparency,
    canCollide: record.canCollide,
    shape: record.shape,
    type: record.type
  };
}

function readVectorObject(record: Record<string, unknown>, xKey: string, yKey: string, zKey: string): unknown {
  if (record[xKey] === undefined && record[yKey] === undefined && record[zKey] === undefined) return undefined;
  return [record[xKey], record[yKey], record[zKey]];
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function sanitizeSessionId(value: string): string {
  const cleaned = String(value || "")
    .replace(/^workspace:/, "workspace-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || `inline-${hashString(value)}`;
}

export function validateScriptPackage(pkg: ScriptPackage): string | null {
  if (!pkg.id) return "missing id";
  if (pkg.apiVersion !== SCRIPT_API_VERSION) return "unsupported api version";
  if (pkg.language !== "js-module" && pkg.language !== "lua") return "unsupported language";
  if (!pkg.sourceUrl && !pkg.source) return "missing script source";
  if (pkg.sourceUrl && !pkg.integrity) return "remote script packages require integrity";
  return null;
}
