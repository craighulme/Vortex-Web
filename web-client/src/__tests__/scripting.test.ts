import { describe, expect, it } from "vitest";
import { LuaAdapter } from "../scripting/LuaAdapter";
import { PermissionSet } from "../scripting/permissions";
import { SCRIPT_API_VERSION, validateScriptPackage } from "../scripting/ScriptRuntime";

describe("script runtime contracts", () => {
  it("requires integrity for relay-delivered script urls", () => {
    expect(validateScriptPackage({
      id: "game-script",
      apiVersion: SCRIPT_API_VERSION,
      language: "lua",
      sourceUrl: "https://relay.example/script.lua"
    })).toBe("remote script packages require integrity");
  });

  it("enforces explicit permissions", () => {
    const permissions = new PermissionSet(["world.read"]);

    expect(permissions.has("world.read")).toBe(true);
    expect(() => permissions.require("world.write")).toThrow("script permission denied");
  });

  it("runs Lua with injected Vortex Web APIs", async () => {
    const messages: string[] = [];
    const adapter = new LuaAdapter();

    await adapter.run([
      "print(vweb.players.localPlayer().name)",
      "local transform = vweb.players.getTransform('me')",
      "print(transform.rotation[2])",
      "print(vweb.players.setTransform('me', { rotation = {0, 3.14, 0} }))",
      "print(vweb.cursor.setImage({ url = 'https://example.com/cursor.png', width = 32 }).mode)",
      "print(vweb.camera.worldToScreen({ x = 1, y = 2, z = 3 }).visible)",
      "print(vweb.input.mousePosition().x)",
      "print(vweb.physics.raycast({0, 4, 0}, {0, -1, 0}, 10).hit)",
      "vweb.ui.layer('hud'):text({ id = 'hello', x = 12, y = 24, text = 'Hi' })",
      "vweb.draw.rect({ id = 'box', x = 8, y = 8, w = 80, h = 20, color = '#ffffff' })",
      "vweb.world.setMarker('mouse', { position = {1, 1, 1}, color = '#22c55e' })",
      "local part = vweb.world.spawnPart({ position = {1, 2, 3}, size = {4, 1, 4}, color = '#22c55e' })",
      "print(part.id)",
      "print(vweb.world.remove(part.id))"
    ].join("\n"), {
      api: {
        "players.localPlayer": () => ({ id: 1, name: "tester", local: true }),
        "players.all": () => [],
        "players.find": () => null,
        "players.getTransform": () => ({ position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }),
        "players.setTransform": () => true,
        "players.clearTransform": () => true,
        "players.flip": () => true,
        "cursor.setMode": () => "classic",
        "cursor.setImage": () => ({ mode: "image" }),
        "cursor.clear": () => ({ mode: "default" }),
        "cursor.setClickToWalk": () => false,
        "cursor.setWorldMarker": () => ({ id: "cursor", position: [1, 1, 1], size: [4, 0.1, 4] }),
        "cursor.worldMarker": () => ({ id: "cursor", position: [1, 1, 1], size: [4, 0.1, 4] }),
        "camera.screenPointToRay": () => ({ origin: [0, 0, 0], direction: [0, 0, -1] }),
        "camera.worldToScreen": () => ({ x: 10, y: 20, z: 0.5, visible: true }),
        "input.mousePosition": () => ({ x: 320, y: 240 }),
        "input.isDown": () => false,
        "physics.raycast": () => ({ hit: true, point: [0, 0, 0], normal: [0, 1, 0], distance: 4 }),
        "ui.layer": () => ({ name: "hud", count: 0 }),
        "ui.clear": () => 0,
        "ui.text": () => ({ id: "hello", layer: "hud", kind: "text" }),
        "ui.rect": () => ({ id: "box", layer: "draw", kind: "rect" }),
        "ui.image": () => ({ id: "image", layer: "hud", kind: "image" }),
        "ui.button": () => ({ id: "button", layer: "hud", kind: "button" }),
        "world.localPosition": () => [0, 0, 0],
        "world.spawnPart": () => ({ id: "lua-part", position: [1, 2, 3], size: [4, 1, 4] }),
        "world.setMarker": () => ({ id: "marker", position: [1, 1, 1], size: [4, 0.1, 4] }),
        "world.marker": () => ({ id: "marker", position: [1, 1, 1], size: [4, 0.1, 4] }),
        "world.clearMarker": () => true,
        "world.remove": () => true,
        "world.clearMine": () => 0,
        "debug.snapshot": () => ({ ok: true })
      },
      log: (_level, message) => messages.push(message),
      timeoutMs: 1000
    });

    expect(messages).toContain("tester");
    expect(messages).toContain("0");
    expect(messages).toContain("image");
    expect(messages).toContain("320");
    expect(messages).toContain("lua-part");
    expect(messages).toContain("true");
  });

  it("keeps Lua sessions alive for lifecycle hooks", async () => {
    const messages: string[] = [];
    const adapter = new LuaAdapter();
    const session = await adapter.createSession({
      id: "lifecycle",
      source: [
        "function onStart() print('started') end",
        "function onUpdate(dt) print('tick', dt) end",
        "vweb.render.onFrame(function(dt) print('frame', dt) end)",
        "vweb.input.onClick(function(button) print('click', button) end)",
        "function onDestroy() print('destroyed') end"
      ].join("\n"),
      api: {
        "ui.clear": () => 0
      },
      log: (_level, message) => messages.push(message),
      timeoutMs: 1000
    });

    await session.update(0.016);
    await session.input({ type: "click", button: "left", x: 100, y: 120 });
    await session.dispose();

    expect(messages).toContain("started");
    expect(messages).toContain("tick 0.016");
    expect(messages).toContain("frame 0.016");
    expect(messages).toContain("click left");
    expect(messages).toContain("destroyed");
  });
});
