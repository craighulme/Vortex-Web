import { describe, expect, it } from "vitest";
import { RuntimeAssetResolverService } from "../assets/RuntimeAssetResolverService";

describe("RuntimeAssetResolverService", () => {
  it("prefers manifest resolution before fallback keys", () => {
    const resolver = new RuntimeAssetResolverService().configure({
      assets: {
        manifest: { raw: { fallback: "/fallback.png" } },
        resolve: (path) => path === "textures.stud" ? "/modern.png" : null
      }
    });

    expect(resolver.resolve("textures.stud", "fallback")).toBe("/modern.png");
    expect(resolver.resolve("missing.path", "fallback")).toBe("/fallback.png");
  });

  it("tolerates missing or invalid fallback JSON", () => {
    const resolver = new RuntimeAssetResolverService().configure({
      assets: {},
      fallbackRaw: "{nope"
    });

    expect(resolver.resolve("missing.path", "fallback")).toBeNull();
  });
});
