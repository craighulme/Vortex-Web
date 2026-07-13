import type { UgcParticleFacing, UgcParticleKind, UgcParticleMotion, UgcTransform } from "./UgcTypes";
import {
  buildFaceOverlay,
  buildPantsOverlay,
  buildShirtOverlay,
  configureAvatarOverlayGeometry
} from "../../../web-client/src/avatar/materials/AvatarOverlayGeometry";
import {
  applyAvatarTextureToOverlay,
  configureAvatarTexturePipeline
} from "../../../web-client/src/avatar/materials/AvatarTexturePipeline";

type ThreeModule = Record<string, any>;

type ViewerModules = {
  THREE: ThreeModule;
  GLTFLoader: any;
  TransformControls: any;
};

type TransformTarget = "model" | "particles";

export type UgcParticleEmitterState = {
  id: string;
  name: string;
  enabled: boolean;
  kind: UgcParticleKind;
  motion: UgcParticleMotion;
  facing: UgcParticleFacing;
  file: File | null;
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

export type UgcViewerState = {
  slot: string;
  attachBone: string;
  transform: UgcTransform;
  particles: UgcParticleEmitterState[];
};

export type UgcStudioViewerOptions = {
  stage: HTMLElement;
  status?: HTMLElement | null;
  runtimeUrl: (path: string) => string;
  editable?: boolean;
  onAnimationUpdate?: (snapshot: UgcAnimationSnapshot) => void;
  onTransformUpdate?: (snapshot: { target: TransformTarget; transform: UgcTransform; particleId?: string }) => void;
};

export type UgcAnimationSnapshot = {
  name: string;
  playing: boolean;
  duration: number;
  time: number;
  normalized: number;
};

export type UgcAvatarAppearance = {
  bodyColors?: string[];
  shirtUrl?: string | null;
  pantsUrl?: string | null;
  faceUrl?: string | null;
};

const DEFAULT_TRANSFORM: UgcTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1]
};

export function defaultParticleEmitter(id = "emitter-1"): UgcParticleEmitterState {
  return {
    id,
    name: `Emitter ${id.replace(/^emitter-/, "")}`,
    enabled: false,
    kind: "file",
    motion: "aura",
    facing: "billboard",
    file: null,
    color: "#8bd3ff",
    transform: cloneTransform(DEFAULT_TRANSFORM),
    rate: 18,
    count: 24,
    size: 0.08,
    spread: 0.58,
    speed: 0.28,
    verticalSpeed: 0.22,
    lifetime: 1.8,
    opacity: 0.86,
    spin: 0.8
  };
}

const DEFAULT_CAMERA = {
  theta: -1.56595,
  phi: 0.27237,
  radius: 12,
  targetY: 2.75
};

const SLOT_ANCHORS: Record<string, { bone: string; position: [number, number, number]; label: string }> = {
  Hat: { bone: "Head", position: [0, 5.3, 0], label: "Head top" },
  Face: { bone: "Head", position: [0, 4.85, 0.52], label: "Face front" },
  Mask: { bone: "Head", position: [0, 4.75, 0.58], label: "Face front" },
  Back: { bone: "Chest", position: [0, 3.55, -0.55], label: "Back" },
  LeftHand: { bone: "LeftHand", position: [-1.25, 2.6, 0.2], label: "Left hand" },
  RightHand: { bone: "RightHand", position: [1.25, 2.6, 0.2], label: "Right hand" },
  LeftFoot: { bone: "LeftFoot", position: [-0.42, 0.35, 0.1], label: "Left foot" },
  RightFoot: { bone: "RightFoot", position: [0.42, 0.35, 0.1], label: "Right foot" },
  Torso: { bone: "Chest", position: [0, 3.15, 0.55], label: "Torso" },
  Shoulder: { bone: "Chest", position: [0.95, 3.95, 0], label: "Shoulder" }
};
const DEFAULT_ANCHOR = SLOT_ANCHORS.Hat as { bone: string; position: [number, number, number]; label: string };

export class UgcStudioViewer {
  readonly state: UgcViewerState = {
    slot: "Hat",
    attachBone: "Head",
    transform: cloneTransform(DEFAULT_TRANSFORM),
    particles: [defaultParticleEmitter()]
  };

  private modules: ViewerModules | null = null;
  private renderer: any = null;
  private scene: any = null;
  private camera: any = null;
  private avatarRoot: any = null;
  private accessoryRoot: any = null;
  private anchorGroup: any = null;
  private anchorParent: any = null;
  private avatarScene: any = null;
  private shirtOverlay: any = null;
  private pantsOverlay: any = null;
  private faceOverlay: any = null;
  private particleRoot: any = null;
  private particleGroups = new Map<string, any>();
  private transformControls: any = null;
  private mixer: any = null;
  private animationActions = new Map<string, any>();
  private activeAnimation: any = null;
  private activeAnimationName = "none";
  private animationPlaying = false;
  private lastAnimationReportMs = 0;
  private lastFrameMs = 0;
  private particleTextureUrls: string[] = [];
  private appearanceTicket = 0;
  private transformTarget: TransformTarget = "model";
  private activeParticleId = "emitter-1";
  private raf = 0;
  private disposed = false;
  private pointerDown = false;
  private orbitTheta = DEFAULT_CAMERA.theta;
  private orbitPhi = DEFAULT_CAMERA.phi;
  private orbitRadius = DEFAULT_CAMERA.radius;
  private lastPointer = { x: 0, y: 0 };
  private readonly snapKeyDown = (event: KeyboardEvent) => {
    if (!this.isEditable()) return;
    if (event.key === "Shift") this.applyTransformSnap(true);
  };
  private readonly snapKeyUp = (event: KeyboardEvent) => {
    if (!this.isEditable()) return;
    if (event.key === "Shift") this.applyTransformSnap(false);
  };

  constructor(private readonly options: UgcStudioViewerOptions) {}

  async mount(): Promise<void> {
    if (this.modules || this.disposed) return;
    const modules = await loadViewerModules(this.options.runtimeUrl);
    if (this.disposed) return;
    this.modules = modules;
    this.createScene();
    await this.renderer?.init?.();
    await this.loadAvatar();
    this.applySlot(this.state.slot);
    this.resize();
    this.start();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.snapKeyDown, true);
    window.removeEventListener("keyup", this.snapKeyUp, true);
    this.revokeParticleTextureUrls();
    this.transformControls?.detach?.();
    this.transformControls?.dispose?.();
    this.options.stage.replaceChildren();
    this.renderer?.dispose?.();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
  }

  resize(): void {
    if (!this.renderer || !this.camera) return;
    const rect = this.options.stage.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(360, Math.floor(rect.height));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  async loadAccessory(file: File): Promise<string[]> {
    const modules = this.modules;
    if (!modules || !this.anchorGroup) return [];
    const url = URL.createObjectURL(file);
    try {
      const gltf = await new modules.GLTFLoader().loadAsync(url);
      this.replaceAccessory(gltf.scene);
      this.fitObject(this.accessoryRoot);
      this.report(`Loaded ${file.name}`);
      return (gltf.animations || []).map((clip: { name?: unknown }) => String(clip.name || "").trim()).filter(Boolean);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  clearAccessory(): void {
    if (!this.anchorGroup || !this.accessoryRoot) return;
    this.anchorGroup.remove(this.accessoryRoot);
    this.accessoryRoot = null;
    if (this.transformTarget === "model") this.transformControls?.detach?.();
  }

  async loadAnimationPack(file: File, slots: Record<string, string> = {}): Promise<string[]> {
    const modules = this.modules;
    if (!modules || !this.mixer || !this.avatarScene) return [];
    const url = URL.createObjectURL(file);
    try {
      const gltf = await new modules.GLTFLoader().loadAsync(url);
      const clipNames = (gltf.animations || []).map((clip: { name?: unknown }) => String(clip.name || "").trim()).filter(Boolean);
      for (const clip of gltf.animations || []) {
        const key = animationSlotForClip(clip.name, slots);
        if (!key) continue;
        this.animationActions.get(key)?.stop?.();
        this.animationActions.set(key, this.mixer.clipAction(clip, this.avatarScene));
      }
      this.report(`Loaded animation pack: ${file.name}`);
      return clipNames;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  applySlot(slot: string): void {
    const anchor = SLOT_ANCHORS[slot] || DEFAULT_ANCHOR;
    this.state.slot = slot;
    this.state.attachBone = anchor.bone;
    this.attachAnchorToBone(anchor.bone, slot);
    this.applyTransform(this.state.transform);
  }

  applyTransform(transform: UgcTransform): void {
    this.state.transform = cloneTransform(transform);
    if (!this.accessoryRoot) return;
    this.accessoryRoot.position.set(transform.position[0], transform.position[1], transform.position[2]);
    this.accessoryRoot.rotation.set(
      degreesToRadians(transform.rotation[0]),
      degreesToRadians(transform.rotation[1]),
      degreesToRadians(transform.rotation[2])
    );
    this.accessoryRoot.scale.set(transform.scale[0], transform.scale[1], transform.scale[2]);
  }

  applyParticles(input: Partial<UgcParticleEmitterState>, id = this.activeParticleId): void {
    const next = this.state.particles.map((emitter) => {
      if (emitter.id !== id) return emitter;
      return normalizeParticleEmitter({
        ...emitter,
        ...input,
        transform: input.transform ? cloneTransform(input.transform) : emitter.transform
      });
    });
    this.setParticleEmitters(next, id);
  }

  setParticleEmitters(emitters: UgcParticleEmitterState[], activeId = this.activeParticleId): void {
    this.state.particles = emitters.length ? emitters.map(normalizeParticleEmitter) : [defaultParticleEmitter()];
    this.activeParticleId = this.state.particles.some((emitter) => emitter.id === activeId)
      ? activeId
      : (this.state.particles[0]?.id || "emitter-1");
    this.rebuildParticles();
    this.attachCurrentTransformTarget();
  }

  setActiveParticle(id: string): void {
    if (!this.state.particles.some((emitter) => emitter.id === id)) return;
    this.activeParticleId = id;
    this.attachCurrentTransformTarget();
  }

  playAnimation(name: string): void {
    this.activeAnimation?.fadeOut?.(0.12);
    this.activeAnimation?.stop?.();
    this.activeAnimation = null;
    this.activeAnimationName = normalizeClipName(name) || "none";
    this.animationPlaying = false;
    if (name === "none") {
      this.report("Animation preview paused");
      this.emitAnimationUpdate(true);
      return;
    }
    const action = this.animationActions.get(this.activeAnimationName);
    if (!action) {
      this.report(`Animation clip not found: ${name}`);
      this.emitAnimationUpdate(true);
      return;
    }
    action.reset();
    action.paused = false;
    action.fadeIn?.(0.12);
    action.play();
    this.activeAnimation = action;
    this.animationPlaying = true;
    this.report(`Animation preview: ${name}`);
    this.emitAnimationUpdate(true);
  }

  setAnimationPlaying(playing: boolean): void {
    if (!this.activeAnimation) return;
    this.animationPlaying = playing;
    this.activeAnimation.paused = !playing;
    this.emitAnimationUpdate(true);
  }

  setAnimationTime(normalized: number): void {
    if (!this.activeAnimation) return;
    const clip = this.activeAnimation.getClip?.();
    const duration = Math.max(0.001, Number(clip?.duration || 0));
    const clamped = Math.max(0, Math.min(1, normalized));
    this.activeAnimation.time = clamped * duration;
    this.mixer?.update?.(0);
    this.emitAnimationUpdate(true);
  }

  snapshotAnimation(): UgcAnimationSnapshot {
    const clip = this.activeAnimation?.getClip?.();
    const duration = Math.max(0, Number(clip?.duration || 0));
    const time = duration ? Math.max(0, Math.min(duration, Number(this.activeAnimation?.time || 0))) : 0;
    return {
      name: this.activeAnimationName,
      playing: this.animationPlaying && Boolean(this.activeAnimation),
      duration,
      time,
      normalized: duration ? time / duration : 0
    };
  }

  resetView(): void {
    this.orbitTheta = DEFAULT_CAMERA.theta;
    this.orbitPhi = DEFAULT_CAMERA.phi;
    this.orbitRadius = DEFAULT_CAMERA.radius;
    this.updateCamera();
  }

  snapshotTransform(): UgcTransform {
    return cloneTransform(this.state.transform);
  }

  snapshotParticleTransform(id = this.activeParticleId): UgcTransform {
    return cloneTransform(this.findParticle(id)?.transform || DEFAULT_TRANSFORM);
  }

  snapshotParticles(): UgcParticleEmitterState[] {
    return this.state.particles.map(normalizeParticleEmitter);
  }

  snapshotCamera(): Record<string, unknown> {
    return {
      orbitTheta: Number(this.orbitTheta.toFixed(5)),
      orbitPhi: Number(this.orbitPhi.toFixed(5)),
      orbitRadius: Number(this.orbitRadius.toFixed(3)),
      targetY: DEFAULT_CAMERA.targetY,
      position: this.camera ? {
        x: Number(this.camera.position.x.toFixed(3)),
        y: Number(this.camera.position.y.toFixed(3)),
        z: Number(this.camera.position.z.toFixed(3))
      } : null
    };
  }

  setTransformMode(mode: "translate" | "rotate" | "scale"): void {
    if (!this.isEditable()) return;
    this.transformControls?.setMode?.(mode);
  }

  setTransformTarget(target: TransformTarget): void {
    if (!this.isEditable()) return;
    this.transformTarget = target;
    this.attachCurrentTransformTarget();
    this.report(target === "particles" ? "Editing particle emitter" : "Editing accessory model");
  }

  applyAvatarAppearance(appearance: UgcAvatarAppearance): void {
    const THREE = this.modules?.THREE;
    if (!THREE || !this.avatarScene) return;
    applyEditorAvatarColors(THREE, this.avatarScene, appearance.bodyColors || []);
    this.applyEditorAvatarTextures(appearance);
  }

  private createScene(): void {
    const { THREE } = this.modules as ViewerModules;
    this.scene = new THREE.Scene();
    configureAvatarOverlayGeometry({ THREE });
    configureAvatarTexturePipeline({ THREE, window, document });
    this.scene.background = new THREE.Color(0x0d1722);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
    this.renderer = createRenderer(THREE);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.options.stage.replaceChildren(this.renderer.domElement);
    this.renderer.domElement.className = "vweb-ugc-canvas";
    this.addPointerControls(this.renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x263747, 2.1);
    this.scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(5, 8, 6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd7ff, 1.1);
    rim.position.set(-5, 5, -5);
    this.scene.add(rim);

    const grid = new THREE.GridHelper(8, 16, 0x446273, 0x223747);
    grid.position.y = -0.01;
    this.scene.add(grid);
    this.avatarRoot = new THREE.Group();
    this.scene.add(this.avatarRoot);
    this.anchorGroup = new THREE.Group();
    this.anchorGroup.name = "VWEB_UGC_AttachmentAnchor";
    this.avatarRoot.add(this.anchorGroup);
    this.particleRoot = new THREE.Group();
    this.anchorGroup.add(this.particleRoot);
    if (this.isEditable()) this.createTransformControls();
    this.updateCamera();
  }

  private async loadAvatar(): Promise<void> {
    const { THREE, GLTFLoader } = this.modules as ViewerModules;
    const url = this.options.runtimeUrl("runtime/assets/avatar/vweb-rig-v1/male.glb");
    try {
      const gltf = await new GLTFLoader().loadAsync(url);
      this.avatarScene = gltf.scene;
      this.avatarRoot.add(gltf.scene);
      gltf.scene.scale.setScalar(1);
      gltf.scene.position.y = 0;
      normalizeEditorAvatarMaterials(THREE, gltf.scene);
      this.shirtOverlay = buildShirtOverlay(gltf.scene);
      this.pantsOverlay = buildPantsOverlay(gltf.scene);
      this.faceOverlay = buildFaceOverlay(gltf.scene) || addEditorFaceOverlay(THREE, gltf.scene);
      this.mixer = new THREE.AnimationMixer(gltf.scene);
      await this.loadDefaultAnimations(gltf.scene);
      this.attachAnchorToBone(this.state.attachBone, this.state.slot);
      this.report("Avatar rig loaded");
    } catch {
      const fallback = createBlockAvatar(THREE);
      this.avatarScene = fallback;
      this.faceOverlay = fallback.getObjectByName?.("VWebEditorFace") || null;
      this.avatarRoot.add(fallback);
      this.report("Using editor fallback avatar");
    }
  }

  private async loadDefaultAnimations(root: any): Promise<void> {
    const { GLTFLoader } = this.modules as ViewerModules;
    const THREE = this.modules?.THREE;
    if (!THREE || !this.mixer) return;
    const url = this.options.runtimeUrl("runtime/assets/avatar/animations/vweb-default-v1.glb");
    try {
      const gltf = await new GLTFLoader().loadAsync(url);
      for (const clip of gltf.animations || []) {
        const key = normalizeClipName(clip.name);
        if (!key) continue;
        this.animationActions.set(key, this.mixer.clipAction(clip, root));
      }
    } catch {
      this.animationActions.clear();
    }
  }

  private replaceAccessory(object: any): void {
    if (this.accessoryRoot) this.anchorGroup.remove(this.accessoryRoot);
    this.accessoryRoot = object;
    normalizeImportedObject(this.modules?.THREE, this.accessoryRoot);
    this.anchorGroup.add(this.accessoryRoot);
    this.attachCurrentTransformTarget();
    this.applyTransform(this.state.transform);
    this.rebuildParticles();
  }

  private fitObject(object: any): void {
    const THREE = this.modules?.THREE;
    if (!THREE || !object) return;
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxAxis = Math.max(size.x, size.y, size.z);
    if (maxAxis > 0 && Number.isFinite(maxAxis)) {
      const scalar = Math.min(1.4, Math.max(0.25, 1 / maxAxis));
      this.state.transform.scale = [scalar, scalar, scalar];
      this.applyTransform(this.state.transform);
    }
  }

  private rebuildParticles(): void {
    const THREE = this.modules?.THREE;
    if (!THREE || !this.particleRoot) return;
    this.revokeParticleTextureUrls();
    this.particleRoot.clear();
    this.particleGroups.clear();
    for (const emitter of this.state.particles) {
      const group = new THREE.Group();
      group.name = `VWEB_ParticleEmitter_${emitter.id}`;
      group.userData.vwebParticleEmitter = emitter;
      this.applyParticleTransformToGroup(group, emitter.transform);
      this.particleGroups.set(emitter.id, group);
      this.particleRoot.add(group);
      if (!emitter.enabled) continue;
      const texture = emitter.file ? this.loadParticleFileTexture(emitter.file) : createParticleTexture(THREE, emitter.color || "#8bd3ff");
      const material = createParticleMaterial(THREE, emitter, texture);
      const planeGeometry = emitter.facing === "billboard" ? null : new THREE.PlaneGeometry(1, 1);
      const particleCount = Math.max(1, Math.min(180, Math.floor(emitter.count || 20)));
      for (let index = 0; index < particleCount; index++) {
        const dot = createParticleVisual(THREE, emitter, material.clone(), planeGeometry);
        const phase = index / particleCount;
        const angle = phase * Math.PI * 2;
        const radius = Math.max(0.02, emitter.spread || 0.58);
        const spiral = emitter.motion === "trail" ? phase : Math.sqrt((index * 37 % particleCount) / particleCount);
        if (emitter.motion === "beam") {
          dot.position.set((seeded(index) - 0.5) * radius * 0.16, (phase - 0.5) * radius * 3.2, 0);
          setParticleScale(dot, (emitter.size || 0.08) * 2.2, (emitter.size || 0.08) * 7.5);
        } else if (emitter.motion === "shockwave") {
          dot.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
          setParticleScale(dot, (emitter.size || 0.08) * 3.2, (emitter.size || 0.08) * 3.2);
        } else {
          dot.position.set(Math.cos(angle) * radius * spiral, (index % 7) * 0.11, Math.sin(angle) * radius * spiral);
          setParticleScale(dot, (emitter.size || 0.08) * 2.4, (emitter.size || 0.08) * 2.4);
        }
        dot.userData.vwebParticleHome = dot.position.clone();
        dot.userData.vwebParticleOffset = phase;
        dot.userData.vwebParticleEmitterId = emitter.id;
        dot.userData.vwebParticleSeed = (index * 16807 % 2147483647) / 2147483647;
        group.add(dot);
      }
    }
  }

  private loadParticleFileTexture(file: File): any {
    const THREE = this.modules?.THREE;
    if (!THREE) return null;
    const url = URL.createObjectURL(file);
    this.particleTextureUrls.push(url);
    const texture = new THREE.TextureLoader().load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private async applyEditorAvatarTextures(appearance: UgcAvatarAppearance): Promise<void> {
    const root = this.avatarScene;
    if (!root) return;
    const ticket = ++this.appearanceTicket;
    await Promise.resolve();
    if (ticket !== this.appearanceTicket) return;
    applyAvatarTextureToOverlay(this.shirtOverlay, appearance.shirtUrl || null, { slot: "shirt" });
    applyAvatarTextureToOverlay(this.pantsOverlay, appearance.pantsUrl || null, { slot: "pants" });
    applyAvatarTextureToOverlay(this.faceOverlay, appearance.faceUrl || null, { slot: "face" });
  }

  private start(): void {
    const tick = () => {
      if (this.disposed || !this.renderer || !this.scene || !this.camera) return;
      this.raf = requestAnimationFrame(tick);
      const now = performance.now();
      const delta = this.lastFrameMs ? Math.min(0.05, (now - this.lastFrameMs) / 1000) : 0.016;
      this.lastFrameMs = now;
      this.mixer?.update?.(delta);
      this.animateParticles(performance.now() / 1000);
      this.emitAnimationUpdate();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  private emitAnimationUpdate(force = false): void {
    if (!this.options.onAnimationUpdate) return;
    const now = performance.now();
    if (!force && now - this.lastAnimationReportMs < 80) return;
    this.lastAnimationReportMs = now;
    this.options.onAnimationUpdate(this.snapshotAnimation());
  }

  private animateParticles(time: number): void {
    if (!this.particleRoot) return;
    this.particleRoot.children.forEach((group: any) => {
      const settings = normalizeParticleEmitter(group.userData.vwebParticleEmitter || defaultParticleEmitter());
      if (!settings.enabled) return;
      const speed = Math.max(0, settings.speed || 0.28);
      const verticalSpeed = settings.verticalSpeed ?? 0.22;
      const lifetime = Math.max(0.2, settings.lifetime || 1.8);
      const spin = settings.spin || 0;
      const baseOpacity = Math.max(0.05, Math.min(1, settings.opacity || 0.86));
      group.children.forEach((child: any) => {
        const offset = Number(child.userData.vwebParticleOffset || 0);
        const seed = Number(child.userData.vwebParticleSeed || 0);
        const motion = settings.motion || "aura";
        const home = child.userData.vwebParticleHome;
        const age = (time * speed + offset * lifetime) % lifetime;
        const normalizedAge = age / lifetime;
        if (home) child.position.copy(home);
        if (motion === "trail") {
          child.position.z -= normalizedAge * Math.max(0.05, settings.spread || 0.58);
          child.position.x += Math.sin(time * 3 + offset * 12) * 0.04;
        } else if (motion === "fountain") {
          child.position.y += normalizedAge * verticalSpeed * 2.2;
          child.position.x += Math.sin(offset * 19) * Math.max(0.02, settings.spread || 0.58) * normalizedAge * 0.45;
          child.position.z += Math.cos(offset * 23) * Math.max(0.02, settings.spread || 0.58) * normalizedAge * 0.45;
        } else if (motion === "orbit") {
          const radius = Math.max(0.03, settings.spread || 0.58);
          const angle = time * (spin || 0.9) + offset * Math.PI * 2;
          child.position.x = Math.cos(angle) * radius;
          child.position.z = Math.sin(angle) * radius;
          child.position.y += Math.sin(time * 2.4 + offset * 7) * verticalSpeed * 0.18;
        } else if (motion === "burst") {
          const radius = Math.max(0.03, settings.spread || 0.58) * normalizedAge;
          const angle = offset * Math.PI * 2 + seed;
          child.position.x = Math.cos(angle) * radius;
          child.position.z = Math.sin(angle) * radius;
          child.position.y += (seed - 0.3) * radius + normalizedAge * verticalSpeed;
        } else if (motion === "drift") {
          child.position.y += normalizedAge * verticalSpeed * 1.6;
          const drift = (seed - 0.5) * Math.max(0.02, settings.spread || 0.58) * normalizedAge;
          child.position.x += drift;
          child.position.z -= drift * 0.7;
        } else if (motion === "beam") {
          const height = Math.max(0.05, settings.spread || 0.58) * 3.4;
          child.position.y = ((offset + time * speed * 0.18) % 1 - 0.5) * height;
          child.position.x += Math.sin(time * 4 + offset * 12) * Math.max(0.01, settings.spread || 0.58) * 0.045;
          setParticleSpin(child, Math.sin(time * 1.8 + offset * 5) * 0.12, settings.facing);
        } else if (motion === "helix") {
          const radius = Math.max(0.03, settings.spread || 0.58) * 0.5;
          const twist = time * (spin || 1.4) + offset * Math.PI * 8;
          child.position.x = Math.cos(twist) * radius;
          child.position.z = Math.sin(twist) * radius;
          child.position.y = (offset - 0.5) * Math.max(0.2, settings.spread || 0.58) * 2.8 + Math.sin(time * 2 + offset * 9) * verticalSpeed * 0.1;
        } else if (motion === "shockwave") {
          const radius = Math.max(0.03, settings.spread || 0.58) * (0.25 + normalizedAge * 1.75);
          const angle = offset * Math.PI * 2;
          child.position.x = Math.cos(angle) * radius;
          child.position.z = Math.sin(angle) * radius;
          child.position.y += Math.sin(normalizedAge * Math.PI) * verticalSpeed * 0.2;
        } else {
          child.position.y += Math.sin(time * 2 + offset * Math.PI * 2) * verticalSpeed * 0.12;
        }
        setParticleSpin(child, time * spin + offset * Math.PI * 2, settings.facing);
        const fade = motion === "drift" || motion === "trail" || motion === "burst" || motion === "shockwave"
          ? 1 - normalizedAge
          : motion === "beam"
            ? 0.55 + Math.sin(time * 5 + offset * 10) * 0.28
          : 0.78 + Math.sin(time * 3 + offset * 8) * 0.18;
        child.material.opacity = Math.max(0.02, Math.min(1, baseOpacity * fade));
      });
    });
  }

  private addPointerControls(canvas: HTMLCanvasElement): void {
    canvas.addEventListener("pointerdown", (event) => {
      this.pointerDown = true;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!this.pointerDown) return;
      const dx = event.clientX - this.lastPointer.x;
      const dy = event.clientY - this.lastPointer.y;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.orbitTheta -= dx * 0.008;
      this.orbitPhi = Math.max(0.16, Math.min(Math.PI * 0.48, this.orbitPhi + dy * 0.006));
      this.updateCamera();
    });
    canvas.addEventListener("pointerup", (event) => {
      this.pointerDown = false;
      canvas.releasePointerCapture(event.pointerId);
    });
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.orbitRadius = Math.max(2.4, Math.min(34, this.orbitRadius + event.deltaY * 0.012));
      this.updateCamera();
    }, { passive: false });
  }

  private createTransformControls(): void {
    const modules = this.modules;
    if (!modules || !this.camera || !this.renderer || !this.scene) return;
    const controls = new modules.TransformControls(this.camera, this.renderer.domElement);
    controls.setMode?.("translate");
    controls.setSpace?.("local");
    controls.setSize?.(0.75);
    controls.addEventListener?.("dragging-changed", (event: { value: boolean }) => {
      this.pointerDown = false;
      this.renderer.domElement.style.cursor = event.value ? "move" : "grab";
    });
    controls.addEventListener?.("objectChange", () => {
      const target = this.transformTarget === "particles" ? this.activeParticleGroup() : this.accessoryRoot;
      if (!target) return;
      const snapshot = transformFromObject(target);
      if (this.transformTarget === "particles") {
        const emitter = this.findParticle(this.activeParticleId);
        if (emitter) emitter.transform = snapshot;
        this.options.onTransformUpdate?.({ target: "particles", transform: snapshot, particleId: this.activeParticleId });
      } else {
        this.state.transform = snapshot;
        this.options.onTransformUpdate?.({ target: "model", transform: snapshot });
      }
    });
    this.scene.add(controls.getHelper?.() || controls);
    this.transformControls = controls;
    window.addEventListener("keydown", this.snapKeyDown, true);
    window.addEventListener("keyup", this.snapKeyUp, true);
    this.attachCurrentTransformTarget();
  }

  private attachCurrentTransformTarget(): void {
    if (!this.transformControls) return;
    const target = this.transformTarget === "particles" ? this.activeParticleGroup() : this.accessoryRoot;
    if (target) this.transformControls.attach?.(target);
    else this.transformControls.detach?.();
  }

  private applyTransformSnap(enabled: boolean): void {
    if (!this.transformControls) return;
    this.transformControls.setTranslationSnap?.(enabled ? 0.25 : null);
    this.transformControls.setRotationSnap?.(enabled ? Math.PI / 12 : null);
    this.transformControls.setScaleSnap?.(enabled ? 0.05 : null);
  }

  private applyParticleTransformToGroup(group: any, transform: UgcTransform): void {
    if (!group) return;
    group.position.set(transform.position[0], transform.position[1], transform.position[2]);
    group.rotation.set(
      degreesToRadians(transform.rotation[0]),
      degreesToRadians(transform.rotation[1]),
      degreesToRadians(transform.rotation[2])
    );
    group.scale.set(transform.scale[0], transform.scale[1], transform.scale[2]);
  }

  private activeParticleGroup(): any {
    return this.particleGroups.get(this.activeParticleId) || null;
  }

  private findParticle(id: string): UgcParticleEmitterState | null {
    return this.state.particles.find((emitter) => emitter.id === id) || null;
  }

  private revokeParticleTextureUrls(): void {
    for (const url of this.particleTextureUrls) URL.revokeObjectURL(url);
    this.particleTextureUrls = [];
  }

  private attachAnchorToBone(boneName: string, slot: string): void {
    const THREE = this.modules?.THREE;
    if (!THREE || !this.anchorGroup) return;
    const target = findBone(this.avatarScene, boneName) || this.avatarRoot;
    if (this.anchorParent !== target) {
      this.anchorParent?.remove?.(this.anchorGroup);
      target.add(this.anchorGroup);
      this.anchorParent = target;
    }
    const position = localSlotPosition(slot);
    this.anchorGroup.position.set(position[0], position[1], position[2]);
    this.anchorGroup.rotation.set(0, 0, 0);
    this.anchorGroup.scale.set(1, 1, 1);
    this.anchorGroup.updateMatrixWorld(true);
  }

  private updateCamera(): void {
    if (!this.camera) return;
    const targetY = DEFAULT_CAMERA.targetY;
    const x = Math.cos(this.orbitTheta) * Math.cos(this.orbitPhi) * this.orbitRadius;
    const z = Math.sin(this.orbitTheta) * Math.cos(this.orbitPhi) * this.orbitRadius;
    const y = Math.sin(this.orbitPhi) * this.orbitRadius + 1.4;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, targetY, 0);
  }

  private report(message: string): void {
    if (this.options.status) this.options.status.textContent = message;
  }

  private isEditable(): boolean {
    return this.options.editable !== false;
  }
}

export function slotToBone(slot: string): string {
  return (SLOT_ANCHORS[slot] || DEFAULT_ANCHOR).bone;
}

export function defaultTransform(): UgcTransform {
  return cloneTransform(DEFAULT_TRANSFORM);
}

function cloneTransform(transform: UgcTransform): UgcTransform {
  return {
    position: [...transform.position] as [number, number, number],
    rotation: [...transform.rotation] as [number, number, number],
    scale: [...transform.scale] as [number, number, number]
  };
}

function normalizeParticleEmitter(input: UgcParticleEmitterState): UgcParticleEmitterState {
  return {
    id: String(input.id || "emitter-1"),
    name: String(input.name || input.id || "Emitter"),
    enabled: input.enabled === true,
    kind: input.kind === "file" ? "file" : "none",
    motion: normalizeParticleMotion(input.motion),
    facing: normalizeParticleFacing(input.facing),
    file: input.file || null,
    color: String(input.color || "#8bd3ff").slice(0, 20),
    transform: cloneTransform(input.transform || DEFAULT_TRANSFORM),
    rate: clampNumber(input.rate, 0, 120, 18),
    count: Math.round(clampNumber(input.count, 1, 180, 24)),
    size: clampNumber(input.size, 0.01, 1, 0.08),
    spread: clampNumber(input.spread, 0, 3, 0.58),
    speed: clampNumber(input.speed, 0, 5, 0.28),
    verticalSpeed: clampNumber(input.verticalSpeed, -3, 3, 0.22),
    lifetime: clampNumber(input.lifetime, 0.2, 10, 1.8),
    opacity: clampNumber(input.opacity, 0.05, 1, 0.86),
    spin: clampNumber(input.spin, -8, 8, 0.8)
  };
}

function normalizeParticleFacing(value: unknown): UgcParticleFacing {
  return value === "front" || value === "ground" ? value : "billboard";
}

function normalizeParticleMotion(value: unknown): UgcParticleMotion {
  return value === "fountain" ||
    value === "orbit" ||
    value === "trail" ||
    value === "burst" ||
    value === "drift" ||
    value === "beam" ||
    value === "helix" ||
    value === "shockwave"
    ? value
    : "aura";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(min, Math.min(max, next)) : fallback;
}

function seeded(value: number): number {
  return (value * 16807 % 2147483647) / 2147483647;
}

function transformFromObject(object: any): UgcTransform {
  return {
    position: [
      Number(object.position.x.toFixed(3)),
      Number(object.position.y.toFixed(3)),
      Number(object.position.z.toFixed(3))
    ],
    rotation: [
      Number(radiansToDegrees(object.rotation.x).toFixed(2)),
      Number(radiansToDegrees(object.rotation.y).toFixed(2)),
      Number(radiansToDegrees(object.rotation.z).toFixed(2))
    ],
    scale: [
      Number(object.scale.x.toFixed(3)),
      Number(object.scale.y.toFixed(3)),
      Number(object.scale.z.toFixed(3))
    ]
  };
}

async function loadViewerModules(runtimeUrl: (path: string) => string): Promise<ViewerModules> {
  const threeModule = await import(/* @vite-ignore */ runtimeUrl("runtime/vendor/three.webgpu.js")) as ThreeModule;
  const loaderModule = await import(/* @vite-ignore */ runtimeUrl("runtime/vendor/GLTFLoader.js")) as { GLTFLoader: any };
  const transformModule = await import(/* @vite-ignore */ runtimeUrl("runtime/vendor/TransformControls.js")) as { TransformControls: any };
  return {
    THREE: threeModule,
    GLTFLoader: loaderModule.GLTFLoader,
    TransformControls: transformModule.TransformControls
  };
}

function createRenderer(THREE: ThreeModule): any {
  return typeof THREE.WebGPURenderer === "function"
    ? new THREE.WebGPURenderer({ antialias: true, alpha: false })
    : new THREE.WebGLRenderer({ antialias: true, alpha: false });
}

function createBlockAvatar(THREE: ThreeModule): any {
  const root = new THREE.Group();
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.02 });
  const addBox = (name: string, size: [number, number, number], position: [number, number, number], color: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material(color));
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    root.add(mesh);
  };
  addBox("Head", [1, 1, 1], [0, 4.65, 0], 0xd6d6d6);
  addBox("Chest", [1.45, 1.65, 0.72], [0, 3.35, 0], 0x4c1d95);
  addBox("LeftArm", [0.55, 1.75, 0.55], [-1.05, 3.35, 0], 0xf5f5f5);
  addBox("RightArm", [0.55, 1.75, 0.55], [1.05, 3.35, 0], 0xf5f5f5);
  addBox("LeftLeg", [0.62, 1.9, 0.62], [-0.38, 1.55, 0], 0x1e1b4b);
  addBox("RightLeg", [0.62, 1.9, 0.62], [0.38, 1.55, 0], 0x1e1b4b);
  addEditorFaceOverlay(THREE, root);
  return root;
}

function addEditorFaceOverlay(THREE: ThreeModule, root: any): any {
  if (!root?.add) return null;
  const existing = root.getObjectByName?.("VWebEditorFace");
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#101827";
  ctx.beginPath();
  ctx.arc(82, 96, 16, 0, Math.PI * 2);
  ctx.arc(174, 96, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 16;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#101827";
  ctx.beginPath();
  ctx.moveTo(76, 158);
  ctx.quadraticCurveTo(128, 206, 180, 158);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    alphaTest: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -0.25,
    polygonOffsetUnits: -1
  });
  const face = createSkinnedEditorFaceOverlay(THREE, root, material) || createEditorFallbackFaceMesh(THREE, root, material);
  if (!face) return null;
  face.name = "VWebEditorFace";
  face.renderOrder = 1000;
  return face;
}

function normalizeEditorAvatarMaterials(THREE: ThreeModule, root: any): void {
  if (!root?.traverse) return;
  root.traverse((child: any) => {
    if (!child.isMesh && !child.isSkinnedMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const replaced = materials.map((material: any, index: number) => createEditorAvatarMaterial(THREE, material, index));
    child.material = Array.isArray(child.material) ? replaced : replaced[0];
    child.castShadow = false;
    child.receiveShadow = true;
  });
}

function createEditorAvatarMaterial(THREE: ThreeModule, source: any, fallbackIndex: number): any {
  const name = String(source?.name || "");
  const region = editorAvatarRegion(name, fallbackIndex);
  const color = DEFAULT_EDITOR_BODY_COLORS[region] ?? 0xffffff;
  const material = new THREE.MeshStandardMaterial({
    name,
    color,
    roughness: 0.72,
    metalness: 0.02,
    transparent: false,
    opacity: 1
  });
  material.vertexColors = false;
  material.map = null;
  material.userData.vwebAvatarRegion = region;
  material.needsUpdate = true;
  return material;
}

const DEFAULT_EDITOR_BODY_COLORS = [0xd6d6d6, 0x5b2ca0, 0xf5f5f5, 0xf5f5f5, 0x1e1b4b, 0x1e1b4b];

function applyEditorAvatarColors(THREE: ThreeModule, root: any, bodyColors: string[]): void {
  const colors = bodyColors.map((color) => safeColor(THREE, color));
  root.traverse?.((child: any) => {
    if (!child.isMesh && !child.isSkinnedMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (let index = 0; index < materials.length; index += 1) {
      const material = materials[index];
      const region = Number.isFinite(Number(material?.userData?.vwebAvatarRegion))
        ? Number(material.userData.vwebAvatarRegion)
        : editorAvatarRegion(String(material?.name || ""), index);
      const color = colors[region];
      if (color && material?.color?.copy) {
        material.color.copy(color);
        material.needsUpdate = true;
      }
    }
  });
}

function safeColor(THREE: ThreeModule, value: string): any {
  try {
    return /^#[0-9a-f]{3,8}$/i.test(String(value || "")) ? new THREE.Color(value) : null;
  } catch {
    return null;
  }
}

function editorAvatarRegion(name: string, fallbackIndex: number): number {
  if (/Material\.002/i.test(name)) return 0;
  if (/Material\.001|Material\.003/i.test(name)) return 1;
  if (/Material\.004/i.test(name)) return 2;
  if (/Material\.005/i.test(name)) return 3;
  if (/Material\.007/i.test(name)) return 4;
  if (/Material\.008/i.test(name)) return 5;
  return Math.max(0, Math.min(5, fallbackIndex));
}

function createSkinnedEditorFaceOverlay(THREE: ThreeModule, root: any, material: any): any {
  let bestMesh: any = null;
  let headBoneIndex = -1;
  root.traverse?.((child: any) => {
    if (bestMesh || !child.isSkinnedMesh) return;
    const index = (child.skeleton?.bones || []).findIndex((bone: any) => String(bone.name || "").replace(/\s+/g, "_") === "Head");
    if (index >= 0) {
      bestMesh = child;
      headBoneIndex = index;
    }
  });
  if (!bestMesh || headBoneIndex < 0) return null;
  const position = bestMesh.geometry?.attributes?.position;
  const skinIndex = bestMesh.geometry?.attributes?.skinIndex;
  const skinWeight = bestMesh.geometry?.attributes?.skinWeight;
  if (!position || !skinIndex?.array || !skinWeight?.array) return null;
  const bounds = { xMin: Infinity, xMax: -Infinity, yMin: Infinity, yMax: -Infinity, zMin: Infinity, zMax: -Infinity };
  for (let i = 0; i < position.count; i += 1) {
    let influence = 0;
    for (let j = 0; j < 4; j += 1) {
      const offset = i * 4 + j;
      if (skinIndex.array[offset] === headBoneIndex) influence += skinWeight.array[offset] || 0;
    }
    if (influence < 0.5) continue;
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    bounds.xMin = Math.min(bounds.xMin, x);
    bounds.xMax = Math.max(bounds.xMax, x);
    bounds.yMin = Math.min(bounds.yMin, y);
    bounds.yMax = Math.max(bounds.yMax, y);
    bounds.zMin = Math.min(bounds.zMin, z);
    bounds.zMax = Math.max(bounds.zMax, z);
  }
  if (!Number.isFinite(bounds.xMin)) return null;
  const headWidth = bounds.xMax - bounds.xMin;
  const headHeight = bounds.yMax - bounds.yMin;
  const cx = (bounds.xMin + bounds.xMax) * 0.5;
  const cy = bounds.yMin + headHeight * 0.54;
  const faceSize = Math.min(headWidth * 0.96, headHeight * 0.82);
  const halfWidth = faceSize * 0.5;
  const halfHeight = faceSize * 0.5;
  const x0 = cx - halfWidth;
  const x1 = cx + halfWidth;
  const y0 = cy - halfHeight;
  const y1 = cy + halfHeight;
  const z = bounds.zMin - Math.max(0.01, (bounds.zMax - bounds.zMin) * 0.018);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z]), 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]), 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2));
  geometry.setAttribute("skinIndex", new THREE.BufferAttribute(new Uint16Array([headBoneIndex, 0, 0, 0, headBoneIndex, 0, 0, 0, headBoneIndex, 0, 0, 0, headBoneIndex, 0, 0, 0]), 4));
  geometry.setAttribute("skinWeight", new THREE.BufferAttribute(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), 4));
  geometry.setIndex([0, 2, 1, 0, 3, 2]);

  const face = new THREE.SkinnedMesh(geometry, material);
  face.bind(bestMesh.skeleton, bestMesh.bindMatrix);
  bestMesh.parent?.add(face);
  return face;
}

function createEditorFallbackFaceMesh(THREE: ThreeModule, root: any, material: any): any {
  const box = new THREE.Box3().setFromObject(root);
  const width = Math.max(0.65, Math.min(0.9, (box.max.x - box.min.x) * 0.55));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, width), material);
  face.position.set(0, box.min.y + (box.max.y - box.min.y) * 0.78, box.min.z - 0.05);
  root.add(face);
  return face;
}

function createParticleTexture(THREE: ThreeModule, color: string): any {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, 128, 128);
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 60);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.28, color);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(64, 64, 48, 0, Math.PI * 2);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createParticleMaterial(THREE: ThreeModule, emitter: UgcParticleEmitterState, texture: any): any {
  const options = {
    map: texture,
    color: new THREE.Color(emitter.color || "#8bd3ff"),
    transparent: true,
    opacity: Math.max(0.05, Math.min(1, emitter.opacity || 0.9)),
    depthWrite: false,
    depthTest: true
  };
  return emitter.facing === "billboard"
    ? new THREE.SpriteMaterial(options)
    : new THREE.MeshBasicMaterial({ ...options, side: THREE.DoubleSide });
}

function createParticleVisual(THREE: ThreeModule, emitter: UgcParticleEmitterState, material: any, planeGeometry: any): any {
  if (emitter.facing === "billboard") return new THREE.Sprite(material);
  const mesh = new THREE.Mesh(planeGeometry, material);
  applyStaticParticleFacing(mesh, emitter.facing);
  return mesh;
}

function setParticleScale(particle: any, x: number, y: number): void {
  particle.scale.set(x, y, 1);
}

function setParticleSpin(particle: any, radians: number, facing: UgcParticleFacing): void {
  if (particle.isSprite) {
    particle.material.rotation = radians;
    return;
  }
  applyStaticParticleFacing(particle, facing);
  if (facing === "ground") particle.rotateZ(radians);
  else particle.rotateZ(radians);
}

function applyStaticParticleFacing(particle: any, facing: UgcParticleFacing): void {
  particle.rotation.set(0, 0, 0);
  if (facing === "ground") particle.rotation.x = -Math.PI / 2;
}

function normalizeImportedObject(THREE: ThreeModule | undefined, object: any): void {
  if (!THREE || !object?.traverse) return;
  object.traverse((child: any) => {
    if (!child.isMesh) return;
    child.castShadow = false;
    child.receiveShadow = true;
    if (child.material?.map) child.material.map.colorSpace = THREE.SRGBColorSpace;
  });
}

function degreesToRadians(value: number): number {
  return (Number(value) || 0) * Math.PI / 180;
}

function radiansToDegrees(value: number): number {
  return (Number(value) || 0) * 180 / Math.PI;
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
    case "Shoulder": return [0.48, 0.34, 0];
    default: return [0, 0, 0];
  }
}

function normalizeClipName(value: string): string {
  return String(value || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/^vweb_/, "");
}

const ANIMATION_PREVIEW_SLOTS = new Set(["idle", "walk", "run", "jump", "fall", "climb", "climb_idle"]);

function animationSlotForClip(name: unknown, slots: Record<string, string> = {}): string | null {
  const normalized = normalizeClipName(String(name || ""));
  for (const [slot, clipName] of Object.entries(slots)) {
    if (normalizeClipName(clipName) === normalized && ANIMATION_PREVIEW_SLOTS.has(slot)) return slot;
  }
  return ANIMATION_PREVIEW_SLOTS.has(normalized) ? normalized : null;
}

function findBone(root: any, name: string): any {
  let found: any = null;
  root?.traverse?.((child: any) => {
    if (found) return;
    if (String(child?.name || "").replace(/\s+/g, "_") === name) found = child;
  });
  return found;
}
