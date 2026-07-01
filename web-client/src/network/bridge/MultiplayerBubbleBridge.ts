type BubbleBridgeContext = {
  THREE: unknown;
  document: Document;
  window: Window;
  runtimeApi: {
    scene: unknown;
    getCharacter(): unknown;
    getCharBubbleBase(): number;
    getCharHeight(): number;
    getCharFootOffset(): number;
  };
  chatBubbles?: {
    configure(options: { THREE: unknown; document: Document; window: Window; scene: unknown }): {
      show(id: unknown, text: string): void;
      updatePositions(options: Record<string, unknown>): void;
    };
    clearPlayer?(id: unknown): void;
    hasBubbles?(): boolean;
  } | null;
  runtimeRemoteSession(): {
    get(id: unknown): { meshes?: { grp?: unknown } } | undefined;
  };
};

export function createMultiplayerBubbleBridge(context: BubbleBridgeContext) {
  const {
    THREE,
    document,
    window,
    runtimeApi,
    chatBubbles,
    runtimeRemoteSession
  } = context;

  function service() {
    if (!chatBubbles) throw new Error("[mp] VortexRuntime chat bubble service is required.");
    return chatBubbles.configure({ THREE, document, window, scene: runtimeApi.scene });
  }

  function show(id: unknown, text: string) {
    service().show(id, text);
  }

  function updatePositions(selfId: unknown) {
    service().updatePositions({
      selfId,
      selfAnchor: runtimeApi.getCharacter(),
      selfBubbleBaseY: runtimeApi.getCharBubbleBase(),
      remoteBubbleBaseOffset: runtimeApi.getCharHeight() - runtimeApi.getCharFootOffset() + 0.4,
      getRemoteAnchor: (id: unknown) => runtimeRemoteSession().get(id)?.meshes?.grp || null,
    });
  }

  function clear(id: unknown) {
    chatBubbles?.clearPlayer?.(id);
  }

  function hasBubbles() {
    return !!chatBubbles?.hasBubbles?.();
  }

  return {
    show,
    updatePositions,
    clear,
    hasBubbles
  };
}
