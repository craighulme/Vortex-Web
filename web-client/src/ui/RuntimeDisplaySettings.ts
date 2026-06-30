export type RuntimeDisplaySettings = {
  chatNameGradients: boolean;
  leaderboardCosmetics: boolean;
  miniProfileCosmetics: boolean;
  runtimeThemeCss: string;
};

const DEFAULT_DISPLAY_SETTINGS: RuntimeDisplaySettings = {
  chatNameGradients: true,
  leaderboardCosmetics: true,
  miniProfileCosmetics: true,
  runtimeThemeCss: ""
};

export function readRuntimeDisplaySettings(documentRef: Document): RuntimeDisplaySettings {
  const meta = documentRef.getElementById("_vortexWebSettings") as HTMLMetaElement | null;
  if (!meta?.content) return { ...DEFAULT_DISPLAY_SETTINGS };
  try {
    const parsed = JSON.parse(meta.content);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_DISPLAY_SETTINGS };
    return {
      chatNameGradients: parsed.chatNameGradients !== false,
      leaderboardCosmetics: parsed.leaderboardCosmetics !== false,
      miniProfileCosmetics: parsed.miniProfileCosmetics !== false,
      runtimeThemeCss: typeof parsed.runtimeThemeCss === "string" ? parsed.runtimeThemeCss : ""
    };
  } catch {
    return { ...DEFAULT_DISPLAY_SETTINGS };
  }
}
