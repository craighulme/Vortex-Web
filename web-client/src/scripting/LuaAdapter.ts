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
local surfaceLayer = tostring(__vweb_surface_layer or "surface")
local frameCallbacks = {}
local inputCallbacks = {}
local clickCallbacks = {}
local incomingChatCallbacks = {}
local outgoingChatCallbacks = {}
local ownedUiElements = {}

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

local function looksLikeVector(value)
  return type(value) == "table" and (value.x ~= nil or value[1] ~= nil)
end

local function wrapPlayer(player, query)
  if player == nil then return nil end
  local wrapped = {
    id = player.id,
    name = player.name,
    localPlayer = player["local"] == true,
    local_ = player["local"] == true,
    __query = query or player.id or "me"
  }
  wrapped.getTransform = function(self) return call("players.getTransform", self.__query or "me") end
  wrapped.setTransform = function(self, transform, options) return call("players.setTransform", self.__query or "me", transform or {}, options or {}) end
  wrapped.clearTransform = function(self) return call("players.clearTransform", self.__query or "me") end
  wrapped.setBodyColors = function(self, colors) return call("players.setBodyColors", self.__query or "me", colors or {}) end
  wrapped.setBodyColor = function(self, slot, color) return call("players.setBodyColor", self.__query or "me", slot, color) end
  wrapped.setTexture = function(self, slot, url) return call("players.setTexture", self.__query or "me", slot, url) end
  wrapped.setOutfit = function(self, outfit) return call("players.setOutfit", self.__query or "me", outfit or {}) end
  wrapped.walkTo = function(self, position, options) return call("players.walkTo", self.__query or "me", position or {}, options or {}) end
  wrapped.stopWalking = function(self) return call("players.stopWalking", self.__query or "me") end
  return wrapped
end

vweb.players = {
  localPlayer = function() return wrapPlayer(call("players.localPlayer"), "me") end,
  all = function()
    local players = call("players.all")
    if type(players) ~= "table" then return players end
    local out = {}
    for i, player in ipairs(players) do out[i] = wrapPlayer(player, player.id or i) end
    return out
  end,
  find = function(query) return wrapPlayer(call("players.find", query), query) end,
  getTransform = function(query) return call("players.getTransform", query or "me") end,
  setTransform = function(query, transform, options) return call("players.setTransform", query or "me", transform or {}, options or {}) end,
  clearTransform = function(query) return call("players.clearTransform", query or "me") end,
  setBodyColors = function(query, colors) return call("players.setBodyColors", query or "me", colors or {}) end,
  setBodyColor = function(query, slot, color) return call("players.setBodyColor", query or "me", slot, color) end,
  setTexture = function(query, slot, url) return call("players.setTexture", query or "me", slot, url) end,
  setOutfit = function(query, outfit) return call("players.setOutfit", query or "me", outfit or {}) end,
  walkTo = function(queryOrPosition, maybePosition, maybeOptions)
    if looksLikeVector(queryOrPosition) then
      return call("players.walkTo", "me", queryOrPosition, maybePosition or {})
    end
    return call("players.walkTo", queryOrPosition or "me", maybePosition or {}, maybeOptions or {})
  end,
  stopWalking = function(query) return call("players.stopWalking", query or "me") end,
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
  state = function() return call("camera.state") end,
  setDistanceOverride = function(distance) return call("camera.setDistanceOverride", distance) end,
  clearDistanceOverride = function() return call("camera.clearDistanceOverride") end,
  screenPointToRay = function(x, y)
    local sx, sy = screenArgs(x, y)
    return call("camera.screenPointToRay", sx, sy)
  end,
  worldToScreen = function(point) return call("camera.worldToScreen", point or {}) end
}

vweb.input = {
  mousePosition = function() return call("input.mousePosition") end,
  viewport = function() return call("input.viewport") end,
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
  end,
  onKey = function(code, fn)
    if type(code) ~= "string" then error("vweb.input.onKey expects a key code", 2) end
    if type(fn) ~= "function" then error("vweb.input.onKey expects a function", 2) end
    table.insert(inputCallbacks, function(event)
      if event and event.type == "keydown" and event.code == code then fn(event) end
    end)
    return #inputCallbacks
  end
}

vweb.physics = {
  raycast = function(origin, direction, maxDistance) return call("physics.raycast", origin or {}, direction or {}, maxDistance or 500) end
}

vweb.assets = {
  url = function(path) return call("assets.url", path or "") end,
  image = function(path) return call("assets.image", path or "") end
}

local function cssColor(value, g, b, a)
  if type(value) == "string" then return value end
  local r = value
  if type(value) == "table" then
    r = value.r or value[1] or 255
    g = value.g or value[2] or 255
    b = value.b or value[3] or 255
    a = value.a or value[4] or a
  end
  r = math.floor(tonumber(r) or 255)
  g = math.floor(tonumber(g) or 255)
  b = math.floor(tonumber(b) or 255)
  if a == nil then return string.format("rgb(%d,%d,%d)", r, g, b) end
  local alpha = tonumber(a) or 255
  if alpha > 1 then alpha = alpha / 255 end
  return string.format("rgba(%d,%d,%d,%.3f)", r, g, b, alpha)
end

local surfaceState = {
  drawColor = "#ffffff",
  textColor = "#ffffff",
  material = nil,
  textX = 0,
  textY = 0,
  font = "Inter, ui-sans-serif, system-ui, sans-serif",
  size = 18,
  weight = 700,
  lineWidth = 1,
  counter = 0,
  offsetX = 0,
  offsetY = 0
}

local function surfaceId(kind)
  surfaceState.counter = surfaceState.counter + 1
  return "__surface_" .. kind .. "_" .. tostring(surfaceState.counter)
end

local function sx(value) return (tonumber(value) or 0) + surfaceState.offsetX end
local function sy(value) return (tonumber(value) or 0) + surfaceState.offsetY end

surface = surface or {}
surface.SetDrawColor = function(r, g, b, a) surfaceState.drawColor = cssColor(r, g, b, a) end
surface.SetTextColor = function(r, g, b, a) surfaceState.textColor = cssColor(r, g, b, a) end
surface.SetFont = function(font, size, weight)
  surfaceState.font = font or surfaceState.font
  surfaceState.size = tonumber(size) or surfaceState.size
  surfaceState.weight = tonumber(weight) or surfaceState.weight
end
surface.SetLineWidth = function(width) surfaceState.lineWidth = math.max(0.5, tonumber(width) or 1) end
surface.SetMaterial = function(url) surfaceState.material = call("assets.image", url or "") end
surface.SetTextPos = function(x, y) surfaceState.textX = tonumber(x) or 0; surfaceState.textY = tonumber(y) or 0 end
surface.GetTextSize = function(text)
  local size = call("ui.measureText", tostring(text or ""), { size = surfaceState.size, weight = surfaceState.weight, font = surfaceState.font })
  return size.width or 0, size.height or surfaceState.size
end
surface.DrawRect = function(x, y, w, h)
  return call("ui.rect", surfaceLayer, {
    id = surfaceId("rect"),
    x = sx(x), y = sy(y), w = w or 0, h = h or 0,
    color = surfaceState.drawColor,
    background = surfaceState.drawColor
  })
end
surface.DrawOutlinedRect = function(x, y, w, h, width)
  local line = tonumber(width) or 1
  surface.DrawRect(x, y, w, line)
  surface.DrawRect(x, (tonumber(y) or 0) + (tonumber(h) or 0) - line, w, line)
  surface.DrawRect(x, y, line, h)
  surface.DrawRect((tonumber(x) or 0) + (tonumber(w) or 0) - line, y, line, h)
end
surface.DrawLine = function(x, y, x2, y2)
  return call("ui.line", surfaceLayer, {
    id = surfaceId("line"),
    x = sx(x), y = sy(y), x2 = sx(x2), y2 = sy(y2),
    color = surfaceState.drawColor,
    width = surfaceState.lineWidth
  })
end
surface.DrawLines = function(points, closed)
  if type(points) ~= "table" then return nil end
  local out = {}
  for _, point in ipairs(points) do
    if type(point) == "table" then
      local px = point.x or point[1]
      local py = point.y or point[2]
      if px ~= nil and py ~= nil then
        table.insert(out, { x = sx(px), y = sy(py) })
      end
    end
  end
  return call("ui.polyline", surfaceLayer, {
    id = surfaceId("polyline"),
    points = out,
    color = surfaceState.drawColor,
    width = surfaceState.lineWidth,
    fill = closed == true
  })
end
surface.DrawPolyline = surface.DrawLines
surface.DrawCircle = function(x, y, radius, color)
  return call("ui.circle", surfaceLayer, {
    id = surfaceId("circle"),
    x = sx(x), y = sy(y), r = radius or 8,
    color = color and cssColor(color) or surfaceState.drawColor,
    fill = false,
    width = 2
  })
end
surface.DrawText = function(text)
  return call("ui.text", surfaceLayer, {
    id = surfaceId("text"),
    x = sx(surfaceState.textX), y = sy(surfaceState.textY),
    text = tostring(text or ""),
    color = surfaceState.textColor,
    size = surfaceState.size,
    weight = surfaceState.weight,
    font = surfaceState.font,
    shadow = true
  })
end
surface.DrawTexturedRect = function(x, y, w, h)
  if not surfaceState.material then return surface.DrawRect(x, y, w, h) end
  return call("ui.image", surfaceLayer, {
    id = surfaceId("image"),
    x = sx(x), y = sy(y), w = w or 0, h = h or 0,
    url = surfaceState.material
  })
end
surface.__beginFrame = function()
  surfaceState.counter = 0
  surfaceState.offsetX = 0
  surfaceState.offsetY = 0
  call("ui.clear", surfaceLayer)
end
surface.__withOffset = function(x, y, fn)
  local ox, oy = surfaceState.offsetX, surfaceState.offsetY
  surfaceState.offsetX = ox + (tonumber(x) or 0)
  surfaceState.offsetY = oy + (tonumber(y) or 0)
  local ok, result = pcall(fn)
  surfaceState.offsetX, surfaceState.offsetY = ox, oy
  if not ok then error(result, 2) end
  return result
end

draw = draw or {}
draw.SimpleText = function(text, font, x, y, color, alignX, alignY)
  if font then surface.SetFont(font) end
  local width, height = surface.GetTextSize(text)
  local tx = tonumber(x) or 0
  local ty = tonumber(y) or 0
  if alignX == 1 or alignX == "center" then tx = tx - width / 2 elseif alignX == 2 or alignX == "right" then tx = tx - width end
  if alignY == 1 or alignY == "center" then ty = ty - height / 2 elseif alignY == 2 or alignY == "bottom" then ty = ty - height end
  if color then surface.SetTextColor(color) end
  surface.SetTextPos(tx, ty)
  return surface.DrawText(text)
end

local function makeLayer(name)
  local function trackUi(info)
    if type(info) == "table" or type(info) == "userdata" then
      local id = info.id
      local layer = info.layer or name
      if id ~= nil and layer ~= nil then
        table.insert(ownedUiElements, { layer = layer, id = id })
      end
    end
    return info
  end

  local function wrapHandle(info)
    info = trackUi(info)
    if info == nil then return nil end
    if type(info) ~= "table" and type(info) ~= "userdata" then return info end
    local handle = {
      id = info.id,
      layer = info.layer or name,
      kind = info.kind
    }
    handle.set = function(self, input)
      local nextInput = input or {}
      return wrapHandle(call("ui.update", self.layer, self.id, nextInput))
    end
    handle.update = handle.set
    handle.remove = function(self) return call("ui.remove", self.layer, self.id) end
    handle.hide = function(self) return wrapHandle(call("ui.update", self.layer, self.id, { opacity = 0, pointerEvents = false })) end
    handle.show = function(self) return wrapHandle(call("ui.update", self.layer, self.id, { opacity = 1 })) end
    return handle
  end
  return {
    info = function() return call("ui.layer", name) end,
    clear = function() return call("ui.clear", name) end,
    viewport = function() return call("ui.viewport") end,
    update = function(self, id, input) return wrapHandle(call("ui.update", name, id, input or {})) end,
    remove = function(self, id) return call("ui.remove", name, id) end,
    text = function(selfOrInput, maybeInput) return wrapHandle(call("ui.text", name, firstArg(selfOrInput, maybeInput) or {})) end,
    rect = function(selfOrInput, maybeInput) return wrapHandle(call("ui.rect", name, firstArg(selfOrInput, maybeInput) or {})) end,
    image = function(selfOrInput, maybeInput) return wrapHandle(call("ui.image", name, firstArg(selfOrInput, maybeInput) or {})) end,
    button = function(selfOrInput, maybeInput) return wrapHandle(call("ui.button", name, firstArg(selfOrInput, maybeInput) or {})) end,
    panel = function(selfOrInput, maybeInput) return wrapHandle(call("ui.panel", name, firstArg(selfOrInput, maybeInput) or {})) end,
    line = function(selfOrInput, maybeInput) return wrapHandle(call("ui.line", name, firstArg(selfOrInput, maybeInput) or {})) end,
    polyline = function(selfOrInput, maybeInput) return wrapHandle(call("ui.polyline", name, firstArg(selfOrInput, maybeInput) or {})) end,
    circle = function(selfOrInput, maybeInput) return wrapHandle(call("ui.circle", name, firstArg(selfOrInput, maybeInput) or {})) end,
    progress = function(selfOrInput, maybeInput) return wrapHandle(call("ui.progress", name, firstArg(selfOrInput, maybeInput) or {})) end,
    chart = function(selfOrInput, maybeInput) return wrapHandle(call("ui.chart", name, firstArg(selfOrInput, maybeInput) or {})) end
  }
end

vweb.ui = {
  layer = makeLayer,
  clear = function(name) return call("ui.clear", name) end,
  viewport = function() return call("ui.viewport") end
}

local vguiPanels = {}
local function vguiKind(className)
  local name = string.lower(tostring(className or "Panel"))
  if name == "dbutton" or name == "button" or name == "textbutton" or name == "imagebutton" then return "button" end
  if name == "dlabel" or name == "label" or name == "textlabel" then return "text" end
  if name == "dimage" or name == "image" or name == "imagelabel" then return "image" end
  return "panel"
end

local function createPanel(className, id)
  local panel = {
    className = className or "Panel",
    id = id or ("panel-" .. tostring(#vguiPanels + 1)),
    x = 0,
    y = 0,
    w = 260,
    h = 96,
    text = "",
    title = "",
    color = "#f8fafc",
    background = "rgba(8,16,28,0.94)",
    visible = true,
    mouseInput = false,
    keyboardInput = false,
    draggable = false,
    hovered = false,
    alpha = 1,
    tooltip = nil,
    transition = nil,
    cursor = nil,
    parent = nil,
    children = {}
  }
  function panel:ScreenX()
    if self.parent then return (tonumber(self.parent:ScreenX()) or 0) + (tonumber(self.x) or 0) end
    return tonumber(self.x) or 0
  end
  function panel:ScreenY()
    if self.parent then return (tonumber(self.parent:ScreenY()) or 0) + (tonumber(self.y) or 0) end
    return tonumber(self.y) or 0
  end
  function panel:ApplyChildren()
    for _, child in pairs(self.children or {}) do
      if child and type(child.Apply) == "function" then child:Apply() end
    end
    return self
  end
  function panel:Apply()
    if self.visible == false then
      call("ui.update", "vgui", self.id, { opacity = 0, pointerEvents = false })
      return self
    end
    local customPaint = type(self.Paint) == "function"
    local input = {
      id = self.id,
      x = self:ScreenX(),
      y = self:ScreenY(),
      w = self.w,
      h = self.h,
      text = customPaint and "" or self.text,
      title = customPaint and "" or self.title,
      color = self.color,
      background = customPaint and "rgba(0,0,0,0)" or self.background,
      border = customPaint and "0" or nil,
      opacity = self.alpha,
      tooltip = self.tooltip,
      transition = self.transition,
      cursor = self.cursor,
      draggable = self.draggable,
      pointerEvents = self.mouseInput,
      onClick = function(event)
        if type(self.DoClick) == "function" then return self:DoClick(event) end
      end,
      onMouseEnter = function(event)
        self.hovered = true
        if type(self.OnMouseEntered) == "function" then return self:OnMouseEntered(event) end
      end,
      onMouseLeave = function(event)
        self.hovered = false
        if type(self.OnMouseExited) == "function" then return self:OnMouseExited(event) end
      end,
      onHover = function(event)
        if type(self.OnHover) == "function" then return self:OnHover(event) end
      end,
      onDrag = function(event)
        local nextX = tonumber(event.elementX) or self:ScreenX()
        local nextY = tonumber(event.elementY) or self:ScreenY()
        if self.parent then
          nextX = nextX - self.parent:ScreenX()
          nextY = nextY - self.parent:ScreenY()
        end
        self.x = nextX
        self.y = nextY
        self:ApplyChildren()
        if type(self.OnDrag) == "function" then return self:OnDrag(event) end
      end
    }
    local kind = vguiKind(self.className)
    if kind == "button" then return call("ui.button", "vgui", input) end
    if kind == "text" then return call("ui.text", "vgui", input) end
    if kind == "image" then
      input.url = self.url
      return call("ui.image", "vgui", input)
    end
    return call("ui.panel", "vgui", input)
  end
  function panel:SetPos(x, y) self.x = tonumber(x) or self.x; self.y = tonumber(y) or self.y; self:Apply(); return self:ApplyChildren() end
  function panel:SetSize(w, h) self.w = tonumber(w) or self.w; self.h = tonumber(h) or self.h; self:Apply(); return self:ApplyChildren() end
  function panel:SetWide(w) self.w = tonumber(w) or self.w; return self:Apply() end
  function panel:SetTall(h) self.h = tonumber(h) or self.h; return self:Apply() end
  function panel:SetText(text) self.text = tostring(text or ""); return self:Apply() end
  function panel:SetTitle(text) self.title = tostring(text or ""); return self:Apply() end
  function panel:SetColor(color) self.color = cssColor(color); return self:Apply() end
  function panel:SetBackgroundColor(color) self.background = cssColor(color); return self:Apply() end
  function panel:SetImage(url) self.url = call("assets.image", url or ""); return self:Apply() end
  function panel:SetAlpha(alpha) self.alpha = math.max(0, math.min(1, (tonumber(alpha) or 255) > 1 and (tonumber(alpha) or 255) / 255 or (tonumber(alpha) or 1))); return self:Apply() end
  function panel:SetTooltip(text) self.tooltip = tostring(text or ""); return self:Apply() end
  function panel:SetCursor(cursor) self.cursor = tostring(cursor or ""); return self:Apply() end
  function panel:SetTransition(value) self.transition = tostring(value or ""); return self:Apply() end
  function panel:SetVisible(visible) self.visible = visible ~= false; return self:Apply() end
  function panel:IsVisible() return self.visible ~= false end
  function panel:IsHovered() return self.hovered == true end
  function panel:Show() self.visible = true; return self:Apply() end
  function panel:Hide() self.visible = false; return self:Apply() end
  function panel:Remove() vguiPanels[self.id] = nil; return call("ui.remove", "vgui", self.id) end
  function panel:SetMouseInputEnabled(enabled) self.mouseInput = enabled == true; return self:Apply() end
  function panel:SetKeyboardInputEnabled(enabled) self.keyboardInput = enabled == true; return self end
  function panel:MakePopup() self.mouseInput = true; self.keyboardInput = true; return self:Apply() end
  function panel:SetDraggable(enabled) self.draggable = enabled == true; return self:Apply() end
  function panel:MoveTo(x, y, seconds)
    self.transition = "left " .. tostring(seconds or 0.18) .. "s ease, top " .. tostring(seconds or 0.18) .. "s ease"
    self.x = tonumber(x) or self.x
    self.y = tonumber(y) or self.y
    self:Apply()
    return self:ApplyChildren()
  end
  function panel:AlphaTo(alpha, seconds)
    self.transition = "opacity " .. tostring(seconds or 0.18) .. "s ease"
    return self:SetAlpha(alpha)
  end
  function panel:Dock() return self end
  function panel:SetParent(parent)
    if self.parent and self.parent.children then self.parent.children[self.id] = nil end
    self.parent = parent
    if parent and parent.children then parent.children[self.id] = self end
    return self:Apply()
  end
  vguiPanels[panel.id] = panel
  panel:Apply()
  return panel
end

vgui = vgui or {}
vgui.Create = function(className, parent, id)
  local panel = createPanel(className, id)
  if parent then panel:SetParent(parent) end
  return panel
end
vgui.RemoveAll = function()
  for _, panel in pairs(vguiPanels) do panel:Remove() end
end

vweb.gui = {
  create = vgui.Create,
  removeAll = vgui.RemoveAll,
  panel = function(id) return vgui.Create("Panel", nil, id) end,
  button = function(id) return vgui.Create("Button", nil, id) end,
  label = function(id) return vgui.Create("Label", nil, id) end,
  image = function(id) return vgui.Create("Image", nil, id) end
}

local hookCallbacks = {}
hook = hook or {}
hook.Add = function(eventName, id, fn)
  if type(eventName) ~= "string" then error("hook.Add expects an event name", 2) end
  if type(fn) ~= "function" then error("hook.Add expects a function", 2) end
  hookCallbacks[eventName] = hookCallbacks[eventName] or {}
  hookCallbacks[eventName][tostring(id or fn)] = fn
end
hook.Remove = function(eventName, id)
  if hookCallbacks[eventName] then hookCallbacks[eventName][tostring(id or "")] = nil end
end
hook.Run = function(eventName, ...)
  local callbacks = hookCallbacks[eventName]
  if not callbacks then return nil end
  local result = nil
  for _, fn in pairs(callbacks) do
    local value = fn(...)
    if value ~= nil then result = value end
  end
  return result
end

vweb.draw = {
  text = function(input) return makeLayer("draw"):text(input or {}) end,
  rect = function(input) return makeLayer("draw"):rect(input or {}) end,
  image = function(input) return makeLayer("draw"):image(input or {}) end,
  button = function(input) return makeLayer("draw"):button(input or {}) end,
  panel = function(input) return makeLayer("draw"):panel(input or {}) end,
  line = function(input) return makeLayer("draw"):line(input or {}) end,
  polyline = function(input) return makeLayer("draw"):polyline(input or {}) end,
  circle = function(input) return makeLayer("draw"):circle(input or {}) end,
  progress = function(input) return makeLayer("draw"):progress(input or {}) end,
  chart = function(input) return makeLayer("draw"):chart(input or {}) end,
  clear = function() return call("ui.clear", "draw") end
}

vweb.world = {
  localPosition = function() return call("world.localPosition") end,
  parts = function() return call("world.parts") end,
  getPart = function(id) return call("world.getPart", id) end,
  spawnPart = function(part) return call("world.spawnPart", part or {}) end,
  setColor = function(id, color) return call("world.setColor", id, color) end,
  setTransparency = function(id, transparency) return call("world.setTransparency", id, transparency) end,
  setCollision = function(id, canCollide) return call("world.setCollision", id, canCollide) end,
  setCanCollide = function(id, canCollide) return call("world.setCanCollide", id, canCollide) end,
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

vweb.hud = {
  paint = function(id, fn) return hook.Add("HUDPaint", id, fn) end,
  removePaint = function(id) return hook.Remove("HUDPaint", id) end,
  clear = function() return call("ui.clear", surfaceLayer) end,
  surface = surface,
  draw = draw
}

vweb.surface = surface

vweb.debug = {
  snapshot = function() return call("debug.snapshot") end
}

vweb.chat = {
  send = function(text) return call("chat.send", text or "") end,
  system = function(text) return call("chat.system", text or "") end,
  onMessage = function(fn)
    if type(fn) ~= "function" then error("vweb.chat.onMessage expects a function", 2) end
    table.insert(incomingChatCallbacks, fn)
    return #incomingChatCallbacks
  end,
  onSend = function(fn)
    if type(fn) ~= "function" then error("vweb.chat.onSend expects a function", 2) end
    table.insert(outgoingChatCallbacks, fn)
    return #outgoingChatCallbacks
  end
}
vweb.chat.onIncoming = vweb.chat.onMessage
vweb.chat.onOutgoing = vweb.chat.onSend

local function makeSignal(connectFn)
  return {
    Connect = function(self, fn)
      if type(fn) ~= "function" then error("Connect expects a function", 2) end
      local token = connectFn(fn)
      return {
        Connected = true,
        Disconnect = function(self)
          self.Connected = false
          if type(token) == "function" then token() end
        end,
        disconnect = function(self) return self:Disconnect() end
      }
    end,
    connect = function(self, fn) return self:Connect(fn) end
  }
end

Vector3 = Vector3 or {}
Vector3.new = function(x, y, z) return { x = tonumber(x) or 0, y = tonumber(y) or 0, z = tonumber(z) or 0 } end
Vector3.zero = Vector3.new(0, 0, 0)
Vector3.one = Vector3.new(1, 1, 1)

Vector2 = Vector2 or {}
Vector2.new = function(x, y) return { x = tonumber(x) or 0, y = tonumber(y) or 0 } end
Vector2.zero = Vector2.new(0, 0)

Color3 = Color3 or {}
Color3.fromRGB = function(r, g, b) return { r = tonumber(r) or 255, g = tonumber(g) or 255, b = tonumber(b) or 255 } end
Color3.new = function(r, g, b)
  return Color3.fromRGB(math.floor((tonumber(r) or 1) * 255), math.floor((tonumber(g) or 1) * 255), math.floor((tonumber(b) or 1) * 255))
end

UDim2 = UDim2 or {}
UDim2.new = function(scaleX, offsetX, scaleY, offsetY)
  return {
    X = { Scale = tonumber(scaleX) or 0, Offset = tonumber(offsetX) or 0 },
    Y = { Scale = tonumber(scaleY) or 0, Offset = tonumber(offsetY) or 0 }
  }
end
UDim2.fromOffset = function(x, y) return UDim2.new(0, x, 0, y) end
UDim2.fromScale = function(x, y) return UDim2.new(x, 0, y, 0) end

local function udimOffset(value, axis)
  if type(value) ~= "table" then return tonumber(value) or 0 end
  local slot = value[axis] or value[string.upper(axis)] or {}
  return tonumber(slot.Offset or slot.offset or value[axis] or value[axis == "x" and 1 or 2]) or 0
end

local function applyRobloxProperty(panel, key, value)
  if key == "Name" then panel.id = tostring(value or panel.id); return true end
  if key == "Parent" then panel:SetParent(value); return true end
  if key == "Position" then panel:SetPos(udimOffset(value, "x"), udimOffset(value, "y")); return true end
  if key == "Size" then panel:SetSize(udimOffset(value, "x"), udimOffset(value, "y")); return true end
  if key == "Text" then panel:SetText(value); return true end
  if key == "Image" then panel:SetImage(value); return true end
  if key == "Visible" then panel:SetVisible(value ~= false); return true end
  if key == "Active" then panel:SetMouseInputEnabled(value == true); return true end
  if key == "Draggable" then panel:SetDraggable(value == true); return true end
  if key == "BackgroundColor3" then panel:SetBackgroundColor(value); return true end
  if key == "TextColor3" then panel:SetColor(value); return true end
  if key == "BackgroundTransparency" then panel:SetAlpha(1 - (tonumber(value) or 0)); return true end
  return false
end

local function robloxifyPanel(panel)
  local rawSet = rawset
  local original = getmetatable(panel) or {}
  original.__newindex = function(self, key, value)
    if not applyRobloxProperty(self, key, value) then rawSet(self, key, value) end
  end
  original.__index = function(self, key)
    if key == "AbsolutePosition" then return Vector2.new(self:ScreenX(), self:ScreenY()) end
    if key == "AbsoluteSize" then return Vector2.new(self.w or 0, self.h or 0) end
    if key == "MouseButton1Click" then
      return makeSignal(function(fn)
        self.DoClick = function(_, event) return fn(event) end
      end)
    end
    return rawget(self, key)
  end
  setmetatable(panel, original)
  return panel
end

local RobloxPlayers = setmetatable({
  GetPlayers = function(self) return vweb.players.all() end,
  FindFirstChild = function(self, query) return vweb.players.find(query) end
}, {
  __index = function(_, key)
    if key == "LocalPlayer" then return vweb.players.localPlayer() end
    return nil
  end
})

local RobloxCamera = {
  GetState = function(self) return vweb.camera.state() end,
  WorldToScreenPoint = function(self, point) return vweb.camera.worldToScreen(point) end,
  ScreenPointToRay = function(self, x, y) return vweb.camera.screenPointToRay(x, y) end,
  SetDistanceOverride = function(self, distance) return vweb.camera.setDistanceOverride(distance) end,
  ClearDistanceOverride = function(self) return vweb.camera.clearDistanceOverride() end
}

local RobloxWorkspace = {
  CurrentCamera = RobloxCamera,
  GetChildren = function(self) return vweb.world.parts() end,
  Raycast = function(self, origin, direction, maxDistance) return vweb.physics.raycast(origin, direction, maxDistance) end,
  FindFirstChild = function(self, id) return vweb.world.getPart(id) end,
  SpawnPart = function(self, part) return vweb.world.spawnPart(part or {}) end
}

local RobloxUserInputService = {
  GetMouseLocation = function(self) return vweb.input.mousePosition() end,
  IsKeyDown = function(self, code) return vweb.input.isDown(code) end,
  InputBegan = makeSignal(function(fn) return vweb.input.onInput(function(event) if event and event.type == "keydown" then fn(event, false) end end) end),
  InputEnded = makeSignal(function(fn) return vweb.input.onInput(function(event) if event and event.type == "keyup" then fn(event, false) end end) end)
}

local RobloxRunService = {
  RenderStepped = makeSignal(function(fn) return vweb.events.onFrame(fn) end),
  Heartbeat = makeSignal(function(fn) return vweb.events.onFrame(fn) end)
}

local RobloxGuiService = {
  Create = function(self, className, parent, id) return robloxifyPanel(vgui.Create(className, parent, id)) end
}

local services = {
  Players = RobloxPlayers,
  Workspace = RobloxWorkspace,
  RunService = RobloxRunService,
  UserInputService = RobloxUserInputService,
  GuiService = RobloxGuiService,
  Camera = RobloxCamera
}

game = game or {}
game.GetService = function(self, name)
  if name == nil then name = self end
  local service = services[tostring(name or "")]
  if service == nil then error("unknown service: " .. tostring(name), 2) end
  return service
end

Players = RobloxPlayers
Workspace = RobloxWorkspace
workspace = RobloxWorkspace
RunService = RobloxRunService
UserInputService = RobloxUserInputService
Camera = RobloxCamera

Instance = Instance or {}
Instance.new = function(className, parent)
  return robloxifyPanel(vgui.Create(className or "Frame", parent))
end

function __vweb_dispatchUpdate(dt)
  surface.__beginFrame()
  call("ui.clear", "draw")
  if type(onUpdate) == "function" then onUpdate(dt) end
  for _, fn in ipairs(frameCallbacks) do fn(dt) end
  if hook and type(hook.Run) == "function" then hook.Run("Think", dt); hook.Run("RenderStepped", dt) end
  if type(HUDPaint) == "function" then HUDPaint() end
  if hook and type(hook.Run) == "function" then hook.Run("HUDPaint") end
  for _, panel in pairs(vguiPanels) do
    if panel.visible ~= false and type(panel.Paint) == "function" then
      if panel.__paintShell ~= true then
        panel.__paintShell = true
        panel:Apply()
      end
      surface.__withOffset(panel.x, panel.y, function() panel:Paint(panel.w, panel.h) end)
    end
  end
end

function __vweb_dispatchInput(event)
  if type(onInput) == "function" then onInput(event) end
  for _, fn in ipairs(inputCallbacks) do fn(event) end
  if event and event.type == "click" then
    for _, fn in ipairs(clickCallbacks) do fn(event.button or "left", event) end
  end
end

function __vweb_dispatchChatIncoming(event)
  if type(onChatMessage) == "function" then onChatMessage(event) end
  if hook and type(hook.Run) == "function" then hook.Run("ChatMessage", event); hook.Run("OnPlayerChat", event) end
  for _, fn in ipairs(incomingChatCallbacks) do fn(event) end
end

function __vweb_dispatchChatOutgoing(event)
  local current = event or {}
  local function applyResult(result)
    if result == false then
      current.cancel = true
    elseif type(result) == "string" then
      current.text = result
    elseif type(result) == "table" then
      if result.cancel ~= nil then current.cancel = result.cancel == true end
      if type(result.text) == "string" then current.text = result.text end
    end
  end
  if type(onChatSend) == "function" then applyResult(onChatSend(current)) end
  if hook and type(hook.Run) == "function" then applyResult(hook.Run("ChatSend", current)); applyResult(hook.Run("OnChatSend", current)) end
  for _, fn in ipairs(outgoingChatCallbacks) do applyResult(fn(current)) end
  return current
end

function __vweb_cleanup()
  if vgui and type(vgui.RemoveAll) == "function" then vgui.RemoveAll() end
  for _, item in ipairs(ownedUiElements) do
    call("ui.remove", item.layer, item.id)
  end
  if vweb and vweb.ui then
    vweb.ui.clear(surfaceLayer)
    vweb.ui.clear("draw")
  end
  hookCallbacks = {}
  frameCallbacks = {}
  inputCallbacks = {}
  clickCallbacks = {}
  incomingChatCallbacks = {}
  outgoingChatCallbacks = {}
  ownedUiElements = {}
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

  async chatIncoming(event: Record<string, unknown>): Promise<void> {
    if (this.disposed) return;
    await this.call("__vweb_dispatchChatIncoming", event);
  }

  async chatOutgoing(event: Record<string, unknown>): Promise<unknown> {
    if (this.disposed) return event;
    return await this.call("__vweb_dispatchChatOutgoing", event);
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
      try {
        await this.call("__vweb_cleanup");
      } catch (error) {
        this.log("warn", error instanceof Error ? error.message : String(error));
      }
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
  const sessionId = "id" in options ? String((options as LuaSessionOptions).id || "").trim() : "";
  lua.global.set("__vweb_surface_layer", sessionId ? `surface-${sessionId}` : "surface");
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
