import type { RuntimeApi } from "./RuntimeApiExportService";
import { QualityApiService } from "./QualityApiService";
import { RuntimeApiService } from "./RuntimeApiService";
import type { RuntimeStartupConfig } from "./RuntimeStartupTypes";

export class RuntimeStartupService {
  private readonly qualityApi = new QualityApiService();
  private readonly runtimeApi = new RuntimeApiService();

  install(config: RuntimeStartupConfig): RuntimeApi {
    const runtimeApi = this.runtimeApi.create(config);
    config.windowRef.VortexQuality = this.qualityApi.install(config);

    config.runtimeApiExports.install({
      windowRef: config.windowRef,
      three: config.three,
      scene: config.scene,
      renderer: config.renderer,
      camera: config.cameraObject,
      runtimeApi,
      setRuntimeApi: config.setRuntimeApi,
      rendererService: config.rendererService,
      worldService: config.worldService,
      worldHandles: config.worldRuntime.dynamicObjects
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
    return runtimeApi;
  }
}
