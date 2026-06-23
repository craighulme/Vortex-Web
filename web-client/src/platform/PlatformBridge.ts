import type { AssetManifest } from "../assets/manifest";
import { normalizeAssetManifest } from "../assets/manifest";

export type BridgeConfig = {
  officialGameId: number;
  customGameId: string | null;
  launchToken: string;
  hubUrl: string;
  brokered: boolean;
  identity: unknown;
};

const emptyBridgeConfig: BridgeConfig = {
  officialGameId: 0,
  customGameId: null,
  launchToken: "",
  hubUrl: "",
  brokered: false,
  identity: null
};

export class PlatformBridge {
  readonly assetManifest: AssetManifest;
  readonly bridgeConfig: BridgeConfig;

  constructor(document: Document, readonly location: Location) {
    this.assetManifest = normalizeAssetManifest(readMetaJson(document, "_importedAssets"));
    this.bridgeConfig = normalizeBridgeConfig(readMetaJson(document, "_vortexBridgeConfig"));
  }
}

function readMetaJson(document: Document, id: string): unknown {
  const raw = document.getElementById(id)?.getAttribute("content");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeBridgeConfig(raw: unknown): BridgeConfig {
  if (!raw || typeof raw !== "object") return emptyBridgeConfig;
  const value = raw as Record<string, unknown>;
  return {
    officialGameId: Number(value.officialGameId || 0),
    customGameId: typeof value.customGameId === "string" ? value.customGameId : null,
    launchToken: typeof value.launchToken === "string" ? value.launchToken : "",
    hubUrl: typeof value.hubUrl === "string" ? value.hubUrl : "",
    brokered: Boolean(value.brokered),
    identity: value.identity ?? null
  };
}
