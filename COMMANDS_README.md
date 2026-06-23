# Vortex Web Commands

Vortex Web includes a small set of chat commands and optional advanced tools for licensed users.

Most players only need the chat commands. Advanced tools are available for testing, moderation, avatar work, or private development depending on the license features attached to the user.

For access or additional command permissions, contact `quackduck.` on Discord.

## Access Levels

| Access | What it unlocks |
| --- | --- |
| Base license | Browser multiplayer through the Vortex Web native bridge. |
| `teleport-commands` | Local teleport commands. Hosted relay leases also protect against obvious unauthorised movement jumps. |
| `bring-command` | Local bring command for moving a replicated player model in your own browser view. |
| `fly-command` | Browser-side fly mode. |
| `noclip-command` | Browser-side collision bypass. |
| `gravity-command` | Browser-side gravity and fall-speed control. |
| `airwalk-command` | Browser-side airwalk mode. |
| `avatar-spoof` | Avatar override tools for authorised testing. |
| `packet-debug` | Packet inspection tools for authorised testing. |
| Local/dev only | Private relay, protocol, or engine development tools. |

## Chat Commands

Type these in Vortex chat. Commands start with `::`.

| Command | Aliases | Access | Result |
| --- | --- | --- | --- |
| `::help` | `::?` | Base license | Shows the available command list. |
| `::players` | `::plr` | Base license | Lists players currently replicated in the browser client. |
| `::where [player]` | `::pos`, `::coords` | Base license | Shows your position, or a replicated player's last known position. |
| `::tp <x> <y> <z>` | `::teleport` | `teleport-commands` | Moves your local browser character to coordinates. |
| `::goto <player>` | `::to` | `teleport-commands` | Moves your local browser character to a replicated player. |
| `::bring <player>` | none | `bring-command` | Moves that replicated model near you locally. It does not move the real player server-side. |
| `::fly [on\|off\|speed]` | none | `fly-command` | Toggles fly mode. Space rises; Shift/Ctrl descends. A number sets speed. |
| `::noclip [on\|off]` | `::clip` | `noclip-command` | Toggles local collision bypass. `::clip` restores normal collision. |
| `::airwalk [on\|off]` | `::air` | `airwalk-command` | Keeps the local character from falling while moving through the air. |
| `::setgravity <0..8\|reset>` | `::gravity`, `::fallspeed` | `gravity-command` | Changes local gravity scale. `1` is normal; `reset` restores default behaviour. |
| `::movement` | `::moves`, `::mods` | Base license | Shows active movement modifiers. |

## Avatar Tools

These tools are available from browser devtools when Vortex Web is loaded.

| Tool | Access | Result |
| --- | --- | --- |
| `VortexAvatar.renderer` | Base license | Reads the active avatar renderer mode. |
| `VortexAvatar.setRenderer(mode)` | Base license | Switches the local browser avatar renderer mode. |
| `VortexAvatar.getOutfit()` | Base license | Returns the current local outfit data. |
| `await VortexAvatar.setOutfit(outfit, persist)` | Logged-in Vortex account | Applies an outfit locally. If `persist` is true, it also saves through the Vortex outfit API. |

Example:

```js
await VortexAvatar.setOutfit({
  shirt_id: 12,
  pant_id: 8,
  face_id: 3,
  body_type: "male",
  body_colors: ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"]
}, false)
```

## Movement Tools

These mirror the movement chat commands from devtools.

| Tool | Access | Result |
| --- | --- | --- |
| `VortexMovement.get()` | Base license | Returns current movement modifier state. |
| `VortexMovement.status()` | Base license | Returns a readable movement summary. |
| `VortexMovement.fly(value, speed)` | `fly-command` | Toggles fly mode. `VortexMovement.fly(40)` enables fly at speed `40`. |
| `VortexMovement.noclip(value)` | `noclip-command` | Toggles collision bypass. |
| `VortexMovement.airwalk(value)` | `airwalk-command` | Toggles airwalk/no-fall mode. |
| `VortexMovement.setGravity(scale)` | `gravity-command` | Sets gravity scale from `0` to `8`, or pass `"reset"`. |
| `VortexMovement.reset()` | Base license | Disables fly, noclip, airwalk, and custom gravity. |

## Packet And Avatar Testing

These are advanced tools for authorised testing. They are not required for normal play.

| Tool | Access | Result |
| --- | --- | --- |
| `VortexPacketDebug.enable(true)` | `packet-debug` | Enables packet debug output. |
| `VortexPacketDebug.enable(false)` | `packet-debug` | Disables packet debug output. |
| `VortexPacketDebug.table()` | `packet-debug` | Shows replicated players as a table. |
| `VortexPacketDebug.players()` | `packet-debug` | Returns replicated player snapshots. |
| `VortexPacketDebug.history()` | `packet-debug` | Returns recent replicated player batches. |
| `VortexPacketDebug.setJoinAvatar(patch)` | `avatar-spoof` | Saves an avatar override for future joins. |
| `VortexPacketDebug.getJoinAvatar()` | Base license | Reads the saved join avatar override. |
| `VortexPacketDebug.clearJoinAvatar()` | Base license | Clears the saved join avatar override. |
| `VortexPacketDebug.spoofAvatar(patch)` | `avatar-spoof` | Applies and sends an avatar override using the current movement format. |
| `VortexPacketDebug.spoofAvatarCompact(patch, options)` | `avatar-spoof` | Sends an avatar override using compact movement encoding. |
| `VortexPacketDebug.spoofAvatarResync(patch, options)` | `avatar-spoof` | Sends an override, waits, then resyncs movement format. |
| `VortexPacketDebug.spoofShirt(id)` | `avatar-spoof` | Overrides only the shirt id. |
| `VortexPacketDebug.spoofOutfit(shirtId, pantId, faceId)` | `avatar-spoof` | Overrides shirt, pants, and face ids. |
| `VortexPacketDebug.spoofColors(colors)` | `avatar-spoof` | Overrides body colours. |
| `VortexPacketDebug.clearSpoof()` | `avatar-spoof` when available | Restores the saved original avatar. |

Example:

```js
VortexPacketDebug.spoofOutfit(12, 8, 3)
```

## Runtime Status Tools

The new Vortex Web runtime exposes status helpers for development builds and issue reports.

| Tool | Result |
| --- | --- |
| `VortexRuntime.input.snapshot()` | Shows pointer lock, focus, and active key state. |
| `VortexRuntime.slim.snapshot()` | Shows active SLIM targets and distance bands. |
| `VortexRuntime.streaming.snapshot()` | Shows queued, ready, and rejected streamed asset manifests. |
| `VortexRuntime.community.snapshot()` | Shows cached Vortex-Web profile cosmetic state. |
| `VortexRuntime.world.loadedMaps()` | Shows maps registered through the new world service. |
| `VortexRuntimeDevTools.enable()` | Mounts the runtime panel and starts the debug/sandbox/SLIM scheduler for the current page. |
| `VortexRuntimeDevTools.disable()` | Hides the runtime panel and stops the debug scheduler. |

## Performance Tools

These browser devtools helpers are for local profiling and performance reports.

| Tool | Result |
| --- | --- |
| `VortexQuality.get()` | Shows the active renderer quality state. |
| `VortexQuality.performance()` | Switches to the lightweight local renderer profile: shadows off and antialias disabled on next reload. Modern avatar rendering remains the default. |
| `VortexQuality.visual()` | Enables higher visual settings such as shadows. Some settings require a reload to recreate the WebGL context. |
| `VortexQuality.setShadows(value)` | Turns dynamic shadows on or off for the current session. |
| `VortexQuality.setAvatarRenderer("legacy" \| "modern")` | Switches the local avatar renderer. Modern is the default; legacy remains available for compatibility testing. |
| `VortexPerf.setEnabled(true)` | Starts lightweight frame-section timing. |
| `VortexPerf.report()` | Returns average CPU frame-section timings, rAF/present cadence, renderer draw counts, and quality state collected so far. |
| `VortexPerf.setLog(true)` | Prints timing tables to the console for the current page session only. Leave this off for real FPS testing. |
| `VortexPerf.stop()` | Disables profiling and console timing logs. |
| `await VortexPerf.sample(seconds)` | Captures a clean no-log profiling sample for 1-30 seconds and returns the report. Pass `{ log: true }` only when live tables are needed. |

Example:

```js
VortexQuality.performance()
await VortexPerf.sample(5)
```

`VortexQuality.get()` also includes renderer and cache stats such as WebGL version, pixel ratio, draw calls, triangles, GPU texture count, cached geometries, cached materials, and cached shared textures.

To compare the new runtime shell against the legacy-only boot path:

```js
localStorage.setItem("v22RuntimeDisabled", "1")
location.reload()
```

Run the same `await VortexPerf.sample(5)` test after reload. Restore the new runtime with:

```js
localStorage.removeItem("v22RuntimeDisabled")
location.reload()
```

The runtime shell is passive by default. The runtime panel and sandbox scheduler only run after `VortexRuntimeDevTools.enable()` or when `localStorage.v22RuntimeDevTools` is set to `"1"`.

## Notes

- Hosted mode does not require sending your Vortex browser cookies or session token to Vortex Web servers.
- Hosted mode uses the browser locally to obtain a short-lived Vortex launch authorisation, then the relay verifies it server-side.
- Local relay mode is for private development and testing.
- Advanced tools are local browser tools unless stated otherwise. Relay-visible behaviour remains controlled by signed license leases and relay validation.
