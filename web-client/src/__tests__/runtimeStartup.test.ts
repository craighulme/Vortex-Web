import { describe, expect, it } from "vitest";
import { RuntimeStartupService } from "../runtime/RuntimeStartupService";

describe("RuntimeStartupService", () => {
  it("installs quality, runtime exports, frame loop, and vortex api", () => {
    const windowRef = { requestAnimationFrame: () => 0 } as unknown as Window & Record<string, unknown>;
    const localMovement = {
      getGrounded: () => true,
      getVelY: () => 4,
      setVelY: () => {},
      setGrounded: () => {},
      constants: () => ({ WALK_SPEED: 16, JUMP_POWER: 50, GRAVITY: -196.2 }),
      getMovementMods: () => ({ fly: false }),
      setMovementMods: () => ({ fly: true }),
      getClimbState: () => "none"
    };
    const runtimeApiExports = {
      installed: null as unknown,
      install(options: unknown) {
        this.installed = options;
        (options as { setRuntimeApi(value: unknown): void; runtimeApi: unknown }).setRuntimeApi((options as { runtimeApi: unknown }).runtimeApi);
        return (options as { runtimeApi: unknown }).runtimeApi;
      }
    };
    const frameLoop = {
      started: null as unknown,
      start(options: unknown) {
        this.started = options;
      }
    };
    const quality = {
      configured: null as unknown,
      configureRuntime(options: unknown) {
        this.configured = options;
        return this;
      }
    };
    const character = { position: { y: 10 } };
    let installedRuntimeApi: unknown = null;

    const api = new RuntimeStartupService().install({
      windowRef,
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } as unknown as Storage,
      three: {
        Mesh: class {},
        BufferGeometry: class { setAttribute() {} },
        Float32BufferAttribute: class {}
      } as any,
      scene: {},
      renderer: { render: () => {}, getPixelRatio: () => 1, userData: { vwebBackend: "webgpu" } },
      cameraObject: {},
      avatarMaterials: { applyShirtToMesh: () => {} } as any,
      avatarAssets: { prefetchAvatarImages: () => {} } as any,
      localAvatar: { getShirtMesh: () => ({}), applyAvatar: async () => {}, getAvatar: () => ({}) } as any,
      avatarUgcEquipment: { applyToLocal: async () => {}, applyToRemote: async () => {} } as any,
      remoteAvatarAppearance: {
        applyShirtToMesh: () => {},
        buildShirtOverlay: () => ({}),
        buildPantsOverlay: () => ({}),
        buildFaceOverlay: () => ({}),
        applyBodyColors: () => {},
        prepareModernAvatarMaterials: () => ({}),
        applyAvatarToMeshes: async () => {}
      } as any,
      characterSpawn: {
        getSpawn: () => ({ x: 1 }),
        setSpawn: () => {},
        applyToCharacter: () => {}
      } as any,
      localMovement: localMovement as any,
      camera: { snapshot: () => ({ yaw: 1 }), setSensitivity: () => {} } as any,
      animation: { getFootIkState: () => ({ active: false }) },
      shadows: { snapshot: () => ({}), markNeedsUpdate: () => {} },
      shadowQuality: () => "medium",
      shadowMapSize: () => 2048,
      shadowsActive: () => false,
      setShadowsEnabled: () => false,
      setShadowQuality: () => ({}),
      sceneSettings: {
        readToneMappingMode: () => "none",
        readFogSettings: () => ({}),
        setToneMappingMode: () => "none",
        setRenderFog: () => ({}),
        setFogDistance: () => ({}),
        markMaterialsForShaderUpdate: () => {}
      } as any,
      rendererService: { detectRendererBackend: () => "webgpu", diagnoseScene: () => ({}) } as any,
      quality: quality as any,
      runtimeApiExports: runtimeApiExports as any,
      setRuntimeApi: (value) => {
        installedRuntimeApi = value;
      },
      frameLoop: frameLoop as any,
      profiler: { begin: () => ({}), mark: () => {}, end: () => {} },
      worldService: { attachRuntimeAdapter: () => {} },
      worldRuntime: {
        textureService: { snapshot: () => ({ textures: 1 }), setStudTextures: () => {} },
        geometryService: { snapshot: () => ({ geometries: 1 }) },
        materialService: { snapshot: () => ({ materials: 1 }) },
        partService: { snapshot: () => ({}) },
        objects: [],
        colliders: [],
        dynamicObjects: {
          spawnPart: () => [{}, 1],
          removeObject: () => {},
          spawnMesh: () => ({}),
          createBatchMesh: () => ({}),
          createRuntimeMesh: () => ({}),
          createGeometry: () => ({}),
          scene: {},
          objects: [],
          bufferGeometryUtils: {},
          shadowsActive: () => false
        },
        useStudTextures: () => true,
        refreshStudMaterialTextures: () => {},
        textureDiagnostics: () => []
      },
      keys: {},
      anim: { rest: {} },
      getCharacter: () => character,
      getCharHeight: () => 5,
      getCharFootOffset: () => 2,
      getCharStandY: () => 3.5,
      readStorageFlag: () => false,
      requestPointerLock: () => {},
      resetCharacterToSpawn: () => true,
      pick: () => "hit",
      update: () => {},
      updateCamera: () => {},
      updateDebug: () => {},
      updateMultiplayer: () => {},
      updateLighting: () => {}
    });

    const apiMethods = api as {
      getGrounded: () => boolean;
      getVelY: () => number;
      pick: () => unknown;
      getCharBubbleBase: () => number;
    };

    expect(apiMethods.getGrounded).toBeDefined();
    expect(apiMethods.getVelY()).toBe(4);
    expect(apiMethods.pick()).toBe("hit");
    expect(apiMethods.getCharBubbleBase()).toBe(13.4);
    expect(windowRef._vortex).toBeUndefined();
    expect(installedRuntimeApi).toBe(api);
    expect(quality.configured).toBeTruthy();
    expect(runtimeApiExports.installed).toBeTruthy();
    expect(frameLoop.started).toBeTruthy();
  });
});
