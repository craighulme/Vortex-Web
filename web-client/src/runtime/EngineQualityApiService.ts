import type { EngineRuntimeBridgeConfig } from "./EngineRuntimeBridgeTypes";

export class EngineQualityApiService {
  install(config: EngineRuntimeBridgeConfig): unknown {
    return config.quality.configureRuntime({
      windowRef: config.windowRef,
      localStorage: config.localStorage,
      renderer: config.renderer,
      scene: config.scene as never,
      shadows: config.shadows,
      rendererService: config.rendererService,
      toneMappingMode: () => config.sceneSettings.readToneMappingMode(),
      fogSettings: () => config.sceneSettings.readFogSettings(),
      shadowQuality: config.shadowQuality,
      shadowMapSize: config.shadowMapSize,
      shadowsActive: config.shadowsActive,
      readStorageFlag: config.readStorageFlag,
      useStudTextures: config.worldRuntime.useStudTextures,
      textureDiagnostics: config.worldRuntime.textureDiagnostics,
      caches: () => ({
        geometries: config.worldRuntime.geometryService.snapshot().geometries,
        materials: config.worldRuntime.materialService.snapshot().materials,
        textures: config.worldRuntime.textureService.snapshot().textures,
        parts: config.worldRuntime.partService.snapshot(),
        renderChunks: config.worldService.renderChunkSnapshot?.() || null
      }),
      setShadows: config.setShadowsEnabled,
      setShadowQuality: config.setShadowQuality,
      setToneMapping: (value) => config.sceneSettings.setToneMappingMode(String(value)),
      setRenderFog: (value) => config.sceneSettings.setRenderFog(Boolean(value)),
      setFogDistance: (value) => config.sceneSettings.setFogDistance(Number(value)),
      setRenderDistance: (value, profile) => config.worldService.setRenderDistance?.(Number(value), profile),
      setStudTexturesEnabled: (value) => config.worldRuntime.textureService.setStudTextures(!!value),
      refreshMaterials: () => {
        config.worldRuntime.refreshStudMaterialTextures();
        config.sceneSettings.markMaterialsForShaderUpdate();
      },
      diagnoseSceneInput: () => ({
        scene: config.scene,
        renderer: config.renderer,
        shadows: config.shadows,
        toneMappingMode: config.sceneSettings.readToneMappingMode()
      })
    });
  }
}
