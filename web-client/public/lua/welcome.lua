-- Welcome starter.
-- Open Lua Editor, click "Open Folder", and pick a local lua/scripts folder
-- if you want to edit scripts in your own IDE.
--
-- This file is intentionally small. The larger examples live in /vortex-web/examples/lua
-- and can be copied into your mounted folder when you want to test them.

print("Vortex Web Lua ready")

local panel = nil
local fps = 0
local frameMs = 0
local mouse = { x = 0, y = 0 }

function onStart()
  local view = vweb.ui.viewport()
  panel = vweb.gui.create("Frame", nil, "lua-welcome-panel")
  panel:SetPos(math.max(24, view.width - 390), 84)
  panel:SetSize(350, 142)
  panel:SetTooltip("Drag me. Open a folder in Lua Editor to work from local files.")
  panel:SetDraggable(true)
  panel:MakePopup()

  panel.Paint = function(self, w, h)
    vweb.surface.SetDrawColor(8, 18, 30, 238)
    vweb.surface.DrawRect(0, 0, w, h)
    vweb.surface.SetDrawColor(self:IsHovered() and 34 or 125, 211, 252, 185)
    vweb.surface.DrawOutlinedRect(0, 0, w, h, 2)

    vweb.surface.SetTextColor(224, 242, 254, 255)
    vweb.surface.SetFont("Inter, ui-sans-serif, system-ui, sans-serif", 17, 800)
    vweb.surface.SetTextPos(18, 18)
    vweb.surface.DrawText("Vortex Web Lua ready")

    vweb.surface.SetTextColor(186, 230, 253, 235)
    vweb.surface.SetFont("Inter, ui-sans-serif, system-ui, sans-serif", 12, 700)
    vweb.surface.SetTextPos(18, 48)
    vweb.surface.DrawText("Open Folder to edit local .lua files and assets.")

    vweb.surface.SetTextColor(226, 232, 240, 255)
    vweb.surface.SetTextPos(18, 74)
    vweb.surface.DrawText("FPS " .. fps .. " | " .. string.format("%.2fms", frameMs))
    vweb.surface.SetTextPos(18, 96)
    vweb.surface.DrawText("Mouse " .. math.floor(mouse.x) .. ", " .. math.floor(mouse.y))

    vweb.surface.SetDrawColor(15, 23, 42, 215)
    vweb.surface.DrawRect(18, 120, 314, 8)
    vweb.surface.SetDrawColor(56, 189, 248, 235)
    vweb.surface.DrawRect(18, 120, math.min(frameMs, 32) / 32 * 314, 8)
  end
end

function onUpdate(dt)
  mouse = vweb.input.mousePosition()
  frameMs = dt * 1000
  if dt > 0 then fps = math.floor(1 / dt) end
end

function onDestroy()
  if panel then panel:Remove() end
end
