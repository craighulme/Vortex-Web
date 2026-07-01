type RuntimeApiLike = {
  getCharFootOffset?(): unknown;
};

type RuntimeMultiplayerAccessor = () => {
  nativeFootOffset(sceneOffset?: number): number;
  nativeYToSceneY(y: unknown, nativeFootOffset: number, sceneFootOffset: number): number;
  sceneYToNativeY(y: unknown, nativeFootOffset: number, sceneFootOffset: number): number;
};

export function createMultiplayerCoordinateBridge({
  runtimeApi,
  runtimeMultiplayer
}: {
  runtimeApi: RuntimeApiLike;
  runtimeMultiplayer: RuntimeMultiplayerAccessor;
}) {
  function nativeFootOffset() {
    const sceneOffset = Number(runtimeApi.getCharFootOffset?.());
    return runtimeMultiplayer().nativeFootOffset(Number.isFinite(sceneOffset) ? sceneOffset : undefined);
  }

  function sceneFootOffset() {
    const offset = Number(runtimeApi.getCharFootOffset?.());
    return Number.isFinite(offset) ? offset : nativeFootOffset();
  }

  function nativeYToSceneY(y: unknown) {
    return runtimeMultiplayer().nativeYToSceneY(y, nativeFootOffset(), sceneFootOffset());
  }

  function sceneYToNativeY(y: unknown) {
    return runtimeMultiplayer().sceneYToNativeY(y, nativeFootOffset(), sceneFootOffset());
  }

  return {
    nativeFootOffset,
    sceneFootOffset,
    nativeYToSceneY,
    sceneYToNativeY
  };
}
