// @ts-nocheck

export function installMultiplayerFrameBridge(context) {
  const {
    window,
    vortex,
    runtimeRemoteSession,
    remotePlayerService,
    normalizeAvatarFields,
    playerDisplayName,
    noteRemoteState,
    animateRemote,
    hasBubbles,
    updateBubblePositions,
    shouldSkipAvatarRebuild,
    clearSkipAvatarRebuild
  } = context;

  function updateFrame(dt) {
    const remoteSession = runtimeRemoteSession();
    if (remoteSession.pendingAvatars.size === 0 && remoteSession.remotes.size === 0 && !hasBubbles()) return;

    const cam = vortex.getCamera?.();
    remoteSession.updateFrame({
      service: remotePlayerService(),
      dt,
      now: performance.now(),
      shouldAnimate: !!cam?.position,
      normalizeAvatar: normalizeAvatarFields,
      displayName: playerDisplayName,
      noteState: (remote, status, reason) => noteRemoteState(remote, status, reason),
      animate: animateRemote,
      onCreateError: (error) => console.error("[mp] makeRemote failed:", error),
      cameraPosition: cam?.position || null,
    });

    updateBubblePositions();
  }

  function rebuildAvatars() {
    runtimeRemoteSession().rebuildAll({
      service: remotePlayerService(),
      normalizeAvatar: normalizeAvatarFields,
      onError: (error) => console.error("[mp] avatar rebuild failed:", error),
    });
  }

  window.addEventListener("vweb-character-renderer-changed", () => {
    if (shouldSkipAvatarRebuild()) {
      clearSkipAvatarRebuild();
      return;
    }
    rebuildAvatars();
  });

  return { updateFrame, rebuildAvatars };
}
