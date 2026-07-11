export type LuaRunOptions = {
  api: Record<string, unknown>;
  log: (level: "info" | "warn" | "error", message: string) => void;
  timeoutMs?: number;
};

type LuaEngineLike = {
  doString(script: string): Promise<unknown>;
  global: {
    set(name: string, value: unknown): void;
    get(name: string): unknown;
    close(): void;
  };
};

export type LuaSessionOptions = LuaRunOptions & {
  id: string;
  source: string;
};

const LUA_PRELUDE = `
vweb = vweb or {}
local raw = __vweb_api
local frameCallbacks = {}
local inputCallbacks = {}
local clickCallbacks = {}

local function call(name, ...)
  local fn = raw[name]
  if fn == nil then error("missing vweb api: " .. name, 2) end
  return fn(...)
end

local function firstArg(selfOrInput, maybeInput)
  if maybeInput ~= nil then return maybeInput end
  return selfOrInput
end

local function screenArgs(x, y)
  if type(x) == "table" and y == nil then
    return x.x or x[1] or 0, x.y or x[2] or 0
  end
  return x or 0, y or 0
end

vweb.players = {
  localPlayer = function() return call("players.localPlayer") end,
  all = function() return call("players.all") end,
  find = function(query) return call("players.find", query) end,
  getTransform = function(query) return call("players.getTransform", query or "me") end,
  setTransform = function(query, transform, options) return call("players.setTransform", query or "me", transform or {}, options or {}) end,
  clearTransform = function(query) return call("players.clearTransform", query or "me") end,
  flip = function(query, enabled) return call("players.flip", query or "me", enabled ~= false) end,
  unflip = function(query) return call("players.flip", query or "me", false) end
}

vweb.cursor = {
  setMode = function(mode) return call("cursor.setMode", mode) end,
  setImage = function(options) return call("cursor.setImage", options or {}) end,
  clear = function() return call("cursor.clear") end,
  setClickToWalk = function(enabled) return call("cursor.setClickToWalk", enabled == true) end,
  setWorldMarker = function(marker) return call("cursor.setWorldMarker", marker or {}) end,
  worldMarker = function(id) return call("cursor.worldMarker", id or "cursor") end,
  clearWorldMarker = function(id) return call("world.clearMarker", id or "cursor") end
}

vweb.camera = {
  screenPointToRay = function(x, y)
    local sx, sy = screenArgs(x, y)
    return call("camera.screenPointToRay", sx, sy)
  end,
  worldToScreen = function(point) return call("camera.worldToScreen", point or {}) end
}

vweb.input = {
  mousePosition = function() return call("input.mousePosition") end,
  isDown = function(code) return call("input.isDown", code) end,
  onClick = function(fn)
    if type(fn) ~= "function" then error("vweb.input.onClick expects a function", 2) end
    table.insert(clickCallbacks, fn)
    return #clickCallbacks
  end,
  onInput = function(fn)
    if type(fn) ~= "function" then error("vweb.input.onInput expects a function", 2) end
    table.insert(inputCallbacks, fn)
    return #inputCallbacks
  end
}

vweb.physics = {
  raycast = function(origin, direction, maxDistance) return call("physics.raycast", origin or {}, direction or {}, maxDistance or 500) end
}

local function makeLayer(name)
  return {
    info = function() return call("ui.layer", name) end,
    clear = function() return call("ui.clear", name) end,
    text = function(selfOrInput, maybeInput) return call("ui.text", name, firstArg(selfOrInput, maybeInput) or {}) end,
    rect = function(selfOrInput, maybeInput) return call("ui.rect", name, firstArg(selfOrInput, maybeInput) or {}) end,
    image = function(selfOrInput, maybeInput) return call("ui.image", name, firstArg(selfOrInput, maybeInput) or {}) end,
    button = function(selfOrInput, maybeInput) return call("ui.button", name, firstArg(selfOrInput, maybeInput) or {}) end
  }
end

vweb.ui = {
  layer = makeLayer,
  clear = function(name) return call("ui.clear", name) end
}

vweb.draw = {
  text = function(input) return call("ui.text", "draw", input or {}) end,
  rect = function(input) return call("ui.rect", "draw", input or {}) end,
  image = function(input) return call("ui.image", "draw", input or {}) end,
  button = function(input) return call("ui.button", "draw", input or {}) end,
  clear = function() return call("ui.clear", "draw") end
}

vweb.world = {
  localPosition = function() return call("world.localPosition") end,
  spawnPart = function(part) return call("world.spawnPart", part or {}) end,
  setMarker = function(id, part) return call("world.setMarker", id, part or {}) end,
  marker = function(id) return call("world.marker", id or "marker") end,
  clearMarker = function(id) return call("world.clearMarker", id) end,
  remove = function(id) return call("world.remove", id) end,
  clearMine = function() return call("world.clearMine") end
}

vweb.events = {
  onFrame = function(fn)
    if type(fn) ~= "function" then error("vweb.events.onFrame expects a function", 2) end
    table.insert(frameCallbacks, fn)
    return #frameCallbacks
  end,
  onInput = function(fn)
    if type(fn) ~= "function" then error("vweb.events.onInput expects a function", 2) end
    table.insert(inputCallbacks, fn)
    return #inputCallbacks
  end
}

vweb.render = {
  onFrame = vweb.events.onFrame,
  onRender2D = vweb.events.onFrame
}

vweb.debug = {
  snapshot = function() return call("debug.snapshot") end
}

function __vweb_dispatchUpdate(dt)
  call("ui.clear", "draw")
  if type(onUpdate) == "function" then onUpdate(dt) end
  for _, fn in ipairs(frameCallbacks) do fn(dt) end
end

function __vweb_dispatchInput(event)
  if type(onInput) == "function" then onInput(event) end
  for _, fn in ipairs(inputCallbacks) do fn(event) end
  if event and event.type == "click" then
    for _, fn in ipairs(clickCallbacks) do fn(event.button or "left", event) end
  end
end
`;

export class LuaAdapter {
  async run(source: string, options: LuaRunOptions): Promise<unknown> {
    const lua = await createEngine(options);

    try {
      installGlobals(lua, options);
      await lua.doString(`${LUA_PRELUDE}\n${source}`);
      return null;
    } finally {
      lua.global.close();
    }
  }

  async createSession(options: LuaSessionOptions): Promise<LuaScriptSession> {
    const lua = await createEngine(options);
    installGlobals(lua, options);
    await lua.doString(`${LUA_PRELUDE}\n${options.source}`);
    const session = new LuaScriptSession(options.id, lua, options.log);
    await session.call("onStart");
    return session;
  }
}

export class LuaScriptSession {
  private disposed = false;
  private updating = false;

  constructor(
    readonly id: string,
    private readonly lua: LuaEngineLike,
    private readonly log: LuaRunOptions["log"]
  ) {}

  async update(dt: number): Promise<void> {
    if (this.disposed || this.updating) return;
    this.updating = true;
    try {
      await this.call("__vweb_dispatchUpdate", dt);
    } finally {
      this.updating = false;
    }
  }

  async input(event: Record<string, unknown>): Promise<void> {
    if (this.disposed) return;
    await this.call("__vweb_dispatchInput", event);
  }

  async call(name: string, ...args: unknown[]): Promise<unknown> {
    if (this.disposed) return null;
    const hook = this.lua.global.get(name);
    if (typeof hook !== "function") return null;
    return await Promise.resolve(hook(...args));
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    try {
      await this.call("onDestroy");
    } catch (error) {
      this.log("warn", error instanceof Error ? error.message : String(error));
    } finally {
      this.disposed = true;
      this.lua.global.close();
    }
  }
}

async function createEngine(options: LuaRunOptions): Promise<LuaEngineLike> {
  const { LuaFactory } = await import("wasmoon");
  const factory = new LuaFactory(resolveBundledWasmUrl());
  return await factory.createEngine({
    injectObjects: true,
    enableProxy: true,
    functionTimeout: options.timeoutMs ?? 1000
  }) as LuaEngineLike;
}

function installGlobals(lua: LuaEngineLike, options: LuaRunOptions): void {
  lua.global.set("__vweb_api", options.api);
  lua.global.set("print", (...args: unknown[]) => {
    options.log("info", args.map(formatLuaValue).join(" "));
  });
  lua.global.set("warn", (...args: unknown[]) => {
    options.log("warn", args.map(formatLuaValue).join(" "));
  });
}

function resolveBundledWasmUrl(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const script = [...document.scripts].find((item) => /\/runtime\/boot\.iife\.js(?:[?#].*)?$/.test(item.src));
  if (script?.src) return new URL("vendor/wasmoon-glue.wasm", script.src).href;
  const base = document.currentScript instanceof HTMLScriptElement && document.currentScript.src
    ? document.currentScript.src
    : document.baseURI;
  return new URL("runtime/vendor/wasmoon-glue.wasm", base).href;
}

function formatLuaValue(value: unknown): string {
  if (value == null) return String(value);
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
}
