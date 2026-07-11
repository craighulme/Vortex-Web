---@meta

---@class VWebVector3
---@field x number
---@field y number
---@field z number

---@class VWebScreenPoint
---@field x number
---@field y number
---@field z number
---@field visible boolean

---@class VWebRay
---@field origin VWebVector3
---@field direction VWebVector3

---@class VWebRayHit
---@field hit boolean
---@field point? VWebVector3
---@field position? VWebVector3
---@field normal? VWebVector3
---@field distance? number
---@field collider? any
---@field partId? string
---@field part? VWebWorldPart

---@class VWebWorldPart
---@field id string
---@field type string
---@field position VWebVector3
---@field size VWebVector3
---@field rotation? VWebVector3
---@field color? number
---@field transparency number
---@field canCollide boolean
---@field shape string
---@field batched boolean

---@class VWebUiHandle
---@field id string
---@field layer string
---@field kind string
---@field set fun(self: VWebUiHandle, input: table): VWebUiHandle
---@field update fun(self: VWebUiHandle, input: table): VWebUiHandle
---@field show fun(self: VWebUiHandle): VWebUiHandle
---@field hide fun(self: VWebUiHandle): VWebUiHandle
---@field remove fun(self: VWebUiHandle): boolean

---@class VWebUiLayer
---@field text fun(self: VWebUiLayer, input: table): VWebUiHandle
---@field rect fun(self: VWebUiLayer, input: table): VWebUiHandle
---@field image fun(self: VWebUiLayer, input: table): VWebUiHandle
---@field button fun(self: VWebUiLayer, input: table): VWebUiHandle
---@field panel fun(self: VWebUiLayer, input: table): VWebUiHandle
---@field line fun(self: VWebUiLayer, input: table): VWebUiHandle
---@field circle fun(self: VWebUiLayer, input: table): VWebUiHandle
---@field progress fun(self: VWebUiLayer, input: table): VWebUiHandle
---@field chart fun(self: VWebUiLayer, input: table): VWebUiHandle
---@field update fun(self: VWebUiLayer, id: string, input: table): VWebUiHandle
---@field remove fun(self: VWebUiLayer, id: string): boolean
---@field clear fun(self: VWebUiLayer): number
---@field viewport fun(self: VWebUiLayer): table

---@class VWebPlayer
---@field id any
---@field name string
---@field localPlayer boolean
---@field getTransform fun(self: VWebPlayer): table
---@field setTransform fun(self: VWebPlayer, transform: table, options?: table): boolean
---@field clearTransform fun(self: VWebPlayer): boolean
---@field setBodyColors fun(self: VWebPlayer, colors: table): boolean
---@field setBodyColor fun(self: VWebPlayer, slot: string, color: string): boolean
---@field setTexture fun(self: VWebPlayer, slot: string, url: string): boolean
---@field setOutfit fun(self: VWebPlayer, outfit: table): boolean
---@field walkTo fun(self: VWebPlayer, position: table, options?: table): table
---@field stopWalking fun(self: VWebPlayer): boolean

---@class VWeb
vweb = {}

vweb.assets = {}
---@param path string
---@return string
function vweb.assets.url(path) end
---@param path string
---@return string
function vweb.assets.image(path) end

vweb.ui = {}
---@param name string
---@return VWebUiLayer
function vweb.ui.layer(name) end
---@return table
function vweb.ui.viewport() end
---@param name? string
---@return number
function vweb.ui.clear(name) end

vweb.draw = {}
---@param input table
function vweb.draw.text(input) end
---@param input table
function vweb.draw.rect(input) end
---@param input table
function vweb.draw.image(input) end
---@param input table
function vweb.draw.button(input) end
---@param input table
function vweb.draw.panel(input) end
---@param input table
function vweb.draw.line(input) end
---@param input table
function vweb.draw.circle(input) end
---@param input table
function vweb.draw.progress(input) end
---@param input table
function vweb.draw.chart(input) end
function vweb.draw.clear() end

surface = {}
function surface.SetDrawColor(r, g, b, a) end
function surface.SetTextColor(r, g, b, a) end
function surface.SetFont(font, size, weight) end
function surface.SetMaterial(url) end
function surface.SetTextPos(x, y) end
function surface.GetTextSize(text) end
function surface.DrawRect(x, y, w, h) end
function surface.DrawOutlinedRect(x, y, w, h, width) end
function surface.DrawLine(x, y, x2, y2) end
function surface.DrawCircle(x, y, radius, color) end
function surface.DrawText(text) end
function surface.DrawTexturedRect(x, y, w, h) end

draw = {}
function draw.SimpleText(text, font, x, y, color, alignX, alignY) end

---@class VWebPanel
---@field x number
---@field y number
---@field w number
---@field h number
---@field DoClick? fun(self: VWebPanel, event: table)
---@field Paint? fun(self: VWebPanel, w: number, h: number)
---@field SetPos fun(self: VWebPanel, x: number, y: number)
---@field SetSize fun(self: VWebPanel, w: number, h: number)
---@field SetText fun(self: VWebPanel, text: string)
---@field SetTitle fun(self: VWebPanel, text: string)
---@field SetColor fun(self: VWebPanel, color: any)
---@field SetBackgroundColor fun(self: VWebPanel, color: any)
---@field SetImage fun(self: VWebPanel, url: string)
---@field SetAlpha fun(self: VWebPanel, alpha: number)
---@field SetTooltip fun(self: VWebPanel, text: string)
---@field SetCursor fun(self: VWebPanel, cursor: string)
---@field SetTransition fun(self: VWebPanel, value: string)
---@field SetVisible fun(self: VWebPanel, visible: boolean)
---@field IsVisible fun(self: VWebPanel): boolean
---@field IsHovered fun(self: VWebPanel): boolean
---@field ScreenX fun(self: VWebPanel): number
---@field ScreenY fun(self: VWebPanel): number
---@field Show fun(self: VWebPanel)
---@field Hide fun(self: VWebPanel)
---@field Remove fun(self: VWebPanel)
---@field MakePopup fun(self: VWebPanel)
---@field SetMouseInputEnabled fun(self: VWebPanel, enabled: boolean)
---@field SetKeyboardInputEnabled fun(self: VWebPanel, enabled: boolean)
---@field SetDraggable fun(self: VWebPanel, enabled: boolean)
---@field MoveTo fun(self: VWebPanel, x: number, y: number, seconds?: number)
---@field AlphaTo fun(self: VWebPanel, alpha: number, seconds?: number)
---@field OnMouseEntered? fun(self: VWebPanel, event: table)
---@field OnMouseExited? fun(self: VWebPanel, event: table)
---@field OnHover? fun(self: VWebPanel, event: table)
---@field OnDrag? fun(self: VWebPanel, event: table)

vgui = {}
---@param className string
---@param parent? VWebPanel
---@param id? string
---@return VWebPanel
function vgui.Create(className, parent, id) end
function vgui.RemoveAll() end

vweb.gui = {}
function vweb.gui.create(className, parent, id) end
function vweb.gui.removeAll() end
function vweb.gui.panel(id) end
function vweb.gui.button(id) end
function vweb.gui.label(id) end
function vweb.gui.image(id) end

vweb.hud = {}
function vweb.hud.paint(id, fn) end
function vweb.hud.removePaint(id) end
function vweb.hud.clear() end
vweb.hud.surface = surface
vweb.hud.draw = draw
vweb.surface = surface

hook = {}
function hook.Add(eventName, id, fn) end
function hook.Remove(eventName, id) end
function hook.Run(eventName, ...) end

vweb.input = {}
---@return table
function vweb.input.mousePosition() end
---@return table
function vweb.input.viewport() end
---@param code string
---@return boolean
function vweb.input.isDown(code) end
---@param code string
---@param fn fun(event: table)
function vweb.input.onKey(code, fn) end
---@param fn fun(button: string, event: table)
function vweb.input.onClick(fn) end
---@param fn fun(event: table)
function vweb.input.onInput(fn) end

vweb.camera = {}
---@return table
function vweb.camera.state() end
---@param distance number
function vweb.camera.setDistanceOverride(distance) end
function vweb.camera.clearDistanceOverride() end
---@param x number|table
---@param y? number
---@return VWebRay
function vweb.camera.screenPointToRay(x, y) end
---@param point VWebVector3|table
---@return VWebScreenPoint
function vweb.camera.worldToScreen(point) end

vweb.physics = {}
---@param origin VWebVector3|table
---@param direction VWebVector3|table
---@param maxDistance? number
---@return VWebRayHit
function vweb.physics.raycast(origin, direction, maxDistance) end

vweb.players = {}
---@return VWebPlayer
function vweb.players.localPlayer() end
---@return VWebPlayer[]
function vweb.players.all() end
---@return VWebPlayer?
function vweb.players.find(query) end
function vweb.players.getTransform(query) end
function vweb.players.setTransform(query, transform, options) end
function vweb.players.clearTransform(query) end
function vweb.players.setBodyColors(query, colors) end
function vweb.players.setBodyColor(query, slot, color) end
function vweb.players.setTexture(query, slot, url) end
function vweb.players.setOutfit(query, outfit) end
function vweb.players.walkTo(position, options) end
function vweb.players.stopWalking(query) end

vweb.world = {}
function vweb.world.localPosition() end
function vweb.world.spawnPart(part) end
function vweb.world.parts() end
function vweb.world.getPart(id) end
function vweb.world.setColor(id, color) end
function vweb.world.setTransparency(id, transparency) end
function vweb.world.setCollision(id, canCollide) end
function vweb.world.setCanCollide(id, canCollide) end
function vweb.world.setMarker(id, part) end
function vweb.world.clearMarker(id) end
function vweb.world.remove(id) end
function vweb.world.clearMine() end

vweb.cursor = {}
function vweb.cursor.setImage(options) end
function vweb.cursor.clear() end
function vweb.cursor.setClickToWalk(enabled) end

vweb.chat = {}
function vweb.chat.send(text) end
function vweb.chat.system(text) end
function vweb.chat.onMessage(fn) end
function vweb.chat.onSend(fn) end
function vweb.chat.onIncoming(fn) end
function vweb.chat.onOutgoing(fn) end

---@class RobloxConnection
---@field Connected boolean
---@field Disconnect fun(self: RobloxConnection)

---@class RobloxSignal
---@field Connect fun(self: RobloxSignal, fn: function): RobloxConnection

Vector3 = {}
---@return VWebVector3
function Vector3.new(x, y, z) end
Vector3.zero = { x = 0, y = 0, z = 0 }
Vector3.one = { x = 1, y = 1, z = 1 }

Vector2 = {}
function Vector2.new(x, y) end
Vector2.zero = { x = 0, y = 0 }

Color3 = {}
function Color3.fromRGB(r, g, b) end
function Color3.new(r, g, b) end

UDim2 = {}
function UDim2.new(scaleX, offsetX, scaleY, offsetY) end
function UDim2.fromOffset(x, y) end
function UDim2.fromScale(x, y) end

---@class RobloxPlayers
---@field LocalPlayer VWebPlayer
---@field GetPlayers fun(self: RobloxPlayers): VWebPlayer[]
---@field FindFirstChild fun(self: RobloxPlayers, query: any): VWebPlayer?

---@class RobloxWorkspace
---@field CurrentCamera table
---@field GetChildren fun(self: RobloxWorkspace): table[]
---@field Raycast fun(self: RobloxWorkspace, origin: table, direction: table, maxDistance?: number): VWebRayHit
---@field FindFirstChild fun(self: RobloxWorkspace, id: any): table?
---@field SpawnPart fun(self: RobloxWorkspace, part: table): table

---@class RobloxRunService
---@field RenderStepped RobloxSignal
---@field Heartbeat RobloxSignal

---@class RobloxUserInputService
---@field InputBegan RobloxSignal
---@field InputEnded RobloxSignal
---@field GetMouseLocation fun(self: RobloxUserInputService): table
---@field IsKeyDown fun(self: RobloxUserInputService, code: string): boolean

game = {}
function game:GetService(name) end

Players = {}
Workspace = {}
workspace = Workspace
RunService = {}
UserInputService = {}
Camera = {}

Instance = {}
---@return VWebPanel
function Instance.new(className, parent) end
