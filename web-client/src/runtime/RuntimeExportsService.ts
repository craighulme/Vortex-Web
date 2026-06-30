export type RuntimeExportsApi = Record<string, unknown>;

export type RuntimeExportsOptions = {
  windowRef: Window & Record<string, unknown>;
  detailTarget?: EventTarget;
  three: unknown;
  gltfLoaderClass: unknown;
  gltfLoader: unknown;
  scene: unknown;
  ambient: unknown;
  renderer: unknown;
  objects: unknown[];
  camera: unknown;
  cam: unknown;
  vortexApi: RuntimeExportsApi;
  rendererService: {
    attachRuntimeAdapter(handles: { scene?: unknown; camera?: unknown; renderer?: unknown }): void;
  };
  worldService: {
    attachRuntimeAdapter(handles: Record<string, unknown>): void;
  };
  worldHandles: {
    addPart: unknown;
    removePart: unknown;
    createRuntimeMesh(geometry: unknown, material: unknown): unknown;
    createGeometry(attributes: Record<string, { array: ArrayLike<number>; itemSize: number }>): unknown;
    scene: unknown;
    objects: unknown[];
    bufferGeometryUtils: unknown;
    shadowsActive: unknown;
  };
  cursorOver(element: Element | null | undefined): boolean;
};

export class RuntimeExportsService {
  install(options: RuntimeExportsOptions): RuntimeExportsApi {
    const windowRef = options.windowRef;
    windowRef._vortex = options.vortexApi;
    windowRef.THREE = options.three;
    windowRef.GLTFLoader = options.gltfLoaderClass;
    windowRef.gltfLoader = options.gltfLoader;
    windowRef.scene = options.scene;
    windowRef.ambient = options.ambient;
    windowRef.renderer = options.renderer;
    windowRef.objects = options.objects;
    windowRef.camera = options.camera;
    windowRef.cam = options.cam;
    windowRef._cursorOver = options.cursorOver;

    options.rendererService.attachRuntimeAdapter({
      scene: options.scene,
      camera: options.camera,
      renderer: options.renderer
    });
    options.worldService.attachRuntimeAdapter({
      ...options.worldHandles,
      setSpawn: options.vortexApi.setSpawn,
      pick: options.vortexApi.pick,
      getObjects: options.vortexApi.getObjects,
      getColliders: options.vortexApi.getColliders
    });

    const target = options.detailTarget || windowRef;
    target.dispatchEvent(new CustomEvent("vweb-runtime-exports-ready", { detail: options.vortexApi }));
    target.dispatchEvent(new CustomEvent("vortex-engine-ready", { detail: options.vortexApi }));
    return options.vortexApi;
  }
}
