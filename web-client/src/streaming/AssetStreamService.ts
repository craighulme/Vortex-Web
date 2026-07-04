export type StreamAssetKind =
  | "model"
  | "mesh"
  | "texture"
  | "material"
  | "audio"
  | "animation"
  | "avatar-item"
  | "theme"
  | "script-package"
  | "map-chunk";

export type StreamAssetManifest = {
  id: string;
  kind: StreamAssetKind;
  apiVersion: number;
  url: string;
  integrity?: string;
  byteLength?: number;
  slim?: {
    sourceId?: string;
    compositeId?: string;
    impostorId?: string;
    distances?: {
      source?: number;
      composite?: number;
      impostor?: number;
      cull?: number;
    };
  };
  capabilities?: string[];
  tags?: string[];
};

export type StreamAssetRecord = StreamAssetManifest & {
  status: "queued" | "ready" | "rejected";
  reason?: string;
  registeredAt: number;
  source?: "local" | "remote-manifest";
  remote?: {
    key?: string;
    etag?: string;
    contentType?: string;
    uploadedAt?: string;
    rigVersion?: string;
    slot?: string;
    version?: string;
  };
};

type DiagnosticsLike = {
  warn(event: string, payload?: Record<string, unknown>): void;
};

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type RemoteAssetManifestResponse = {
  apiVersion?: unknown;
  generatedAt?: unknown;
  source?: unknown;
  assets?: unknown;
};

type RemoteAssetObject = {
  key?: unknown;
  url?: unknown;
  size?: unknown;
  etag?: unknown;
  uploadedAt?: unknown;
  contentType?: unknown;
  kind?: unknown;
  rigVersion?: unknown;
  slot?: unknown;
  sha256?: unknown;
  version?: unknown;
};

export type RemoteAssetManifestOptions = {
  ttlMs?: number;
  fetcher?: FetchLike;
  now?: () => number;
};

const SUPPORTED_API_VERSION = 1;
const ALLOWED_KINDS = new Set<StreamAssetKind>([
  "model",
  "mesh",
  "texture",
  "material",
  "audio",
  "animation",
  "avatar-item",
  "theme",
  "script-package",
  "map-chunk"
]);

const DEFAULT_REMOTE_MANIFEST_TTL_MS = 5 * 60 * 1000;

const REMOTE_KIND_MAP: Record<string, StreamAssetKind> = {
  avatars: "model",
  animations: "animation",
  ugc: "avatar-item",
  textures: "texture",
  sounds: "audio",
  maps: "map-chunk",
  themes: "theme"
};

export class AssetStreamService {
  readonly supportedApiVersion = SUPPORTED_API_VERSION;
  private readonly records = new Map<string, StreamAssetRecord>();
  private readonly inflightRemoteManifests = new Map<string, Promise<StreamAssetRecord[]>>();
  private readonly remoteManifestCache = new Map<string, { fetchedAt: number; records: StreamAssetRecord[] }>();

  constructor(private readonly diagnostics: DiagnosticsLike) {}

  register(manifest: StreamAssetManifest, options: Pick<StreamAssetRecord, "source" | "remote"> = {}): StreamAssetRecord {
    const rejection = validateManifest(manifest);
    const record: StreamAssetRecord = rejection ? {
      ...manifest,
      status: "rejected",
      reason: rejection,
      registeredAt: Date.now(),
      ...options
    } : {
      ...manifest,
      status: "queued",
      registeredAt: Date.now(),
      ...options
    };
    this.records.set(manifest.id, record);
    if (rejection) this.diagnostics.warn("stream.asset.rejected", { id: manifest.id, reason: rejection });
    return record;
  }

  async hydrateRemoteManifest(manifestUrl: string, options: RemoteAssetManifestOptions = {}): Promise<StreamAssetRecord[]> {
    const url = normalizeManifestUrl(manifestUrl);
    if (!url) {
      this.diagnostics.warn("stream.manifest.rejected", { reason: "unsafe url" });
      return [];
    }

    const now = options.now?.() ?? Date.now();
    const ttlMs = Math.max(0, Math.floor(options.ttlMs ?? DEFAULT_REMOTE_MANIFEST_TTL_MS));
    const cached = this.remoteManifestCache.get(url);
    if (cached && ttlMs > 0 && now - cached.fetchedAt <= ttlMs) return cached.records;

    const inflight = this.inflightRemoteManifests.get(url);
    if (inflight) return inflight;

    const fetcher = options.fetcher ?? globalThis.fetch?.bind(globalThis);
    if (!fetcher) {
      this.diagnostics.warn("stream.manifest.failed", { url, reason: "fetch unavailable" });
      return [];
    }

    const task = this.fetchRemoteManifest(url, fetcher, now)
      .finally(() => this.inflightRemoteManifests.delete(url));
    this.inflightRemoteManifests.set(url, task);
    return task;
  }

  markReady(id: string): boolean {
    const record = this.records.get(id);
    if (!record || record.status === "rejected") return false;
    this.records.set(id, { ...record, status: "ready" });
    return true;
  }

  get(id: string): StreamAssetRecord | null {
    return this.records.get(id) ?? null;
  }

  byKind(kind: StreamAssetKind): StreamAssetRecord[] {
    return [...this.records.values()].filter((record) => record.kind === kind);
  }

  snapshot(): { total: number; queued: number; ready: number; rejected: number } {
    const result = { total: this.records.size, queued: 0, ready: 0, rejected: 0 };
    for (const record of this.records.values()) result[record.status] += 1;
    return result;
  }

  remoteManifestSnapshot(): { manifests: number; inflight: number; remoteAssets: number } {
    let remoteAssets = 0;
    for (const record of this.records.values()) if (record.source === "remote-manifest") remoteAssets += 1;
    return {
      manifests: this.remoteManifestCache.size,
      inflight: this.inflightRemoteManifests.size,
      remoteAssets
    };
  }

  private async fetchRemoteManifest(url: string, fetcher: FetchLike, fetchedAt: number): Promise<StreamAssetRecord[]> {
    try {
      const response = await fetcher(url, {
        cache: "no-store",
        headers: { accept: "application/json" }
      });
      if (!response.ok) {
        this.diagnostics.warn("stream.manifest.failed", { url, status: response.status });
        return [];
      }
      const payload = await response.json() as RemoteAssetManifestResponse;
      const records = this.registerRemoteAssets(payload);
      this.remoteManifestCache.set(url, { fetchedAt, records });
      return records;
    } catch (error) {
      this.diagnostics.warn("stream.manifest.failed", { url, error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  private registerRemoteAssets(payload: RemoteAssetManifestResponse): StreamAssetRecord[] {
    if (payload.apiVersion !== SUPPORTED_API_VERSION) {
      this.diagnostics.warn("stream.manifest.rejected", { reason: "unsupported api version" });
      return [];
    }
    if (!Array.isArray(payload.assets)) {
      this.diagnostics.warn("stream.manifest.rejected", { reason: "missing assets" });
      return [];
    }

    const records: StreamAssetRecord[] = [];
    for (const item of payload.assets) {
      const manifest = remoteAssetToManifest(item as RemoteAssetObject);
      if (!manifest) continue;
      const record = this.register(manifest, remoteAssetOptions(item as RemoteAssetObject));
      records.push(record);
    }
    return records;
  }
}

function validateManifest(manifest: StreamAssetManifest): string | undefined {
  if (!manifest.id.trim()) return "missing id";
  if (!ALLOWED_KINDS.has(manifest.kind)) return "unsupported kind";
  if (manifest.apiVersion !== SUPPORTED_API_VERSION) return "unsupported api version";
  if (!isSafeAssetUrl(manifest.url)) return "unsafe url";
  if (manifest.kind === "script-package" && !manifest.integrity) return "script package requires integrity";
  return undefined;
}

function isSafeAssetUrl(url: string): boolean {
  try {
    const base = typeof location === "undefined" ? "https://playvortex.io/" : location.href;
    const parsed = new URL(url, base);
    return parsed.protocol === "https:" || parsed.protocol === "chrome-extension:" || parsed.protocol === "moz-extension:";
  } catch {
    return false;
  }
}

function normalizeManifestUrl(value: string): string {
  if (!isSafeAssetUrl(value)) return "";
  return new URL(value, typeof location === "undefined" ? "https://playvortex.io/" : location.href).toString();
}

function remoteAssetToManifest(asset: RemoteAssetObject): StreamAssetManifest | null {
  const key = cleanAssetText(asset.key, 220);
  const url = cleanAssetText(asset.url, 1024);
  const kind = normalizeRemoteAssetKind(cleanAssetText(asset.kind, 32), key);
  if (!key || !url || !kind) return null;
  const manifest: StreamAssetManifest = {
    id: key,
    kind,
    apiVersion: SUPPORTED_API_VERSION,
    url
  };
  const byteLength = positiveInteger(asset.size);
  const integrity = cleanSha256(asset.sha256);
  if (byteLength) manifest.byteLength = byteLength;
  if (integrity) manifest.integrity = integrity;
  return manifest;
}

function remoteAssetOptions(asset: RemoteAssetObject): Pick<StreamAssetRecord, "source" | "remote"> {
  const remote: NonNullable<StreamAssetRecord["remote"]> = {};
  for (const [field, value, max] of [
    ["key", asset.key, 220],
    ["etag", asset.etag, 160],
    ["contentType", asset.contentType, 120],
    ["uploadedAt", asset.uploadedAt, 80],
    ["rigVersion", asset.rigVersion, 80],
    ["slot", asset.slot, 80],
    ["version", asset.version, 80]
  ] as const) {
    const clean = cleanAssetText(value, max);
    if (clean) remote[field] = clean;
  }
  return Object.keys(remote).length
    ? { source: "remote-manifest", remote }
    : { source: "remote-manifest" };
}

function normalizeRemoteAssetKind(rawKind: string, key: string): StreamAssetKind | null {
  const folder = rawKind || key.split("/", 1)[0] || "";
  return REMOTE_KIND_MAP[folder] ?? null;
}

function cleanSha256(value: unknown): string | undefined {
  const text = cleanAssetText(value, 128).toLowerCase();
  return /^[a-f0-9]{64}$/.test(text) ? `sha256-${text}` : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function cleanAssetText(value: unknown, max: number): string {
  return String(value || "").trim().replace(/[^\x20-\x7e]/g, "").slice(0, max);
}
