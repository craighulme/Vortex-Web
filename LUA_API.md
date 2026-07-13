# Vortex Web Lua API Reference

Raw local runtime scripting reference. No raw DOM, fetch, WebSocket, cookies, or extension APIs.

For examples and explanation, read [LUA_DOCS.md](LUA_DOCS.md).

## Players

| API | Signature | Notes |
| --- | --- | --- |
| `vweb.players.localPlayer` | `(): Player` | Returns the local player. |
| `vweb.players.all` | `(): Player[]` | Returns local and remote players. |
| `vweb.players.find` | `(idOrName)` | Finds a player by id or partial name. |
| `vweb.players.getTransform` | `(player?)` | Reads a visual transform. |
| `vweb.players.setTransform` | `(player, transform, options?)` | Applies a local visual transform. |
| `vweb.players.clearTransform` | `(player?)` | Clears a local visual transform. |
| `vweb.players.setBodyColors` | `(player, colors)` | Overrides body colors locally. |
| `vweb.players.setBodyColor` | `(player, slot, color)` | Overrides one body color locally. |
| `vweb.players.setTexture` | `(player, slot, url)` | Overrides a shirt, pants, or face texture locally. |
| `vweb.players.setOutfit` | `(player, outfit)` | Overrides multiple avatar textures locally. |
| `vweb.players.walkTo` | `(position, options?)` | Moves the local player toward a world point. |
| `vweb.players.stopWalking` | `()` | Cancels local scripted walking. |

## Input

| API | Signature | Notes |
| --- | --- | --- |
| `vweb.input.mousePosition` | `(): {x,y}` | Returns the runtime cursor position. |
| `vweb.input.viewport` | `(): {width,height,scale}` | Returns the visible viewport. |
| `vweb.input.isDown` | `(code)` | Returns whether a key is down. |
| `vweb.input.onClick` | `(fn)` | Runs on gameplay clicks. |
| `vweb.input.onInput` | `(fn)` | Runs on input events. |
| `vweb.input.onKey` | `(code, fn)` | Runs when a key is pressed. |

## Camera

| API | Signature | Notes |
| --- | --- | --- |
| `vweb.camera.screenPointToRay` | `(x, y)` | Creates a world ray from screen coordinates. |
| `vweb.camera.worldToScreen` | `(point)` | Projects a world point into screen space. |
| `vweb.camera.state` | `()` | Returns camera yaw, pitch, distance, and zoom limits. |
| `vweb.camera.setDistanceOverride` | `(distance)` | Temporarily clamps third-person camera distance. |
| `vweb.camera.clearDistanceOverride` | `()` | Clears a script camera distance override. |
| `vweb.camera.setSubject` | `(player)` | Follows a local or remote player by id, name, or me/local. |
| `vweb.camera.setTarget` | `(player)` | Alias for setSubject. |
| `vweb.camera.clearSubject` | `()` | Returns the camera to the local player. |
| `vweb.camera.getSubject` | `()` | Returns the current script camera subject. |

## Physics

| API | Signature | Notes |
| --- | --- | --- |
| `vweb.physics.raycast` | `(origin, direction, maxDistance)` | Casts against runtime physics and returns hit point plus part metadata when available. |

## Assets

| API | Signature | Notes |
| --- | --- | --- |
| `vweb.assets.url` | `(path)` | Resolves a folder, packaged, or approved asset URL. |
| `vweb.assets.image` | `(path)` | Alias for image asset URLs. |

## Ui

| API | Signature | Notes |
| --- | --- | --- |
| `vweb.ui.layer` | `(name)` | Returns a retained UI layer. |
| `vweb.ui.viewport` | `()` | Returns visible viewport dimensions. |
| `hud:text` | `({ id, x, y, text })` | Creates or updates text. |
| `hud:button` | `({ id, x, y, w, h, text, onClick })` | Creates or updates a button. |
| `hud:panel` | `({ id, x, y, w, h, title, text, draggable? })` | Creates or updates a panel. |
| `hud:progress` | `({ id, x, y, w, h, value, max })` | Creates or updates a progress bar. |
| `hud:circle` | `({ id, x, y, r })` | Creates or updates a circle. |
| `hud:line` | `({ id, x, y, x2, y2 })` | Creates or updates a line. |
| `hud:chart` | `({ id, x, y, w, h, values })` | Creates or updates a compact chart. |
| `handle:set` | `(input)` | Updates an existing UI handle. |
| `handle:remove` | `()` | Removes an existing UI handle. |
| `vweb.gui.create` | `(className, parent?, id?)` | Vortex Web alias for creating retained UI controls. |
| `vweb.hud.paint` | `(id, fn)` | Registers an immediate HUD paint callback. |

## Draw

| API | Signature | Notes |
| --- | --- | --- |
| `vweb.draw.text` | `(input)` | Immediate-mode text. |
| `vweb.draw.rect` | `(input)` | Immediate-mode rectangle. |
| `vweb.draw.line` | `(input)` | Immediate-mode line. |
| `vweb.draw.polyline` | `({ points, color?, width? })` | Immediate-mode batched line path. |
| `vweb.draw.circle` | `(input)` | Immediate-mode circle. |
| `vweb.draw.progress` | `(input)` | Immediate-mode progress bar. |
| `vweb.draw.chart` | `(input)` | Immediate-mode chart. |
| `draw.SimpleText` | `(text, font, x, y, color?, alignX?, alignY?)` | Draws one line of immediate-mode text. |

## Surface

| API | Signature | Notes |
| --- | --- | --- |
| `surface.SetDrawColor` | `(r, g?, b?, a?)` | Sets the active immediate draw color. |
| `surface.SetLineWidth` | `(width)` | Sets the active line width for immediate line drawing. |
| `surface.DrawRect` | `(x, y, w, h)` | Draws a rectangle in the HUD paint layer. |
| `surface.DrawOutlinedRect` | `(x, y, w, h, width?)` | Draws an outlined rectangle. |
| `surface.DrawLine` | `(x, y, x2, y2)` | Draws a line. |
| `surface.DrawLines` | `(points, closed?)` | Draws a batched line path. |
| `surface.DrawText` | `(text)` | Draws text at the active text position. |
| `surface.DrawTexturedRect` | `(x, y, w, h)` | Draws the active material image. |
| `surface.GetTextSize` | `(text)` | Measures text with the active font. |

## Vgui

| API | Signature | Notes |
| --- | --- | --- |
| `vgui.Create` | `(className, parent?, id?)` | Creates a retained panel/control. |
| `panel:SetPos` | `(x, y)` | Moves a panel. |
| `panel:SetSize` | `(w, h)` | Resizes a panel. |
| `panel:SetMouseInputEnabled` | `(enabled)` | Allows mouse interaction. |
| `panel:MakePopup` | `()` | Enables mouse and keyboard input. |
| `panel:SetTooltip` | `(text)` | Sets hover tooltip text. |
| `panel:IsHovered` | `()` | Returns whether the cursor is over the panel. |
| `panel:ScreenX` | `()` | Returns absolute screen X after parent offsets. |
| `panel:ScreenY` | `()` | Returns absolute screen Y after parent offsets. |
| `panel:MoveTo` | `(x, y, seconds?)` | Animates panel position. |
| `panel:AlphaTo` | `(alpha, seconds?)` | Animates panel opacity. |
| `panel.DoClick` | `(self, event)` | Runs when a clickable panel/button is clicked. |
| `panel.OnHover` | `(self, event)` | Runs while the cursor moves over the panel. |
| `panel.OnDrag` | `(self, event)` | Runs when a draggable panel moves. |
| `panel.Paint` | `(self, w, h)` | Draws custom panel contents with surface primitives. |

## Hook

| API | Signature | Notes |
| --- | --- | --- |
| `hook.Add` | `(eventName, id, fn)` | Registers a named callback. |
| `hook.Remove` | `(eventName, id)` | Removes a named callback. |
| `hook.Run` | `(eventName, ...)` | Runs callbacks for an event and returns the last non-nil result. |
| `hook.Add("Think")` | `(id, fn)` | Runs every frame before HUD paint. |
| `hook.Add("HUDPaint")` | `(id, fn)` | Runs every frame for immediate HUD drawing. |
| `hook.Add("ChatMessage")` | `(id, fn)` | Runs on incoming chat. |
| `hook.Add("ChatSend")` | `(id, fn)` | Can rewrite or cancel outgoing chat. |

## World

| API | Signature | Notes |
| --- | --- | --- |
| `vweb.world.spawnPart` | `(part)` | Spawns a local runtime part. |
| `vweb.world.parts` | `()` | Lists loaded runtime parts. |
| `vweb.world.getPart` | `(id)` | Reads a part snapshot. |
| `vweb.world.setColor` | `(id, color)` | Overrides a part color locally. |
| `vweb.world.setTransparency` | `(id, value)` | Overrides a part transparency locally. |
| `vweb.world.setCollision` | `(id, canCollide)` | Toggles local collision for a part. |
| `vweb.world.setMarker` | `(id, part)` | Creates or updates a local marker. |
| `vweb.world.clearMarker` | `(id)` | Removes a marker. |
| `vweb.world.remove` | `(id)` | Removes a part owned by the script. |

## Cursor

| API | Signature | Notes |
| --- | --- | --- |
| `vweb.cursor.setImage` | `({url,width,height,hotspot})` | Sets a custom cursor image. |
| `vweb.cursor.clear` | `()` | Restores the default cursor. |
| `vweb.cursor.setClickToWalk` | `(enabled)` | Enables scripted click-to-walk mode. |

## Chat

| API | Signature | Notes |
| --- | --- | --- |
| `vweb.chat.send` | `(text)` | Sends chat through the runtime. |
| `vweb.chat.system` | `(text)` | Prints a local system chat line. |
| `vweb.chat.onMessage` | `(fn)` | Runs when chat is rendered. |
| `vweb.chat.onSend` | `(fn)` | Can rewrite or cancel local outgoing chat. |
| `vweb.chat.onIncoming` | `(fn)` | Alias for vweb.chat.onMessage. |
| `vweb.chat.onOutgoing` | `(fn)` | Alias for vweb.chat.onSend. |

## Roblox

| API | Signature | Notes |
| --- | --- | --- |
| `game:GetService` | `(name)` | Returns a Roblox-style service alias. |
| `Instance.new` | `(className, parent?)` | Creates a retained UI object. |
| `Vector3.new` | `(x, y, z)` | Creates a vector table. |
| `Vector2.new` | `(x, y)` | Creates a 2D vector table. |
| `Color3.fromRGB` | `(r, g, b)` | Creates a color table. |
| `UDim2.fromOffset` | `(x, y)` | Creates an offset-only UI dimension. |
| `Players:GetPlayers` | `()` | Returns local and remote players. |
| `Workspace:Raycast` | `(origin, direction, maxDistance?)` | Casts against the runtime world. |
| `RunService.RenderStepped:Connect` | `(fn)` | Runs every rendered frame. |
| `UserInputService.InputBegan:Connect` | `(fn)` | Runs on key and pointer input. |

## Lifecycle

| API | Signature | Notes |
| --- | --- | --- |
| `onStart` | `()` | Runs when a script session starts. |
| `onUpdate` | `(dt)` | Runs each frame. |
| `onInput` | `(event)` | Runs on input events. |
| `onChatMessage` | `(event)` | Runs on incoming chat. |
| `onChatSend` | `(event)` | Can rewrite or cancel outgoing chat. |
| `onDestroy` | `()` | Runs before a script session stops. |
