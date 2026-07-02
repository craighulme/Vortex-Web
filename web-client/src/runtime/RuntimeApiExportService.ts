import type { WorldDynamicAdapter } from "../world/WorldDynamicObjectService";

export type RuntimeApi = Record<string, unknown>;

export type RuntimeApiExportOptions = {
  windowRef: Window & Record<string, unknown>;
  detailTarget?: EventTarget;
  three: unknown;
  scene: unknown;
  renderer: unknown;
  camera: unknown;
  runtimeApi: RuntimeApi;
  setRuntimeApi(value: RuntimeApi): void;
  rendererService: {
    attachRuntimeAdapter(handles: { three?: unknown; scene?: unknown; camera?: unknown; renderer?: unknown }): void;
  };
  worldService: {
    attachRuntimeAdapter(handles: Record<string, unknown>): void;
  };
  worldHandles: WorldDynamicAdapter;
};

export class RuntimeApiExportService {
  install(options: RuntimeApiExportOptions): RuntimeApi {
    options.rendererService.attachRuntimeAdapter({
      three: options.three,
      scene: options.scene,
      camera: options.camera,
      renderer: options.renderer
    });
    options.setRuntimeApi(options.runtimeApi);
    options.worldService.attachRuntimeAdapter({
      ...options.worldHandles,
      setSpawn: options.runtimeApi.setSpawn,
      pick: options.runtimeApi.pick,
      getObjects: options.runtimeApi.getObjects,
      getColliders: options.runtimeApi.getColliders
    });

    const target = options.detailTarget || options.windowRef;
    target.dispatchEvent(new CustomEvent("vweb-runtime-exports-ready", { detail: options.runtimeApi }));
    return options.runtimeApi;
  }
}
