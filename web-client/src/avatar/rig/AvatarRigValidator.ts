import {
  LEGACY_VORTEX_R7_RIG_VERSION,
  VORTEX_RIG_SPEC,
  VORTEX_RIG_VERSION,
  type VortexRigSpec
} from "./VortexRigSpec";

export type RigSceneNode = {
  name?: unknown;
  children?: unknown;
  traverse?: (visitor: (node: RigSceneNode) => void) => void;
};

export type AvatarRigValidationIssue = {
  code:
    | "missing-required-bone"
    | "missing-attachment-anchor"
    | "missing-ik-helper"
    | "duplicate-node-name";
  name: string;
  severity: "error" | "warning";
};

export type AvatarRigValidationResult = {
  ok: boolean;
  version: typeof VORTEX_RIG_VERSION;
  nodeCount: number;
  boneNames: string[];
  attachmentAnchors: string[];
  missingRequiredBones: string[];
  missingAttachmentAnchors: string[];
  missingIkHelpers: string[];
  duplicateNames: string[];
  issues: AvatarRigValidationIssue[];
};

export type AvatarRigKind = typeof VORTEX_RIG_VERSION | typeof LEGACY_VORTEX_R7_RIG_VERSION | "unknown";

export type AvatarRigDetectionResult = {
  kind: AvatarRigKind;
  confidence: number;
  nodeNames: string[];
  matchedRequiredBones: string[];
  matchedLegacyBones: string[];
};

export type AvatarRigUpgradePlan = {
  from: AvatarRigKind;
  to: typeof VORTEX_RIG_VERSION;
  requiredBoneMap: Readonly<Record<string, readonly string[]>>;
  createBones: string[];
  createAttachmentAnchors: Array<{ name: string; parentBone: string }>;
  createIkHelpers: string[];
  notes: string[];
};

export class AvatarRigValidator {
  constructor(private readonly spec: VortexRigSpec = VORTEX_RIG_SPEC) {}

  validate(input: unknown): AvatarRigValidationResult {
    return validateVortexRig(input, this.spec);
  }

  detect(input: unknown): AvatarRigDetectionResult {
    return detectVortexRig(input, this.spec);
  }

  createUpgradePlan(input: unknown): AvatarRigUpgradePlan {
    return createRigUpgradePlan(input, this.spec);
  }
}

const LEGACY_R7_BONES = [
  "HumanoidRootPart",
  "Torso",
  "Head",
  "Left Arm",
  "Right Arm",
  "Left Leg",
  "Right Leg"
] as const;

const LEGACY_R7_TO_VWEB_BONE_MAP: Readonly<Record<string, readonly string[]>> = {
  HumanoidRootPart: ["Root", "Hips"],
  Torso: ["Spine", "Chest", "Neck"],
  Head: ["Head"],
  "Left Arm": ["LeftUpperArm", "LeftLowerArm", "LeftHand"],
  "Right Arm": ["RightUpperArm", "RightLowerArm", "RightHand"],
  "Left Leg": ["LeftUpperLeg", "LeftLowerLeg", "LeftFoot"],
  "Right Leg": ["RightUpperLeg", "RightLowerLeg", "RightFoot"]
};

export function validateVortexRig(input: unknown, spec: VortexRigSpec = VORTEX_RIG_SPEC): AvatarRigValidationResult {
  const names = collectNodeNames(input);
  const nameSet = new Set(names);
  const duplicateNames = collectDuplicates(names);
  const missingRequiredBones = spec.requiredBones.filter((bone) => !nameSet.has(bone));
  const missingAttachmentAnchors = spec.attachmentAnchors
    .map((anchor) => anchor.anchor)
    .filter((anchor) => !nameSet.has(anchor));
  const missingIkHelpers = spec.ikHelpers.filter((helper) => !nameSet.has(helper));
  const issues: AvatarRigValidationIssue[] = [
    ...missingRequiredBones.map((name) => issue("missing-required-bone", name, "error")),
    ...missingAttachmentAnchors.map((name) => issue("missing-attachment-anchor", name, "warning")),
    ...missingIkHelpers.map((name) => issue("missing-ik-helper", name, "warning")),
    ...duplicateNames.map((name) => issue("duplicate-node-name", name, "warning"))
  ];

  return {
    ok: missingRequiredBones.length === 0,
    version: spec.version,
    nodeCount: names.length,
    boneNames: spec.requiredBones.filter((bone) => nameSet.has(bone)),
    attachmentAnchors: spec.attachmentAnchors.map((anchor) => anchor.anchor).filter((anchor) => nameSet.has(anchor)),
    missingRequiredBones,
    missingAttachmentAnchors,
    missingIkHelpers,
    duplicateNames,
    issues
  };
}

export function detectVortexRig(input: unknown, spec: VortexRigSpec = VORTEX_RIG_SPEC): AvatarRigDetectionResult {
  const nodeNames = collectNodeNames(input);
  const nameSet = new Set(nodeNames);
  const matchedRequiredBones = spec.requiredBones.filter((bone) => nameSet.has(bone));
  const matchedLegacyBones = LEGACY_R7_BONES.filter((bone) => nameSet.has(bone));
  const vwebConfidence = matchedRequiredBones.length / spec.requiredBones.length;
  const legacyConfidence = matchedLegacyBones.length / LEGACY_R7_BONES.length;
  if (vwebConfidence === 1) {
    return {
      kind: VORTEX_RIG_VERSION,
      confidence: 1,
      nodeNames,
      matchedRequiredBones,
      matchedLegacyBones
    };
  }
  if (legacyConfidence >= 0.85) {
    return {
      kind: LEGACY_VORTEX_R7_RIG_VERSION,
      confidence: Number(legacyConfidence.toFixed(4)),
      nodeNames,
      matchedRequiredBones,
      matchedLegacyBones
    };
  }
  return {
    kind: "unknown",
    confidence: Number(Math.max(vwebConfidence, legacyConfidence).toFixed(4)),
    nodeNames,
    matchedRequiredBones,
    matchedLegacyBones
  };
}

export function createRigUpgradePlan(input: unknown, spec: VortexRigSpec = VORTEX_RIG_SPEC): AvatarRigUpgradePlan {
  const detection = detectVortexRig(input, spec);
  const nameSet = new Set(detection.nodeNames);
  const createBones = spec.requiredBones.filter((bone) => !nameSet.has(bone));
  return {
    from: detection.kind,
    to: VORTEX_RIG_VERSION,
    requiredBoneMap: LEGACY_R7_TO_VWEB_BONE_MAP,
    createBones,
    createAttachmentAnchors: spec.attachmentAnchors
      .filter((anchor) => !nameSet.has(anchor.anchor))
      .map((anchor) => ({ name: anchor.anchor, parentBone: anchor.bone })),
    createIkHelpers: spec.ikHelpers.filter((helper) => !nameSet.has(helper)),
    notes: upgradeNotes(detection.kind)
  };
}

export function collectNodeNames(input: unknown): string[] {
  const names: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const record = node as RigSceneNode;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (name) names.push(name);
    if (Array.isArray(record.children)) {
      for (const child of record.children) visit(child);
    }
  };

  if (Array.isArray(input)) {
    for (const node of input) visit(node);
    return names;
  }

  const root = input as RigSceneNode;
  if (root && typeof root === "object" && typeof root.traverse === "function") {
    root.traverse((node) => visit({ name: node.name }));
    return names;
  }

  visit(input);
  return names;
}

function collectDuplicates(names: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) duplicates.add(name);
    else seen.add(name);
  }
  return [...duplicates];
}

function issue(code: AvatarRigValidationIssue["code"], name: string, severity: AvatarRigValidationIssue["severity"]): AvatarRigValidationIssue {
  return { code, name, severity };
}

function upgradeNotes(kind: AvatarRigKind): string[] {
  if (kind === VORTEX_RIG_VERSION) return ["Rig already matches the Vortex Web target skeleton."];
  if (kind === LEGACY_VORTEX_R7_RIG_VERSION) {
    return [
      "Legacy R7 limbs need split upper/lower/hand/foot bones before foot IK or layered animation can be reliable.",
      "Keep visual mesh weighting separate from the character collision root.",
      "Attachment anchors should be empty nodes parented to stable target bones so UGC transforms survive mesh revisions."
    ];
  }
  return [
    "Rig does not match a known Vortex Web source skeleton.",
    "Use the required bone list and attachment anchors from vweb-rig-v1 before importing UGC."
  ];
}
