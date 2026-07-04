import type { AvatarEquipmentState } from "./AvatarEquipmentService";
import type { AvatarItemCatalogService, AvatarItemManifest } from "./AvatarItemCatalogService";
import { VORTEX_RIG_VERSION } from "./rig/VortexRigSpec";

export type AvatarWebCosmeticsPayload = {
  type: "web_avatar_cosmetics";
  apiVersion: 1;
  rigVersion: typeof VORTEX_RIG_VERSION;
  playerId: number;
  updatedAt: number;
  equipped: AvatarEquipmentState;
  items: AvatarItemManifest[];
  animationPack?: AvatarWebAnimationPack;
};

export type AvatarWebCosmeticsSnapshot = {
  equippedSlots: number;
  items: number;
  animationSlots: number;
  rigVersion: typeof VORTEX_RIG_VERSION;
};

export type AvatarWebAnimationPack = {
  id: string;
  version: number;
  slots: Partial<Record<"idle" | "walk" | "run" | "jump" | "fall" | "climb" | "climb_idle", string>>;
};

export class AvatarWebCosmeticsService {
  createPayload(
    playerId: unknown,
    equipment: AvatarEquipmentState,
    catalog: AvatarItemCatalogService,
    options: { animationPack?: AvatarWebAnimationPack | null } = {}
  ): AvatarWebCosmeticsPayload | null {
    const safePlayerId = Number(playerId);
    if (!Number.isInteger(safePlayerId) || safePlayerId <= 0) return null;
    const animationPack = normalizeAnimationPack(options.animationPack);
    return {
      type: "web_avatar_cosmetics",
      apiVersion: 1,
      rigVersion: VORTEX_RIG_VERSION,
      playerId: safePlayerId,
      updatedAt: Date.now(),
      equipped: cloneEquipment(equipment),
      items: catalog.manifests(),
      ...(animationPack ? { animationPack } : {})
    };
  }

  readPayload(input: unknown): AvatarWebCosmeticsPayload | null {
    if (!input || typeof input !== "object") return null;
    const raw = input as Partial<AvatarWebCosmeticsPayload>;
    if (raw.type !== "web_avatar_cosmetics") return null;
    if (raw.apiVersion !== 1 || raw.rigVersion !== VORTEX_RIG_VERSION) return null;
    const playerId = Number(raw.playerId);
    if (!Number.isInteger(playerId) || playerId <= 0) return null;
    const animationPack = normalizeAnimationPack(raw.animationPack);
    return {
      type: "web_avatar_cosmetics",
      apiVersion: 1,
      rigVersion: VORTEX_RIG_VERSION,
      playerId,
      updatedAt: Number(raw.updatedAt) || Date.now(),
      equipped: cloneEquipment(raw.equipped ?? {}),
      items: Array.isArray(raw.items) ? raw.items.map((item) => ({ ...item })) : [],
      ...(animationPack ? { animationPack } : {})
    };
  }

  snapshot(payload: AvatarWebCosmeticsPayload | null): AvatarWebCosmeticsSnapshot {
    return {
      equippedSlots: payload ? Object.keys(payload.equipped).length : 0,
      items: payload?.items.length ?? 0,
      animationSlots: payload?.animationPack ? Object.keys(payload.animationPack.slots).length : 0,
      rigVersion: VORTEX_RIG_VERSION
    };
  }
}

function cloneEquipment(equipment: AvatarEquipmentState): AvatarEquipmentState {
  return Object.fromEntries(
    Object.entries(equipment).map(([slot, attachment]) => [slot, attachment ? { ...attachment } : attachment])
  ) as AvatarEquipmentState;
}

function normalizeAnimationPack(input: unknown): AvatarWebAnimationPack | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<AvatarWebAnimationPack>;
  const id = String(raw.id || "").trim();
  const version = Number(raw.version || 1);
  if (!id || !Number.isFinite(version) || version <= 0 || !raw.slots || typeof raw.slots !== "object") return null;
  const slots = Object.fromEntries(
    Object.entries(raw.slots)
      .filter(([slot, assetId]) => isAnimationSlot(slot) && String(assetId || "").trim())
      .map(([slot, assetId]) => [slot, String(assetId)])
  ) as AvatarWebAnimationPack["slots"];
  if (Object.keys(slots).length === 0) return null;
  return { id, version, slots };
}

function isAnimationSlot(value: string): value is keyof AvatarWebAnimationPack["slots"] {
  return ["idle", "walk", "run", "jump", "fall", "climb", "climb_idle"].includes(value);
}
