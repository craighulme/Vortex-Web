import { describe, expect, it } from "vitest";
import { AvatarEquipmentService } from "../avatar/AvatarEquipmentService";

describe("AvatarEquipmentService", () => {
  it("normalizes, equips, snapshots, and removes attachment slots", () => {
    const service = new AvatarEquipmentService();

    expect(service.slotMetadata().map((slot) => slot.slot)).toContain("RightHand");
    expect(service.equip({ id: "sword", slot: "righthand", kind: "tool", assetUrl: "/sword.glb" } as never)).toEqual({
      id: "sword",
      slot: "RightHand",
      kind: "tool",
      assetUrl: "/sword.glb"
    });
    expect(service.snapshot().RightHand?.id).toBe("sword");
    expect(service.unequip("RightHand")).toBe(true);
    expect(service.snapshot().RightHand).toBeUndefined();
  });

  it("rejects invalid attachment records", () => {
    const service = new AvatarEquipmentService();

    expect(service.equip({ id: "hat", slot: "Unknown" } as never)).toBeNull();
    expect(service.equip({ slot: "Hat" })).toBeNull();
  });
});
