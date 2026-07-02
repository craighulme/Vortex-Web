type MultiplayerFrameBridgeContext = {
  window: Window;
  runtimeApi: any;
  runtimeRemoteSession: () => any;
  remotePlayerService: () => any;
  normalizeAvatarFields: (data?: Record<string, unknown>) => any;
  playerDisplayName: (id: unknown, username: unknown) => string;
  noteRemoteState: (...args: any[]) => void;
  animateRemote: (...args: any[]) => void;
  hasBubbles: () => boolean;
  updateBubblePositions: () => void;
  shouldSkipAvatarRebuild: () => boolean;
  clearSkipAvatarRebuild: () => void;
};

export function installMultiplayerFrameBridge(context: MultiplayerFrameBridgeContext) {
  const {
    window,
    runtimeApi,
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

  function updateFrame(dt: number) {
    const remoteSession = runtimeRemoteSession();
    if (remoteSession.pendingAvatars.size === 0 && remoteSession.remotes.size === 0 && !hasBubbles()) return;

    const cam = runtimeApi.getCamera?.();
    remoteSession.updateFrame({
      service: remotePlayerService(),
      dt,
      now: performance.now(),
      shouldAnimate: !!cam?.position,
      normalizeAvatar: normalizeAvatarFields,
      displayName: playerDisplayName,
      noteState: (remote: unknown, status: unknown, reason: unknown) => noteRemoteState(remote, status, reason),
      animate: animateRemote,
      onCreateError: (error: unknown) => console.error("[mp] makeRemote failed:", error),
      cameraPosition: cam?.position || null,
    });

    updateBubblePositions();
  }

  function rebuildAvatars() {
    runtimeRemoteSession().rebuildAll({
      service: remotePlayerService(),
      normalizeAvatar: normalizeAvatarFields,
      onError: (error: unknown) => console.error("[mp] avatar rebuild failed:", error),
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
