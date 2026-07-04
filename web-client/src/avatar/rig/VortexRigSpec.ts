import {
  AVATAR_ATTACHMENT_SLOTS,
  AVATAR_SLOT_ANCHORS,
  AVATAR_SLOT_BONES,
  type AvatarAttachmentSlot
} from "../AvatarEquipmentService";

export const VORTEX_RIG_VERSION = "vweb-rig-v1" as const;
export const LEGACY_VORTEX_R7_RIG_VERSION = "legacy-vortex-r7" as const;

export const VORTEX_RIG_REQUIRED_BONES = [
  "Root",
  "Hips",
  "Spine",
  "Chest",
  "Neck",
  "Head",
  "LeftUpperArm",
  "LeftLowerArm",
  "LeftHand",
  "RightUpperArm",
  "RightLowerArm",
  "RightHand",
  "LeftUpperLeg",
  "LeftLowerLeg",
  "LeftFoot",
  "RightUpperLeg",
  "RightLowerLeg",
  "RightFoot"
] as const;

export const VORTEX_RIG_OPTIONAL_BONES = [
  "LeftToe",
  "RightToe",
  "Jaw",
  "LeftEye",
  "RightEye",
  "FaceRoot",
  "LeftThumb",
  "RightThumb",
  "LeftIndex",
  "RightIndex"
] as const;

export const VORTEX_RIG_IK_HELPERS = [
  "IK_LeftFoot_Target",
  "IK_RightFoot_Target",
  "IK_LeftFoot_Pole",
  "IK_RightFoot_Pole",
  "IK_LeftHand_Target",
  "IK_RightHand_Target",
  "IK_LeftHand_Pole",
  "IK_RightHand_Pole"
] as const;

export type VortexRigBoneName = typeof VORTEX_RIG_REQUIRED_BONES[number] | typeof VORTEX_RIG_OPTIONAL_BONES[number];

export type VortexRigAttachmentAnchor = {
  slot: AvatarAttachmentSlot;
  bone: string;
  anchor: string;
};

export type VortexRigSpec = {
  version: typeof VORTEX_RIG_VERSION;
  requiredBones: readonly string[];
  optionalBones: readonly string[];
  ikHelpers: readonly string[];
  attachmentAnchors: readonly VortexRigAttachmentAnchor[];
  retargetAliases: Readonly<Record<string, string>>;
};

export const VORTEX_RIG_ATTACHMENT_ANCHORS: readonly VortexRigAttachmentAnchor[] = AVATAR_ATTACHMENT_SLOTS.map((slot) => ({
  slot,
  bone: AVATAR_SLOT_BONES[slot],
  anchor: AVATAR_SLOT_ANCHORS[slot]
}));

export const VORTEX_RIG_RETARGET_ALIASES: Readonly<Record<string, string>> = {
  HumanoidRootPart: "Root",
  Torso: "Chest",
  UpperTorso: "Chest",
  LowerTorso: "Hips",
  "Left Arm": "LeftUpperArm",
  "Right Arm": "RightUpperArm",
  "Left Leg": "LeftUpperLeg",
  "Right Leg": "RightUpperLeg",
  Left_Arm: "LeftUpperArm",
  Right_Arm: "RightUpperArm",
  Left_Leg: "LeftUpperLeg",
  Right_Leg: "RightUpperLeg",
  LeftFoot: "LeftFoot",
  RightFoot: "RightFoot",
  mixamorigHips: "Hips",
  mixamorigSpine: "Spine",
  mixamorigSpine1: "Chest",
  mixamorigNeck: "Neck",
  mixamorigHead: "Head",
  mixamorigLeftArm: "LeftUpperArm",
  mixamorigLeftForeArm: "LeftLowerArm",
  mixamorigLeftHand: "LeftHand",
  mixamorigRightArm: "RightUpperArm",
  mixamorigRightForeArm: "RightLowerArm",
  mixamorigRightHand: "RightHand",
  mixamorigLeftUpLeg: "LeftUpperLeg",
  mixamorigLeftLeg: "LeftLowerLeg",
  mixamorigLeftFoot: "LeftFoot",
  mixamorigRightUpLeg: "RightUpperLeg",
  mixamorigRightLeg: "RightLowerLeg",
  mixamorigRightFoot: "RightFoot"
};

export const VORTEX_RIG_SPEC: VortexRigSpec = {
  version: VORTEX_RIG_VERSION,
  requiredBones: VORTEX_RIG_REQUIRED_BONES,
  optionalBones: VORTEX_RIG_OPTIONAL_BONES,
  ikHelpers: VORTEX_RIG_IK_HELPERS,
  attachmentAnchors: VORTEX_RIG_ATTACHMENT_ANCHORS,
  retargetAliases: VORTEX_RIG_RETARGET_ALIASES
};
