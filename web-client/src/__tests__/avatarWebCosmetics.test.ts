import { describe, expect, it } from "vitest";
import { AvatarEquipmentService } from "../avatar/AvatarEquipmentService";
import { AvatarItemCatalogService } from "../avatar/AvatarItemCatalogService";
import { AvatarWebCosmeticsService } from "../avatar/AvatarWebCosmeticsService";
import { VORTEX_RIG_VERSION } from "../avatar/rig/VortexRigSpec";
import { AssetStreamService } from "../streaming/AssetStreamService";

describe("AvatarWebCosmeticsService", () => {
  it("creates a web-only cosmetics payload from equipment and item manifests", () => {
    const equipment = new AvatarEquipmentService();
    const catalog = new AvatarItemCatalogService(equipment, new AssetStreamService({ warn: () => undefined }));
    catalog.register({
      id: "ugc:back:jetpack",
      name: "Jetpack",
      slot: "Back",
      kind: "accessory",
      assetUrl: "https://assets.example.invalid/jetpack.glb",
      bone: "Torso"
    });
    catalog.equip("ugc:back:jetpack");

    const payload = new AvatarWebCosmeticsService().createPayload(18154, equipment.snapshot(), catalog, {
      animationPack: {
        id: "anim:default-plus",
        version: 1,
        slots: {
          idle: "idle.glb#Idle",
          walk: "walk.glb#Walk",
          climb: "climb.glb#Climb"
        }
      }
    });

    expect(payload).toMatchObject({
      type: "web_avatar_cosmetics",
      apiVersion: 1,
      rigVersion: VORTEX_RIG_VERSION,
      playerId: 18154,
      animationPack: {
        id: "anim:default-plus",
        slots: {
          climb: "climb.glb#Climb"
        }
      }
    });
    expect(payload?.equipped.Back?.id).toBe("ugc:back:jetpack");
    expect(payload?.items[0]?.assetUrl).toBe("https://assets.example.invalid/jetpack.glb");
    expect(new AvatarWebCosmeticsService().snapshot(payload).animationSlots).toBe(3);
  });

  it("rejects payloads for unsupported rig versions", () => {
    const service = new AvatarWebCosmeticsService();

    expect(service.readPayload({
      type: "web_avatar_cosmetics",
      apiVersion: 1,
      rigVersion: "old-rig",
      playerId: 18154,
      updatedAt: Date.now(),
      equipped: {},
      items: []
    })).toBeNull();
  });

  it("drops invalid animation pack slots from received payloads", () => {
    const payload = new AvatarWebCosmeticsService().readPayload({
      type: "web_avatar_cosmetics",
      apiVersion: 1,
      rigVersion: VORTEX_RIG_VERSION,
      playerId: 18154,
      updatedAt: Date.now(),
      equipped: {},
      items: [],
      animationPack: {
        id: "anim:web",
        version: 1,
        slots: {
          idle: "idle.glb#Idle",
          bad: "bad.glb#Bad"
        }
      }
    });

    expect(payload?.animationPack?.slots).toEqual({ idle: "idle.glb#Idle" });
  });
});
