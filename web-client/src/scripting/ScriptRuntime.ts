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
  normal?: ScriptVector3;
  distance?: number;
  collider?: unknown;
};

export type ScriptRuntimeContext = {
  documentRef: Document;
  windowRef: Window;
  storage: Pick<Storage, "getItem" | "setItem">;
  getLocalPlayer(): ScriptPlayerInfo | null;
  getPlayers(): ScriptPlayerInfo[];
  getPlayerRoot(query?: unknown): ScriptPlayerRoot | null;
  getLocalPosition(): [number, number, number] | null;
  screenPointToRay(x: unknown, y: unknown): ScriptRay;
  worldToScreen(point: unknown): ScriptScreenPoint;
  raycast(origin: unknown, direction: unknown, maxDistance?: unknown): ScriptRayHit;
  getMousePosition(): { x: number; y: number };
  isKeyDown(code: unknown): boolean;
  spawnWorldPart(input: ScriptWorldPartInput): ScriptWorldPartInfo;
  removeWorldPart(id: string): boolean;
  setWorldMarker(id: unknown, input: ScriptWorldPartInput): ScriptWorldPartInfo;
  clearWorldMarker(id: unknown): boolean;
  setCursorImage(options: ScriptCursorOptions): ScriptCursorState;
  clearCursor(): ScriptCursorState;
  ui: ScriptUiService;
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
  private readonly playerTransformOverrides = new Map<string, ScriptTransform>();
  private readonly sessions = new Map<string, LuaScriptSession>();

  constructor(
    private readonly events: EventBus<RuntimeEventMap>,
    private readonly diagnostics: DiagnosticsService
  ) {}

  configure(context: ScriptRuntimeContext): this {
    this.context = context;
    this.store = new LocalScriptStore(context.storage);
    this.enabled = context.storage.getItem("vwebLuaToolsEnabled") === "1";
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
    if (!this.store) throw new Error("Lua tools are not configured yet.");
    return this.store.upsert(input);
  }

  deleteLocalScript(id: string): boolean {
    return this.store?.remove(id) ?? false;
  }

  async runLocalScript(idOrSource: string, maybeSource?: string): Promise<void> {
    this.assertRunnable();
    const script = maybeSource == null ? this.store?.get(idOrSource) : null;
    const source = maybeSource ?? script?.source ?? idOrSource;
    if (!source.trim()) throw new Error("Script is empty.");
    this.running = true;
    this.log("info", `running ${script?.name || "Lua script"}`);
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

  async startLocalScript(idOrSource: string, maybeSource?: string): Promise<void> {
    this.assertRunnable();
    const script = maybeSource == null ? this.store?.get(idOrSource) : null;
    const source = maybeSource ?? script?.source ?? idOrSource;
    const id = script?.id ?? `inline-${hashString(source)}`;
    if (!source.trim()) throw new Error("Script is empty.");
    await this.stopLocalScript(id);
    this.log("info", `starting ${script?.name || id}`);
    try {
      const session = await this.lua.createSession({
        id,
        source,
        api: this.createLuaApi(),
        log: (level, message) => this.log(level, message),
        timeoutMs: 1000
      });
      this.sessions.set(id, session);
      this.log("info", `started ${script?.name || id}`);
    } catch (error) {
      this.log("error", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async stopLocalScript(id?: string): Promise<boolean> {
    if (id) {
      const session = this.sessions.get(id);
      if (!session) return false;
      this.sessions.delete(id);
      await session.dispose();
      this.log("info", `stopped ${id}`);
      return true;
    }
    const sessions = [...this.sessions.entries()];
    this.sessions.clear();
    for (const [, session] of sessions) await session.dispose();
    if (sessions.length) this.log("info", `stopped ${sessions.length} script session(s)`);
    return sessions.length > 0;
  }

  clearLog(): void {
    this.logEntries.length = 0;
  }

  snapshot(): { configured: boolean; available: boolean; enabled: boolean; running: boolean; sessions: string[]; scripts: LocalLuaScript[]; log: ScriptLogEntry[] } {
    return {
      configured: Boolean(this.context),
      available: this.canUseLua(),
      enabled: this.isEnabled(),
      running: this.running,
      sessions: [...this.sessions.keys()],
      scripts: this.listLocalScripts(),
      log: [...this.logEntries]
    };
  }

  private assertRunnable(): void {
    if (!this.context) throw new Error("Lua tools are not configured yet.");
    if (!this.canUseLua()) throw new Error("Lua tools require the lua license feature.");
    if (!this.isEnabled()) throw new Error("Lua tools are disabled.");
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
        context.documentRef.body.classList.toggle("vw-lua-click-to-walk", enabled === true);
        return enabled === true;
      },
      "camera.screenPointToRay": (x: unknown, y: unknown) => context.screenPointToRay(x, y),
      "camera.worldToScreen": (point: unknown) => context.worldToScreen(point),
      "input.mousePosition": () => context.getMousePosition(),
      "input.isDown": (code: unknown) => context.isKeyDown(code),
      "physics.raycast": (origin: unknown, direction: unknown, maxDistance: unknown) => context.raycast(origin, direction, maxDistance),
      "ui.layer": (layer: unknown) => context.ui.layer(layer),
      "ui.clear": (layer: unknown) => context.ui.clear(layer),
      "ui.text": (layer: unknown, input: unknown) => context.ui.text(layer, normalizeUiInput(input)),
      "ui.rect": (layer: unknown, input: unknown) => context.ui.rect(layer, normalizeUiInput(input)),
      "ui.image": (layer: unknown, input: unknown) => context.ui.image(layer, normalizeUiInput(input)),
      "ui.button": (layer: unknown, input: unknown) => context.ui.button(layer, normalizeUiInput(input)),
      "world.localPosition": () => context.getLocalPosition(),
      "world.spawnPart": (input: unknown) => {
        const part = context.spawnWorldPart(normalizeWorldPartInput(input));
        this.ownedWorldParts.add(part.id);
        return part;
      },
      "world.setMarker": (id: unknown, input: unknown) => {
        const part = context.setWorldMarker(id, normalizeWorldPartInput(input));
        this.ownedWorldParts.add(part.id);
        return part;
      },
      "world.clearMarker": (id: unknown) => context.clearWorldMarker(id),
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

export function validateScriptPackage(pkg: ScriptPackage): string | null {
  if (!pkg.id) return "missing id";
  if (pkg.apiVersion !== SCRIPT_API_VERSION) return "unsupported api version";
  if (pkg.language !== "js-module" && pkg.language !== "lua") return "unsupported language";
  if (!pkg.sourceUrl && !pkg.source) return "missing script source";
  if (pkg.sourceUrl && !pkg.integrity) return "remote script packages require integrity";
  return null;
}
