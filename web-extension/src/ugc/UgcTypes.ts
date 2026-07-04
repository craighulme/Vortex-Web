export type UgcAssetKind = "avatar-item" | "character-morph" | "animation-pack";
export type UgcParticleKind = "none" | "file";
export type UgcParticleMotion = "aura" | "fountain" | "orbit" | "trail" | "burst" | "drift" | "beam" | "helix" | "shockwave";
export type UgcParticleFacing = "billboard" | "front" | "ground";
export type UgcVfxNodeType = "texture" | "emitter" | "motion" | "renderer" | "output";
export type UgcVfxParam = string | number | boolean | number[] | null;

export type UgcVfxNode = {
  id: string;
  type: UgcVfxNodeType;
  label?: string;
  params?: Record<string, UgcVfxParam>;
};

export type UgcVfxEdge = {
  from: string;
  to: string;
  out?: string;
  in?: string;
};

export type UgcVfxGraph = {
  apiVersion: 1;
  nodes: UgcVfxNode[];
  edges: UgcVfxEdge[];
};

export type UgcTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

export type UgcParticleSpec = {
  kind: UgcParticleKind;
  id?: string;
  name?: string;
  enabled?: boolean;
  motion?: UgcParticleMotion;
  facing?: UgcParticleFacing;
  fileId?: string;
  fileName?: string;
  url?: string;
  color?: string;
  transform?: UgcTransform;
  rate?: number;
  count?: number;
  size?: number;
  spread?: number;
  speed?: number;
  verticalSpeed?: number;
  lifetime?: number;
  opacity?: number;
  spin?: number;
};

export type UgcDraftFileRef = {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
};

export type UgcDraftParticleFileRef = {
  emitterId: string;
  file: UgcDraftFileRef;
};

export type UgcDraft = {
  schemaVersion: 1;
  id: string;
  identityKey?: string;
  ownerUserId?: number;
  remoteItemId?: string;
  remoteStatus?: string;
  name: string;
  kind: UgcAssetKind;
  slot: string;
  rigVersion: string;
  fileName: string;
  modelFile: UgcDraftFileRef;
  particleFiles: UgcDraftParticleFileRef[];
  createdAt: number;
  updatedAt: number;
  submittedAt?: number;
  manifest: UgcItemManifest;
};

export type UgcItemManifest = {
  apiVersion: 1;
  id: string;
  name: string;
  kind: UgcAssetKind;
  rigVersion: string;
  modelUrl?: string;
  animationPackId?: string;
  slot?: string;
  attachBone?: string;
  transform?: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
  particles?: UgcParticleSpec[];
  vfxGraph?: UgcVfxGraph;
  clips?: Partial<Record<"idle" | "walk" | "run" | "jump" | "fall" | "climb" | "climb_idle", string>>;
  tags?: string[];
};

export type UgcStoreItem = {
  id: string;
  identityKey?: string;
  name: string;
  kind: UgcAssetKind;
  status?: string;
  url: string;
  key: string;
  slot: string;
  rigVersion: string;
  size: number;
  uploadedAt: string;
  contentType: string;
  manifest?: UgcItemManifest;
};

export type UgcEquipmentPayload = {
  apiVersion: 1;
  users: Record<string, {
    userId: number;
    updatedAt?: number;
    items: UgcStoreItem[];
  }>;
};

export type UgcEquippedStoreItem = Pick<UgcStoreItem, "id" | "identityKey" | "name" | "kind" | "url" | "key" | "slot" | "rigVersion" | "size" | "manifest"> & {
  equippedAt: number;
};
