import type { AssetManager } from "../assets/AssetManager";
import type { AnimationService } from "../animation/AnimationService";
import type { AvatarService } from "../avatar/AvatarService";
import type { DiagnosticsService } from "../diagnostics/DiagnosticsService";
import type { GameSession } from "../game/GameSession";
import type { ProtocolService } from "../network/protocol";
import type { PhysicsWorld } from "../physics/types";
import type { ScriptRuntime } from "../scripting/ScriptRuntime";
import type { CoreHudService } from "../ui/CoreHudService";
import type { EventBus } from "./EventBus";
import type { PlatformBridge } from "../platform/PlatformBridge";
import type { RendererService } from "../renderer/RendererService";
import type { WorldService } from "../world/WorldService";

export type RuntimeEventMap = {
  "legacy:vortex-ready": { legacy: unknown };
  "session:changed": { snapshot: unknown };
  "script:package-rejected": { reason: string };
};

export type VortexRuntime = {
  version: string;
  platform: PlatformBridge;
  events: EventBus<RuntimeEventMap>;
  assets: AssetManager;
  renderer: RendererService;
  world: WorldService;
  gameSession: GameSession;
  physics: PhysicsWorld;
  avatar: AvatarService;
  animation: AnimationService;
  scripting: ScriptRuntime;
  protocol: ProtocolService;
  ui: CoreHudService;
  diagnostics: DiagnosticsService;
  legacy: {
    getVortex(): unknown;
    setVortex(value: unknown): void;
  };
};

export type RuntimeOptions = {
  version: string;
  document: Document;
  location: Location;
};
