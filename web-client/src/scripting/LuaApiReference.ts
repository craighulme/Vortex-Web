export type LuaApiKind = "function" | "method" | "event" | "lifecycle";

export type LuaApiEntry = {
  name: string;
  kind: LuaApiKind;
  signature: string;
  summary: string;
  snippet?: string;
  group: "players" | "input" | "camera" | "physics" | "assets" | "ui" | "draw" | "surface" | "vgui" | "hook" | "world" | "cursor" | "chat" | "roblox" | "lifecycle";
};

export const LUA_API_REFERENCE: LuaApiEntry[] = [
  { group: "players", kind: "function", name: "vweb.players.localPlayer", signature: "(): Player", summary: "Returns the local player.", snippet: "vweb.players.localPlayer()" },
  { group: "players", kind: "function", name: "vweb.players.all", signature: "(): Player[]", summary: "Returns local and remote players.", snippet: "vweb.players.all()" },
  { group: "players", kind: "function", name: "vweb.players.find", signature: "(idOrName)", summary: "Finds a player by id or partial name.", snippet: "vweb.players.find(\"name\")" },
  { group: "players", kind: "function", name: "vweb.players.getTransform", signature: "(player?)", summary: "Reads a visual transform.", snippet: "vweb.players.getTransform(\"me\")" },
  { group: "players", kind: "function", name: "vweb.players.setTransform", signature: "(player, transform, options?)", summary: "Applies a local visual transform.", snippet: "vweb.players.setTransform(\"me\", { rotation = {0, math.rad(180), 0} })" },
  { group: "players", kind: "function", name: "vweb.players.clearTransform", signature: "(player?)", summary: "Clears a local visual transform.", snippet: "vweb.players.clearTransform(\"me\")" },
  { group: "players", kind: "function", name: "vweb.players.setBodyColors", signature: "(player, colors)", summary: "Overrides body colors locally.", snippet: "vweb.players.setBodyColors(\"me\", { head = \"#ffffff\", torso = \"#512a95\", rightLeg = \"#22c55e\" })" },
  { group: "players", kind: "function", name: "vweb.players.setBodyColor", signature: "(player, slot, color)", summary: "Overrides one body color locally.", snippet: "vweb.players.setBodyColor(\"me\", \"rightLeg\", \"#22c55e\")" },
  { group: "players", kind: "function", name: "vweb.players.setTexture", signature: "(player, slot, url)", summary: "Overrides a shirt, pants, or face texture locally.", snippet: "vweb.players.setTexture(\"me\", \"shirt\", vweb.assets.image(\"shirt.png\"))" },
  { group: "players", kind: "function", name: "vweb.players.setOutfit", signature: "(player, outfit)", summary: "Overrides multiple avatar textures locally.", snippet: "vweb.players.setOutfit(\"me\", { shirt = vweb.assets.image(\"shirt.png\"), face = vweb.assets.image(\"face.png\") })" },
  { group: "players", kind: "function", name: "vweb.players.walkTo", signature: "(position, options?)", summary: "Moves the local player toward a world point.", snippet: "vweb.players.walkTo({ x = 0, y = 0, z = 0 })" },
  { group: "players", kind: "function", name: "vweb.players.stopWalking", signature: "()", summary: "Cancels local scripted walking.", snippet: "vweb.players.stopWalking()" },

  { group: "input", kind: "function", name: "vweb.input.mousePosition", signature: "(): {x,y}", summary: "Returns the runtime cursor position.", snippet: "vweb.input.mousePosition()" },
  { group: "input", kind: "function", name: "vweb.input.viewport", signature: "(): {width,height,scale}", summary: "Returns the visible viewport.", snippet: "vweb.input.viewport()" },
  { group: "input", kind: "function", name: "vweb.input.isDown", signature: "(code)", summary: "Returns whether a key is down.", snippet: "vweb.input.isDown(\"KeyW\")" },
  { group: "input", kind: "event", name: "vweb.input.onClick", signature: "(fn)", summary: "Runs on gameplay clicks.", snippet: "vweb.input.onClick(function(button, event)\n  $0\nend)" },
  { group: "input", kind: "event", name: "vweb.input.onInput", signature: "(fn)", summary: "Runs on input events.", snippet: "vweb.input.onInput(function(event)\n  $0\nend)" },
  { group: "input", kind: "event", name: "vweb.input.onKey", signature: "(code, fn)", summary: "Runs when a key is pressed.", snippet: "vweb.input.onKey(\"KeyE\", function(event)\n  $0\nend)" },

  { group: "camera", kind: "function", name: "vweb.camera.screenPointToRay", signature: "(x, y)", summary: "Creates a world ray from screen coordinates.", snippet: "vweb.camera.screenPointToRay(mouse.x, mouse.y)" },
  { group: "camera", kind: "function", name: "vweb.camera.worldToScreen", signature: "(point)", summary: "Projects a world point into screen space.", snippet: "vweb.camera.worldToScreen({ x = 0, y = 10, z = 0 })" },
  { group: "camera", kind: "function", name: "vweb.camera.state", signature: "()", summary: "Returns camera yaw, pitch, distance, and zoom limits.", snippet: "local camera = vweb.camera.state()" },
  { group: "camera", kind: "function", name: "vweb.camera.setDistanceOverride", signature: "(distance)", summary: "Temporarily clamps third-person camera distance.", snippet: "vweb.camera.setDistanceOverride(12)" },
  { group: "camera", kind: "function", name: "vweb.camera.clearDistanceOverride", signature: "()", summary: "Clears a script camera distance override.", snippet: "vweb.camera.clearDistanceOverride()" },
  { group: "physics", kind: "function", name: "vweb.physics.raycast", signature: "(origin, direction, maxDistance)", summary: "Casts against runtime physics and returns hit point plus part metadata when available.", snippet: "local hit = vweb.physics.raycast(ray.origin, ray.direction, 500)\nif hit.hit and hit.part then\n  print(hit.part.id)\nend" },
  { group: "assets", kind: "function", name: "vweb.assets.url", signature: "(path)", summary: "Resolves a folder, packaged, or approved asset URL.", snippet: "vweb.assets.url(\"cursor.png\")" },
  { group: "assets", kind: "function", name: "vweb.assets.image", signature: "(path)", summary: "Alias for image asset URLs.", snippet: "vweb.assets.image(\"hud/panel.png\")" },

  { group: "ui", kind: "function", name: "vweb.ui.layer", signature: "(name)", summary: "Returns a retained UI layer.", snippet: "vweb.ui.layer(\"hud\")" },
  { group: "ui", kind: "function", name: "vweb.ui.viewport", signature: "()", summary: "Returns visible viewport dimensions.", snippet: "vweb.ui.viewport()" },
  { group: "ui", kind: "method", name: "hud:text", signature: "({ id, x, y, text })", summary: "Creates or updates text.", snippet: "hud:text({ id = \"label\", x = 24, y = 24, text = \"Hello\" })" },
  { group: "ui", kind: "method", name: "hud:button", signature: "({ id, x, y, w, h, text, onClick })", summary: "Creates or updates a button.", snippet: "hud:button({ id = \"button\", x = 24, y = 64, w = 160, h = 40, text = \"Click\", onClick = function()\n  $0\nend })" },
  { group: "ui", kind: "method", name: "hud:panel", signature: "({ id, x, y, w, h, title, text, draggable? })", summary: "Creates or updates a panel.", snippet: "hud:panel({ id = \"panel\", x = 24, y = 24, w = 260, h = 92, title = \"Status\", text = \"Ready\", draggable = true })" },
  { group: "ui", kind: "method", name: "hud:progress", signature: "({ id, x, y, w, h, value, max })", summary: "Creates or updates a progress bar.", snippet: "hud:progress({ id = \"bar\", x = 24, y = 116, w = 220, h = 12, value = 75, max = 100, color = \"#22c55e\" })" },
  { group: "ui", kind: "method", name: "hud:circle", signature: "({ id, x, y, r })", summary: "Creates or updates a circle.", snippet: "hud:circle({ id = \"circle\", x = 160, y = 160, r = 28, color = \"#22c55e\", fill = false })" },
  { group: "ui", kind: "method", name: "hud:line", signature: "({ id, x, y, x2, y2 })", summary: "Creates or updates a line.", snippet: "hud:line({ id = \"line\", x = 24, y = 24, x2 = 160, y2 = 64, color = \"#7dd3fc\", width = 2 })" },
  { group: "ui", kind: "method", name: "hud:chart", signature: "({ id, x, y, w, h, values })", summary: "Creates or updates a compact chart.", snippet: "hud:chart({ id = \"chart\", x = 24, y = 148, w = 240, h = 72, values = { 4, 8, 6, 12 }, color = \"#38bdf8\" })" },
  { group: "ui", kind: "method", name: "handle:set", signature: "(input)", summary: "Updates an existing UI handle.", snippet: "panel:set({ text = \"Updated\" })" },
  { group: "ui", kind: "method", name: "handle:remove", signature: "()", summary: "Removes an existing UI handle.", snippet: "panel:remove()" },

  { group: "draw", kind: "function", name: "vweb.draw.text", signature: "(input)", summary: "Immediate-mode text." },
  { group: "draw", kind: "function", name: "vweb.draw.rect", signature: "(input)", summary: "Immediate-mode rectangle." },
  { group: "draw", kind: "function", name: "vweb.draw.line", signature: "(input)", summary: "Immediate-mode line." },
  { group: "draw", kind: "function", name: "vweb.draw.polyline", signature: "({ points, color?, width? })", summary: "Immediate-mode batched line path." },
  { group: "draw", kind: "function", name: "vweb.draw.circle", signature: "(input)", summary: "Immediate-mode circle." },
  { group: "draw", kind: "function", name: "vweb.draw.progress", signature: "(input)", summary: "Immediate-mode progress bar." },
  { group: "draw", kind: "function", name: "vweb.draw.chart", signature: "(input)", summary: "Immediate-mode chart." },

  { group: "surface", kind: "function", name: "surface.SetDrawColor", signature: "(r, g?, b?, a?)", summary: "Sets the active immediate draw color.", snippet: "surface.SetDrawColor(34, 197, 94, 180)" },
  { group: "surface", kind: "function", name: "surface.SetLineWidth", signature: "(width)", summary: "Sets the active line width for immediate line drawing.", snippet: "surface.SetLineWidth(2)" },
  { group: "surface", kind: "function", name: "surface.DrawRect", signature: "(x, y, w, h)", summary: "Draws a rectangle in the HUD paint layer.", snippet: "surface.DrawRect(24, 24, 180, 44)" },
  { group: "surface", kind: "function", name: "surface.DrawOutlinedRect", signature: "(x, y, w, h, width?)", summary: "Draws an outlined rectangle.", snippet: "surface.DrawOutlinedRect(24, 24, 180, 44, 2)" },
  { group: "surface", kind: "function", name: "surface.DrawLine", signature: "(x, y, x2, y2)", summary: "Draws a line.", snippet: "surface.DrawLine(24, 24, 160, 80)" },
  { group: "surface", kind: "function", name: "surface.DrawLines", signature: "(points, closed?)", summary: "Draws a batched line path.", snippet: "surface.DrawLines({ { 24, 24 }, { 72, 48 }, { 160, 32 } })" },
  { group: "surface", kind: "function", name: "surface.DrawText", signature: "(text)", summary: "Draws text at the active text position.", snippet: "surface.SetTextPos(32, 32)\nsurface.DrawText(\"Hello\")" },
  { group: "surface", kind: "function", name: "surface.DrawTexturedRect", signature: "(x, y, w, h)", summary: "Draws the active material image.", snippet: "surface.SetMaterial(vweb.assets.image(\"icon.png\"))\nsurface.DrawTexturedRect(24, 24, 64, 64)" },
  { group: "surface", kind: "function", name: "surface.GetTextSize", signature: "(text)", summary: "Measures text with the active font.", snippet: "local w, h = surface.GetTextSize(\"Hello\")" },
  { group: "draw", kind: "function", name: "draw.SimpleText", signature: "(text, font, x, y, color?, alignX?, alignY?)", summary: "Draws one line of immediate-mode text.", snippet: "draw.SimpleText(\"HP\", \"Inter\", 24, 24, { r = 255, g = 255, b = 255 })" },

  { group: "vgui", kind: "function", name: "vgui.Create", signature: "(className, parent?, id?)", summary: "Creates a retained panel/control.", snippet: "local frame = vgui.Create(\"DFrame\", nil, \"tools\")\nframe:SetPos(24, 120)\nframe:SetSize(260, 140)\nframe:SetTitle(\"Tools\")" },
  { group: "vgui", kind: "method", name: "panel:SetPos", signature: "(x, y)", summary: "Moves a panel." },
  { group: "vgui", kind: "method", name: "panel:SetSize", signature: "(w, h)", summary: "Resizes a panel." },
  { group: "vgui", kind: "method", name: "panel:SetMouseInputEnabled", signature: "(enabled)", summary: "Allows mouse interaction." },
  { group: "vgui", kind: "method", name: "panel:MakePopup", signature: "()", summary: "Enables mouse and keyboard input." },
  { group: "vgui", kind: "method", name: "panel:SetTooltip", signature: "(text)", summary: "Sets hover tooltip text." },
  { group: "vgui", kind: "method", name: "panel:IsHovered", signature: "()", summary: "Returns whether the cursor is over the panel." },
  { group: "vgui", kind: "method", name: "panel:ScreenX", signature: "()", summary: "Returns absolute screen X after parent offsets." },
  { group: "vgui", kind: "method", name: "panel:ScreenY", signature: "()", summary: "Returns absolute screen Y after parent offsets." },
  { group: "vgui", kind: "method", name: "panel:MoveTo", signature: "(x, y, seconds?)", summary: "Animates panel position." },
  { group: "vgui", kind: "method", name: "panel:AlphaTo", signature: "(alpha, seconds?)", summary: "Animates panel opacity." },
  { group: "vgui", kind: "event", name: "panel.DoClick", signature: "(self, event)", summary: "Runs when a clickable panel/button is clicked.", snippet: "button.DoClick = function(self)\n  print(\"clicked\")\nend" },
  { group: "vgui", kind: "event", name: "panel.OnHover", signature: "(self, event)", summary: "Runs while the cursor moves over the panel.", snippet: "panel.OnHover = function(self, event)\n  print(event.localX, event.localY)\nend" },
  { group: "vgui", kind: "event", name: "panel.OnDrag", signature: "(self, event)", summary: "Runs when a draggable panel moves.", snippet: "panel.OnDrag = function(self, event)\n  print(event.elementX, event.elementY)\nend" },
  { group: "vgui", kind: "event", name: "panel.Paint", signature: "(self, w, h)", summary: "Draws custom panel contents with surface primitives.", snippet: "frame.Paint = function(self, w, h)\n  surface.SetDrawColor(15, 23, 42, 220)\n  surface.DrawRect(0, 0, w, h)\nend" },

  { group: "ui", kind: "function", name: "vweb.gui.create", signature: "(className, parent?, id?)", summary: "Vortex Web alias for creating retained UI controls.", snippet: "local panel = vweb.gui.create(\"Panel\", nil, \"stats\")" },
  { group: "ui", kind: "function", name: "vweb.hud.paint", signature: "(id, fn)", summary: "Registers an immediate HUD paint callback.", snippet: "vweb.hud.paint(\"stats\", function()\n  vweb.surface.DrawRect(24, 24, 120, 32)\nend)" },

  { group: "hook", kind: "function", name: "hook.Add", signature: "(eventName, id, fn)", summary: "Registers a named callback.", snippet: "hook.Add(\"HUDPaint\", \"my-hud\", function()\n  surface.DrawRect(24, 24, 120, 32)\nend)" },
  { group: "hook", kind: "function", name: "hook.Remove", signature: "(eventName, id)", summary: "Removes a named callback." },
  { group: "hook", kind: "function", name: "hook.Run", signature: "(eventName, ...)", summary: "Runs callbacks for an event and returns the last non-nil result." },
  { group: "hook", kind: "event", name: "hook.Add(\"Think\")", signature: "(id, fn)", summary: "Runs every frame before HUD paint.", snippet: "hook.Add(\"Think\", \"tick\", function(dt)\n  $0\nend)" },
  { group: "hook", kind: "event", name: "hook.Add(\"HUDPaint\")", signature: "(id, fn)", summary: "Runs every frame for immediate HUD drawing.", snippet: "hook.Add(\"HUDPaint\", \"hud\", function()\n  surface.DrawRect(24, 24, 120, 32)\nend)" },
  { group: "hook", kind: "event", name: "hook.Add(\"ChatMessage\")", signature: "(id, fn)", summary: "Runs on incoming chat.", snippet: "hook.Add(\"ChatMessage\", \"reader\", function(event)\n  print(event.username, event.text)\nend)" },
  { group: "hook", kind: "event", name: "hook.Add(\"ChatSend\")", signature: "(id, fn)", summary: "Can rewrite or cancel outgoing chat.", snippet: "hook.Add(\"ChatSend\", \"commands\", function(event)\n  if event.text == \"!ping\" then return false end\nend)" },

  { group: "world", kind: "function", name: "vweb.world.spawnPart", signature: "(part)", summary: "Spawns a local runtime part.", snippet: "vweb.world.spawnPart({ position = {0, 8, 0}, size = {4, 1, 4}, color = \"#22c55e\" })" },
  { group: "world", kind: "function", name: "vweb.world.parts", signature: "()", summary: "Lists loaded runtime parts.", snippet: "vweb.world.parts()" },
  { group: "world", kind: "function", name: "vweb.world.getPart", signature: "(id)", summary: "Reads a part snapshot.", snippet: "vweb.world.getPart(\"map-part-1\")" },
  { group: "world", kind: "function", name: "vweb.world.setColor", signature: "(id, color)", summary: "Overrides a part color locally.", snippet: "vweb.world.setColor(part.id, \"#22c55e\")" },
  { group: "world", kind: "function", name: "vweb.world.setTransparency", signature: "(id, value)", summary: "Overrides a part transparency locally.", snippet: "vweb.world.setTransparency(part.id, 0.4)" },
  { group: "world", kind: "function", name: "vweb.world.setCollision", signature: "(id, canCollide)", summary: "Toggles local collision for a part.", snippet: "vweb.world.setCollision(part.id, false)" },
  { group: "world", kind: "function", name: "vweb.world.setMarker", signature: "(id, part)", summary: "Creates or updates a local marker.", snippet: "vweb.world.setMarker(\"marker\", { position = {0, 2, 0}, size = {4, 0.1, 4}, color = \"#22c55e\" })" },
  { group: "world", kind: "function", name: "vweb.world.clearMarker", signature: "(id)", summary: "Removes a marker.", snippet: "vweb.world.clearMarker(\"marker\")" },
  { group: "world", kind: "function", name: "vweb.world.remove", signature: "(id)", summary: "Removes a part owned by the script.", snippet: "vweb.world.remove(part.id)" },

  { group: "cursor", kind: "function", name: "vweb.cursor.setImage", signature: "({url,width,height,hotspot})", summary: "Sets a custom cursor image." },
  { group: "cursor", kind: "function", name: "vweb.cursor.clear", signature: "()", summary: "Restores the default cursor.", snippet: "vweb.cursor.clear()" },
  { group: "cursor", kind: "function", name: "vweb.cursor.setClickToWalk", signature: "(enabled)", summary: "Enables scripted click-to-walk mode.", snippet: "vweb.cursor.setClickToWalk(true)" },

  { group: "chat", kind: "function", name: "vweb.chat.send", signature: "(text)", summary: "Sends chat through the runtime.", snippet: "vweb.chat.send(\"hello\")" },
  { group: "chat", kind: "function", name: "vweb.chat.system", signature: "(text)", summary: "Prints a local system chat line.", snippet: "vweb.chat.system(\"local message\")" },
  { group: "chat", kind: "event", name: "vweb.chat.onMessage", signature: "(fn)", summary: "Runs when chat is rendered.", snippet: "vweb.chat.onMessage(function(event)\n  print(event.username, event.text)\nend)" },
  { group: "chat", kind: "event", name: "vweb.chat.onSend", signature: "(fn)", summary: "Can rewrite or cancel local outgoing chat.", snippet: "vweb.chat.onSend(function(event)\n  if event.text == \"!ping\" then\n    vweb.chat.system(\"pong\")\n    return false\n  end\nend)" },
  { group: "chat", kind: "event", name: "vweb.chat.onIncoming", signature: "(fn)", summary: "Alias for vweb.chat.onMessage." },
  { group: "chat", kind: "event", name: "vweb.chat.onOutgoing", signature: "(fn)", summary: "Alias for vweb.chat.onSend." },

  { group: "roblox", kind: "function", name: "game:GetService", signature: "(name)", summary: "Returns a Roblox-style service alias.", snippet: "local Players = game:GetService(\"Players\")" },
  { group: "roblox", kind: "function", name: "Instance.new", signature: "(className, parent?)", summary: "Creates a retained UI object.", snippet: "local frame = Instance.new(\"Frame\")\nframe.Position = UDim2.fromOffset(24, 80)\nframe.Size = UDim2.fromOffset(260, 120)" },
  { group: "roblox", kind: "function", name: "Vector3.new", signature: "(x, y, z)", summary: "Creates a vector table.", snippet: "Vector3.new(0, 8, 0)" },
  { group: "roblox", kind: "function", name: "Vector2.new", signature: "(x, y)", summary: "Creates a 2D vector table.", snippet: "Vector2.new(24, 64)" },
  { group: "roblox", kind: "function", name: "Color3.fromRGB", signature: "(r, g, b)", summary: "Creates a color table.", snippet: "Color3.fromRGB(34, 197, 94)" },
  { group: "roblox", kind: "function", name: "UDim2.fromOffset", signature: "(x, y)", summary: "Creates an offset-only UI dimension.", snippet: "UDim2.fromOffset(320, 180)" },
  { group: "roblox", kind: "method", name: "Players:GetPlayers", signature: "()", summary: "Returns local and remote players.", snippet: "local players = game:GetService(\"Players\"):GetPlayers()" },
  { group: "roblox", kind: "method", name: "Workspace:Raycast", signature: "(origin, direction, maxDistance?)", summary: "Casts against the runtime world.", snippet: "local hit = workspace:Raycast(Vector3.new(0, 8, 0), Vector3.new(0, -1, 0), 50)" },
  { group: "roblox", kind: "event", name: "RunService.RenderStepped:Connect", signature: "(fn)", summary: "Runs every rendered frame.", snippet: "game:GetService(\"RunService\").RenderStepped:Connect(function(dt)\n  $0\nend)" },
  { group: "roblox", kind: "event", name: "UserInputService.InputBegan:Connect", signature: "(fn)", summary: "Runs on key and pointer input.", snippet: "game:GetService(\"UserInputService\").InputBegan:Connect(function(input, processed)\n  $0\nend)" },

  { group: "lifecycle", kind: "lifecycle", name: "onStart", signature: "()", summary: "Runs when a script session starts.", snippet: "function onStart()\n  $0\nend" },
  { group: "lifecycle", kind: "lifecycle", name: "onUpdate", signature: "(dt)", summary: "Runs each frame.", snippet: "function onUpdate(dt)\n  $0\nend" },
  { group: "lifecycle", kind: "lifecycle", name: "onInput", signature: "(event)", summary: "Runs on input events.", snippet: "function onInput(event)\n  $0\nend" },
  { group: "lifecycle", kind: "lifecycle", name: "onChatMessage", signature: "(event)", summary: "Runs on incoming chat.", snippet: "function onChatMessage(event)\n  $0\nend" },
  { group: "lifecycle", kind: "lifecycle", name: "onChatSend", signature: "(event)", summary: "Can rewrite or cancel outgoing chat.", snippet: "function onChatSend(event)\n  $0\nend" },
  { group: "lifecycle", kind: "lifecycle", name: "onDestroy", signature: "()", summary: "Runs before a script session stops.", snippet: "function onDestroy()\n  $0\nend" }
];
