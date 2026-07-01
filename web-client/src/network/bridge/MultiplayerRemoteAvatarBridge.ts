type RemoteAvatarBridgeContext = {
  THREE: unknown;
  document: Document;
  runtimeApi: unknown;
  remotePlayers: {
    configure(options: { THREE: unknown; document: Document; runtimeApi: unknown }): {
      makeRemote(username: string, id: number, avatar: unknown): unknown;
      setNameLabel(remote: unknown, username: string): void;
      disposeRemote(meshes: unknown): void;
    };
  } | null | undefined;
  animation?: {
    animateRuntimeRemote?(remote: unknown, dt: number): void;
  } | null;
};

export function createMultiplayerRemoteAvatarBridge(context: RemoteAvatarBridgeContext) {
  const {
    THREE,
    document,
    runtimeApi,
    remotePlayers,
    animation
  } = context;

  function service() {
    if (!remotePlayers) throw new Error("[mp] VortexRuntime remote player service is required.");
    return remotePlayers.configure({ THREE, document, runtimeApi });
  }

  function make(username: string, id: number, avatar: unknown) {
    return service().makeRemote(username, id, avatar);
  }

  function setNameLabel(remote: unknown, username: string) {
    service().setNameLabel(remote, username);
  }

  function dispose(meshes: unknown) {
    service().disposeRemote(meshes);
  }

  function animate(_id: unknown, remote: unknown, dt: number) {
    animation?.animateRuntimeRemote?.(remote, dt);
  }

  return {
    service,
    make,
    setNameLabel,
    dispose,
    animate
  };
}
