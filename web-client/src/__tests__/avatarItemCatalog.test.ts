import { describe, expect, it } from "vitest";
import { AvatarEquipmentService } from "../avatar/AvatarEquipmentService";
import { AvatarItemCatalogService } from "../avatar/AvatarItemCatalogService";
import { AssetStreamService } from "../streaming/AssetStreamService";

describe("AvatarItemCatalogService", () => {
  it("registers streamed avatar items and equips through attachment slots", () => {
    const equipment = new AvatarEquipmentService();
    const streaming = new AssetStreamService({ warn: () => undefined });
    const catalog = new AvatarItemCatalogService(equipment, streaming);

    const record = catalog.register({
      id: "ugc:hat:1",
      name: "Test Hat",
      slot: "Hat",
      kind: "accessory",
      assetUrl: "https://assets.example.invalid/hat.glb",
      bone: "Head",
      offset: [0, 1, 0],
      tags: ["ugc", "hat"]
    });

    expect(record?.stream.status).toBe("queued");
    expect(streaming.byKind("avatar-item")).toHaveLength(1);
    expect(catalog.equip("ugc:hat:1")).toMatchObject({
      id: "ugc:hat:1",
      slot: "Hat",
      assetUrl: "https://assets.example.invalid/hat.glb",
      bone: "Head"
    });
    expect(equipment.snapshot().Hat?.id).toBe("ugc:hat:1");
  });

  it("rejects invalid item slots and refused stream manifests", () => {
    const warnings: unknown[] = [];
    const catalog = new AvatarItemCatalogService(
      new AvatarEquipmentService(),
      new AssetStreamService({ warn: (_event, payload) => warnings.push(payload) })
    );

    expect(catalog.register({
      id: "ugc:bad-slot",
      slot: "Unknown" as never,
      assetUrl: "https://assets.example.invalid/item.glb"
    })).toBeNull();

    const rejected = catalog.register({
      id: "ugc:bad-url",
      slot: "Back",
      assetUrl: "javascript:alert(1)"
    });

    expect(rejected?.stream.status).toBe("rejected");
    expect(catalog.equip("ugc:bad-url")).toBeNull();
    expect(warnings).toHaveLength(1);
  });
});
