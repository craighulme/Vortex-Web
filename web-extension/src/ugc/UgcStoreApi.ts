import type { UgcAssetKind, UgcDraft, UgcEquippedStoreItem, UgcEquipmentPayload, UgcItemManifest, UgcStoreItem } from "./UgcTypes";

export const VWEB_COMMUNITY_API_BASE = "https://vweb.irongiant.vip";
const EQUIPPED_STORAGE_KEY = "vwebUgcEquippedV1";

type RemoteAsset = {
  id?: unknown;
  identityKey?: unknown;
  identity_key?: unknown;
  name?: unknown;
  key?: unknown;
  url?: unknown;
  status?: unknown;
  size?: unknown;
  uploadedAt?: unknown;
  contentType?: unknown;
  kind?: unknown;
  rigVersion?: unknown;
  slot?: unknown;
  version?: unknown;
  ugcKind?: unknown;
  manifest?: unknown;
};

type RemoteManifest = {
  apiVersion?: unknown;
  items?: unknown;
  assets?: unknown;
};

export class UgcStoreApi {
  constructor(private readonly apiBase = VWEB_COMMUNITY_API_BASE) {}

  async listPublished(): Promise<UgcStoreItem[]> {
    const response = await fetch(new URL("/ugc/items", this.apiBase).toString(), {
      credentials: "omit",
      cache: "no-store",
      headers: { accept: "application/json" }
    });
    if (!response.ok) return [];
    const payload = await response.json() as RemoteManifest;
    if (payload.apiVersion !== 1) return [];
    const items = Array.isArray(payload.items) ? payload.items : payload.assets;
    if (!Array.isArray(items)) return [];
    return items.map((asset) => assetToStoreItem(asset as RemoteAsset))
      .filter(isUgcStoreItem)
      .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
  }

  async listOwn(token: string): Promise<UgcStoreItem[]> {
    const response = await fetch(new URL("/ugc/my-items", this.apiBase).toString(), {
      credentials: "omit",
      cache: "no-store",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) return [];
    const payload = await response.json() as RemoteManifest;
    if (payload.apiVersion !== 1) return [];
    const items = Array.isArray(payload.items) ? payload.items : payload.assets;
    if (!Array.isArray(items)) return [];
    return items.map((asset) => assetToStoreItem(asset as RemoteAsset))
      .filter(isUgcStoreItem)
      .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
  }

  async publishDraft(input: { draft: UgcDraft; file: File; token: string; particles?: Map<string, File> }): Promise<UgcStoreItem> {
    const form = new FormData();
    form.set("name", input.draft.name);
    form.set("kind", input.draft.kind);
    form.set("slot", input.draft.slot);
    form.set("rigVersion", input.draft.rigVersion);
    if (input.draft.identityKey) form.set("identityKey", input.draft.identityKey);
    form.set("manifest", JSON.stringify(input.draft.manifest));
    form.set("model", input.file, input.file.name);
    for (const particle of input.draft.particleFiles) {
      const file = input.particles?.get(particle.emitterId);
      if (file) form.set(`particle:${particle.emitterId}`, file, file.name);
    }
    const response = await fetch(new URL("/ugc/upload", this.apiBase).toString(), {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${input.token}`
      },
      body: form
    });
    const payload = await response.json().catch(() => ({})) as { item?: RemoteAsset; error?: string };
    if (!response.ok || !payload.item) {
      throw new Error(payload.error || `publish failed: HTTP ${response.status}`);
    }
    const item = assetToStoreItem(payload.item);
    if (!item) throw new Error("publish returned an invalid item");
    return item;
  }

  async listEquipment(userIds: Array<number | string>): Promise<UgcEquipmentPayload> {
    const ids = [...new Set(userIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
    if (!ids.length) return { apiVersion: 1, users: {} };
    const url = new URL("/ugc/equipment", this.apiBase);
    url.searchParams.set("ids", ids.slice(0, 64).join(","));
    const response = await fetch(url.toString(), {
      credentials: "omit",
      cache: "no-store",
      headers: { accept: "application/json" }
    });
    if (!response.ok) return { apiVersion: 1, users: {} };
    const payload = await response.json().catch(() => null) as Partial<UgcEquipmentPayload> | null;
    return normalizeEquipmentPayload(payload);
  }

  async saveEquipment(token: string, items: UgcEquippedStoreItem[]): Promise<UgcEquippedStoreItem[]> {
    const response = await fetch(new URL("/ugc/equipment", this.apiBase).toString(), {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        items: items.map((item) => ({ id: item.id, key: item.key }))
      })
    });
    const payload = await response.json().catch(() => ({})) as { items?: RemoteAsset[]; error?: string };
    if (!response.ok) throw new Error(payload.error || `equipment save failed: HTTP ${response.status}`);
    return Array.isArray(payload.items)
      ? payload.items.map((item) => assetToStoreItem(item)).filter(isUgcStoreItem).map(storeItemToEquipped)
      : items;
  }
}

export class UgcEquipmentStore {
  constructor(private readonly storage: Storage = window.localStorage) {}

  load(): UgcEquippedStoreItem[] {
    try {
      const raw = this.storage.getItem(EQUIPPED_STORAGE_KEY);
      const items = raw ? JSON.parse(raw) : [];
      return Array.isArray(items) ? items.map(normalizeEquippedItem).filter(isEquippedItem) : [];
    } catch {
      return [];
    }
  }

  isEquipped(item: UgcStoreItem): boolean {
    return this.load().some((equipped) => equipped.id === item.id);
  }

  equip(item: UgcStoreItem): UgcEquippedStoreItem[] {
    const next = this.load().filter((equipped) => equipped.id !== item.id && !sameEquipmentSlot(equipped, item));
    next.push({
      id: item.id,
      identityKey: item.identityKey,
      name: item.name,
      kind: item.kind,
      url: item.url,
      key: item.key,
      slot: item.slot,
      rigVersion: item.rigVersion,
      size: item.size,
      manifest: item.manifest,
      equippedAt: Date.now()
    });
    this.save(next);
    return next;
  }

  replace(items: UgcStoreItem[] | UgcEquippedStoreItem[]): UgcEquippedStoreItem[] {
    const next = items.map(storeItemToEquipped).filter(isEquippedItem);
    this.save(next);
    return next;
  }

  unequip(item: UgcStoreItem): UgcEquippedStoreItem[] {
    const next = this.load().filter((equipped) => equipped.id !== item.id);
    this.save(next);
    return next;
  }

  private save(items: UgcEquippedStoreItem[]): void {
    this.storage.setItem(EQUIPPED_STORAGE_KEY, JSON.stringify(items.slice(0, 64)));
    window.dispatchEvent(new CustomEvent("vweb-ugc-equipment-changed", { detail: { items } }));
  }
}

function isUgcStoreItem(value: UgcStoreItem | null): value is UgcStoreItem {
  return !!value;
}

function isEquippedItem(value: UgcEquippedStoreItem | null): value is UgcEquippedStoreItem {
  return !!value;
}

function assetToStoreItem(asset: RemoteAsset): UgcStoreItem | null {
  const key = cleanText(asset.key ?? asset.id, 220);
  const url = cleanText(asset.url, 1024);
  if (!key || !url) return null;
  const kind = normalizeKind(asset.ugcKind, key);
  const id = cleanText(asset.id, 120) || key;
  return {
    id,
    identityKey: cleanText(asset.identityKey ?? asset.identity_key, 220),
    key,
    url,
    kind,
    name: cleanText(asset.name, 96) || nameFromKey(key),
    status: cleanText(asset.status, 32),
    slot: cleanText(asset.slot, 48) || slotFromKey(key, kind),
    rigVersion: cleanText(asset.rigVersion, 80) || "vweb-rig-v1",
    size: Number(asset.size) || 0,
    uploadedAt: cleanText(asset.uploadedAt, 80),
    contentType: cleanText(asset.contentType, 120)
    ,
    manifest: normalizeManifest(asset.manifest)
  };
}

function normalizeEquipmentPayload(payload: Partial<UgcEquipmentPayload> | null): UgcEquipmentPayload {
  if (!payload || payload.apiVersion !== 1 || !payload.users || typeof payload.users !== "object") {
    return { apiVersion: 1, users: {} };
  }
  const users: UgcEquipmentPayload["users"] = {};
  for (const [id, user] of Object.entries(payload.users)) {
    const userId = Number((user as { userId?: unknown })?.userId ?? id);
    if (!Number.isInteger(userId) || userId <= 0) continue;
    const rawItems = Array.isArray((user as { items?: unknown }).items) ? (user as { items: unknown[] }).items : [];
    users[String(userId)] = {
      userId,
      updatedAt: Number((user as { updatedAt?: unknown }).updatedAt || 0) || 0,
      items: rawItems.map((item) => assetToStoreItem(item as RemoteAsset)).filter(isUgcStoreItem)
    };
  }
  return { apiVersion: 1, users };
}

function normalizeKind(value: unknown, key: string): UgcAssetKind {
  if (value === "character-morph" || value === "animation-pack" || value === "avatar-item") return value;
  if (key.startsWith("avatars/")) return "character-morph";
  if (key.startsWith("animations/")) return "animation-pack";
  return "avatar-item";
}

function slotFromKey(key: string, kind: UgcAssetKind): string {
  if (kind !== "avatar-item") return "";
  const parts = key.split("/");
  return parts.length > 2 ? parts[1] ?? "" : "";
}

function nameFromKey(key: string): string {
  const file = key.split("/").pop() || key;
  return file.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function cleanText(value: unknown, max: number): string {
  return String(value || "").trim().replace(/[^\x20-\x7e]/g, "").slice(0, max);
}

function normalizeManifest(value: unknown): UgcItemManifest | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const manifest = value as Partial<UgcItemManifest>;
  if (manifest.apiVersion !== 1) return undefined;
  if (manifest.kind !== "avatar-item" && manifest.kind !== "character-morph" && manifest.kind !== "animation-pack") return undefined;
  return manifest as UgcItemManifest;
}

function normalizeEquippedItem(value: unknown): UgcEquippedStoreItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<UgcEquippedStoreItem>;
  const key = cleanText(item.key, 220);
  const url = cleanText(item.url, 1024);
  const kind = normalizeKind(item.kind, key);
  if (!key || !url) return null;
  return {
    id: cleanText(item.id, 220) || key,
    identityKey: cleanText(item.identityKey, 220),
    name: cleanText(item.name, 96) || nameFromKey(key),
    kind,
    url,
    key,
    slot: cleanText(item.slot, 48) || slotFromKey(key, kind),
    rigVersion: cleanText(item.rigVersion, 80) || "vweb-rig-v1",
    size: Number(item.size) || 0,
    manifest: normalizeManifest(item.manifest),
    equippedAt: Number(item.equippedAt) || Date.now()
  };
}

function storeItemToEquipped(item: UgcStoreItem | UgcEquippedStoreItem): UgcEquippedStoreItem {
  return {
    id: cleanText(item.id, 220) || cleanText(item.key, 220),
    identityKey: cleanText(item.identityKey, 220),
    name: cleanText(item.name, 96) || nameFromKey(item.key),
    kind: normalizeKind(item.kind, item.key),
    url: cleanText(item.url, 1024),
    key: cleanText(item.key, 220),
    slot: cleanText(item.slot, 48) || slotFromKey(item.key, normalizeKind(item.kind, item.key)),
    rigVersion: cleanText(item.rigVersion, 80) || "vweb-rig-v1",
    size: Number(item.size) || 0,
    manifest: normalizeManifest(item.manifest),
    equippedAt: Number((item as UgcEquippedStoreItem).equippedAt) || Date.now()
  };
}

function sameEquipmentSlot(left: Pick<UgcStoreItem, "kind" | "slot">, right: Pick<UgcStoreItem, "kind" | "slot">): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind !== "avatar-item") return true;
  return cleanText(left.slot, 48).toLowerCase() === cleanText(right.slot, 48).toLowerCase();
}
