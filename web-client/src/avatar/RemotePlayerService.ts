import type { NativeAvatarState } from "./AvatarService";
import { RemoteAvatarProxyService } from "./remote/RemoteAvatarProxyService";
import { RemoteNameLabelService } from "./remote/RemoteNameLabelService";
import { RemoteRenderBudgetService, syncRemoteProxyTransform } from "./remote/RemoteRenderBudgetService";
import type {
  RemoteAvatarContext,
  RemotePlayerMeshes,
  RemotePlayerRecord,
  RemotePlayerRuntimeApi,
  RemoteRenderBudgetSnapshot,
  RemoteRenderProfile,
  RigBone,
  RigBoneRest,
  RuntimeObject3D,
  RuntimeSprite,
  ThreeLike
} from "./remote/RemotePlayerTypes";

export type {
  RemoteAvatarContext,
  RemotePlayerMeshes,
  RemotePlayerRecord,
  RemoteRenderBudgetSnapshot,
  RemoteRenderProfile,
  RemoteRenderProfileRow
} from "./remote/RemotePlayerTypes";

type RemotePlayerServiceConfig = {
  THREE: ThreeLike;
  document: Document;
  runtimeApi: RemotePlayerRuntimeApi;
};

type RemotePlayerFrameOptions = {
  remotes: Map<unknown, RemotePlayerRecord>;
  pendingAvatars: Map<unknown, Record<string, unknown>>;
  dt: number;
  now?: number;
  shouldAnimate?: boolean;
  normalizeAvatar: (input: Record<string, unknown>) => NativeAvatarState;
  displayName: (id: unknown, username: unknown) => string;
  noteState: (remote: RemotePlayerRecord, status: string, reason: string) => void;
  animate: (id: unknown, remote: RemotePlayerRecord, dt: number) => void;
  onCreateError?: (error: unknown) => void;
  cameraPosition?: { x?: unknown; y?: unknown; z?: unknown } | null;
};

type RemotePlayerFrameSnapshot = {
  created: number;
  updated: number;
  hidden: number;
  shadowCasters: number;
  pendingCleared: boolean;
};

type RemotePlayerRebuildSnapshot = {
  rebuilt: number;
  failed: number;
};

const REMOTE_LERP = 12;
const REMOTE_STALE_MS = 5000;

export class RemotePlayerService {
  private config: RemotePlayerServiceConfig | null = null;
  private created = 0;
  private disposed = 0;
  private nameLabels: RemoteNameLabelService | null = null;
  private proxies: RemoteAvatarProxyService | null = null;
  private renderBudget: RemoteRenderBudgetService | null = null;

  configure(config: RemotePlayerServiceConfig): this {
    this.config = config;
    this.nameLabels = new RemoteNameLabelService(config.THREE, config.document);
    this.proxies = new RemoteAvatarProxyService(config.THREE, config.runtimeApi);
    this.renderBudget = new RemoteRenderBudgetService(config.THREE);
    return this;
  }

  makeRemote(username: string, _id: number, avatar: NativeAvatarState): RemotePlayerMeshes | null {
    const config = this.assertConfigured();
    const group = this.cloneLocalPlayer();
    if (!group) return null;
    const proxy = this.createRemoteProxy(avatar);

    const nameSprite = this.createNameLabel(username);
    nameSprite.position.y = this.nameLabelY();
    group.add?.(nameSprite);

    const bones: Record<string, RigBone> = {};
    group.traverse((node) => {
      if (!isBone(node)) return;
      const bone = node as RigBone;
      bones[bone.name || ""] = bone;
      bones[boneAlias(bone.name)] = bone;
    });

    const meshes: RemotePlayerMeshes = {
      grp: group,
      proxy,
      bones,
      rest: config.runtimeApi.getAnimRest(),
      shirtMesh: config.runtimeApi.buildShirtOverlay(group),
      pantsMesh: config.runtimeApi.buildPantsOverlay?.(group),
      faceMesh: config.runtimeApi.buildFaceOverlay?.(group),
      nameSprite
    };
    config.runtimeApi.applyAvatarToMeshes?.(meshes, withRemoteAvatarContext(avatar, _id, username));
    this.created += 1;
    return meshes;
  }

  setNameLabel(remote: { meshes?: RemotePlayerMeshes | null } | null | undefined, username: string): void {
    if (!remote?.meshes?.grp) return;
    const oldSprite = remote.meshes.nameSprite;
    if (oldSprite) this.disposeNameSprite(oldSprite);
    const sprite = this.createNameLabel(username);
    sprite.position.y = this.nameLabelY();
    remote.meshes.grp.add?.(sprite);
    remote.meshes.nameSprite = sprite;
  }

  disposeRemote(meshes: RemotePlayerMeshes | null | undefined): void {
    if (!meshes?.grp) return;
    const { runtimeApi } = this.assertConfigured();
    runtimeApi.scene.remove(meshes.grp);
    if (meshes.proxy) runtimeApi.scene.remove(meshes.proxy);
    this.safeTraverse(meshes.grp, (object) => {
      if (object.isSprite) this.disposeNameSprite(object as RuntimeSprite);
    });
    if (meshes.nameSprite) this.disposeNameSprite(meshes.nameSprite);
    this.disposed += 1;
  }

  cloneLocalPlayer(): RuntimeObject3D | null {
    return this.clonePlayer();
  }

  updateFrame(options: RemotePlayerFrameOptions): RemotePlayerFrameSnapshot {
    this.assertConfigured();
    let created = 0;
    let updated = 0;
    let hidden = 0;
    let pendingCleared = false;
    let shadowCasters = 0;

    if (options.pendingAvatars.size > 0 && this.config?.runtimeApi.getCharacter()) {
      for (const [id, info] of options.pendingAvatars) {
        const remote = options.remotes.get(id);
        if (!remote || remote.meshes) continue;
        try {
          remote.avatar = options.normalizeAvatar(info);
          remote.username = options.displayName(id, info.username || remote.username);
          remote.meshes = this.makeRemote(remote.username, Number(id), remote.avatar);
          if (remote.meshes) {
            created += 1;
            this.syncCreatedRemote(remote);
          }
        } catch (error) {
          options.onCreateError?.(error);
        }
      }
      options.pendingAvatars.clear();
      pendingCleared = true;
    }

    const now = options.now ?? performance.now();
    for (const [id, remote] of options.remotes) {
      if (!remote.meshes) continue;
      const group = remote.meshes.grp;
      if (!remote.hasPosition || !remote.tPos) {
        options.noteState(remote, "hidden", "no-position");
        group.visible = false;
        if (remote.meshes.proxy) remote.meshes.proxy.visible = false;
        hidden += 1;
        continue;
      }
      if (now - Number(remote.seen || 0) > REMOTE_STALE_MS) {
        options.noteState(remote, "hidden", "stale-position");
        group.visible = false;
        if (remote.meshes.proxy) remote.meshes.proxy.visible = false;
        hidden += 1;
        continue;
      }

      group.position.lerp?.(remote.tPos, Math.min(1, REMOTE_LERP * options.dt));
      this.rotateTowards(group, Number(remote.tRy || 0), options.dt);
      syncRemoteProxyTransform(remote);
      if (options.shouldAnimate) {
        const animationDt = this.consumeAnimationDelta(remote, options.dt, now);
        if (animationDt > 0) options.animate(id, remote, animationDt);
      }
      updated += 1;
    }

    if (options.cameraPosition) {
      const budget = this.updateRenderBudget(options.remotes, options.cameraPosition);
      shadowCasters = budget.shadowCasters;
    }

    return { created, updated, hidden, shadowCasters, pendingCleared };
  }

  rebuildAll(options: {
    remotes: Map<unknown, RemotePlayerRecord>;
    normalizeAvatar: (input: Record<string, unknown>) => NativeAvatarState;
    onError?: (error: unknown) => void;
  }): RemotePlayerRebuildSnapshot {
    let rebuilt = 0;
    let failed = 0;
    for (const [id, remote] of options.remotes) {
      const old = remote.meshes;
      const visible = old?.grp?.visible;
      const position = old?.grp?.position?.clone?.();
      const yaw = old?.grp?.rotation?.y;
      this.disposeRemote(old);
      remote.meshes = null;
      try {
        const avatar = options.normalizeAvatar(remote.avatar || {});
        remote.avatar = avatar;
        remote.meshes = this.makeRemote(remote.username || String(id), Number(id), avatar);
        if (remote.meshes) {
          if (position) remote.meshes.grp.position.copy?.(position);
          if (Number.isFinite(yaw)) remote.meshes.grp.rotation.y = Number(yaw);
          remote.meshes.grp.visible = Boolean(visible);
          rebuilt += 1;
        }
      } catch (error) {
        failed += 1;
        options.onError?.(error);
      }
    }
    return { rebuilt, failed };
  }

  snapshot(): { configured: boolean; created: number; disposed: number } {
    return {
      configured: Boolean(this.config),
      created: this.created,
      disposed: this.disposed
    };
  }

  profile(remotes: Map<unknown, RemotePlayerRecord> | null | undefined, now = performance.now()): RemoteRenderProfile & { budget: RemoteRenderBudgetSnapshot } {
    if (!this.renderBudget) this.assertConfigured();
    return this.renderBudget!.profile(remotes, now);
  }

  private clonePlayer(): RuntimeObject3D | null {
    const { THREE, runtimeApi } = this.assertConfigured();
    const source = runtimeApi.getCharacter();
    if (!source) return null;
    const clone = source.clone(true);
    clone.userData = clone.userData || {};
    delete clone.userData.vwebModernAvatarMaterials;

    const toRemove: RuntimeObject3D[] = [];
    clone.traverse((object) => {
      if (/Overlay$/.test(object.name || "")) toRemove.push(object);
      if (object.userData) delete object.userData.vwebModernAvatarMaterials;
    });
    for (const object of toRemove) object.parent?.remove?.(object);

    clone.traverse((object) => {
      if (!object.isMesh) return;
      if (Array.isArray(object.material)) {
        object.material = object.material.map((material) => material?.clone ? material.clone() : material);
      } else if (object.material?.clone) {
        object.material = object.material.clone();
      }
      if (object.userData) {
        delete object.userData.vwebClonedBodyMaterials;
        delete object.userData.vwebClonedBodyMaterial;
      }
    });

    const sourceBones: Record<string, RigBone> = {};
    const cloneBones: Record<string, RigBone> = {};
    source.traverse((node) => {
      if (!isBone(node)) return;
      const bone = node as RigBone;
      sourceBones[bone.name || ""] = bone;
      sourceBones[boneAlias(bone.name)] = bone;
    });
    clone.traverse((node) => {
      if (!isBone(node)) return;
      const bone = node as RigBone;
      cloneBones[bone.name || ""] = bone;
      cloneBones[boneAlias(bone.name)] = bone;
    });

    const sourceMeshes: RuntimeObject3D[] = [];
    const cloneMeshes: RuntimeObject3D[] = [];
    source.traverse((mesh) => {
      if (mesh.isSkinnedMesh) sourceMeshes.push(mesh);
    });
    clone.traverse((mesh) => {
      if (mesh.isSkinnedMesh) cloneMeshes.push(mesh);
    });
    sourceMeshes.forEach((sourceMesh, index) => {
      const cloneMesh = cloneMeshes[index];
      if (!cloneMesh?.skeleton || !sourceMesh.skeleton || !sourceMesh.bindMatrix) return;
      const bones = sourceMesh.skeleton.bones.map((bone) => cloneBones[bone.name || ""] || cloneBones[boneAlias(bone.name)] || bone);
      const skeleton = new THREE.Skeleton(bones, sourceMesh.skeleton.boneInverses.map((matrix) => matrix.clone()));
      (cloneMesh as { skeleton: unknown }).skeleton = skeleton;
      cloneMesh.bind?.(skeleton, sourceMesh.bindMatrix.clone());
    });

    const rest = runtimeApi.getAnimRest();
    clone.traverse((node) => {
      if (!isBone(node)) return;
      const bone = node as RigBone;
      const pose = rest[bone.name || ""] || rest[boneAlias(bone.name)];
      if (!pose) return;
      bone.rotation.set?.(Number(pose.x || 0), Number(pose.y || 0), Number(pose.z || 0));
      bone.position.y = Number(pose.py || 0);
    });

    clone.rotation.set?.(0, Math.PI, 0);
    clone.traverse((object) => {
      if (object.isMesh) (object as RuntimeObject3D & { castShadow?: boolean }).castShadow = true;
    });
    clone.visible = false;
    runtimeApi.scene.add(clone);
    return clone;
  }

  private createNameLabel(username: string) {
    if (!this.nameLabels) this.assertConfigured();
    return this.nameLabels!.create(username);
  }

  private disposeNameSprite(sprite: RuntimeSprite): void {
    if (!this.nameLabels) this.assertConfigured();
    this.nameLabels!.dispose(sprite);
  }

  private safeTraverse(root: RuntimeObject3D, visitor: (object: RuntimeObject3D) => void): void {
    try {
      if (typeof root.traverse === "function") {
        root.traverse(visitor);
        return;
      }
    } catch {
      // A partially cloned Three object can have a malformed child graph; disposal should stay best-effort.
    }
    visitor(root);
  }

  private nameLabelY(): number {
    const { runtimeApi } = this.assertConfigured();
    return runtimeApi.getCharHeight() - runtimeApi.getCharFootOffset() + 1.4;
  }

  private syncCreatedRemote(remote: RemotePlayerRecord): void {
    if (!remote.meshes) return;
    if (remote.hasPosition && remote.tPos) {
      remote.meshes.grp.position.copy?.(remote.tPos);
      remote.meshes.grp.rotation.y = Number(remote.tRy || 0);
      remote.meshes.grp.visible = true;
      if (remote.meshes.proxy) {
        remote.meshes.proxy.position.copy?.(remote.tPos);
        remote.meshes.proxy.rotation.y = Number(remote.tRy || 0);
        remote.meshes.proxy.visible = false;
      }
    } else {
      remote.meshes.grp.visible = false;
      if (remote.meshes.proxy) remote.meshes.proxy.visible = false;
    }
  }

  private rotateTowards(group: RuntimeObject3D, targetYaw: number, dt: number): void {
    const currentYaw = Number(group.rotation.y || 0);
    let deltaYaw = targetYaw - currentYaw;
    deltaYaw = ((deltaYaw % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    group.rotation.y = currentYaw + deltaYaw * Math.min(1, REMOTE_LERP * dt);
    if (group.rotation.y > Math.PI) group.rotation.y -= 2 * Math.PI;
    else if (group.rotation.y < -Math.PI) group.rotation.y += 2 * Math.PI;
  }

  private consumeAnimationDelta(remote: RemotePlayerRecord, dt: number, now: number): number {
    const frameDt = Math.max(0, Number(dt) || 0);
    if (frameDt <= 0) return 0;
    const anim = String(remote.anim || "idle");
    if (remote.lastAnimationName !== anim) {
      remote.lastAnimationName = anim;
      remote.lastAnimationAt = now;
      remote.animationAccumulator = 0;
      return frameDt;
    }
    const intervalMs = remoteAnimationIntervalMs(anim);
    const lastAt = Number(remote.lastAnimationAt || 0);
    if (!lastAt || now - lastAt >= intervalMs) {
      const accumulated = Number(remote.animationAccumulator || 0) + frameDt;
      remote.animationAccumulator = 0;
      remote.lastAnimationAt = now;
      return accumulated;
    }
    remote.animationAccumulator = Math.min(0.25, Number(remote.animationAccumulator || 0) + frameDt);
    return 0;
  }

  updateRenderBudget(
    remotes: Map<unknown, RemotePlayerRecord> | null | undefined,
    cameraPosition: { x?: unknown; y?: unknown; z?: unknown } | null | undefined
  ): RemoteRenderBudgetSnapshot {
    if (!this.renderBudget) this.assertConfigured();
    return this.renderBudget!.updateRenderBudget(remotes, cameraPosition);
  }

  private createRemoteProxy(avatar: NativeAvatarState): RuntimeObject3D | null {
    if (!this.proxies) this.assertConfigured();
    return this.proxies!.create(avatar);
  }

  private assertConfigured(): RemotePlayerServiceConfig {
    if (!this.config) throw new Error("RemotePlayerService is not configured");
    return this.config;
  }
}

function isBone(node: RuntimeObject3D | null | undefined): boolean {
  return Boolean(node?.isBone || node?.type === "Bone");
}

function boneAlias(name: unknown): string {
  return String(name || "").replace(/\s+/g, "_");
}

function remoteAnimationIntervalMs(anim: string): number {
  if (anim === "walk" || anim === "jump" || anim === "climb") return 1000 / 30;
  return 1000 / 12;
}

function withRemoteAvatarContext(avatar: NativeAvatarState, id: unknown, username: unknown): RemoteAvatarContext {
  return {
    ...avatar,
    id,
    playerId: id,
    username: String(username || "").trim()
  };
}
