import { describe, expect, it } from "vitest";
import { RuntimeExportsService } from "../runtime/RuntimeExportsService";

describe("RuntimeExportsService", () => {
  it("installs runtime globals and adapter handles in one place", () => {
    const service = new RuntimeExportsService();
    const windowRef = new EventTarget() as Window & Record<string, unknown>;
    const rendererHandles: unknown[] = [];
    const worldHandles: Record<string, unknown>[] = [];
    let readyDetail: unknown = null;
    windowRef.addEventListener("vweb-runtime-exports-ready", (event) => {
      readyDetail = (event as CustomEvent).detail;
    });
    const vortexApi = {
      setSpawn: () => undefined,
      pick: () => undefined,
      getObjects: () => [],
      getColliders: () => []
    };

    service.install({
      windowRef,
      three: "three",
      gltfLoaderClass: "GLTFLoader",
      gltfLoader: "loader",
      scene: "scene",
      ambient: "ambient",
      renderer: "renderer",
      objects: [],
      camera: "camera",
      cam: "cam",
      vortexApi,
      rendererService: { attachRuntimeAdapter: (handles) => rendererHandles.push(handles) },
      worldService: { attachRuntimeAdapter: (handles) => worldHandles.push(handles) },
      worldHandles: {
        addPart: "addPart",
        removePart: "removePart",
        createRuntimeMesh: () => ({}),
        createGeometry: () => ({}),
        scene: "scene",
        objects: [],
        bufferGeometryUtils: "buffer",
        shadowsActive: () => true
      },
      cursorOver: () => false
    });

    expect(windowRef._vortex).toBe(vortexApi);
    expect(windowRef.THREE).toBe("three");
    expect(rendererHandles[0]).toMatchObject({ scene: "scene", camera: "camera", renderer: "renderer" });
    expect(worldHandles[0]).toMatchObject({ addPart: "addPart", setSpawn: vortexApi.setSpawn });
    expect(readyDetail).toBe(vortexApi);
  });
});
