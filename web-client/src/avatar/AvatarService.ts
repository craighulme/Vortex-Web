export const ATTACHMENT_SLOTS = [
  "Head",
  "Face",
  "Hat",
  "Mask",
  "Torso",
  "Shirt",
  "Pants",
  "LeftHand",
  "RightHand",
  "Back",
  "LeftFoot",
  "RightFoot"
] as const;

export type AttachmentSlot = typeof ATTACHMENT_SLOTS[number];

export type AvatarState = {
  bodyType: "male" | "female";
  bodyColors: string[];
  shirtId: number;
  pantId: number;
  faceId: number;
  attachments: Partial<Record<AttachmentSlot, string>>;
};

export class AvatarService {
  normalize(input: Partial<AvatarState> = {}): AvatarState {
    return {
      bodyType: input.bodyType === "female" ? "female" : "male",
      bodyColors: normalizeBodyColors(input.bodyColors),
      shirtId: safeId(input.shirtId),
      pantId: safeId(input.pantId),
      faceId: safeId(input.faceId),
      attachments: { ...(input.attachments ?? {}) }
    };
  }
}

function normalizeBodyColors(colors: string[] | undefined): string[] {
  const out = Array.isArray(colors) ? colors.slice(0, 6) : [];
  while (out.length < 6) out.push("#ffffff");
  return out.map((color) => /^#[0-9a-f]{6}$/i.test(color) ? color : "#ffffff");
}

function safeId(value: number | undefined): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : 0;
}
