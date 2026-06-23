import { AssetManager } from "../assets/AssetManager";
import { AnimationService } from "../animation/AnimationService";
import { AvatarService } from "../avatar/AvatarService";
import { DiagnosticsService } from "../diagnostics/DiagnosticsService";
import { GameSession } from "../game/GameSession";
import { createProtocolService } from "../network/protocol";
import { createPhysicsWorld } from "../physics/createPhysicsWorld";
import { PlatformBridge } from "../platform/PlatformBridge";
import { RendererService } from "../renderer/RendererService";
import { ScriptRuntime } from "../scripting/ScriptRuntime";
import { CoreHudService } from "../ui/CoreHudService";
import { WorldService } from "../world/WorldService";
import { EventBus } from "./EventBus";
import type { RuntimeEventMap, RuntimeOptions, VortexRuntime } from "./types";

export function createVortexRuntime(options: RuntimeOptions): VortexRuntime {
  const events = new EventBus<RuntimeEventMap>();
  const diagnostics = new DiagnosticsService();
  const platform = new PlatformBridge(options.document, options.location);
  const gameSession = new GameSession(platform.bridgeConfig, events);
  let legacyVortex: unknown = null;

  const runtime: VortexRuntime = {
    version: options.version,
    platform,
    events,
    assets: new AssetManager(platform.assetManifest, diagnostics),
    renderer: new RendererService(),
    world: new WorldService(),
    gameSession,
    physics: createPhysicsWorld({ backend: "legacy", diagnostics }),
    avatar: new AvatarService(),
    animation: new AnimationService(),
    scripting: new ScriptRuntime(events, diagnostics),
    protocol: createProtocolService(),
    ui: new CoreHudService(options.document),
    diagnostics,
    legacy: {
      getVortex: () => legacyVortex,
      setVortex(value: unknown) {
        legacyVortex = value;
        events.emit("legacy:vortex-ready", { legacy: value });
      }
    }
  };

  return runtime;
}
