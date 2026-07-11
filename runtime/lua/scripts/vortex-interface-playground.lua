local state = {
  health = 100,
  visible = true,
  draggable = true,
  showMouse = true,
  graphMode = "fps",
  fps = 0,
  frameMs = 0,
  time = 0,
  sampleLimit = 30,
  samples = {},
  mouse = { x = 0, y = 0 },
  window = nil,
  dragButton = nil,
  graphButton = nil,
  healButton = nil
}

local function clamp(value, minValue, maxValue)
  if value < minValue then return minValue end
  if value > maxValue then return maxValue end
  return value
end

local function pushSample(value)
  table.insert(state.samples, value)
  if #state.samples > state.sampleLimit then table.remove(state.samples, 1) end
end

local function graphTitle()
  if state.graphMode == "frame" then return "Frame time" end
  if state.graphMode == "mouse" then return "Mouse X" end
  return "FPS"
end

local function graphMax()
  if state.graphMode == "frame" then return 34 end
  if state.graphMode == "mouse" then return math.max(1, vweb.ui.viewport().width) end
  return 240
end

local function currentSample()
  if state.graphMode == "frame" then return state.frameMs end
  if state.graphMode == "mouse" then return state.mouse.x end
  return state.fps
end

local function nextGraphMode()
  if state.graphMode == "fps" then
    state.graphMode = "frame"
  elseif state.graphMode == "frame" then
    state.graphMode = "mouse"
  else
    state.graphMode = "fps"
  end
  state.samples = {}
end

local function drawMiniGraph(x, y, w, h)
  vweb.surface.SetDrawColor(2, 6, 23, 155)
  vweb.surface.DrawRect(x, y, w, h)
  vweb.surface.SetDrawColor(51, 65, 85, 170)
  vweb.surface.DrawOutlinedRect(x, y, w, h, 1)

  if #state.samples < 2 then return end
  local maxValue = graphMax()
  vweb.surface.SetDrawColor(56, 189, 248, 230)
  vweb.surface.SetLineWidth(2)
  local steps = math.max(1, state.sampleLimit - 1)
  local points = {}
  for i = 2, #state.samples do
    local x2 = x + ((i - 1) / steps) * w
    local y2 = y + h - clamp(state.samples[i] / maxValue, 0, 1) * h
    if i == 2 then
      table.insert(points, {
        x + ((i - 2) / steps) * w,
        y + h - clamp(state.samples[i - 1] / maxValue, 0, 1) * h
      })
    end
    table.insert(points, { x2, y2 })
  end
  vweb.surface.DrawLines(points)
  vweb.surface.SetLineWidth(1)
end

local function syncButtons()
  if not state.dragButton then return end
  state.dragButton:SetText(state.draggable and "Drag: on" or "Drag: off")
  state.dragButton:SetBackgroundColor(state.draggable and "rgba(34,197,94,0.22)" or "rgba(15,23,42,0.74)")
  state.graphButton:SetText("Graph: " .. state.graphMode)
end

local function setVisible(visible)
  state.visible = visible
  local alpha = visible and 1 or 0
  if state.window then state.window:SetAlpha(alpha) end
  if state.dragButton then state.dragButton:SetAlpha(alpha) end
  if state.graphButton then state.graphButton:SetAlpha(alpha) end
  if state.healButton then state.healButton:SetAlpha(alpha) end
end

local function styleButton(button)
  button:SetSize(104, 34)
  button:SetColor("#f8fafc")
  button:SetBackgroundColor("rgba(15,23,42,0.74)")
  button:SetCursor("pointer")
  button:SetTooltip("Lua-created interactive control")
  button:SetMouseInputEnabled(true)
  button.OnMouseEntered = function(self) self:AlphaTo(0.82, 0.1) end
  button.OnMouseExited = function(self) self:AlphaTo(1, 0.1) end
end

local function createUi()
  local view = vweb.ui.viewport()
  state.window = vweb.gui.create("Frame", nil, "lua-demo-window")
  state.window:SetPos(math.max(24, view.width - 390), 104)
  state.window:SetSize(360, 248)
  state.window:SetTitle("Lua Demo")
  state.window:SetDraggable(state.draggable)
  state.window:SetTooltip("Drag me. Press D or click Drag to lock/unlock.")
  state.window:MakePopup()

  state.window.Paint = function(self, w, h)
    vweb.surface.SetDrawColor(8, 16, 28, 210)
    vweb.surface.DrawRect(0, 0, w, h)
    vweb.surface.SetDrawColor(self:IsHovered() and 56 or 125, 189, 248, 210)
    vweb.surface.DrawOutlinedRect(0, 0, w, h, 2)

    vweb.surface.SetTextColor(248, 250, 252, 255)
    vweb.surface.SetFont("Inter, ui-sans-serif, system-ui, sans-serif", 18, 800)
    vweb.surface.SetTextPos(18, 18)
    vweb.surface.DrawText("Vortex Web Lua")

    vweb.surface.SetFont("Inter, ui-sans-serif, system-ui, sans-serif", 13, 700)
    vweb.surface.SetTextColor(186, 230, 253, 235)
    vweb.surface.SetTextPos(18, 48)
    vweb.surface.DrawText("M panel  G graph  D drag  X mouse  J damage")

    vweb.surface.SetTextColor(226, 232, 240, 255)
    vweb.surface.SetTextPos(18, 76)
    vweb.surface.DrawText("FPS " .. state.fps .. " | " .. string.format("%.2f", state.frameMs) .. "ms | Mouse " .. math.floor(state.mouse.x) .. ", " .. math.floor(state.mouse.y))

    vweb.surface.SetTextColor(148, 163, 184, 255)
    vweb.surface.SetTextPos(18, 103)
    vweb.surface.DrawText(graphTitle())
    drawMiniGraph(18, 124, 324, 52)

    vweb.surface.SetDrawColor(15, 23, 42, 210)
    vweb.surface.DrawRect(18, 185, 324, 10)
    vweb.surface.SetDrawColor(state.health > 45 and 34 or 249, state.health > 45 and 197 or 115, state.health > 45 and 94 or 22, 235)
    vweb.surface.DrawRect(18, 185, state.health * 3.24, 10)
  end

  state.dragButton = vweb.gui.button("lua-demo-drag")
  state.dragButton:SetParent(state.window)
  state.dragButton:SetPos(18, 207)
  styleButton(state.dragButton)
  state.dragButton.DoClick = function()
    state.draggable = not state.draggable
    state.window:SetDraggable(state.draggable)
    syncButtons()
  end

  state.graphButton = vweb.gui.button("lua-demo-graph")
  state.graphButton:SetParent(state.window)
  state.graphButton:SetPos(128, 207)
  styleButton(state.graphButton)
  state.graphButton.DoClick = function()
    nextGraphMode()
    syncButtons()
  end

  state.healButton = vweb.gui.button("lua-demo-heal")
  state.healButton:SetParent(state.window)
  state.healButton:SetPos(238, 207)
  styleButton(state.healButton)
  state.healButton:SetText("Heal")
  state.healButton.DoClick = function()
    state.health = 100
    vweb.chat.system("Lua demo health reset")
  end

  syncButtons()
end

function onStart()
  createUi()
  vweb.chat.system("Lua demo loaded. Type !luahelp for controls.")
end

vweb.input.onKey("KeyM", function() setVisible(not state.visible) end)
vweb.input.onKey("KeyG", function() nextGraphMode(); syncButtons() end)
vweb.input.onKey("KeyD", function()
  state.draggable = not state.draggable
  if state.window then state.window:SetDraggable(state.draggable) end
  syncButtons()
end)
vweb.input.onKey("KeyX", function() state.showMouse = not state.showMouse end)
vweb.input.onKey("KeyJ", function() state.health = clamp(state.health - 8, 0, 100) end)

vweb.chat.onSend(function(event)
  if event.text == "!luahelp" then
    vweb.chat.system("M panel, G graph, D drag, X mouse ring, J damage, buttons are clickable.")
    return false
  end
end)

function onUpdate(dt)
  state.time = state.time + dt
  state.frameMs = dt * 1000
  local instantFps = 0
  if dt > 0 then instantFps = 1 / dt end
  if state.fps == 0 then
    state.fps = math.floor(instantFps)
  else
    state.fps = math.floor(state.fps * 0.9 + instantFps * 0.1)
  end
  state.mouse = vweb.input.mousePosition()
  pushSample(currentSample())
end

vweb.hud.paint("lua-demo-hudpaint", function()
  local view = vweb.ui.viewport()
  local mouse = state.mouse
  local x = 24
  local y = view.height - 112
  local w = 326
  local h = 82

  vweb.surface.SetDrawColor(8, 16, 28, 226)
  vweb.surface.DrawRect(x, y, w, h)
  vweb.surface.SetDrawColor(56, 189, 248, 170)
  vweb.surface.DrawOutlinedRect(x, y, w, h, 2)

  vweb.surface.SetTextColor(248, 250, 252, 255)
  vweb.surface.SetFont("Inter, ui-sans-serif, system-ui, sans-serif", 16, 800)
  vweb.surface.SetTextPos(x + 16, y + 12)
  vweb.surface.DrawText("Script HUD | !luahelp")
  vweb.surface.SetFont("Inter, ui-sans-serif, system-ui, sans-serif", 12, 700)
  vweb.surface.SetTextColor(186, 230, 253, 235)
  vweb.surface.SetTextPos(x + 16, y + 36)
  vweb.surface.DrawText("FPS " .. state.fps .. " | " .. string.format("%.2f", state.frameMs) .. "ms | " .. graphTitle())
  vweb.surface.SetDrawColor(15, 23, 42, 230)
  vweb.surface.DrawRect(x + 16, y + 62, w - 32, 6)
  vweb.surface.SetDrawColor(state.health > 45 and 34 or 249, state.health > 45 and 197 or 115, state.health > 45 and 94 or 22, 235)
  vweb.surface.DrawRect(x + 16, y + 62, (w - 32) * (state.health / 100), 6)

  if state.showMouse then
    local pulse = 10 + math.sin(state.time * 8) * 3
    vweb.surface.SetDrawColor(56, 189, 248, 210)
    vweb.surface.DrawCircle(mouse.x, mouse.y, pulse)
    vweb.surface.DrawLine(mouse.x - 18, mouse.y, mouse.x - 7, mouse.y)
    vweb.surface.DrawLine(mouse.x + 7, mouse.y, mouse.x + 18, mouse.y)
    vweb.surface.DrawLine(mouse.x, mouse.y - 18, mouse.x, mouse.y - 7)
    vweb.surface.DrawLine(mouse.x, mouse.y + 7, mouse.x, mouse.y + 18)
  end
end)

function onDestroy()
  if state.window then state.window:Remove() end
  if state.dragButton then state.dragButton:Remove() end
  if state.graphButton then state.graphButton:Remove() end
  if state.healButton then state.healButton:Remove() end
  vweb.ui.clear("surface")
end
