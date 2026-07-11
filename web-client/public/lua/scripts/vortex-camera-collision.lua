local state = {
  enabled = true,
  smoothedDistance = nil,
  lastBlocked = false,
  status = nil
}

local pivotHeight = 2.64
local wallPadding = 0.75
local inSpeed = 18
local outSpeed = 7

local function clamp(value, minValue, maxValue)
  if value < minValue then return minValue end
  if value > maxValue then return maxValue end
  return value
end

local function lerp(current, target, alpha)
  return current + (target - current) * clamp(alpha, 0, 1)
end

local function cameraDirection(camera)
  local yaw = camera.yaw or 0
  local pitch = camera.pitch or 0
  local cosPitch = math.cos(pitch)
  return {
    x = cosPitch * math.sin(yaw),
    y = math.sin(pitch),
    z = cosPitch * math.cos(yaw)
  }
end

local function pivotFromLocalPlayer()
  local position = vweb.world.localPosition()
  if not position then return nil end
  return {
    x = position[1] or position.x or 0,
    y = (position[2] or position.y or 0) + pivotHeight,
    z = position[3] or position.z or 0
  }
end

local function setStatus(text, blocked)
  local view = vweb.ui.viewport()
  local hud = vweb.ui.layer("camera-collision")
  if not state.status then
    state.status = hud:text({
      id = "camera-collision-status",
      x = math.max(24, view.width - 314),
      y = 64,
      w = 290,
      h = 24,
      size = 13,
      weight = 800,
      color = "#e0f2fe",
      shadow = true
    })
  end
  state.status:set({
    x = math.max(24, view.width - 314),
    text = text,
    color = blocked and "#fbbf24" or "#bae6fd",
    opacity = 0.82
  })
end

function onStart()
  vweb.chat.system("Camera collision loaded. Press C to toggle.")
end

vweb.input.onKey("KeyC", function()
  state.enabled = not state.enabled
  if not state.enabled then
    vweb.camera.clearDistanceOverride()
    setStatus("Camera collision: off", false)
  else
    setStatus("Camera collision: on", false)
  end
end)

function onUpdate(dt)
  if not state.enabled then return end

  local camera = vweb.camera.state()
  local desired = camera.targetDistance or camera.distance or 25.6
  if desired <= 2.05 then
    state.smoothedDistance = nil
    vweb.camera.clearDistanceOverride()
    return
  end

  local pivot = pivotFromLocalPlayer()
  if not pivot then return end

  local direction = cameraDirection(camera)
  local hit = vweb.physics.raycast(pivot, direction, desired)
  local targetDistance = desired
  local blocked = false

  if hit and hit.hit and hit.distance then
    targetDistance = clamp(hit.distance - wallPadding, 0.85, desired)
    blocked = targetDistance < desired - 0.15
  end

  local speed = blocked and inSpeed or outSpeed
  state.smoothedDistance = lerp(state.smoothedDistance or desired, targetDistance, dt * speed)

  if state.smoothedDistance < desired - 0.08 then
    vweb.camera.setDistanceOverride(state.smoothedDistance)
  else
    state.smoothedDistance = desired
    vweb.camera.clearDistanceOverride()
  end

  if blocked ~= state.lastBlocked then
    state.lastBlocked = blocked
    setStatus(blocked and "Camera collision: wall clamp" or "Camera collision: clear", blocked)
  end
end

function onDestroy()
  vweb.camera.clearDistanceOverride()
  vweb.ui.clear("camera-collision")
end
