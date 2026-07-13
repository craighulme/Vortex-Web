-- Roblox-style cursor and click-to-walk demo for Vortex Web Lua.
-- Use Start, not Run Once, so frame/input callbacks stay alive.

local cursorUrl = "https://devforum-uploads.s3.dualstack.us-east-2.amazonaws.com/uploads/original/4X/0/9/d/09d4a2f9a3a671825d14dd6816761866ec680456.png"
local hoverMarkerId = "roblox-click-walk-hover"
local targetMarkerId = "roblox-click-walk-target"

local hoverPoint = nil
local targetPoint = nil
local lastFailure = nil
local hud = vweb.ui.layer("click-walk-demo")

vweb.cursor.setImage({
  url = cursorUrl,
  width = 36,
  height = 36,
  -- The source PNG has transparent padding; this keeps the click ray on the visible arrow tip.
  hotspot = { 17.4, 17.7, 0 }
})
vweb.cursor.setClickToWalk(true)

local function v3(value)
  if not value then return nil end
  return {
    x = value.x or value[1] or 0,
    y = value.y or value[2] or 0,
    z = value.z or value[3] or 0
  }
end

local function raised(point)
  local p = v3(point)
  if not p then return nil end
  return { p.x, p.y + 0.14, p.z }
end

local function distXZ(a, b)
  local pa = v3(a)
  local pb = v3(b)
  if not pa or not pb then return 999999 end
  local dx = pa.x - pb.x
  local dz = pa.z - pb.z
  return math.sqrt(dx * dx + dz * dz)
end

local function manualMovementPressed()
  return vweb.input.isDown("KeyW")
    or vweb.input.isDown("KeyA")
    or vweb.input.isDown("KeyS")
    or vweb.input.isDown("KeyD")
    or vweb.input.isDown("ArrowUp")
    or vweb.input.isDown("ArrowDown")
end

local function mouseGroundHit()
  local mouse = vweb.input.mousePosition()
  local ray = vweb.camera.screenPointToRay(mouse.x, mouse.y)
  return vweb.physics.raycast(ray.origin, ray.direction, 1000)
end

local function drawCircle(id, point, alpha, height)
  local position = raised(point)
  if not position then return end
  vweb.world.setMarker(id, {
    position = position,
    size = { 4.25, height or 0.2, 4.25 },
    color = "#22c55e",
    transparency = alpha or 0.18,
    canCollide = false,
    shape = "Cylinder2"
  })
end

local function clearTarget()
  targetPoint = nil
  vweb.world.clearMarker(targetMarkerId)
  vweb.players.stopWalking("me")
end

vweb.render.onFrame(function()
  local hit = mouseGroundHit()
  if hit and hit.hit then
    hoverPoint = hit.position or hit.point
    drawCircle(hoverMarkerId, hoverPoint, 0.38, 0.16)
  else
    hoverPoint = nil
    vweb.world.clearMarker(hoverMarkerId)
  end

  if targetPoint then
    drawCircle(targetMarkerId, targetPoint, 0.04, 0.26)

    if manualMovementPressed() then
      clearTarget()
    else
      local localPos = vweb.world.localPosition()
      if localPos and distXZ(localPos, targetPoint) <= 0.35 then
        clearTarget()
      end
    end
  end

  hud:clear()
  hud:text({
    id = "hint",
    x = 24,
    y = 24,
    text = "Left click to walk",
    size = 18,
    color = "#ffffff",
    shadow = true
  })

  if lastFailure then
    hud:text({
      id = "failed",
      x = 24,
      y = 50,
      text = "No path: " .. tostring(lastFailure),
      size = 14,
      color = "#f87171",
      shadow = true
    })
  end
end)

vweb.input.onClick(function(button)
  if button ~= "left" or not hoverPoint then return end

  local player = vweb.players.localPlayer()
  if not player then
    lastFailure = "no local player"
    return
  end

  local result = player:walkTo(hoverPoint, {
    speed = 16,
    stopDistance = 0.18
  })

  if result and result.ok then
    lastFailure = nil
    targetPoint = result.target or hoverPoint
    drawCircle(targetMarkerId, targetPoint, 0.04, 0.26)
  else
    lastFailure = result and result.reason or "unknown"
    targetPoint = nil
    vweb.world.clearMarker(targetMarkerId)
  end
end)

function onDestroy()
  vweb.cursor.setClickToWalk(false)
  vweb.cursor.clear()
  vweb.world.clearMarker(hoverMarkerId)
  vweb.world.clearMarker(targetMarkerId)
  vweb.players.stopWalking("me")
  hud:clear()
end
