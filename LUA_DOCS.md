# Vortex Web Lua Docs

Vortex Web Lua runs inside the browser client. Scripts are local by default, sandboxed, and routed through runtime services. They do not get raw DOM, raw fetch, WebSocket, cookies, or extension APIs.

Open the editor from in-game settings: `Dev Tools -> Lua Editor`, or press `F2`.

## Runtime Model

Scripts can be run once or started as sessions.

```lua
function onStart() end
function onUpdate(dt) end
function onInput(event) end
function onChatMessage(event) end
function onChatSend(event) end
function onDestroy() end
```

Session scripts can also use named hooks:

```lua
hook.Add("HUDPaint", "my_hud", function()
  surface.SetDrawColor(15, 23, 42, 220)
  surface.DrawRect(24, 24, 220, 48)
end)
```

## Roblox-Style Aliases

These aliases exist for familiar script shape. They call the same Vortex Web services as `vweb.*`.

```lua
local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local hit = Workspace:Raycast(Vector3.new(0, 8, 0), Vector3.new(0, -1, 0), 50)

RunService.RenderStepped:Connect(function(dt)
  print("frame", dt)
end)
```

Constructors:

```lua
Vector3.new(x, y, z)
Vector2.new(x, y)
Color3.fromRGB(r, g, b)
Color3.new(r, g, b)
UDim2.fromOffset(x, y)
UDim2.fromScale(x, y)
Instance.new(className, parent)
```

Services:

- `Players`: `LocalPlayer`, `GetPlayers()`, `FindFirstChild(query)`
- `Workspace`: `CurrentCamera`, `GetChildren()`, `FindFirstChild(id)`, `Raycast(origin, direction, maxDistance)`, `SpawnPart(part)`
- `RunService`: `RenderStepped:Connect(fn)`, `Heartbeat:Connect(fn)`
- `UserInputService`: `GetMouseLocation()`, `IsKeyDown(code)`, `InputBegan:Connect(fn)`, `InputEnded:Connect(fn)`
- `Camera`: `WorldToScreenPoint(point)`, `ScreenPointToRay(x, y)`, `GetState()`, `SetDistanceOverride(distance)`, `ClearDistanceOverride()`

## Players

```lua
local me = vweb.players.localPlayer()
local all = vweb.players.all()
local target = vweb.players.find("name or id")

local transform = me:getTransform()
me:setTransform({ rotation = {0, math.rad(180), 0} })
me:clearTransform()

vweb.players.setBodyColor("me", "rightLeg", "#22c55e")
vweb.players.setTexture("me", "face", vweb.assets.image("faces/test.png"))
vweb.players.walkTo({ x = 0, y = 4, z = 0 })
vweb.players.stopWalking("me")
```

Player transforms and outfit edits are local visual overrides unless the runtime later adds a replicated route for that capability.

## World And Physics

```lua
local parts = vweb.world.parts()
local part = vweb.world.spawnPart({
  position = {0, 8, 0},
  size = {4, 1, 4},
  color = "#22c55e",
  canCollide = true
})

vweb.world.setColor(part.id, "#38bdf8")
vweb.world.setCollision(part.id, false)
vweb.world.remove(part.id)

local ray = vweb.camera.screenPointToRay(vweb.input.mousePosition())
local hit = vweb.physics.raycast(ray.origin, ray.direction, 500)
```

Raycast hits include world part data when the collider can be resolved:

```lua
if hit.hit and hit.part then
  print(hit.part.id, hit.part.type)
  vweb.world.setColor(hit.part.id, "#22c55e")
end
```

Markers are useful for cursors, targets, and local debug visuals:

```lua
vweb.world.setMarker("target", {
  position = hit.point,
  size = {4, 0.08, 4},
  color = "#22c55e",
  transparency = 0.25,
  shape = "Cylinder"
})
```

## Camera

```lua
local camera = vweb.camera.state()
local screen = vweb.camera.worldToScreen({ x = 0, y = 10, z = 0 })
local ray = vweb.camera.screenPointToRay(320, 240)

vweb.camera.setDistanceOverride(8)
vweb.camera.clearDistanceOverride()
```

Distance override is intended for camera collision and temporary cinematic/scripted camera constraints.

## Input

```lua
local mouse = vweb.input.mousePosition()
local viewport = vweb.input.viewport()

vweb.input.onKey("KeyE", function(event)
  print("pressed E")
end)

vweb.input.onClick(function(button, event)
  print(button, event.x, event.y)
end)
```

## UI And HUD

Use `vweb.gui` or `Instance.new` for retained UI. Use `surface` and `draw` inside paint callbacks for custom HUDs.

```lua
local frame = Instance.new("Frame")
frame.Position = UDim2.fromOffset(24, 84)
frame.Size = UDim2.fromOffset(320, 160)
frame.BackgroundColor3 = Color3.fromRGB(8, 16, 28)
frame.Draggable = true
frame.Active = true

frame.Paint = function(self, w, h)
  surface.SetDrawColor(8, 16, 28, 220)
  surface.DrawRect(0, 0, w, h)
  surface.SetTextColor(248, 250, 252, 255)
  surface.SetTextPos(16, 16)
  surface.DrawText("Runtime panel")
end
```

```lua
local button = Instance.new("TextButton", frame)
button.Position = UDim2.fromOffset(16, 112)
button.Size = UDim2.fromOffset(120, 34)
button.Text = "Click"
button.MouseButton1Click:Connect(function()
  print("clicked")
end)
```

Immediate drawing:

```lua
hook.Add("HUDPaint", "stats", function()
  surface.SetDrawColor(15, 23, 42, 210)
  surface.DrawRect(24, 24, 240, 64)
  draw.SimpleText("FPS", "Inter", 40, 42, { r = 255, g = 255, b = 255 })
end)
```

For graphs, paths, minimaps, and traces, prefer one batched path over many separate lines:

```lua
hook.Add("HUDPaint", "trace", function()
  surface.SetDrawColor(34, 197, 94, 220)
  surface.DrawLines({
    { 24, 120 },
    { 64, 96 },
    { 112, 132 },
    { 160, 88 }
  })
end)
```

Retained layer helpers remain available:

```lua
local hud = vweb.ui.layer("hud")
hud:text({ id = "label", x = 24, y = 24, text = "Hello" })
hud:button({ id = "button", x = 24, y = 64, w = 160, h = 40, text = "Click" })
```

## Chat

```lua
vweb.chat.onMessage(function(event)
  print(event.username, event.text)
end)

vweb.chat.onSend(function(event)
  if event.text == "!ping" then
    vweb.chat.system("pong")
    return false
  end
end)
```

Returning `false` cancels the outgoing message. Returning a string rewrites it.

Named hooks are available for chat too:

```lua
hook.Add("ChatMessage", "reader", function(event)
  print(event.username, event.text)
end)

hook.Add("ChatSend", "commands", function(event)
  if event.text == "!local" then
    vweb.chat.system("handled locally")
    return false
  end
end)
```

`vweb.chat.onIncoming` aliases `onMessage`; `vweb.chat.onOutgoing` aliases `onSend`.

## Assets

```lua
local url = vweb.assets.image("hud/icon.png")
vweb.cursor.setImage({ url = url, width = 32, height = 32, hotspot = { 2, 2, 0 } })
```

Asset paths resolve through Vortex Web approved/package/workspace asset handling.

## Limits

- Current scripts are browser-local unless a runtime service has explicit replication support.
- Raw network and browser APIs are intentionally unavailable.
- Stopping a session clears its hooks, frame/input/chat callbacks, `HUDPaint`, `vgui` panels, `frame.Paint`, `surface`/`draw` output, and retained UI elements created by that script.
- `onDestroy` is still the right place for script-specific state cleanup.
- APIs may change while Lua support is still gated and experimental.

## Generated Reference

The raw API table is generated from `web-client/src/scripting/LuaApiReference.ts` into [LUA_API.md](LUA_API.md):

```powershell
cd web-client
npm run docs:lua-api
```
