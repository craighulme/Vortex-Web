import { describe, expect, it } from "vitest";
import { AssetStreamService } from "../streaming/AssetStreamService";

describe("AssetStreamService", () => {
  it("accepts versioned safe manifests and tracks readiness", () => {
    const service = new AssetStreamService({ warn: () => undefined });
    const record = service.register({
      id: "mesh:test",
      kind: "mesh",
      apiVersion: 1,
      url: "https://assets.example.invalid/test.glb",
      slim: { impostorId: "mesh:test:impostor" }
    });

    expect(record.status).toBe("queued");
    expect(service.markReady("mesh:test")).toBe(true);
    expect(service.snapshot()).toEqual({ total: 1, queued: 0, ready: 1, rejected: 0 });
  });

  it("rejects script packages without integrity metadata", () => {
    const service = new AssetStreamService({ warn: () => undefined });
    const record = service.register({
      id: "script:test",
      kind: "script-package",
      apiVersion: 1,
      url: "https://assets.example.invalid/test.lua.wasm"
    });

    expect(record.status).toBe("rejected");
    expect(record.reason).toBe("script package requires integrity");
  });

  it("hydrates remote Vortex Web asset manifests", async () => {
    const service = new AssetStreamService({ warn: () => undefined });
    const fetcher = async () => Response.json({
      apiVersion: 1,
      assets: [
        {
          key: "animations/vweb-default-v1.glb",
          kind: "animations",
          url: "https://vweb.irongiant.vip/assets/animations/vweb-default-v1.glb",
          size: 1234,
          contentType: "model/gltf-binary",
          rigVersion: "vweb-rig-v1",
          sha256: "a".repeat(64)
        },
        {
          key: "ugc/hats/test.glb",
          kind: "ugc",
          url: "https://vweb.irongiant.vip/assets/ugc/hats/test.glb",
          size: 456
        }
      ]
    });

    const records = await service.hydrateRemoteManifest("https://vweb.irongiant.vip/assets/manifest", {
      fetcher,
      now: () => 1000
    });

    expect(records).toHaveLength(2);
    expect(service.get("animations/vweb-default-v1.glb")?.kind).toBe("animation");
    expect(service.get("animations/vweb-default-v1.glb")?.integrity).toBe(`sha256-${"a".repeat(64)}`);
    expect(service.get("ugc/hats/test.glb")?.kind).toBe("avatar-item");
    expect(service.remoteManifestSnapshot()).toEqual({ manifests: 1, inflight: 0, remoteAssets: 2 });
  });

  it("uses the remote manifest cache within the TTL", async () => {
    const service = new AssetStreamService({ warn: () => undefined });
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return Response.json({
        apiVersion: 1,
        assets: [{
          key: "textures/stud.png",
          kind: "textures",
          url: "https://vweb.irongiant.vip/assets/textures/stud.png"
        }]
      });
    };

    await service.hydrateRemoteManifest("https://vweb.irongiant.vip/assets/manifest", { fetcher, now: () => 1000 });
    await service.hydrateRemoteManifest("https://vweb.irongiant.vip/assets/manifest", { fetcher, now: () => 2000 });

    expect(calls).toBe(1);
    expect(service.byKind("texture")).toHaveLength(1);
  });
});
