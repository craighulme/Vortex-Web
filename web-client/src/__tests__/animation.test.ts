import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimationService, type RigBoneLike } from "../animation/AnimationService";

function bone(): RigBoneLike {
  return {
    rotation: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  };
}

describe("AnimationService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("owns remote walk/jump/climb pose animation", () => {
    const service = new AnimationService();
    const remote = {
      anim: "jump",
      animTime: 0,
      meshes: {
        bones: {
          Left_Arm: bone(),
          Right_Arm: bone(),
          Left_Leg: bone(),
          Right_Leg: bone(),
          Torso: bone()
        },
        rest: {
          Left_Arm: { x: 0, z: 0, py: 0 },
          Right_Arm: { x: 0, z: 0, py: 0 },
          Left_Leg: { x: 0 },
          Right_Leg: { x: 0 },
          Torso: { x: 0, z: 0 }
        }
      }
    };

    service.animateRuntimeRemote(remote, 1 / 60);

    expect(remote.animTime).toBeGreaterThan(0);
    expect(remote.meshes.bones.Left_Arm.rotation.x).toBeLessThan(0);
    expect(remote.meshes.bones.Right_Arm.position.y).toBeLessThan(0);
  });

  it("exposes default animation slots and lets packages override slots", () => {
    const service = new AnimationService();
    expect(service.getAnimationSet().defaultSlots).toEqual(expect.arrayContaining(["idle", "walk", "run", "jump", "fall", "climb", "climb_idle"]));

    const arm = bone();
    const remote = {
      anim: "dance",
      animTime: 0,
      meshes: {
        bones: { Left_Arm: arm },
        rest: { Left_Arm: { x: 0 } }
      }
    };

    service.registerClip("dance", ({ bones }) => {
      const left = bones.Left_Arm;
      if (left) left.rotation.x = 1.25;
    });
    service.animateRuntimeRemote(remote, 1 / 60);

    expect(service.getAnimationSet().slots).toContain("dance");
    expect(arm.rotation.x).toBe(1.25);
    expect(service.unregisterClip("dance")).toBe(true);
    expect(service.getAnimationSet().slots).not.toContain("dance");
  });

  it("keeps player animation overrides scoped to that avatar", () => {
    const service = new AnimationService();
    const overriddenArm = bone();
    const defaultArm = bone();

    service.animateRuntimeRemote({
      anim: "idle",
      animTime: 0,
      meshes: {
        bones: { Left_Arm: overriddenArm },
        rest: { Left_Arm: { x: 0, z: 0 } },
        animationClips: {
          idle: ({ bones }) => {
            if (bones.Left_Arm) bones.Left_Arm.rotation.x = 2;
          }
        }
      }
    }, 1 / 60);
    service.animateRuntimeRemote({
      anim: "idle",
      animTime: 0,
      meshes: {
        bones: { Left_Arm: defaultArm },
        rest: { Left_Arm: { x: 0, z: 0 } }
      }
    }, 1 / 60);

    expect(overriddenArm.rotation.x).toBe(2);
    expect(defaultArm.rotation.x).not.toBe(2);
  });

  it("uses the climb idle slot when attached to a truss without movement", () => {
    const service = new AnimationService();
    const leftArm = bone();
    const animation = {
      time: 0,
      bones: {
        Left_Arm: leftArm,
        Right_Arm: bone(),
        Left_Leg: bone(),
        Right_Leg: bone(),
        Torso: bone()
      },
      rest: {
        Left_Arm: { x: 0, z: 0, py: 0 },
        Right_Arm: { x: 0, z: 0, py: 0 },
        Left_Leg: { x: 0 },
        Right_Leg: { x: 0 },
        Torso: { x: 0, z: 0 }
      }
    };

    service.animateLocal(animation, { dt: 1 / 10, moving: false, grounded: true, climbing: true });

    expect(leftArm.rotation.x).toBeLessThan(-1);
    expect(leftArm.position.y).toBeGreaterThan(0);
  });

  it("uses fall pose while airborne with downward velocity", () => {
    const service = new AnimationService();
    const leftArm = bone();
    const rightArm = bone();
    const animation = {
      time: 0,
      bones: {
        Left_Arm: leftArm,
        Right_Arm: rightArm,
        Left_Leg: bone(),
        Right_Leg: bone(),
        Torso: bone()
      },
      rest: {
        Left_Arm: { x: 0, z: 0, py: 0 },
        Right_Arm: { x: 0, z: 0, py: 0 },
        Left_Leg: { x: 0 },
        Right_Leg: { x: 0 },
        Torso: { x: 0, z: 0 }
      }
    };

    service.animateLocal(animation, { dt: 1 / 10, moving: false, grounded: false, climbing: false, verticalVelocity: -20 });

    expect(leftArm.rotation.z).toBeGreaterThan(0);
    expect(rightArm.rotation.z).toBeLessThan(0);
    expect(leftArm.position.y).toBeGreaterThan(0);
  });

  it("keeps idle subtly animated instead of static", () => {
    const service = new AnimationService();
    const leftArm = bone();
    const torso = bone();
    const animation = {
      time: 0,
      bones: {
        Left_Arm: leftArm,
        Right_Arm: bone(),
        Left_Leg: bone(),
        Right_Leg: bone(),
        Torso: torso
      },
      rest: {
        Left_Arm: { x: 0, z: 0, py: 0 },
        Right_Arm: { x: 0, z: 0, py: 0 },
        Left_Leg: { x: 0 },
        Right_Leg: { x: 0 },
        Torso: { x: 0, z: 0 }
      }
    };

    service.animateLocal(animation, { dt: 0.25, moving: false, grounded: true, climbing: false });

    expect(Math.abs(Number(leftArm.rotation.z))).toBeGreaterThan(0.01);
    expect(Math.abs(Number(torso.rotation.x))).toBeGreaterThan(0.001);
  });

  it("owns local foot IK state and bone offsets", () => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => key === "vwebFootIkDisabled" ? "0" : null
    });
    const service = new AnimationService();
    service.setFootIk({ enabled: true, smoothing: 30, footProbeDistance: 2.5, maxLegExtension: 1.35 });
    const leftLeg = bone();
    const rightLeg = bone();
    const torso = bone();
    const animation = {
      time: 0,
      bones: { Left_Leg: leftLeg, Right_Leg: rightLeg, Torso: torso },
      rest: {
        Left_Leg: { px: 0.8, py: 0, pz: 0, sy: 1 },
        Right_Leg: { px: -0.8, py: 0, pz: 0, sy: 1 },
        Torso: { py: 0 }
      }
    };

    const state = service.applyLocalFootIk({
      animation,
      character: { position: { x: 0, y: 3, z: 0 }, rotation: { y: 0 } },
      physics: {
        snapshot: () => ({ status: "ready" }),
        castRay: () => ({ point: [0, 0.5, 0] })
      },
      dt: 1 / 30,
      moving: false,
      grounded: true,
      footOffset: 2,
      charHeight: 5
    });

    expect(state.active).toBe(true);
    expect(state.leftY).toBeLessThan(0);
    expect(leftLeg.position.y).toBeLessThan(0);
  });
});
