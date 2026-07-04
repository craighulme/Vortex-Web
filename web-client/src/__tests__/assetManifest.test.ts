import { describe, expect, it } from "vitest";
import { AssetManager } from "../assets/AssetManager";
import { normalizeAssetManifest } from "../assets/manifest";
import { DiagnosticsService } from "../diagnostics/DiagnosticsService";

describe("asset manifest", () => {
  it("normalizes imported asset metadata", () => {
    const manifest = normalizeAssetManifest({
      stud: "stud.png",
      malePlayerGlb: "male.glb",
      femalePlayerGlb: "female.glb",
      malePlayerGlbV1: "male-v1.glb",
      femalePlayerGlbV1: "female-v1.glb",
      vwebDefaultAnimationsGlb: "default-animations.glb",
      oofSound: "oof.mp3",
      mapdata: { Baseplate: "baseplate.json" },
      imgdata: { icons: { baseplate: "icon.png" }, banners: { baseplate: "banner.png" } }
    });

    const assets = new AssetManager(manifest, new DiagnosticsService());
    expect(assets.resolve("textures.stud")).toBe("stud.png");
    expect(assets.resolve("meshes.malePlayerGlb")).toBe("male.glb");
    expect(assets.resolveRequired("meshes.femalePlayerGlb")).toBe("female.glb");
    expect(assets.resolve("meshes.malePlayerGlbV1")).toBe("male-v1.glb");
    expect(assets.resolveRequired("meshes.femalePlayerGlbV1")).toBe("female-v1.glb");
    expect(assets.resolveRequired("meshes.vwebDefaultAnimationsGlb")).toBe("default-animations.glb");
    expect(assets.resolve("sounds.oofSound")).toBe("oof.mp3");
    expect(assets.resolve("maps.Baseplate")).toBe("baseplate.json");
    expect(assets.resolve("images.icons.baseplate")).toBe("icon.png");
    expect(() => assets.resolveRequired("meshes.missing")).toThrow("asset manifest missing path");
  });
});
