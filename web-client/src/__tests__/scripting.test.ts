import { describe, expect, it } from "vitest";
import { LuaAdapter } from "../scripting/LuaAdapter";
import { LocalScriptStore } from "../scripting/LocalScriptStore";
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

  it("does not seed hardcoded stock scripts into local storage", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };
    const store = new LocalScriptStore(storage);

    expect(store.list()).toEqual([]);

    values.set("vwebLocalLuaScripts.v1", JSON.stringify([{
      id: "welcome",
      name: "Welcome",
      enabled: true,
      updatedAt: 1,
      source: "local hud = vweb.ui.layer('hud')\nprint('Lua running:')\n-- lua-status"
    }]));

    expect(store.list()).toEqual([]);
  });

  it("runs Lua with injected Vortex Web APIs", async () => {
    const messages: string[] = [];
    const adapter = new LuaAdapter();

    await adapter.run([
      "print(vweb.players.localPlayer().name)",
      "local Players = game:GetService('Players')",
      "print(Players.LocalPlayer.name)",
      "local transform = vweb.players.getTransform('me')",
      "print(transform.rotation[2])",
      "print(vweb.players.setTransform('me', { rotation = {0, 3.14, 0} }))",
      "print(vweb.players.setBodyColor('me', 'rightLeg', '#22c55e'))",
      "print(vweb.players.setTexture('me', 'shirt', 'https://example.com/shirt.png'))",
      "print(vweb.players.setOutfit('me', { face = 'https://example.com/face.png' }))",
      "print(vweb.players.localPlayer():walkTo({ x = 4, y = 1, z = 8 }).ok)",
      "print(vweb.cursor.setImage({ url = 'https://example.com/cursor.png', width = 32 }).mode)",
      "print(vweb.camera.worldToScreen({ x = 1, y = 2, z = 3 }).visible)",
      "print(vweb.camera.state().distance)",
      "print(vweb.camera.setDistanceOverride(8).scriptDistanceOverride)",
      "print(vweb.camera.clearDistanceOverride().scriptDistanceOverride == nil)",
      "print(vweb.input.mousePosition().x)",
      "print(vweb.physics.raycast({0, 4, 0}, {0, -1, 0}, 10).hit)",
      "print(vweb.physics.raycast({0, 4, 0}, {0, -1, 0}, 10).part.id)",
      "local Workspace = game:GetService('Workspace')",
      "print(Workspace:Raycast(Vector3.new(0, 4, 0), Vector3.new(0, -1, 0), 10).hit)",
      "vweb.ui.layer('hud'):text({ id = 'hello', x = 12, y = 24, text = 'Hi' })",
      "vweb.draw.rect({ id = 'box', x = 8, y = 8, w = 80, h = 20, color = '#ffffff' })",
      "vweb.hud.paint('alias-paint', function() vweb.surface.DrawCircle(10, 10, 4) end)",
      "local aliasButton = vweb.gui.button('alias-button')",
      "aliasButton:SetTooltip('Hover help')",
      "aliasButton:SetCursor('pointer')",
      "aliasButton.OnHover = function(self, event) print(event.localX or 0) end",
      "local frame = Instance.new('Frame')",
      "frame.Position = UDim2.fromOffset(24, 80)",
      "frame.Size = UDim2.fromOffset(180, 92)",
      "frame.BackgroundColor3 = Color3.fromRGB(34, 197, 94)",
      "frame.Active = true",
      "surface.SetDrawColor(34, 197, 94, 180)",
      "surface.DrawRect(4, 5, 64, 16)",
      "vweb.world.setMarker('mouse', { position = {1, 1, 1}, color = '#22c55e' })",
      "local parts = vweb.world.parts()",
      "print(parts[1].id)",
      "print(vweb.world.setCollision(parts[1].id, false).ok)",
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
        "players.setBodyColors": () => true,
        "players.setBodyColor": () => true,
        "players.setTexture": () => true,
        "players.setOutfit": () => true,
        "players.walkTo": () => ({ ok: true }),
        "players.stopWalking": () => true,
        "players.flip": () => true,
        "cursor.setMode": () => "classic",
        "cursor.setImage": () => ({ mode: "image" }),
        "cursor.clear": () => ({ mode: "default" }),
        "cursor.setClickToWalk": () => false,
        "cursor.setWorldMarker": () => ({ id: "cursor", position: [1, 1, 1], size: [4, 0.1, 4] }),
        "cursor.worldMarker": () => ({ id: "cursor", position: [1, 1, 1], size: [4, 0.1, 4] }),
        "camera.screenPointToRay": () => ({ origin: [0, 0, 0], direction: [0, 0, -1] }),
        "camera.worldToScreen": () => ({ x: 10, y: 20, z: 0.5, visible: true }),
        "camera.state": () => ({ distance: 25.6 }),
        "camera.setDistanceOverride": () => ({ scriptDistanceOverride: 8 }),
        "camera.clearDistanceOverride": () => ({ scriptDistanceOverride: null }),
        "input.mousePosition": () => ({ x: 320, y: 240 }),
        "input.isDown": () => false,
        "physics.raycast": () => ({
          hit: true,
          point: [0, 0, 0],
          normal: [0, 1, 0],
          distance: 4,
          partId: "map-part-1",
          part: { id: "map-part-1", position: [0, 0, 0], size: [4, 1, 4], color: 0x808080, transparency: 0, canCollide: true, shape: "Block", type: "Part", batched: true }
        }),
        "ui.layer": () => ({ name: "hud", count: 0 }),
        "ui.clear": () => 0,
        "ui.measureText": (text: unknown) => ({ width: String(text ?? "").length * 10, height: 18 }),
        "ui.text": () => ({ id: "hello", layer: "hud", kind: "text" }),
        "ui.rect": () => ({ id: "box", layer: "draw", kind: "rect" }),
        "ui.image": () => ({ id: "image", layer: "hud", kind: "image" }),
        "ui.button": () => ({ id: "button", layer: "hud", kind: "button" }),
        "ui.circle": () => ({ id: "surface", layer: "surface", kind: "circle" }),
        "ui.panel": () => ({ id: "frame", layer: "vgui", kind: "panel" }),
        "ui.update": () => ({ id: "frame", layer: "vgui", kind: "panel" }),
        "world.localPosition": () => [0, 0, 0],
        "world.parts": () => [{ id: "map-part-1", position: [0, 0, 0], size: [4, 1, 4], color: 0x808080, transparency: 0, canCollide: true, shape: "Block", type: "Part", batched: true }],
        "world.getPart": () => ({ id: "map-part-1", position: [0, 0, 0], size: [4, 1, 4], color: 0x808080, transparency: 0, canCollide: true, shape: "Block", type: "Part", batched: true }),
        "world.setColor": () => ({ ok: true }),
        "world.setTransparency": () => ({ ok: true }),
        "world.setCollision": () => ({ ok: true }),
        "world.setCanCollide": () => ({ ok: true }),
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
    expect(messages).toContain("map-part-1");
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
        "hook.Add('HUDPaint', 'paint-test', function() surface.DrawRect(10, 10, 20, 20) end)",
        "vweb.ui.layer('hud'):text({ id = 'owned-hud', x = 8, y = 8, text = 'owned' })",
        "vweb.draw.rect({ id = 'owned-draw', x = 8, y = 28, w = 40, h = 12 })",
        "local frame = vgui.Create('DFrame', nil, 'test-frame')",
        "frame:SetPos(12, 20)",
        "frame:SetSize(120, 64)",
        "frame:SetTitle('Tools')",
        "vweb.render.onFrame(function(dt) print('frame', dt) end)",
        "vweb.input.onClick(function(button) print('click', button) end)",
        "game:GetService('RunService').RenderStepped:Connect(function(dt) print('roblox-frame', dt) end)",
        "function onDestroy() print('destroyed') end"
      ].join("\n"),
      api: {
        "ui.panel": () => ({ id: "test-frame", layer: "vgui", kind: "panel" }),
        "ui.update": () => ({ id: "test-frame", layer: "vgui", kind: "panel" }),
        "ui.text": () => ({ id: "owned-hud", layer: "hud", kind: "text" }),
        "ui.rect": (layer: unknown, input: any) => ({ id: String(input?.id || "surface"), layer: String(layer || "surface"), kind: "rect" }),
        "ui.circle": () => ({ id: "surface", layer: "surface", kind: "circle" }),
        "ui.remove": (_layer: unknown, id: unknown) => {
          messages.push(`removed ${String(id)}`);
          return true;
        },
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
    expect(messages).toContain("roblox-frame 0.016");
    expect(messages).toContain("click left");
    expect(messages).toContain("destroyed");
    expect(messages).toContain("removed test-frame");
    expect(messages).toContain("removed owned-hud");
    expect(messages).toContain("removed owned-draw");
  });

  it("routes bulk Lua line drawing through one polyline API call", async () => {
    const calls: Array<{ layer: string; points: unknown[] }> = [];
    const adapter = new LuaAdapter();

    await adapter.run([
      "surface.SetDrawColor(34, 197, 94, 180)",
      "surface.DrawLines({ { 4, 6 }, { x = 20, y = 18 }, { 40, 10 } })",
      "vweb.draw.polyline({ id = 'trace', points = { { x = 1, y = 2 }, { x = 3, y = 4 } }, color = '#38bdf8' })"
    ].join("\n"), {
      api: {
        "ui.polyline": (layer: unknown, input: any) => {
          calls.push({ layer: String(layer), points: Array.isArray(input?.points) ? input.points : [] });
          return { id: String(input?.id || "polyline"), layer: String(layer), kind: "line" };
        },
        "ui.remove": () => true,
        "ui.clear": () => 0
      },
      log: () => {},
      timeoutMs: 1000
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]!.layer).toBe("surface");
    expect(calls[0]!.points).toHaveLength(3);
    expect(calls[1]!.layer).toBe("draw");
    expect(calls[1]!.points).toHaveLength(2);
  });

  it("isolates immediate HUD paint layers per Lua session", async () => {
    const cleared: string[] = [];
    const drawn: string[] = [];
    const adapter = new LuaAdapter();
    const api = {
      "ui.clear": (layer: unknown) => {
        cleared.push(String(layer));
        return 0;
      },
      "ui.rect": (layer: unknown) => {
        drawn.push(String(layer));
        return { id: "rect", layer: String(layer), kind: "rect" };
      },
      "ui.remove": () => true
    };

    const first = await adapter.createSession({
      id: "first",
      source: "hook.Add('HUDPaint', 'paint', function() surface.DrawRect(1, 2, 3, 4) end)",
      api,
      log: () => {},
      timeoutMs: 1000
    });
    const second = await adapter.createSession({
      id: "second",
      source: "hook.Add('HUDPaint', 'paint', function() surface.DrawRect(5, 6, 7, 8) end)",
      api,
      log: () => {},
      timeoutMs: 1000
    });

    await first.update(0.016);
    await second.update(0.016);
    await first.dispose();
    await second.dispose();

    expect(cleared).toContain("surface-first");
    expect(cleared).toContain("surface-second");
    expect(drawn).toContain("surface-first");
    expect(drawn).toContain("surface-second");
  });

  it("supports retained UI handles and outgoing chat hooks", async () => {
    const messages: string[] = [];
    const calls: string[] = [];
    const adapter = new LuaAdapter();
    const session = await adapter.createSession({
      id: "ui-chat",
      source: [
        "local hud = vweb.ui.layer('hud')",
        "local panel = hud:panel({ id = 'panel', text = 'one', draggable = true })",
        "panel:set({ text = 'two' })",
        "hud:chart({ id = 'fps', values = { 4, 8, 6, 12 }, color = '#38bdf8' })",
        "print(vweb.ui.viewport().width)",
        "vweb.chat.onSend(function(event)",
        "  if event.text == '!hide' then return false end",
        "  if event.text == '!hello' then return { text = 'hello world' } end",
        "end)",
        "hook.Add('ChatSend', 'chat-hook', function(event)",
        "  if event.text == '!hook' then return { text = 'hooked' } end",
        "end)",
        "hook.Add('ChatMessage', 'incoming-hook', function(event)",
        "  print('incoming', event.text)",
        "end)"
      ].join("\n"),
      api: {
        "ui.layer": () => ({ name: "hud", count: 0 }),
        "ui.panel": () => {
          calls.push("panel");
          return { id: "panel", layer: "hud", kind: "panel" };
        },
        "ui.update": (_layer: unknown, _id: unknown, input: any) => {
          calls.push(`update:${input.text}`);
          return { id: "panel", layer: "hud", kind: "panel" };
        },
        "ui.remove": () => true,
        "ui.chart": () => {
          calls.push("chart");
          return { id: "fps", layer: "hud", kind: "chart" };
        },
        "ui.viewport": () => ({ width: 1280, height: 720, scale: 1 }),
        "ui.measureText": (text: unknown) => ({ width: String(text ?? "").length * 10, height: 18 }),
        "ui.clear": () => 0
      },
      log: (_level, message) => messages.push(message),
      timeoutMs: 1000
    });

    expect(messages).toContain("1280");
    expect(calls).toEqual(["panel", "update:two", "chart"]);
    expect(await session.chatOutgoing({ type: "outgoing", text: "!hide" })).toMatchObject({ cancel: true });
    expect(await session.chatOutgoing({ type: "outgoing", text: "!hello" })).toMatchObject({ text: "hello world" });
    expect(await session.chatOutgoing({ type: "outgoing", text: "!hook" })).toMatchObject({ text: "hooked" });
    await session.chatIncoming({ type: "incoming", username: "tester", text: "hi" });
    expect(messages).toContain("incoming hi");
    await session.dispose();
  });
});
