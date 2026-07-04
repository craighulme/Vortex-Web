export const AVATAR_ATTACHMENT_SLOTS = [
  "Head",
  "Face",
  "Hair",
  "Hat",
  "Mask",
  "Neck",
  "Shoulders",
  "LeftShoulder",
  "RightShoulder",
  "Torso",
  "Chest",
  "Shirt",
  "Pants",
  "Waist",
  "Front",
  "LeftHand",
  "RightHand",
  "LeftArm",
  "RightArm",
  "Back",
  "LeftLeg",
  "RightLeg",
  "LeftFoot",
  "RightFoot"
] as const;

export type AvatarAttachmentSlot = typeof AVATAR_ATTACHMENT_SLOTS[number];

export type AvatarAttachmentKind = "accessory" | "clothing" | "tool" | "body" | "unknown";

export type AvatarAttachment = {
  id: string;
  slot: AvatarAttachmentSlot;
  kind: AvatarAttachmentKind;
  assetId?: string;
  assetUrl?: string;
  bone?: string;
  offset?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  metadata?: Record<string, unknown>;
};

export type AvatarEquipmentState = Partial<Record<AvatarAttachmentSlot, AvatarAttachment>>;

export class AvatarEquipmentService {
  private readonly equipped: AvatarEquipmentState = {};

  normalizeAttachment(input: Partial<AvatarAttachment> & { id?: unknown; slot?: unknown }): AvatarAttachment | null {
    const slot = normalizeSlot(input.slot);
    const id = String(input.id ?? input.assetId ?? input.assetUrl ?? "").trim();
    if (!slot || !id) return null;
    return {
      id,
      slot,
      kind: normalizeKind(input.kind),
      ...(input.assetId ? { assetId: String(input.assetId) } : {}),
      ...(input.assetUrl ? { assetUrl: String(input.assetUrl) } : {}),
      ...(input.bone ? { bone: String(input.bone) } : {}),
      ...(input.offset ? { offset: normalizeVector(input.offset, [0, 0, 0]) } : {}),
      ...(input.rotation ? { rotation: normalizeVector(input.rotation, [0, 0, 0]) } : {}),
      ...(input.scale ? { scale: normalizeVector(input.scale, [1, 1, 1]) } : {}),
      ...(input.metadata && typeof input.metadata === "object" ? { metadata: { ...input.metadata } } : {})
    };
  }

  equip(input: Partial<AvatarAttachment> & { id?: unknown; slot?: unknown }): AvatarAttachment | null {
    const attachment = this.normalizeAttachment(input);
    if (!attachment) return null;
    this.equipped[attachment.slot] = attachment;
    return { ...attachment };
  }

  unequip(slot: unknown): boolean {
    const normalized = normalizeSlot(slot);
    if (!normalized || !this.equipped[normalized]) return false;
    delete this.equipped[normalized];
    return true;
  }

  snapshot(): AvatarEquipmentState {
    return Object.fromEntries(
      Object.entries(this.equipped).map(([slot, attachment]) => [slot, attachment ? { ...attachment } : attachment])
    ) as AvatarEquipmentState;
  }

  slotMetadata(): Array<{ slot: AvatarAttachmentSlot; defaultBone: string; defaultAnchor: string; accepts: AvatarAttachmentKind[] }> {
    return AVATAR_ATTACHMENT_SLOTS.map((slot) => ({
      slot,
      defaultBone: AVATAR_SLOT_BONES[slot],
      defaultAnchor: AVATAR_SLOT_ANCHORS[slot],
      accepts: SLOT_ACCEPTS[slot]
    }));
  }
}

export const AVATAR_SLOT_BONES: Record<AvatarAttachmentSlot, string> = {
  Head: "Head",
  Face: "Head",
  Hair: "Head",
  Hat: "Head",
  Mask: "Head",
  Neck: "Neck",
  Shoulders: "Chest",
  LeftShoulder: "LeftUpperArm",
  RightShoulder: "RightUpperArm",
  Torso: "Torso",
  Chest: "Chest",
  Shirt: "Torso",
  Pants: "Torso",
  Waist: "Hips",
  Front: "Chest",
  LeftHand: "LeftHand",
  RightHand: "RightHand",
  LeftArm: "LeftLowerArm",
  RightArm: "RightLowerArm",
  Back: "Torso",
  LeftLeg: "LeftLowerLeg",
  RightLeg: "RightLowerLeg",
  LeftFoot: "LeftFoot",
  RightFoot: "RightFoot"
};

export const AVATAR_SLOT_ANCHORS: Record<AvatarAttachmentSlot, string> = Object.fromEntries(
  AVATAR_ATTACHMENT_SLOTS.map((slot) => [slot, `VWEB_Attach_${slot}`])
) as Record<AvatarAttachmentSlot, string>;

const SLOT_ACCEPTS: Record<AvatarAttachmentSlot, AvatarAttachmentKind[]> = {
  Head: ["body", "accessory"],
  Face: ["clothing", "accessory"],
  Hair: ["accessory"],
  Hat: ["accessory"],
  Mask: ["accessory"],
  Neck: ["accessory"],
  Shoulders: ["accessory"],
  LeftShoulder: ["accessory"],
  RightShoulder: ["accessory"],
  Torso: ["body", "accessory"],
  Chest: ["body", "accessory"],
  Shirt: ["clothing"],
  Pants: ["clothing"],
  Waist: ["accessory", "tool"],
  Front: ["accessory"],
  LeftHand: ["tool", "accessory"],
  RightHand: ["tool", "accessory"],
  LeftArm: ["body", "accessory"],
  RightArm: ["body", "accessory"],
  Back: ["accessory", "tool"],
  LeftLeg: ["body", "accessory"],
  RightLeg: ["body", "accessory"],
  LeftFoot: ["body", "accessory"],
  RightFoot: ["body", "accessory"]
};

function normalizeSlot(value: unknown): AvatarAttachmentSlot | null {
  const match = AVATAR_ATTACHMENT_SLOTS.find((slot) => slot.toLowerCase() === String(value || "").toLowerCase());
  return match ?? null;
}

function normalizeKind(value: unknown): AvatarAttachmentKind {
  const kind = String(value || "").toLowerCase();
  if (kind === "accessory" || kind === "clothing" || kind === "tool" || kind === "body") return kind;
  return "unknown";
}

function normalizeVector(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(value)) return fallback;
  const next = [Number(value[0]), Number(value[1]), Number(value[2])];
  return next.every(Number.isFinite) ? next as [number, number, number] : fallback;
}
