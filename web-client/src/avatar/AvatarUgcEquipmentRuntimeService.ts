import { AVATAR_SLOT_BONES, type AvatarAttachmentSlot } from "./AvatarEquipmentService";
import { runtimeBoneAliases } from "./rig/RigBoneAliases";
import { loadGltfAnimationClipMap } from "../animation/GltfAnimationClipAdapter";
import type { LocalAnimationState } from "../animation/AnimationService";
import type { AnimationClip } from "../animation/AnimationPose";

type ThreeLike = Record<string, any>;
type Object3DLike = {
  name?: string;
  isBone?: boolean;
  isMesh?: boolean;
  isSprite?: boolean;
  parent?: { remove?(object: unknown): void };
  userData?: Record<string, unknown>;
  position?: { x?: number; y?: number; z?: number; set?(x: number, y: number, z: number): void; copy?(value: unknown): void };
  rotation?: { x?: number; y?: number; z?: number; set?(x: number, y: number, z: number): void };
  scale?: { x?: number; y?: number; z?: number; set?(x: number, y: number, z: number): void };
  material?: Record<string, any>;
  geometry?: Record<string, any>;
  add?(object: unknown): void;
  remove?(object: unknown): void;
  clear?(): void;
  traverse?(visitor: (object: Object3DLike) => void): void;
  clone?(recursive?: boolean): Object3DLike;
  rotateZ?(radians: number): void;
  castShadow?: boolean;
  receiveShadow?: boolean;
};

type LoaderLike = {
  loadAsync(url: string): Promise<{ scene?: Object3DLike; scenes?: Object3DLike[]; animations?: any[] }>;
};

type UgcTransform = {
  position?: unknown;
  rotation?: unknown;
  scale?: unknown;
};

type UgcItemManifest = {
  apiVersion?: unknown;
  kind?: unknown;
  modelUrl?: unknown;
  slot?: unknown;
  attachBone?: unknown;
  transform?: UgcTransform;
  particles?: unknown[];
  clips?: Record<string, unknown>;
};

type UgcParticleManifest = {
  id: string;
  enabled: boolean;
  motion: string;
  facing: "billboard" | "front" | "ground";
  url: string;
  color: string;
  transform: UgcTransform;
  rate: number;
  count: number;
  size: number;
  spread: number;
  speed: number;
  verticalSpeed: number;
  lifetime: number;
  opacity: number;
  spin: number;
};

type UgcEquipmentItem = {
  id: string;
  key: string;
  name: string;
  kind: "avatar-item" | "character-morph" | "animation-pack";
  url: string;
  slot: string;
  manifest?: UgcItemManifest;
};

type UgcEquipmentPayload = {
  apiVersion?: unknown;
  users?: Record<string, {
    userId?: unknown;
    updatedAt?: unknown;
    items?: unknown[];
  }>;
};

type ServiceConfig = {
  THREE: ThreeLike;
  loader: LoaderLike;
  windowRef: Window;
  localStorage: Storage;
  apiBase?: string;
  fetcher?: typeof fetch;
  diagnostics?: {
    warn?(event: string, payload?: unknown): void;
    info?(event: string, payload?: unknown): void;
  };
  getLocalPlayerId?(): unknown;
  localAnimation?: LocalAnimationState;
};

type QueueEntry = {
  resolve(items: UgcEquipmentItem[]): void;
};

type AppliedRecord = {
  signature: string;
  objects: Object3DLike[];
  animationClips?: Record<string, AnimationClip> | null;
};

type RuntimeParticleGroup = {
  group: Object3DLike;
  emitter: UgcParticleManifest;
  children: Object3DLike[];
};

const DEFAULT_API_BASE = "https://vweb.irongiant.vip";
const EQUIPPED_STORAGE_KEY = "vwebUgcEquippedV1";
const EQUIPMENT_CACHE_MS = 60_000;

export class AvatarUgcEquipmentRuntimeService {
  private config: ServiceConfig | null = null;
  private readonly equipmentCache = new Map<number, { expiresAt: number; items: UgcEquipmentItem[] }>();
  private readonly assetCache = new Map<string, Promise<Object3DLike | null>>();
  private readonly animationClipCache = new Map<string, Promise<Record<string, AnimationClip> | null>>();
  private readonly textureCache = new Map<string, Promise<any>>();
  private readonly particleGroups = new Set<RuntimeParticleGroup>();
  private readonly pendingIds = new Set<number>();
  private readonly pendingResolvers = new Map<number, QueueEntry[]>();
  private flushTimer: number | null = null;
  private applied = new WeakMap<Object3DLike, AppliedRecord>();
  private appliedCount = 0;
  private skippedCount = 0;
  private failedCount = 0;
  private particleEmitterCount = 0;

  configure(config: ServiceConfig): this {
    this.config = config;
    return this;
  }

  applyToLocal(root: unknown, avatar?: unknown): Promise<void> {
    const id = normalizeUserId(readField(avatar, ["id", "user_id", "userId", "player_id", "playerId"]) ?? this.config?.getLocalPlayerId?.());
    return this.applyToAvatarRoot(id, root, { useLocalFallback: true });
  }

  applyToRemote(userId: unknown, rootOrMeshes: unknown): Promise<void> {
    return this.applyToAvatarRoot(normalizeUserId(userId), rootOrMeshes, { useLocalFallback: false });
  }

  clear(root: unknown): void {
    const target = readAvatarRoot(root);
    if (!target) return;
    this.clearApplied(target);
  }

  snapshot(): {
    configured: boolean;
    cachedUsers: number;
    cachedAssets: number;
    cachedAnimationPacks: number;
    pendingUsers: number;
    applied: number;
    skipped: number;
    failed: number;
    particles: number;
  } {
    return {
      configured: Boolean(this.config),
      cachedUsers: this.equipmentCache.size,
      cachedAssets: this.assetCache.size,
      cachedAnimationPacks: this.animationClipCache.size,
      pendingUsers: this.pendingIds.size,
      applied: this.appliedCount,
      skipped: this.skippedCount,
      failed: this.failedCount,
      particles: this.particleEmitterCount
    };
  }

  update(dt: number): void {
    if (!this.particleGroups.size) return;
    const now = performance.now?.() || Date.now();
    for (const record of this.particleGroups) updateRuntimeParticleGroup(record, now / 1000, dt);
  }

  private async applyToAvatarRoot(userId: number | null, root: unknown, options: { useLocalFallback: boolean }): Promise<void> {
    const target = readAvatarRoot(root);
    if (!target || !this.config) return;
    const animationTarget = this.animationTargetFor(root, options.useLocalFallback);

    const remoteItems = userId ? await this.fetchEquipmentForUser(userId) : [];
    const items = remoteItems.length || !options.useLocalFallback ? remoteItems : this.readLocalEquipment();
    const signature = items.map((item) => `${item.id}:${item.key}:${item.slot}:${item.url}`).sort().join("|");
    if (this.applied.get(target)?.signature === signature) return;

    this.clearApplied(target);
    if (!items.length) {
      this.setAnimationClips(animationTarget, null);
      this.applied.set(target, { signature, objects: [], animationClips: null });
      return;
    }

    const objects: Object3DLike[] = [];
    let animationClips: Record<string, AnimationClip> | null = null;
    for (const item of items) {
      if (item.kind === "animation-pack") {
        const clips = await this.createAnimationPack(item);
        if (clips) animationClips = { ...(animationClips || {}), ...clips };
        continue;
      }
      if (item.kind !== "avatar-item") {
        this.skippedCount += 1;
        continue;
      }
      const object = await this.createAttachment(item);
      if (!object) continue;
      const parent = this.resolveAttachmentParent(target, item);
      parent.add?.(object);
      objects.push(object);
      this.appliedCount += 1;
    }
    this.setAnimationClips(animationTarget, animationClips);
    this.applied.set(target, { signature, objects, animationClips });
  }

  private async createAttachment(item: UgcEquipmentItem): Promise<Object3DLike | null> {
    const config = this.config;
    if (!config) return null;
    const url = resolveUrl(String(item.manifest?.modelUrl || item.url), this.apiBase());
    if (!url) return null;
    const source = await this.loadModel(url);
    if (!source) return null;
    const clone = source.clone?.(true) ?? source;
    this.prepareAttachmentMesh(clone);

    const itemGroup = typeof config.THREE.Group === "function" ? new config.THREE.Group() as Object3DLike : clone;
    itemGroup.name = `VWEB_UGC_${safeName(item.name || item.id)}`;
    itemGroup.userData = { ...(itemGroup.userData || {}), vwebRuntimeKind: "avatar-ugc-item", vwebUgcItemId: item.id };
    if (itemGroup !== clone) itemGroup.add?.(clone);
    applyTransform(itemGroup, item.manifest?.transform);

    const anchor = typeof config.THREE.Group === "function" ? new config.THREE.Group() as Object3DLike : itemGroup;
    anchor.name = `VWEB_UGC_Anchor_${safeName(item.slot || item.id)}`;
    anchor.userData = { ...(anchor.userData || {}), vwebRuntimeKind: "avatar-ugc", vwebUgcItemId: item.id };
    if (anchor !== itemGroup) {
      const slotPosition = localSlotPosition(item.slot);
      anchor.position?.set?.(slotPosition[0], slotPosition[1], slotPosition[2]);
      anchor.rotation?.set?.(0, 0, 0);
      anchor.scale?.set?.(1, 1, 1);
      anchor.add?.(itemGroup);
    }
    this.attachParticles(anchor, item);
    return anchor;
  }

  private async loadModel(url: string): Promise<Object3DLike | null> {
    const cached = this.assetCache.get(url);
    if (cached) return cached;
    const promise = this.config!.loader.loadAsync(url)
      .then((asset) => asset.scene ?? asset.scenes?.[0] ?? null)
      .catch((error) => {
        this.failedCount += 1;
        this.warn("avatar.ugc.model.failed", { url, error: errorMessage(error) });
        return null;
      });
    this.assetCache.set(url, promise);
    return promise;
  }

  private async createAnimationPack(item: UgcEquipmentItem): Promise<Record<string, AnimationClip> | null> {
    const config = this.config;
    if (!config) return null;
    const clipMap = normalizeClipMap(item.manifest?.clips);
    const url = resolveAnimationPackUrl(item, this.apiBase());
    if (!url) return null;
    const cacheKey = `${url}|${Object.entries(clipMap).sort().map(([slot, clip]) => `${slot}:${clip}`).join("|")}`;
    const cached = this.animationClipCache.get(cacheKey);
    if (cached) return cached;
    const promise = loadGltfAnimationClipMap({
      loader: config.loader,
      url,
      THREE: config.THREE,
      slots: clipMap
    }).catch((error) => {
      this.failedCount += 1;
      this.warn("avatar.ugc.animation-pack.failed", { item: item.id, url, error: errorMessage(error) });
      return null;
    });
    this.animationClipCache.set(cacheKey, promise);
    return promise;
  }

  private prepareAttachmentMesh(root: Object3DLike): void {
    root.traverse?.((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
  }

  private attachParticles(anchor: Object3DLike, item: UgcEquipmentItem): void {
    const particles = normalizeParticleManifests(item.manifest?.particles, this.apiBase());
    if (!particles.length || !this.config) return;
    for (const emitter of particles) {
      const group = this.createParticleGroup(item, emitter);
      if (!group) continue;
      anchor.add?.(group.group);
      this.particleGroups.add(group);
      this.particleEmitterCount += 1;
    }
  }

  private createParticleGroup(item: UgcEquipmentItem, emitter: UgcParticleManifest): RuntimeParticleGroup | null {
    const THREE = this.config?.THREE;
    if (!THREE || typeof THREE.Group !== "function") return null;
    const group = new THREE.Group() as Object3DLike;
    group.name = `VWEB_UGC_Particles_${safeName(item.id)}_${safeName(emitter.id)}`;
    group.userData = {
      ...(group.userData || {}),
      vwebRuntimeKind: "avatar-ugc-particles",
      vwebUgcItemId: item.id,
      vwebParticleEmitterId: emitter.id
    };
    applyTransform(group, emitter.transform);

    const children: Object3DLike[] = [];
    const materialPromise = this.createParticleMaterial(emitter);
    const count = clampNumber(emitter.count, 1, 180, 24);
    const planeGeometry = emitter.facing === "billboard" ? null : new THREE.PlaneGeometry(1, 1);
    for (let index = 0; index < count; index += 1) {
      const particle = emitter.facing === "billboard"
        ? new THREE.Sprite(new THREE.SpriteMaterial({ color: emitter.color, transparent: true, opacity: emitter.opacity, depthWrite: false }))
        : new THREE.Mesh(planeGeometry, new THREE.MeshBasicMaterial({ color: emitter.color, transparent: true, opacity: emitter.opacity, depthWrite: false, side: THREE.DoubleSide }));
      particle.name = `VWEB_UGC_Particle_${safeName(emitter.id)}_${index}`;
      particle.userData = {
        ...(particle.userData || {}),
        vwebRuntimeKind: "avatar-ugc-particle",
        vwebParticleHome: createParticleHome(THREE, emitter, index, count),
        vwebParticleOffset: count > 0 ? index / count : 0,
        vwebParticleSeed: seeded(index)
      };
      applyParticleScale(particle, emitter);
      applyStaticParticleFacing(particle, emitter.facing);
      group.add?.(particle);
      children.push(particle);
      materialPromise.then((material) => {
        if (!material) return;
        particle.material?.dispose?.();
        particle.material = material.clone ? material.clone() : material;
      }).catch((error) => this.warn("avatar.ugc.particle.material.failed", { item: item.id, emitter: emitter.id, error: errorMessage(error) }));
    }
    return { group, emitter, children };
  }

  private async createParticleMaterial(emitter: UgcParticleManifest): Promise<any> {
    const THREE = this.config?.THREE;
    if (!THREE) return null;
    const texture = emitter.url ? await this.loadTexture(emitter.url) : createFallbackParticleTexture(THREE, emitter.color);
    const options = {
      map: texture,
      color: new THREE.Color(emitter.color || "#ffffff"),
      transparent: true,
      opacity: clampNumber(emitter.opacity, 0.05, 1, 0.86),
      depthWrite: false,
      depthTest: true
    };
    return emitter.facing === "billboard"
      ? new THREE.SpriteMaterial(options)
      : new THREE.MeshBasicMaterial({ ...options, side: THREE.DoubleSide });
  }

  private async loadTexture(url: string): Promise<any> {
    const cached = this.textureCache.get(url);
    if (cached) return cached;
    const THREE = this.config?.THREE;
    const promise = new Promise<any>((resolve) => {
      if (!THREE?.TextureLoader) {
        resolve(null);
        return;
      }
      new THREE.TextureLoader().load(url, (texture: any) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        texture.needsUpdate = true;
        resolve(texture);
      }, undefined, (error: unknown) => {
        this.failedCount += 1;
        this.warn("avatar.ugc.particle.texture.failed", { url, error: errorMessage(error) });
        resolve(createFallbackParticleTexture(THREE, "#ffffff"));
      });
    });
    this.textureCache.set(url, promise);
    return promise;
  }

  private resolveAttachmentParent(root: Object3DLike, item: UgcEquipmentItem): Object3DLike {
    const boneName = String(item.manifest?.attachBone || slotDefaultBone(item.slot) || "").trim();
    if (!boneName) return root;
    const bones = new Map<string, Object3DLike>();
    root.traverse?.((node) => {
      if (!node.isBone || !node.name) return;
      for (const alias of runtimeBoneAliases(node.name)) bones.set(alias.toLowerCase(), node);
    });
    for (const alias of runtimeBoneAliases(boneName)) {
      const bone = bones.get(alias.toLowerCase());
      if (bone) return bone;
    }
    return root;
  }

  private fetchEquipmentForUser(userId: number): Promise<UgcEquipmentItem[]> {
    const cached = this.equipmentCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.items);

    this.pendingIds.add(userId);
    const promise = new Promise<UgcEquipmentItem[]>((resolve) => {
      const entries = this.pendingResolvers.get(userId) ?? [];
      entries.push({ resolve });
      this.pendingResolvers.set(userId, entries);
    });
    if (this.flushTimer === null) {
      this.flushTimer = this.config?.windowRef.setTimeout(() => this.flushEquipmentQueue(), 30) ?? null;
    }
    return promise;
  }

  private async flushEquipmentQueue(): Promise<void> {
    const config = this.config;
    if (!config) return;
    this.flushTimer = null;
    const ids = [...this.pendingIds].slice(0, 64);
    this.pendingIds.clear();
    if (!ids.length) return;

    let records = new Map<number, UgcEquipmentItem[]>();
    try {
      const url = new URL("/ugc/equipment", this.apiBase());
      url.searchParams.set("ids", ids.join(","));
      const response = await this.fetcher()(url.toString(), {
        credentials: "omit",
        cache: "no-store",
        headers: { accept: "application/json" }
      });
      if (response.ok) {
        records = normalizeEquipmentPayload(await response.json().catch(() => null));
      }
    } catch (error) {
      this.warn("avatar.ugc.equipment.failed", { ids, error: errorMessage(error) });
    }

    for (const id of ids) {
      const items = records.get(id) ?? [];
      this.equipmentCache.set(id, { expiresAt: Date.now() + EQUIPMENT_CACHE_MS, items });
      const resolvers = this.pendingResolvers.get(id) ?? [];
      this.pendingResolvers.delete(id);
      for (const entry of resolvers) entry.resolve(items);
    }
  }

  private readLocalEquipment(): UgcEquipmentItem[] {
    try {
      const raw = this.config?.localStorage.getItem(EQUIPPED_STORAGE_KEY);
      const values = raw ? JSON.parse(raw) : [];
      return Array.isArray(values) ? values.map(normalizeEquipmentItem).filter(isEquipmentItem) : [];
    } catch {
      return [];
    }
  }

  private apiBase(): string {
    return this.config?.apiBase || DEFAULT_API_BASE;
  }

  private fetcher(): typeof fetch {
    const config = this.config;
    return config?.fetcher ?? config!.windowRef.fetch.bind(config!.windowRef);
  }

  private warn(event: string, payload?: unknown): void {
    this.config?.diagnostics?.warn?.(event, payload);
  }

  private clearApplied(root: Object3DLike): void {
    const record = this.applied.get(root);
    if (!record) return;
    this.setAnimationClips(this.animationTargetFor(root, false), null);
    for (const object of record.objects) {
      this.disposeAppliedObject(object);
      object.parent?.remove?.(object);
    }
    this.applied.delete(root);
  }

  private disposeAppliedObject(root: Object3DLike): void {
    root.traverse?.((object) => {
      if (object.userData?.vwebRuntimeKind === "avatar-ugc-particles") {
        for (const record of [...this.particleGroups]) {
          if (record.group === object) {
            this.particleGroups.delete(record);
            this.particleEmitterCount = Math.max(0, this.particleEmitterCount - 1);
          }
        }
      }
      if (object.userData?.vwebRuntimeKind !== "avatar-ugc-particle") return;
      object.geometry?.dispose?.();
      object.material?.dispose?.();
    });
  }

  private animationTargetFor(rootOrMeshes: unknown, local: boolean): { animationClips?: Record<string, AnimationClip> | null } | LocalAnimationState | null {
    if (local) return this.config?.localAnimation || null;
    if (!rootOrMeshes || typeof rootOrMeshes !== "object") return null;
    const meshes = rootOrMeshes as { grp?: unknown; animationClips?: Record<string, AnimationClip> | null };
    return meshes.grp ? meshes : null;
  }

  private setAnimationClips(target: { animationClips?: Record<string, AnimationClip> | null } | null, clips: Record<string, AnimationClip> | null): void {
    if (!target) return;
    target.animationClips = clips;
  }
}

function normalizeEquipmentPayload(payload: unknown): Map<number, UgcEquipmentItem[]> {
  const result = new Map<number, UgcEquipmentItem[]>();
  const raw = payload as UgcEquipmentPayload | null;
  if (!raw || raw.apiVersion !== 1 || !raw.users || typeof raw.users !== "object") return result;
  for (const [key, value] of Object.entries(raw.users)) {
    const userId = normalizeUserId(value?.userId ?? key);
    if (!userId) continue;
    const items = Array.isArray(value?.items) ? value.items.map(normalizeEquipmentItem).filter(isEquipmentItem) : [];
    result.set(userId, items);
  }
  return result;
}

function normalizeEquipmentItem(input: unknown): UgcEquipmentItem | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const manifest = normalizeManifest(value.manifest);
  const url = cleanText(value.url ?? manifest?.modelUrl, 1024);
  const key = cleanText(value.key ?? value.id, 220);
  if (!url || !key) return null;
  return {
    id: cleanText(value.id, 120) || key,
    key,
    name: cleanText(value.name, 96) || key.split("/").pop() || key,
    kind: normalizeKind(value.kind ?? value.ugcKind ?? manifest?.kind),
    url,
    slot: cleanText(value.slot ?? manifest?.slot, 48),
    ...(manifest ? { manifest } : {})
  };
}

function normalizeManifest(input: unknown): UgcItemManifest | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as UgcItemManifest;
  const manifest: UgcItemManifest = {
    apiVersion: raw.apiVersion,
    kind: raw.kind,
    modelUrl: raw.modelUrl,
    slot: raw.slot,
    attachBone: raw.attachBone
  };
  if (raw.transform !== undefined) manifest.transform = raw.transform;
  if (Array.isArray(raw.particles)) manifest.particles = raw.particles;
  if (raw.clips && typeof raw.clips === "object") manifest.clips = raw.clips;
  return manifest;
}

function normalizeParticleManifests(input: unknown, base: string): UgcParticleManifest[] {
  if (!Array.isArray(input)) return [];
  return input.map((value, index) => normalizeParticleManifest(value, index, base)).filter(isParticleManifest);
}

function normalizeParticleManifest(input: unknown, index: number, base: string): UgcParticleManifest | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const url = resolveUrl(cleanText(raw.url ?? raw.fileUrl ?? raw.fileId, 1024), base);
  return {
    id: cleanText(raw.id, 80) || `emitter-${index + 1}`,
    enabled: raw.enabled === true,
    motion: cleanText(raw.motion, 32) || "aura",
    facing: normalizeParticleFacing(raw.facing),
    url,
    color: normalizeColor(raw.color),
    transform: normalizeTransform(raw.transform),
    rate: clampNumber(raw.rate, 0, 120, 18),
    count: Math.round(clampNumber(raw.count, 1, 180, 24)),
    size: clampNumber(raw.size, 0.01, 1.5, 0.08),
    spread: clampNumber(raw.spread, 0, 5, 0.58),
    speed: clampNumber(raw.speed, 0, 5, 0.28),
    verticalSpeed: clampNumber(raw.verticalSpeed ?? raw.rise, -5, 5, 0.22),
    lifetime: clampNumber(raw.lifetime, 0.1, 10, 1.8),
    opacity: clampNumber(raw.opacity, 0.02, 1, 0.86),
    spin: clampNumber(raw.spin, -12, 12, 0.8)
  };
}

function isParticleManifest(value: UgcParticleManifest | null): value is UgcParticleManifest {
  return Boolean(value?.enabled);
}

function normalizeParticleFacing(value: unknown): "billboard" | "front" | "ground" {
  return value === "front" || value === "ground" ? value : "billboard";
}

function normalizeTransform(value: unknown): UgcTransform {
  const raw = value && typeof value === "object" ? value as UgcTransform : {};
  return {
    position: vector3(raw.position, [0, 0, 0]),
    rotation: vector3(raw.rotation, [0, 0, 0]),
    scale: vector3(raw.scale, [1, 1, 1])
  };
}

function isEquipmentItem(item: UgcEquipmentItem | null): item is UgcEquipmentItem {
  return Boolean(item);
}

function normalizeKind(value: unknown): UgcEquipmentItem["kind"] {
  if (value === "character-morph" || value === "animation-pack") return value;
  return "avatar-item";
}

function normalizeClipMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [slot, raw] of Object.entries(value as Record<string, unknown>)) {
    const clip = String(raw || "").trim();
    const parsed = clip.includes("#") ? clip.split("#").pop() || "" : clip;
    if (slot && parsed) out[slot] = parsed;
  }
  return out;
}

function resolveAnimationPackUrl(item: UgcEquipmentItem, base: string): string {
  const values = [
    item.manifest?.modelUrl,
    ...Object.values(item.manifest?.clips || {}).map((value) => String(value || "").split("#")[0]),
    item.url
  ];
  for (const value of values) {
    const url = resolveUrl(String(value || ""), base);
    if (url) return url;
  }
  return "";
}

function normalizeUserId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function readAvatarRoot(value: unknown): Object3DLike | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { grp?: unknown };
  const root = record.grp ?? value;
  return root && typeof root === "object" ? root as Object3DLike : null;
}

function readField(input: unknown, names: string[]): unknown {
  if (!input || typeof input !== "object") return undefined;
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (wanted.has(key.toLowerCase())) return value;
  }
  return undefined;
}

function slotDefaultBone(slot: string): string {
  const match = (Object.keys(AVATAR_SLOT_BONES) as AvatarAttachmentSlot[])
    .find((candidate) => candidate.toLowerCase() === String(slot || "").toLowerCase());
  return match ? AVATAR_SLOT_BONES[match] : "";
}

function applyTransform(object: Object3DLike, transform: UgcTransform | undefined): void {
  const position = vector3(transform?.position, [0, 0, 0]);
  const rotation = vector3(transform?.rotation, [0, 0, 0]);
  const scale = vector3(transform?.scale, [1, 1, 1]);
  object.position?.set?.(position[0], position[1], position[2]);
  object.rotation?.set?.(degreesToRadians(rotation[0]), degreesToRadians(rotation[1]), degreesToRadians(rotation[2]));
  object.scale?.set?.(scale[0], scale[1], scale[2]);
}

function localSlotPosition(slot: string): [number, number, number] {
  switch (slot) {
    case "Hat": return [0, 0.58, 0];
    case "Face": return [0, 0.05, -0.56];
    case "Mask": return [0, 0.02, -0.62];
    case "Back": return [0, 0.1, 0.55];
    case "LeftHand": return [0, -0.08, 0.08];
    case "RightHand": return [0, -0.08, 0.08];
    case "LeftFoot": return [0, -0.12, 0.04];
    case "RightFoot": return [0, -0.12, 0.04];
    case "Torso": return [0, 0.1, -0.56];
    case "Shoulder":
    case "Shoulders":
    case "LeftShoulder":
    case "RightShoulder":
      return [0.48, 0.34, 0];
    default: return [0, 0, 0];
  }
}

function degreesToRadians(value: number): number {
  return (Number(value) || 0) * Math.PI / 180;
}

function updateRuntimeParticleGroup(record: RuntimeParticleGroup, time: number, dt: number): void {
  const emitter = record.emitter;
  for (const particle of record.children) {
    const home = particle.userData?.vwebParticleHome as { x: number; y: number; z: number } | undefined;
    const offset = Number(particle.userData?.vwebParticleOffset || 0);
    const seed = Number(particle.userData?.vwebParticleSeed || 0);
    if (home) particle.position?.set?.(home.x, home.y, home.z);

    const lifetime = Math.max(0.1, emitter.lifetime || 1.8);
    const speed = Math.max(0, emitter.speed || 0.28);
    const spin = Number(emitter.spin || 0);
    const age = (time * Math.max(0.05, speed) + offset) % lifetime;
    const normalizedAge = age / lifetime;
    const spread = Math.max(0.001, emitter.spread || 0.58);
    const rise = Number(emitter.verticalSpeed || 0);
    const angle = offset * Math.PI * 2 + time * spin;

    if (emitter.motion === "fountain") {
      particle.position!.y = Number(particle.position?.y || 0) + normalizedAge * rise * 2.2;
      particle.position!.x = Number(particle.position?.x || 0) + Math.sin(offset * 19) * spread * normalizedAge * 0.45;
      particle.position!.z = Number(particle.position?.z || 0) + Math.cos(offset * 23) * spread * normalizedAge * 0.45;
    } else if (emitter.motion === "orbit") {
      particle.position?.set?.(Math.cos(angle) * spread, Math.sin(time * 2.4 + offset * 7) * rise * 0.18, Math.sin(angle) * spread);
    } else if (emitter.motion === "burst" || emitter.motion === "shockwave") {
      const radius = spread * (0.25 + normalizedAge * 1.75);
      particle.position?.set?.(Math.cos(angle) * radius, Number(particle.position?.y || 0) + Math.sin(normalizedAge * Math.PI) * rise * 0.2, Math.sin(angle) * radius);
    } else if (emitter.motion === "beam") {
      particle.position!.y = ((offset + time * speed * 0.18) % 1 - 0.5) * spread * 3.4;
    } else if (emitter.motion === "helix") {
      particle.position?.set?.(Math.cos(angle * 2) * spread * 0.5, (offset - 0.5) * spread * 2.8 + Math.sin(time * 2 + offset * 9) * rise * 0.1, Math.sin(angle * 2) * spread * 0.5);
    } else {
      particle.position!.y = Number(particle.position?.y || 0) + Math.sin(time * 2 + offset * Math.PI * 2) * rise * 0.12;
    }

    applyParticleSpin(particle, time * spin + offset * Math.PI * 2, emitter.facing);
    const fade = emitter.motion === "fountain" || emitter.motion === "burst" || emitter.motion === "shockwave"
      ? 1 - normalizedAge
      : 0.78 + Math.sin(time * 3 + offset * 8 + seed) * 0.18;
    if (particle.material) particle.material.opacity = Math.max(0.02, Math.min(1, emitter.opacity * fade));
  }
  void dt;
}

function createParticleHome(THREE: ThreeLike, emitter: UgcParticleManifest, index: number, count: number): { x: number; y: number; z: number } {
  const phase = count > 0 ? index / count : 0;
  const angle = phase * Math.PI * 2;
  const radius = Math.max(0.02, emitter.spread || 0.58);
  const spiral = emitter.motion === "trail" ? phase : Math.sqrt((index * 37 % Math.max(1, count)) / Math.max(1, count));
  if (emitter.motion === "beam") return { x: (seeded(index) - 0.5) * radius * 0.16, y: (phase - 0.5) * radius * 3.2, z: 0 };
  if (emitter.motion === "shockwave") return { x: Math.cos(angle) * radius, y: 0, z: Math.sin(angle) * radius };
  void THREE;
  return { x: Math.cos(angle) * radius * spiral, y: (index % 7) * 0.11, z: Math.sin(angle) * radius * spiral };
}

function applyParticleScale(particle: Object3DLike, emitter: UgcParticleManifest): void {
  const x = (emitter.size || 0.08) * (emitter.motion === "beam" ? 2.2 : emitter.motion === "shockwave" ? 3.2 : 2.4);
  const y = (emitter.size || 0.08) * (emitter.motion === "beam" ? 7.5 : emitter.motion === "shockwave" ? 3.2 : 2.4);
  particle.scale?.set?.(x, y, 1);
}

function applyParticleSpin(particle: Object3DLike, radians: number, facing: UgcParticleManifest["facing"]): void {
  if (particle.isSprite) {
    if (particle.material) particle.material.rotation = radians;
    return;
  }
  applyStaticParticleFacing(particle, facing);
  particle.rotateZ?.(radians);
}

function applyStaticParticleFacing(particle: Object3DLike, facing: UgcParticleManifest["facing"]): void {
  particle.rotation?.set?.(0, 0, 0);
  if (facing === "ground" && particle.rotation) particle.rotation.x = -Math.PI / 2;
}

function createFallbackParticleTexture(THREE: ThreeLike, color: string): any {
  const documentRef = globalThis.document;
  if (!documentRef?.createElement || !THREE?.CanvasTexture) return null;
  const canvas = documentRef.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, 128, 128);
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 60);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.3, color);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(64, 64, 48, 0, Math.PI * 2);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function normalizeColor(value: unknown): string {
  const text = String(value || "#ffffff").trim();
  return /^#[0-9a-f]{3,8}$/i.test(text) ? text : "#ffffff";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(min, Math.min(max, next)) : fallback;
}

function seeded(value: number): number {
  return (value * 16807 % 2147483647) / 2147483647;
}

function vector3(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(value)) return fallback;
  const next: [number, number, number] = [Number(value[0]), Number(value[1]), Number(value[2])];
  return next.every(Number.isFinite) ? next : fallback;
}

function resolveUrl(value: string, base: string): string {
  try {
    return new URL(value, base).toString();
  } catch {
    return "";
  }
}

function cleanText(value: unknown, max: number): string {
  return String(value || "").trim().replace(/[^\x20-\x7e]/g, "").slice(0, max);
}

function safeName(value: unknown): string {
  return cleanText(value, 80).replace(/[^a-zA-Z0-9_-]+/g, "-") || "item";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "unknown error");
}
