import type { RemotePlayerService } from "../../avatar/RemotePlayerService";
import type { NativeAvatarState } from "../../avatar/AvatarService";
import type { RemotePlayerMeshes, RemotePlayerRecord, ThreeLike } from "../../avatar/remote/RemotePlayerTypes";
import type { RuntimeApi } from "../../runtime/RuntimeApiExportService";

type RemoteAvatarBridgeContext = {
  THREE: ThreeLike;
  document: Document;
  runtimeApi: RuntimeApi;
  remotePlayers: RemotePlayerService | null | undefined;
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

  function make(username: string, id: number, avatar: NativeAvatarState) {
    return service().makeRemote(username, id, avatar);
  }

  function setNameLabel(remote: RemotePlayerRecord | null | undefined, username: string) {
    service().setNameLabel(remote ? { meshes: remote.meshes ?? null } : null, username);
  }

  function dispose(meshes: RemotePlayerMeshes | null | undefined) {
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
