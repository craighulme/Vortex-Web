import type { AssetStreamService, StreamAssetRecord } from "../streaming/AssetStreamService";
import type { AvatarWebAnimationPack } from "./AvatarWebCosmeticsService";

export type AvatarAnimationSlot = "idle" | "walk" | "run" | "jump" | "fall" | "climb" | "climb_idle";

export type AvatarAnimationClipManifest = {
  slot: AvatarAnimationSlot;
  assetUrl: string;
  assetId?: string;
  clipName?: string;
  integrity?: string;
};

export type AvatarAnimationPackManifest = {
  id: string;
  name?: string;
  version?: number;
  apiVersion?: number;
  clips: AvatarAnimationClipManifest[];
  tags?: string[];
};

export type AvatarAnimationPackRecord = {
  id: string;
  name: string;
  version: number;
  manifest: AvatarAnimationPackManifest;
  streams: StreamAssetRecord[];
  registeredAt: number;
};

const ANIMATION_SLOTS = new Set<AvatarAnimationSlot>(["idle", "walk", "run", "jump", "fall", "climb", "climb_idle"]);

export class AvatarAnimationPackService {
  private readonly records = new Map<string, AvatarAnimationPackRecord>();
  private selectedPackId: string | null = null;

  constructor(private readonly streaming: AssetStreamService) {}

  register(manifest: AvatarAnimationPackManifest): AvatarAnimationPackRecord | null {
    const id = String(manifest.id || "").trim();
    if (!id) return null;
    const clips = normalizeClips(manifest.clips);
    if (clips.length === 0) return null;
    const streams = clips.map((clip) => this.streaming.register({
      id: clip.assetId ?? `${id}:${clip.slot}`,
      kind: "animation",
      apiVersion: manifest.apiVersion ?? this.streaming.supportedApiVersion,
      url: clip.assetUrl,
      ...(clip.integrity ? { integrity: clip.integrity } : {}),
      ...(manifest.tags ? { tags: manifest.tags } : {})
    }));
    const record: AvatarAnimationPackRecord = {
      id,
      name: String(manifest.name || id),
      version: Number(manifest.version || 1),
      manifest: cloneManifest({ ...manifest, id, clips }),
      streams,
      registeredAt: Date.now()
    };
    this.records.set(id, record);
    return cloneRecord(record);
  }

  registerStreamRecords(records: StreamAssetRecord[]): AvatarAnimationPackRecord[] {
    const manifests = animationPackManifestsFromStreams(records);
    const registered: AvatarAnimationPackRecord[] = [];
    for (const manifest of manifests) {
      const record = this.register(manifest);
      if (record) registered.push(record);
    }
    if (!this.selectedPackId && registered[0]) this.selectedPackId = registered[0].id;
    return registered;
  }

  select(id: string | null): boolean {
    if (id === null) {
      this.selectedPackId = null;
      return true;
    }
    if (!this.records.has(id)) return false;
    this.selectedPackId = id;
    return true;
  }

  selected(): AvatarAnimationPackRecord | null {
    const record = this.selectedPackId ? this.records.get(this.selectedPackId) : null;
    return record ? cloneRecord(record) : null;
  }

  toWebPayload(record: AvatarAnimationPackRecord | null = this.selected()): AvatarWebAnimationPack | null {
    if (!record) return null;
    const slots: AvatarWebAnimationPack["slots"] = {};
    for (const clip of record.manifest.clips) {
      const stream = record.streams.find((candidate) => candidate.id === (clip.assetId ?? `${record.id}:${clip.slot}`));
      if (stream?.status === "rejected") continue;
      slots[clip.slot] = clip.clipName ? `${clip.assetUrl}#${clip.clipName}` : clip.assetUrl;
    }
    if (Object.keys(slots).length === 0) return null;
    return {
      id: record.id,
      version: record.version,
      slots
    };
  }

  list(): AvatarAnimationPackRecord[] {
    return [...this.records.values()].map(cloneRecord);
  }

  snapshot(): { total: number; selected: string | null; queued: number; ready: number; rejected: number } {
    const result = { total: this.records.size, selected: this.selectedPackId, queued: 0, ready: 0, rejected: 0 };
    for (const record of this.records.values()) {
      for (const stream of record.streams) result[stream.status] += 1;
    }
    return result;
  }
}

function normalizeClips(clips: AvatarAnimationClipManifest[] | undefined): AvatarAnimationClipManifest[] {
  if (!Array.isArray(clips)) return [];
  const bySlot = new Map<AvatarAnimationSlot, AvatarAnimationClipManifest>();
  for (const clip of clips) {
    const slot = clip?.slot;
    const assetUrl = String(clip?.assetUrl || "").trim();
    if (!ANIMATION_SLOTS.has(slot) || !assetUrl) continue;
    bySlot.set(slot, {
      slot,
      assetUrl,
      ...(clip.assetId ? { assetId: String(clip.assetId) } : {}),
      ...(clip.clipName ? { clipName: String(clip.clipName) } : {}),
      ...(clip.integrity ? { integrity: String(clip.integrity) } : {})
    });
  }
  return [...bySlot.values()];
}

function animationPackManifestsFromStreams(records: StreamAssetRecord[]): AvatarAnimationPackManifest[] {
  const packs = new Map<string, AvatarAnimationPackManifest>();
  for (const record of records) {
    if (record.kind !== "animation" || record.status === "rejected") continue;
    const slot = animationSlotFromRecord(record);
    if (!slot) continue;
    const packId = animationPackIdFromRecord(record);
    const manifest = packs.get(packId) ?? createStreamAnimationPackManifest(record, packId);
    manifest.clips.push({
      slot,
      assetUrl: record.url,
      assetId: record.id,
      ...(record.integrity ? { integrity: record.integrity } : {})
    });
    packs.set(packId, manifest);
  }
  return [...packs.values()].map((manifest) => ({
    ...manifest,
    clips: normalizeClips(manifest.clips)
  })).filter((manifest) => manifest.clips.length > 0);
}

function animationSlotFromRecord(record: StreamAssetRecord): AvatarAnimationSlot | null {
  const slot = String(record.remote?.slot || "").trim();
  if (ANIMATION_SLOTS.has(slot as AvatarAnimationSlot)) return slot as AvatarAnimationSlot;
  const filename = record.id.split("/").pop()?.split(".")[0] || "";
  const normalized = filename.replace(/^vweb[-_]/, "").replace(/[-_]v\d+$/, "").replace(/[-_]animation$/, "");
  return ANIMATION_SLOTS.has(normalized as AvatarAnimationSlot) ? normalized as AvatarAnimationSlot : null;
}

function createStreamAnimationPackManifest(record: StreamAssetRecord, packId: string): AvatarAnimationPackManifest {
  const manifest: AvatarAnimationPackManifest = {
    id: packId,
    name: animationPackNameFromRecord(record),
    version: animationPackVersionFromRecord(record),
    apiVersion: record.apiVersion,
    clips: []
  };
  if (record.tags) manifest.tags = [...record.tags];
  return manifest;
}

function animationPackIdFromRecord(record: StreamAssetRecord): string {
  const rig = String(record.remote?.rigVersion || "vweb-rig").trim();
  const version = String(record.remote?.version || "default").trim();
  return `anim:${rig}:${version}`;
}

function animationPackNameFromRecord(record: StreamAssetRecord): string {
  const rig = String(record.remote?.rigVersion || "Vortex Web Rig").trim();
  const version = String(record.remote?.version || "Default").trim();
  return `${rig} ${version} animations`;
}

function animationPackVersionFromRecord(record: StreamAssetRecord): number {
  const raw = Number(record.remote?.version);
  return Number.isInteger(raw) && raw > 0 ? raw : 1;
}

function cloneRecord(record: AvatarAnimationPackRecord): AvatarAnimationPackRecord {
  return {
    ...record,
    manifest: cloneManifest(record.manifest),
    streams: record.streams.map((stream) => ({ ...stream }))
  };
}

function cloneManifest(manifest: AvatarAnimationPackManifest): AvatarAnimationPackManifest {
  return {
    id: manifest.id,
    ...(manifest.name !== undefined ? { name: manifest.name } : {}),
    ...(manifest.version !== undefined ? { version: manifest.version } : {}),
    ...(manifest.apiVersion !== undefined ? { apiVersion: manifest.apiVersion } : {}),
    clips: normalizeClips(manifest.clips),
    ...(manifest.tags ? { tags: [...manifest.tags] } : {})
  };
}
