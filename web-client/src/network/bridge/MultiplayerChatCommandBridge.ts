type MultiplayerChatCommandBridgeContext = Record<string, any> & {
  window: Window;
};

export function createMultiplayerChatCommandBridge(context: MultiplayerChatCommandBridgeContext) {
  const {
    window,
    Chat,
    chatCommands,
    runtimeApi,
    runtimeRemoteSession,
    requireLicenseFeature,
    getLaunchInfo,
    getLocalPlayerId
  } = context;

  function commandPlayerList() {
    return runtimeRemoteSession().commandPlayerList({
      localId: getLocalPlayerId(),
      localUsername: getLaunchInfo()?.username || "You",
      localPosition: runtimeApi.getCharacter?.()?.position?.clone?.() || null
    });
  }

  function movementMods() {
    return runtimeApi.getMovementMods?.() || {
      fly: false,
      noclip: false,
      airwalk: false,
      gravityScale: 1,
      flySpeed: 28
    };
  }

  function setMovementMods(patch: Record<string, unknown> = {}) {
    if (!runtimeApi.setMovementMods) throw new Error("movement modifiers are not available in this build");
    return runtimeApi.setMovementMods(patch);
  }

  function teleportLocalToScene(x: unknown, y: unknown, z: unknown) {
    const char = runtimeApi.getCharacter?.();
    if (!char) return false;
    char.position.set(Number(x), Number(y), Number(z));
    runtimeApi.setVelY?.(0);
    runtimeApi.setGrounded?.(false);
    return true;
  }

  function handleChatCommand(text: string) {
    return chatCommands.handle(text, {
      chat: Chat,
      players: commandPlayerList,
      localPosition: () => runtimeApi.getCharacter?.()?.position || null,
      movementMods,
      setMovementMods,
      requireFeature: requireLicenseFeature,
      teleportLocal: teleportLocalToScene,
      bringPlayer: (player: Record<string, any>) => {
        const char = runtimeApi.getCharacter?.();
        const remote = runtimeRemoteSession().get(player.id);
        if (!char || !remote) return false;
        const pos = char.position.clone();
        pos.x += Math.sin(char.rotation.y || 0) * 3;
        pos.z += Math.cos(char.rotation.y || 0) * 3;
        remote.tPos.copy(pos);
        remote.meshes?.grp?.position?.copy(pos);
        remote.meshes && (remote.meshes.grp.visible = true);
        remote.seen = performance.now();
        return true;
      },
    });
  }

  return {
    commandPlayerList,
    movementMods,
    setMovementMods,
    teleportLocalToScene,
    handleChatCommand
  };
}
