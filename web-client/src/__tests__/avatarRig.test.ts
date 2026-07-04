import { describe, expect, it } from "vitest";
import { AvatarRigValidator } from "../avatar/rig/AvatarRigValidator";
import { runtimeBoneAliases } from "../avatar/rig/RigBoneAliases";
import {
  LEGACY_VORTEX_R7_RIG_VERSION,
  VORTEX_RIG_ATTACHMENT_ANCHORS,
  VORTEX_RIG_IK_HELPERS,
  VORTEX_RIG_REQUIRED_BONES,
  VORTEX_RIG_VERSION
} from "../avatar/rig/VortexRigSpec";

describe("AvatarRigValidator", () => {
  it("accepts a complete Vortex Web rig scene", () => {
    const nodes = [
      ...VORTEX_RIG_REQUIRED_BONES,
      ...VORTEX_RIG_IK_HELPERS,
      ...VORTEX_RIG_ATTACHMENT_ANCHORS.map((anchor) => anchor.anchor)
    ].map((name) => ({ name }));

    const result = new AvatarRigValidator().validate(nodes);

    expect(result.ok).toBe(true);
    expect(result.version).toBe(VORTEX_RIG_VERSION);
    expect(result.missingRequiredBones).toEqual([]);
    expect(result.missingAttachmentAnchors).toEqual([]);
  });

  it("reports missing required bones as errors and missing anchors as warnings", () => {
    const result = new AvatarRigValidator().validate([{ name: "Root" }, { name: "Hips" }, { name: "Hips" }]);

    expect(result.ok).toBe(false);
    expect(result.duplicateNames).toEqual(["Hips"]);
    expect(result.issues.some((issue) => issue.code === "missing-required-bone" && issue.severity === "error")).toBe(true);
    expect(result.issues.some((issue) => issue.code === "missing-attachment-anchor" && issue.severity === "warning")).toBe(true);
  });

  it("detects the current Vortex R7 GLB skeleton as a legacy source rig", () => {
    const validator = new AvatarRigValidator();
    const legacyNodes = [
      "Body",
      "HumanoidRootPart",
      "Torso",
      "Head",
      "Left Arm",
      "Right Arm",
      "Left Leg",
      "Right Leg"
    ].map((name) => ({ name }));

    const detection = validator.detect(legacyNodes);
    const plan = validator.createUpgradePlan(legacyNodes);

    expect(detection.kind).toBe(LEGACY_VORTEX_R7_RIG_VERSION);
    expect(detection.confidence).toBe(1);
    expect(plan.from).toBe(LEGACY_VORTEX_R7_RIG_VERSION);
    expect(plan.requiredBoneMap["Left Arm"]).toEqual(["LeftUpperArm", "LeftLowerArm", "LeftHand"]);
    expect(plan.createBones).toContain("LeftLowerLeg");
    expect(plan.createAttachmentAnchors.length).toBeGreaterThan(10);
    expect(plan.createIkHelpers).toContain("IK_LeftFoot_Target");
  });

  it("returns an unknown rig plan for arbitrary models", () => {
    const plan = new AvatarRigValidator().createUpgradePlan([{ name: "Cube" }, { name: "Armature" }]);

    expect(plan.from).toBe("unknown");
    expect(plan.createBones).toContain("Root");
    expect(plan.notes[0]).toContain("does not match");
  });

  it("binds Vortex Web bones to legacy animation aliases", () => {
    expect(runtimeBoneAliases("LeftUpperLeg")).toEqual(expect.arrayContaining(["LeftUpperLeg", "Left_Leg", "Left Leg"]));
    expect(runtimeBoneAliases("RightUpperArm")).toEqual(expect.arrayContaining(["RightUpperArm", "Right_Arm", "Right Arm"]));
    expect(runtimeBoneAliases("Chest")).toEqual(expect.arrayContaining(["Chest", "Torso", "UpperTorso"]));
  });
});
