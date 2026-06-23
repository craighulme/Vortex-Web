import { describe, expect, it } from "vitest";
import { AssetManager } from "../assets/AssetManager";
import { normalizeAssetManifest } from "../assets/manifest";
import { DiagnosticsService } from "../diagnostics/DiagnosticsService";

describe("asset manifest", () => {
  it("normalizes legacy imported asset metadata", () => {
    const manifest = normalizeAssetManifest({
      stud: "stud.png",
      swordMdl: "sword.fbx",
      mapdata: { Baseplate: "baseplate.json" },
      imgdata: { icons: { baseplate: "icon.png" }, banners: { baseplate: "banner.png" } }
    });

    const assets = new AssetManager(manifest, new DiagnosticsService());
    expect(assets.resolve("textures.stud")).toBe("stud.png");
    expect(assets.resolve("meshes.swordMdl")).toBe("sword.fbx");
    expect(assets.resolve("maps.Baseplate")).toBe("baseplate.json");
    expect(assets.resolve("images.icons.baseplate")).toBe("icon.png");
  });
});
