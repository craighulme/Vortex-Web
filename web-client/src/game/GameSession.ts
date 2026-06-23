import type { EventBus } from "../runtime/EventBus";
import type { RuntimeEventMap } from "../runtime/types";
import type { BridgeConfig } from "../platform/PlatformBridge";

export type GameFeatureFlag = "SWORD_FIGHT" | "BUILD_MODE" | "VOID_DIE" | "REMOVE_BASEPLATE";

export type GameSessionSnapshot = {
  officialGameId: number;
  customGameId: string | null;
  mapName: string;
  flags: Record<GameFeatureFlag, boolean>;
};

export class GameSession {
  private mapName = "";
  private readonly flags: Record<GameFeatureFlag, boolean> = {
    SWORD_FIGHT: false,
    BUILD_MODE: false,
    VOID_DIE: false,
    REMOVE_BASEPLATE: false
  };

  constructor(
    private readonly bridgeConfig: BridgeConfig,
    private readonly events: EventBus<RuntimeEventMap>
  ) {}

  setMapName(name: string): void {
    this.mapName = name;
    this.emit();
  }

  setFlag(flag: GameFeatureFlag, enabled: boolean): void {
    this.flags[flag] = enabled;
    this.emit();
  }

  snapshot(): GameSessionSnapshot {
    return {
      officialGameId: this.bridgeConfig.officialGameId,
      customGameId: this.bridgeConfig.customGameId,
      mapName: this.mapName,
      flags: { ...this.flags }
    };
  }

  private emit(): void {
    this.events.emit("session:changed", { snapshot: this.snapshot() });
  }
}
