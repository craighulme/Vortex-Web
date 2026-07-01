import type {
  RemotePlayerRecord,
  RemoteRenderBudgetSnapshot,
  RemoteRenderProfile,
  RemoteRenderProfileRow,
  RuntimeMaterial,
  RuntimeObject3D,
  ThreeLike
} from "./RemotePlayerTypes";

const REMOTE_SHADOW_BUDGET = 6;
const REMOTE_SHADOW_DISTANCE = 160;
const REMOTE_FULL_AVATAR_BUDGET = 10;
const REMOTE_ACTIVE_FULL_EXTRA = 4;
const REMOTE_ALWAYS_FULL_DISTANCE = 28;
const REMOTE_ACTIVE_FULL_DISTANCE = 110;

export class RemoteRenderBudgetService {
  private lastBudget: RemoteRenderBudgetSnapshot = emptyBudgetSnapshot();

  constructor(private readonly THREE: ThreeLike) {}

  profile(remotes: Map<unknown, RemotePlayerRecord> | null | undefined, now = performance.now()): RemoteRenderProfile & { budget: RemoteRenderBudgetSnapshot } {
    const rows: RemoteRenderProfileRow[] = [];
    const totals = {
      remotes: 0,
      visible: 0,
      meshes: 0,
      skinnedMeshes: 0,
      sprites: 0,
      materials: 0,
      uniqueGeometries: 0,
      uniqueTextures: 0,
      shadowCasters: 0,
      shadowReceivers: 0,
      animatedActive: 0
    };

    for (const [id, remote] of remotes || []) {
      totals.remotes += 1;
      const row = this.profileRemote(String(id), remote, now);
      rows.push(row);
      if (row.visible) totals.visible += 1;
      totals.meshes += row.meshes;
      totals.skinnedMeshes += row.skinnedMeshes;
      totals.sprites += row.sprites;
      totals.materials += row.materials;
      totals.uniqueGeometries += row.uniqueGeometries;
      totals.uniqueTextures += row.uniqueTextures;
      totals.shadowCasters += row.shadowCasters;
      totals.shadowReceivers += row.shadowReceivers;
      if (row.anim && row.anim !== "idle") totals.animatedActive += 1;
    }

    rows.sort((a, b) => b.meshes + b.materials - (a.meshes + a.materials));
    return { totals, rows, budget: { ...this.lastBudget } };
  }

  updateRenderBudget(
    remotes: Map<unknown, RemotePlayerRecord> | null | undefined,
    cameraPosition: { x?: unknown; y?: unknown; z?: unknown } | null | undefined
  ): RemoteRenderBudgetSnapshot {
    this.lastBudget = this.applyRenderBudget(remotes, cameraPosition);
    return { ...this.lastBudget };
  }

  private profileRemote(id: string, remote: RemotePlayerRecord, now: number): RemoteRenderProfileRow {
    const group = remote.meshes?.grp;
    const stats = {
      meshes: 0,
      skinnedMeshes: 0,
      sprites: 0,
      shadowCasters: 0,
      shadowReceivers: 0
    };
    const materials = new Set<unknown>();
    const geometries = new Set<unknown>();
    const textures = new Set<unknown>();

    if (group?.visible) {
      safeTraverse(group, (object) => {
        if (object.isSprite) stats.sprites += 1;
        if (!object.isMesh) return;
        stats.meshes += 1;
        if (object.isSkinnedMesh) stats.skinnedMeshes += 1;
        if (object.castShadow) stats.shadowCasters += 1;
        if (object.receiveShadow) stats.shadowReceivers += 1;
        if (object.geometry) geometries.add(object.geometry);
        for (const material of materialList(object.material)) {
          materials.add(material);
          collectMaterialTextures(material, textures);
        }
      });
    }

    const proxy = remote.meshes?.proxy;
    if (proxy?.visible) {
      safeTraverse(proxy, (object) => {
        if (object.isSprite) stats.sprites += 1;
        if (!object.isMesh) return;
        stats.meshes += 1;
        if (object.isSkinnedMesh) stats.skinnedMeshes += 1;
        if (object.castShadow) stats.shadowCasters += 1;
        if (object.receiveShadow) stats.shadowReceivers += 1;
        if (object.geometry) geometries.add(object.geometry);
        for (const material of materialList(object.material)) {
          materials.add(material);
          collectMaterialTextures(material, textures);
        }
      });
    }

    const visibleRoot = group?.visible ? group : proxy?.visible ? proxy : group;
    const bounds = this.readVisualBounds(visibleRoot);
    const positionY = numberOrNull(visibleRoot?.position?.y);

    return {
      id,
      username: String(remote.username || ""),
      visible: Boolean(group?.visible || proxy?.visible),
      meshes: stats.meshes,
      skinnedMeshes: stats.skinnedMeshes,
      sprites: stats.sprites,
      materials: materials.size,
      uniqueGeometries: geometries.size,
      uniqueTextures: textures.size,
      shadowCasters: stats.shadowCasters,
      shadowReceivers: stats.shadowReceivers,
      anim: String(remote.anim || "idle"),
      ageMs: Number(remote.seen) ? Math.round(now - Number(remote.seen)) : null,
      positionY,
      visualMinY: bounds?.minY ?? null,
      visualMaxY: bounds?.maxY ?? null,
      visualFootDelta: positionY === null || bounds?.minY === undefined ? null : roundNumber(bounds.minY - positionY)
    };
  }

  private applyRenderBudget(
    remotes: Map<unknown, RemotePlayerRecord> | null | undefined,
    cameraPosition: { x?: unknown; y?: unknown; z?: unknown } | null | undefined
  ): RemoteRenderBudgetSnapshot {
    const camera = readVec3(cameraPosition);
    if (!camera) return emptyBudgetSnapshot();
    const candidates: Array<{ remote: RemotePlayerRecord; distance: number; active: boolean }> = [];
    for (const remote of remotes?.values?.() || []) {
      const group = remote.meshes?.grp;
      const proxy = remote.meshes?.proxy;
      const visible = Boolean(group?.visible || proxy?.visible);
      if (!group || !visible) {
        setRemoteCastShadow(remote, false);
        continue;
      }
      const position = readVec3(group.position);
      if (!position) continue;
      const distance = distanceBetween(camera, position);
      const active = remote.anim === "walk" || remote.anim === "jump" || remote.anim === "climb";
      candidates.push({ remote, distance, active });
    }

    candidates.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.distance - b.distance;
    });

    let withShadows = 0;
    let shadowCasters = 0;
    let fullRemotes = 0;
    let proxyRemotes = 0;
    const crowded = candidates.length > REMOTE_FULL_AVATAR_BUDGET + REMOTE_ACTIVE_FULL_EXTRA;
    for (const [index, candidate] of candidates.entries()) {
      const full = candidate.distance <= REMOTE_ALWAYS_FULL_DISTANCE ||
        index < REMOTE_FULL_AVATAR_BUDGET ||
        (candidate.active && candidate.distance <= REMOTE_ACTIVE_FULL_DISTANCE && (!crowded || index < REMOTE_FULL_AVATAR_BUDGET + REMOTE_ACTIVE_FULL_EXTRA));
      setRemoteLod(candidate.remote, full ? "full" : "proxy");
      if (full) fullRemotes += 1;
      else proxyRemotes += 1;
      const allowShadow = withShadows < REMOTE_SHADOW_BUDGET && candidate.distance <= REMOTE_SHADOW_DISTANCE;
      const casters = setRemoteCastShadow(candidate.remote, allowShadow);
      if (allowShadow) {
        withShadows += 1;
        shadowCasters += casters;
      }
    }

    return {
      visibleRemotes: candidates.length,
      fullRemotes,
      proxyRemotes,
      shadowedRemotes: withShadows,
      shadowCasters,
      shadowBudget: REMOTE_SHADOW_BUDGET,
      shadowDistance: REMOTE_SHADOW_DISTANCE
    };
  }

  private readVisualBounds(group: RuntimeObject3D | null | undefined): { minY: number; maxY: number } | null {
    const Box3 = this.THREE.Box3;
    if (!group || !Box3) return null;
    try {
      const box = new Box3().setFromObject(group);
      const minY = numberOrNull(box.min.y);
      const maxY = numberOrNull(box.max.y);
      if (minY === null || maxY === null) return null;
      return { minY, maxY };
    } catch {
      return null;
    }
  }
}

export function syncRemoteProxyTransform(remote: RemotePlayerRecord): void {
  const group = remote.meshes?.grp;
  const proxy = remote.meshes?.proxy;
  if (!group || !proxy) return;
  proxy.position.copy?.(group.position);
  proxy.rotation.y = Number(group.rotation.y || 0);
}

export function emptyBudgetSnapshot(): RemoteRenderBudgetSnapshot {
  return {
    visibleRemotes: 0,
    fullRemotes: 0,
    proxyRemotes: 0,
    shadowedRemotes: 0,
    shadowCasters: 0,
    shadowBudget: REMOTE_SHADOW_BUDGET,
    shadowDistance: REMOTE_SHADOW_DISTANCE
  };
}

function setRemoteCastShadow(remote: RemotePlayerRecord, castShadow: boolean): number {
  let casters = 0;
  const group = remote.meshes?.grp;
  if (!group) return casters;
  safeTraverse(group, (object) => {
    if (!object.isMesh) return;
    object.castShadow = castShadow;
    if (castShadow) casters += 1;
  });
  return casters;
}

function setRemoteLod(remote: RemotePlayerRecord, lod: "full" | "proxy"): void {
  const group = remote.meshes?.grp;
  const proxy = remote.meshes?.proxy;
  if (!group) return;
  if (!proxy || lod === "full") {
    group.visible = true;
    if (proxy) proxy.visible = false;
    return;
  }
  group.visible = false;
  proxy.visible = true;
}

function safeTraverse(root: RuntimeObject3D, visitor: (object: RuntimeObject3D) => void): void {
  try {
    if (typeof root.traverse === "function") {
      root.traverse(visitor);
      return;
    }
  } catch {
    // A partially cloned Three object can have a malformed child graph; traversal should stay best-effort.
  }
  visitor(root);
}

function materialList(material: RuntimeMaterial | RuntimeMaterial[] | undefined): RuntimeMaterial[] {
  if (!material) return [];
  return Array.isArray(material) ? material.filter(Boolean) : [material];
}

function collectMaterialTextures(material: RuntimeMaterial, textures: Set<unknown>): void {
  for (const [key, value] of Object.entries(material as Record<string, unknown>)) {
    if (!/map$/i.test(key)) continue;
    if (value && typeof value === "object") textures.add(value);
  }
}

function numberOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? roundNumber(number) : null;
}

function roundNumber(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function readVec3(value: { x?: unknown; y?: unknown; z?: unknown } | null | undefined): { x: number; y: number; z: number } | null {
  const x = Number(value?.x);
  const y = Number(value?.y);
  const z = Number(value?.z);
  return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
}

function distanceBetween(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
