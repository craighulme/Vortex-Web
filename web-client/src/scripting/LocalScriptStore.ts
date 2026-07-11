export type LocalLuaScript = {
  id: string;
  name: string;
  source: string;
  enabled: boolean;
  updatedAt: number;
};

const STORAGE_KEY = "vwebLocalLuaScripts.v1";

export class LocalScriptStore {
  constructor(private readonly storage: Pick<Storage, "getItem" | "setItem"> = globalThis.localStorage) {}

  list(): LocalLuaScript[] {
    const parsed = this.read();
    const migrated = migrateStockScripts(parsed);
    if (migrated.changed) this.write(migrated.scripts);
    return migrated.scripts;
  }

  get(id: string): LocalLuaScript | null {
    return this.list().find((script) => script.id === id) ?? null;
  }

  upsert(input: Partial<LocalLuaScript> & Pick<LocalLuaScript, "name" | "source">): LocalLuaScript {
    const scripts = this.list();
    const id = sanitizeId(input.id || input.name || "script");
    const index = scripts.findIndex((script) => script.id === id);
    const next: LocalLuaScript = {
      id,
      name: input.name.trim() || "Untitled",
      source: input.source,
      enabled: input.enabled ?? true,
      updatedAt: Date.now()
    };
    if (index >= 0) scripts[index] = next;
    else scripts.push(next);
    this.write(scripts);
    return next;
  }

  remove(id: string): boolean {
    const scripts = this.list();
    const next = scripts.filter((script) => script.id !== id);
    if (next.length === scripts.length) return false;
    this.write(next);
    return true;
  }

  private read(): LocalLuaScript[] {
    try {
      const raw = JSON.parse(this.storage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw.map(normalizeScript).filter(Boolean) as LocalLuaScript[];
    } catch {
      return [];
    }
  }

  private write(scripts: LocalLuaScript[]): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(scripts.map(normalizeScript).filter(Boolean)));
  }
}

function normalizeScript(value: unknown): LocalLuaScript | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const id = sanitizeId(String(source.id || source.name || ""));
  if (!id) return null;
  return {
    id,
    name: String(source.name || id).slice(0, 80),
    source: String(source.source || ""),
    enabled: source.enabled !== false,
    updatedAt: Number(source.updatedAt) || Date.now()
  };
}

function migrateStockScripts(scripts: LocalLuaScript[]): { scripts: LocalLuaScript[]; changed: boolean } {
  let changed = false;
  const next = scripts.filter((script) => {
    if (script.id === "welcome" && isOldStockWelcome(script.source)) {
      changed = true;
      return false;
    }
    if (isOldStockPackagedExample(script)) {
      changed = true;
      return false;
    }
    return true;
  });
  return { scripts: next, changed };
}

function isOldStockPackagedExample(script: LocalLuaScript): boolean {
  const id = String(script.id || "");
  const text = String(script.source || "");
  if (id === "vortex-interface-playground") {
    return text.includes("Vortex Web Lua") && text.includes("drawMiniGraph") && text.includes("!luahelp");
  }
  if (id === "vortex-camera-collision") {
    return text.includes("camera") && text.includes("setDistanceOverride") && text.includes("clearDistanceOverride");
  }
  return false;
}

function isOldStockWelcome(source: string): boolean {
  const text = String(source || "");
  if (text.includes("Lua running:") || text.includes("Lua running | dt")) return true;
  if (!text.includes("Vortex Web Lua ready")) return false;
  if (text.includes("lua-status-panel") || text.includes("vweb.gui.create(\"Frame\"") || text.includes("vweb.gui.create('Frame'")) return true;
  if (text.includes("panel = vweb.gui.create('Frame'") && text.includes("vweb.surface.SetDrawColor(8, 18, 30, 190)")) return true;
  if (!text.includes("local hud = vweb.ui.layer('hud')")) return false;
  return text.includes("lua-status");
}

function sanitizeId(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 48) || `script-${Date.now().toString(36)}`;
}
