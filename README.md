# Vortex Web

Vortex Web is the next-generation rewrite path for Vortex2+2: an unofficial, extension-powered browser client for Vortex focused on native multiplayer relay support, performance, modular runtime architecture, and future scripting support.

This project is not an official Vortex client. It exists to keep a browser-playable version alive while the official app continues to evolve.

## Direction

Vortex2+2 is being rebranded into Vortex Web. The goal is not just a name change; it is a gradual rewrite that keeps the current browser client working while moving toward a cleaner, production-ready runtime.

Planned direction:
- Preserve extension-based browser play on `https://playvortex.io/games/{id}`.
- Keep native multiplayer alive in the browser through a WebSocket-to-native/app relay.
- Move legacy globals into a typed runtime shell.
- Improve loading, asset management, map handling, rendering, physics, avatar equipment, UI, and diagnostics.
- Add a game API first, then evaluate Lua/WASM scripting behind safe runtime permissions.
- Avoid building a web studio for now; the focus is the playable web client.

## Current State

The current playable game still uses the legacy Vortex2+2 engine scripts for movement, rendering, multiplayer, chat, maps, avatars, and building/sword modes.

The new TypeScript/Vite runtime shell has been added as the first migration step. It provides typed services for assets, renderer ownership, world/entities, physics adapters, avatar slots, animation/foot-IK configuration, scripting permissions, UI, diagnostics, and protocol definitions. These systems are not fully wired into live gameplay yet.

Important: Rapier physics, foot IK, and the new avatar/equipment service are scaffolded for the rewrite path, not active replacements for the legacy in-game movement/avatar systems yet.

## Access And Auth

Vortex Web browser multiplayer is license-gated. To get a key, or to request more authorisation for restricted commands, contact `quackduck.` on Discord.

Hosted mode does not send user session tokens or browser cookies to Vortex Web servers. The extension uses the user's existing Vortex browser session locally to request a normal short-lived game authorisation token from Vortex, then sends that game authorisation token and the signed license lease to the hosted relay. The hosted relay verifies the game authorisation token server-side and keeps relay secrets out of the extension.

Command access is documented in [COMMANDS_README.md](COMMANDS_README.md).

## Browser Play

This extension injects a `Play in Browser` button on `https://playvortex.io/games/{id}`. The button fetches the normal Vortex launch token with your existing browser login and opens the Vortex Web browser client.

The official app uses UDP for live multiplayer. Browser extensions cannot open UDP sockets, so live Vortex multiplayer uses a WebSocket-to-native/app relay. Public builds default to the hosted Vortex Web relay.

Local relay mode is not the supported public setup. It is possible for private development or self-hosted/reverse-engineering work, but you must provide and maintain your own local relay/runtime configuration.

The historical local relay URL is `ws://127.0.0.1:27822/ws`, but public users should use the hosted default unless they are deliberately building and maintaining their own local relay.

## Current Features

- Clean custom dark UI
- Map loader
- Normal mapping
- Shadows
- Custom games
- Multiplayer health and sword system
- Multiplayer building game
- Hosted native multiplayer relay support
- Extension-managed launch handoff
- Rebrand/update path from Vortex2+2 to Vortex Web
- Early modular TypeScript runtime shell for future migration work

## Installation

1. Download the latest release.
2. Unzip it.
3. Go to `chrome://extensions`.
4. Enable developer mode.
5. Press `Load unpacked` and select the folder containing this file.

## Troubleshooting

If Vortex Web breaks the game, check whether another extension is interfering and disable it first. If that does not fix it, Vortex may have changed something upstream and the extension may need an update.

## Credits

- Native UDP protocol research and browser multiplayer bridge by [@craighulme23](https://github.com/craighulme23)
- Search engine originally created by enk, modified and used with permission
- Crossroads by Shedletsky
- SFOTH by Shedletsky
- Sword fight baseplate by Inuk
- Building game by Inuk
- Party.exe map by 8DSK
- Fencing map by Stickmasterluke

## Screenshots

Vortex Web Building game:

![Vortex Web Building game](https://i.imgur.com/SooHiwI.jpeg)

Sword fight on the heights:

![Sword fight on the heights](https://media.discordapp.net/attachments/1497640288687100115/1502972700874899556/image.png?ex=6a06ede7&is=6a059c67&hm=a74ea0a22261862d10508df7a5e77764839d42ed480882d742e39d35c1ca3dc8&=&format=webp&quality=lossless)
