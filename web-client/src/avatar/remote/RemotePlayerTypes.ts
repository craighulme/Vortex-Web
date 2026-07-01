import type { NativeAvatarState } from "../AvatarService";

export type RemotePlayerMeshes = {
  grp: RuntimeObject3D;
  proxy?: RuntimeObject3D | null;
  bones: Record<string, RigBone>;
  rest: Record<string, RigBoneRest>;
  shirtMesh?: unknown;
  pantsMesh?: unknown;
  faceMesh?: unknown;
  nameSprite?: RuntimeSprite;
};

export type RemotePlayerRuntimeApi = {
  scene: { add(object: unknown): void; remove(object: unknown): void };
  getCharacter(): RuntimeObject3D | null;
  getAnimRest(): Record<string, RigBoneRest>;
  getCharFootOffset(): number;
  getCharHeight(): number;
  buildShirtOverlay(group: RuntimeObject3D): unknown;
  buildPantsOverlay?: (group: RuntimeObject3D) => unknown;
  buildFaceOverlay?: (group: RuntimeObject3D) => unknown;
  applyAvatarToMeshes?: (meshes: RemotePlayerMeshes, avatar: RemoteAvatarContext) => void;
};

export type RuntimeObject3D = {
  name?: string;
  type?: string;
  isBone?: boolean;
  isMesh?: boolean;
  isSkinnedMesh?: boolean;
  isSprite?: boolean;
  visible?: boolean;
  parent?: { remove?(object: unknown): void };
  userData: Record<string, unknown>;
  material?: RuntimeMaterial | RuntimeMaterial[];
  geometry?: unknown;
  castShadow?: boolean;
  receiveShadow?: boolean;
  skeleton?: { bones: RigBone[]; boneInverses: Array<{ clone(): unknown }> };
  bindMatrix?: { clone(): unknown };
  rotation: { y?: number; set?(x: number, y: number, z: number): void };
  position: RuntimeVector3;
  clone(recursive?: boolean): RuntimeObject3D;
  traverse(visitor: (object: RuntimeObject3D) => void): void;
  bind?(skeleton: unknown, bindMatrix: unknown): void;
  add?(object: unknown): void;
  scale?: { set?(x: number, y: number, z: number): void };
};

export type RigBone = RuntimeObject3D & {
  rotation: { set?(x: number, y: number, z: number): void } & Record<string, number>;
  position: RuntimeVector3;
};

export type RuntimeVector3 = {
  x?: number;
  y: number;
  z?: number;
  clone?(): RuntimeVector3;
  copy?(value: RuntimeVector3): void;
  lerp?(value: RuntimeVector3, alpha: number): void;
  set?(x: number, y: number, z: number): void;
};

export type RigBoneRest = {
  x?: number;
  y?: number;
  z?: number;
  py?: number;
};

export type RuntimeMaterial = {
  clone?(): RuntimeMaterial;
  dispose?(): void;
  map?: { dispose?(): void };
};

export type RuntimeSprite = RuntimeObject3D & {
  material?: RuntimeMaterial;
  scale: { set(x: number, y: number, z: number): void };
};

export type ThreeLike = {
  Group?: new () => RuntimeObject3D;
  Mesh?: new (geometry: unknown, material: unknown) => RuntimeObject3D;
  BoxGeometry?: new (x: number, y: number, z: number) => unknown;
  MeshStandardMaterial?: new (options: Record<string, unknown>) => RuntimeMaterial;
  Skeleton: new (bones: RigBone[], boneInverses: unknown[]) => unknown;
  CanvasTexture: new (canvas: HTMLCanvasElement) => unknown;
  SpriteMaterial: new (options: Record<string, unknown>) => RuntimeMaterial;
  Sprite: new (material: RuntimeMaterial) => RuntimeSprite;
  Box3?: new () => RuntimeBox3;
};

export type RuntimeBox3 = {
  setFromObject(object: unknown): RuntimeBox3;
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
};

export type RemotePlayerRecord = {
  id?: unknown;
  avatar?: NativeAvatarState;
  username?: string;
  is_staff?: unknown;
  is_booster?: unknown;
  meshes?: RemotePlayerMeshes | null | undefined;
  hasPosition?: boolean;
  tPos?: RuntimeVector3 | undefined;
  tRy?: number;
  seen?: number;
  anim?: string;
  animTime?: number;
  lastAnimationAt?: number;
  animationAccumulator?: number;
  lastAnimationName?: string;
};

export type RemoteAvatarContext = NativeAvatarState & {
  id?: unknown;
  playerId?: unknown;
  username?: string;
};

export type RemoteRenderProfile = {
  totals: {
    remotes: number;
    visible: number;
    meshes: number;
    skinnedMeshes: number;
    sprites: number;
    materials: number;
    uniqueGeometries: number;
    uniqueTextures: number;
    shadowCasters: number;
    shadowReceivers: number;
    animatedActive: number;
  };
  rows: RemoteRenderProfileRow[];
};

export type RemoteRenderProfileRow = {
  id: string;
  username: string;
  visible: boolean;
  meshes: number;
  skinnedMeshes: number;
  sprites: number;
  materials: number;
  uniqueGeometries: number;
  uniqueTextures: number;
  shadowCasters: number;
  shadowReceivers: number;
  anim: string;
  ageMs: number | null;
  positionY: number | null;
  visualMinY: number | null;
  visualMaxY: number | null;
  visualFootDelta: number | null;
};

export type RemoteRenderBudgetSnapshot = {
  visibleRemotes: number;
  fullRemotes: number;
  proxyRemotes: number;
  shadowedRemotes: number;
  shadowCasters: number;
  shadowBudget: number;
  shadowDistance: number;
};
