export type RuntimeAnimationSlot = "idle" | "walk" | "run" | "jump" | "fall" | "climb" | "climb_idle" | string;

export type RigBoneLike = {
  rotation: Record<string, number>;
  position: Record<string, number>;
  scale?: Record<string, number>;
  quaternion?: {
    set?(x: number, y: number, z: number, w: number): void;
    slerp?(target: unknown, alpha: number): void;
  };
};

export type RigBoneRest = {
  x?: number;
  y?: number;
  z?: number;
  px?: number;
  py?: number;
  pz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
};

export type AnimationPoseContext = {
  bones: Record<string, RigBoneLike | undefined>;
  rest: Record<string, RigBoneRest | undefined>;
  slot: RuntimeAnimationSlot | undefined;
  time: number;
  dt: number;
  moving?: boolean;
};

export type AnimationClip = (context: AnimationPoseContext) => void;

export const DEFAULT_ANIMATION_SLOTS = ["idle", "walk", "run", "jump", "fall", "climb", "climb_idle"] as const;

export function applyDefaultAnimationPose(context: AnimationPoseContext): void {
  const slot = normalizeAnimationSlot(context.slot, context.moving);
  const speed = 12;
  const t = Number(context.time || 0);

  if (slot === "climb") {
    const phase = t * Math.PI * 2.2;
    const grip = Math.sin(phase) * 0.12;
    const kick = Math.sin(phase) * 0.28;
    setBoneRotation(context, "Left_Arm", "x", -Math.PI * 0.62 + grip, 12);
    setBoneRotation(context, "Right_Arm", "x", -Math.PI * 0.62 - grip, 12);
    setBoneRotation(context, "Left_Arm", "z", 0.35, 10);
    setBoneRotation(context, "Right_Arm", "z", -0.35, 10);
    setBoneRotation(context, "Left_Leg", "x", 0.3 + kick, 10);
    setBoneRotation(context, "Right_Leg", "x", 0.3 - kick, 10);
    setBoneRotation(context, "Torso", "x", -0.15, 10);
    setBoneRotation(context, "Torso", "z", 0, 10);
    setBonePosition(context, "Left_Arm", "y", 0.36, 12);
    setBonePosition(context, "Right_Arm", "y", 0.36, 12);
    return;
  }

  if (slot === "climb_idle") {
    setBoneRotation(context, "Left_Arm", "x", -Math.PI * 0.72, 10);
    setBoneRotation(context, "Right_Arm", "x", -Math.PI * 0.72, 10);
    setBoneRotation(context, "Left_Arm", "z", 0.32, 10);
    setBoneRotation(context, "Right_Arm", "z", -0.32, 10);
    setBoneRotation(context, "Left_Leg", "x", 0.18, 10);
    setBoneRotation(context, "Right_Leg", "x", -0.18, 10);
    setBoneRotation(context, "Torso", "x", -0.12, 10);
    setBoneRotation(context, "Torso", "z", 0, 10);
    setBonePosition(context, "Left_Arm", "y", 0.42, 10);
    setBonePosition(context, "Right_Arm", "y", 0.42, 10);
    return;
  }

  if (slot === "jump" || slot === "fall") {
    if (slot === "jump") {
      setBoneRotation(context, "Left_Leg", "x", 0.06, speed);
      setBoneRotation(context, "Right_Leg", "x", 0.06, speed);
      setBoneRotation(context, "Left_Arm", "x", -Math.PI, speed);
      setBoneRotation(context, "Right_Arm", "x", -Math.PI, speed);
      setBoneRotation(context, "Left_Arm", "z", 0.03, speed);
      setBoneRotation(context, "Right_Arm", "z", -0.03, speed);
      setBoneRotation(context, "Torso", "x", 0, speed);
      setBonePosition(context, "Left_Arm", "y", -0.75, speed);
      setBonePosition(context, "Right_Arm", "y", -0.75, speed);
      return;
    }
    setBoneRotation(context, "Left_Leg", "x", 0.08, speed);
    setBoneRotation(context, "Right_Leg", "x", 0.28, speed);
    setBoneRotation(context, "Left_Arm", "x", -0.25, speed);
    setBoneRotation(context, "Right_Arm", "x", -0.25, speed);
    setBoneRotation(context, "Left_Arm", "z", 0.45, speed);
    setBoneRotation(context, "Right_Arm", "z", -0.45, speed);
    setBoneRotation(context, "Torso", "x", 0.12, speed);
    setBonePosition(context, "Left_Arm", "y", 0.05, speed);
    setBonePosition(context, "Right_Arm", "y", 0.05, speed);
    return;
  }

  if (slot === "walk" || slot === "run") {
    const stride = slot === "run" ? 1.25 : 1.0;
    const armSwing = slot === "run" ? 1.0 : 0.8;
    const swing = Math.sin(t * (slot === "run" ? 3.8 : 2.8) * Math.PI);
    setBoneRotation(context, "Left_Leg", "x", swing * stride, speed);
    setBoneRotation(context, "Right_Leg", "x", -swing * stride, speed);
    setBoneRotation(context, "Left_Arm", "x", -swing * armSwing, speed);
    setBoneRotation(context, "Right_Arm", "x", swing * armSwing, speed);
    setBoneRotation(context, "Left_Arm", "z", 0.05, speed);
    setBoneRotation(context, "Right_Arm", "z", -0.05, speed);
    setBoneRotation(context, "Torso", "x", slot === "run" ? 0.08 : 0.03, speed);
    setBoneRotation(context, "Torso", "z", 0, speed);
    setBonePosition(context, "Left_Arm", "y", 0, speed);
    setBonePosition(context, "Right_Arm", "y", 0, speed);
    return;
  }

  const breathe = Math.sin(t * 1.6) * 0.025;
  const sway = Math.sin(t * 0.8 + 0.7) * 0.018;
  const armDrift = Math.sin(t * 1.1 + Math.PI * 0.4) * 0.02;
  const idleSpeed = 5;
  setBoneRotation(context, "Left_Leg", "x", 0, idleSpeed);
  setBoneRotation(context, "Right_Leg", "x", 0, idleSpeed);
  setBoneRotation(context, "Left_Arm", "x", 0.035 + armDrift, idleSpeed);
  setBoneRotation(context, "Right_Arm", "x", 0.035 - armDrift, idleSpeed);
  setBoneRotation(context, "Left_Arm", "z", 0.12 + breathe, idleSpeed);
  setBoneRotation(context, "Right_Arm", "z", -0.12 - breathe, idleSpeed);
  setBoneRotation(context, "Torso", "x", breathe * 0.65, idleSpeed);
  setBoneRotation(context, "Torso", "z", sway, idleSpeed);
  setBonePosition(context, "Left_Arm", "y", armDrift * 0.35, idleSpeed);
  setBonePosition(context, "Right_Arm", "y", -armDrift * 0.35, idleSpeed);
}

export function normalizeAnimationSlot(slot: RuntimeAnimationSlot | undefined, moving = true): RuntimeAnimationSlot {
  if (slot === "climb" && !moving) return "climb_idle";
  if (slot === "running") return "run";
  if (slot === "walking") return "walk";
  if (slot === "falling") return "fall";
  return slot || "idle";
}

function setBoneRotation(context: AnimationPoseContext, name: string, axis: string, target: number, speed: number): void {
  const bone = context.bones[name];
  if (!bone) return;
  const restValue = Number(context.rest[name]?.[axis as keyof RigBoneRest] ?? 0);
  bone.rotation[axis] = lerp(Number(bone.rotation[axis] || 0), restValue + target, Math.min(1, speed * context.dt));
}

function setBonePosition(context: AnimationPoseContext, name: string, axis: "x" | "y" | "z", offset: number, speed: number): void {
  const bone = context.bones[name];
  if (!bone) return;
  const restKey = axis === "x" ? "px" : axis === "y" ? "py" : "pz";
  const restValue = Number(context.rest[name]?.[restKey] ?? 0);
  bone.position[axis] = lerp(Number(bone.position[axis] || 0), restValue + offset, Math.min(1, speed * context.dt));
}

function lerp(current: number, target: number, alpha: number): number {
  return current + (target - current) * alpha;
}
