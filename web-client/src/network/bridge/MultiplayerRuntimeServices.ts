import { DEFAULT_BODY_COLORS } from "../../avatar/AvatarService";

type RuntimeServiceBag = Record<string, any>;

function required(runtime: RuntimeServiceBag | null | undefined, key: string, label: string) {
  const service = runtime?.[key];
  if (!service) throw new Error(`[mp] VortexRuntime ${label} service is required.`);
  return service;
}

export function createMultiplayerRuntimeServices(runtime: RuntimeServiceBag) {
  return {
    raw: runtime,
    multiplayer: () => required(runtime, "multiplayer", "multiplayer"),
    session: () => required(runtime, "multiplayerSession", "multiplayer session"),
    connection: () => required(runtime, "multiplayerConnection", "multiplayer connection"),
    router: () => required(runtime, "multiplayerRouter", "multiplayer message router"),
    remoteSession: () => required(runtime, "remoteSession", "remote session"),
    access: () => required(runtime, "access", "access"),
    packetDebug: () => required(runtime, "packetDebug", "packet debug"),
    community: () => runtime?.community || null,
    bridgeConfig: () => {
      const config = runtime?.platform?.bridgeConfig;
      if (!config) throw new Error("[mp] VortexRuntime platform bridge config is required.");
      return config;
    },
    leaderboard: () => {
      const leaderboard = runtime?.leaderboard?.api?.();
      if (!leaderboard) throw new Error("[mp] VortexRuntime leaderboard service is required.");
      return leaderboard;
    },
    normalizeAvatarFields(data: Record<string, any> = {}) {
      return runtime?.avatar?.normalizeNative?.(data) || {
        shirt_id: 0,
        pant_id: 0,
        body_type: "male",
        body_colors: [...DEFAULT_BODY_COLORS],
        face_id: 0
      };
    }
  };
}
