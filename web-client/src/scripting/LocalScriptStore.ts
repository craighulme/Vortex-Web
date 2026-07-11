export type LocalLuaScript = {
  id: string;
  name: string;
  source: string;
  enabled: boolean;
  updatedAt: number;
};

const STORAGE_KEY = "vwebLocalLuaScripts.v1";

const DEFAULT_SCRIPT: LocalLuaScript = {
  id: "welcome",
  name: "Welcome",
  enabled: true,
  updatedAt: 0,
  source: [
    "print('Vortex Web Lua ready')",
    "",
    "local hud = vweb.ui.layer('hud')",
    "",
    "function onStart()",
    "  local me = vweb.players.localPlayer()",
    "  if me then print('local player', me.id, me.name) end",
    "end",
    "",
    "function onUpdate(dt)",
    "  local mouse = vweb.input.mousePosition()",
    "  local ray = vweb.camera.screenPointToRay(mouse.x, mouse.y)",
    "  local hit = vweb.physics.raycast(ray.origin, ray.direction, 500)",
    "  hud:text({ id = 'lua-status', x = 24, y = 24, text = 'Lua running: ' .. string.format('%.2f', dt), size = 18 })",
    "  if hit.hit then",
    "    vweb.world.setMarker('lua-cursor', { position = hit.point, size = {4, 0.08, 4}, color = '#22c55e', transparency = 0.3, canCollide = false })",
    "  end",
    "end",
    "",
    "function onDestroy()",
    "  vweb.ui.clear('hud')",
    "  vweb.world.clearMarker('lua-cursor')",
    "end",
    "",
    "-- Try this locally:",
    "-- vweb.players.setTransform('me', { rotation = {0, math.rad(180), 0} })",
    "-- vweb.cursor.setImage({ url = 'https://example.com/cursor.png', width = 32, height = 32, hotspot = {0, 0, 0} })",
    "-- local part = vweb.world.spawnPart({ position = {0, 8, 0}, size = {4, 1, 4}, color = '#22c55e' })",
    "-- vweb.world.remove(part.id)"
  ].join("\n")
};

export class LocalScriptStore {
  constructor(private readonly storage: Pick<Storage, "getItem" | "setItem"> = globalThis.localStorage) {}

  list(): LocalLuaScript[] {
    const parsed = this.read();
    if (parsed.length) return parsed;
    return [{ ...DEFAULT_SCRIPT, updatedAt: Date.now() }];
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
    this.write(next.length ? next : [{ ...DEFAULT_SCRIPT, updatedAt: Date.now() }]);
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

function sanitizeId(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 48) || `script-${Date.now().toString(36)}`;
}
