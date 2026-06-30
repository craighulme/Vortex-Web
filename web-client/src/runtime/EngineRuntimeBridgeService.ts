import type { EngineRuntimeExportsApi } from "./EngineRuntimeExportsService";
import { EngineQualityApiService } from "./EngineQualityApiService";
import { EngineVortexApiService } from "./EngineVortexApiService";
import type { EngineRuntimeBridgeConfig } from "./EngineRuntimeBridgeTypes";

export class EngineRuntimeBridgeService {
  private readonly qualityApi = new EngineQualityApiService();
  private readonly vortexApi = new EngineVortexApiService();

  install(config: EngineRuntimeBridgeConfig): EngineRuntimeExportsApi {
    const vortexApi = this.vortexApi.create(config);
    config.windowRef.VortexQuality = this.qualityApi.install(config);

    config.runtimeExports.install({
      windowRef: config.windowRef,
      three: config.three,
      gltfLoaderClass: config.gltfLoaderClass,
      gltfLoader: config.gltfLoader,
      scene: config.scene,
      ambient: config.ambient,
      renderer: config.renderer,
      objects: config.worldRuntime.objects,
      camera: config.cameraObject,
      cam: config.cameraState,
      vortexApi,
      rendererService: config.rendererService,
      worldService: config.worldService,
      worldHandles: {
        addPart: config.worldRuntime.addPart,
        removePart: config.worldRuntime.removePart,
        createRuntimeMesh: (geometry, material) => new config.three.Mesh(geometry, material),
        createGeometry: (attributes) => {
          const geometry = new config.three.BufferGeometry();
          for (const [name, attribute] of Object.entries(attributes || {})) {
            geometry.setAttribute(name, new config.three.Float32BufferAttribute(attribute.array, attribute.itemSize));
          }
          return geometry;
        },
        scene: config.scene,
        objects: config.worldRuntime.objects,
        bufferGeometryUtils: config.bufferGeometryUtils,
        shadowsActive: config.shadowsActive
      },
      cursorOver: config.cursorOver
    });

    config.frameLoop.start({
      windowRef: config.windowRef,
      profiler: config.profiler,
      callbacks: {
        update: config.update,
        camera: config.updateCamera,
        debug: config.updateDebug,
        multiplayer: config.updateMultiplayer,
        lighting: config.updateLighting,
        render: () => config.renderer.render(config.scene, config.cameraObject)
      }
    });
    return vortexApi;
  }
}
