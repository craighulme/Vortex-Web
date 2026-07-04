import type { AssetStreamService, StreamAssetRecord } from "../streaming/AssetStreamService";
import type { AvatarAttachment, AvatarAttachmentKind, AvatarEquipmentService } from "./AvatarEquipmentService";

export type AvatarItemManifest = {
  id: string;
  name?: string;
  kind?: AvatarAttachmentKind;
  assetUrl: string;
  assetId?: string;
  slot: AvatarAttachment["slot"];
  bone?: string;
  offset?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  metadata?: Record<string, unknown>;
  apiVersion?: number;
  integrity?: string;
  tags?: string[];
};

export type AvatarItemRecord = {
  id: string;
  name: string;
  manifest: AvatarItemManifest;
  attachment: AvatarAttachment;
  stream: StreamAssetRecord;
  registeredAt: number;
};

export class AvatarItemCatalogService {
  private readonly records = new Map<string, AvatarItemRecord>();

  constructor(
    private readonly equipment: AvatarEquipmentService,
    private readonly streaming: AssetStreamService
  ) {}

  register(manifest: AvatarItemManifest): AvatarItemRecord | null {
    const attachmentInput: Partial<AvatarAttachment> & { id: string; slot: AvatarAttachment["slot"] } = {
      id: manifest.id,
      slot: manifest.slot,
      kind: manifest.kind ?? "accessory",
      assetId: manifest.assetId ?? manifest.id,
      assetUrl: manifest.assetUrl
    };
    if (manifest.bone !== undefined) attachmentInput.bone = manifest.bone;
    if (manifest.offset !== undefined) attachmentInput.offset = manifest.offset;
    if (manifest.rotation !== undefined) attachmentInput.rotation = manifest.rotation;
    if (manifest.scale !== undefined) attachmentInput.scale = manifest.scale;
    if (manifest.metadata !== undefined) attachmentInput.metadata = manifest.metadata;

    const attachment = this.equipment.normalizeAttachment(attachmentInput);
    if (!attachment) return null;

    const streamManifest = {
      id: manifest.assetId ?? manifest.id,
      kind: "avatar-item",
      apiVersion: manifest.apiVersion ?? this.streaming.supportedApiVersion,
      url: manifest.assetUrl
    } as const;
    const stream = this.streaming.register({
      ...streamManifest,
      ...(manifest.integrity !== undefined ? { integrity: manifest.integrity } : {}),
      ...(manifest.tags !== undefined ? { tags: manifest.tags } : {})
    });
    const record: AvatarItemRecord = {
      id: manifest.id,
      name: String(manifest.name || manifest.id),
      manifest: cloneManifest(manifest),
      attachment,
      stream,
      registeredAt: Date.now()
    };
    this.records.set(record.id, record);
    return cloneRecord(record);
  }

  equip(id: string): AvatarAttachment | null {
    const record = this.records.get(id);
    if (!record || record.stream.status === "rejected") return null;
    return this.equipment.equip(record.attachment);
  }

  get(id: string): AvatarItemRecord | null {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : null;
  }

  list(): AvatarItemRecord[] {
    return [...this.records.values()].map(cloneRecord);
  }

  manifests(options: { includeRejected?: boolean } = {}): AvatarItemManifest[] {
    return [...this.records.values()]
      .filter((record) => options.includeRejected || record.stream.status !== "rejected")
      .map((record) => cloneManifest(record.manifest));
  }

  snapshot(): { total: number; ready: number; queued: number; rejected: number } {
    const result = { total: this.records.size, ready: 0, queued: 0, rejected: 0 };
    for (const record of this.records.values()) result[record.stream.status] += 1;
    return result;
  }
}

function cloneRecord(record: AvatarItemRecord): AvatarItemRecord {
  const attachment: AvatarAttachment = { ...record.attachment };
  if (record.attachment.offset) attachment.offset = [...record.attachment.offset];
  if (record.attachment.rotation) attachment.rotation = [...record.attachment.rotation];
  if (record.attachment.scale) attachment.scale = [...record.attachment.scale];
  if (record.attachment.metadata) attachment.metadata = { ...record.attachment.metadata };
  return {
    ...record,
    manifest: cloneManifest(record.manifest),
    attachment,
    stream: { ...record.stream }
  };
}

function cloneManifest(manifest: AvatarItemManifest): AvatarItemManifest {
  const clone: AvatarItemManifest = {
    id: manifest.id,
    assetUrl: manifest.assetUrl,
    slot: manifest.slot
  };
  if (manifest.name !== undefined) clone.name = manifest.name;
  if (manifest.kind !== undefined) clone.kind = manifest.kind;
  if (manifest.assetId !== undefined) clone.assetId = manifest.assetId;
  if (manifest.bone !== undefined) clone.bone = manifest.bone;
  if (manifest.offset !== undefined) clone.offset = [...manifest.offset];
  if (manifest.rotation !== undefined) clone.rotation = [...manifest.rotation];
  if (manifest.scale !== undefined) clone.scale = [...manifest.scale];
  if (manifest.metadata !== undefined) clone.metadata = { ...manifest.metadata };
  if (manifest.apiVersion !== undefined) clone.apiVersion = manifest.apiVersion;
  if (manifest.integrity !== undefined) clone.integrity = manifest.integrity;
  if (manifest.tags !== undefined) clone.tags = [...manifest.tags];
  return clone;
}
