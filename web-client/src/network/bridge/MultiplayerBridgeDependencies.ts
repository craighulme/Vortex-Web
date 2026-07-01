export type MultiplayerBridgeDependencies = {
  window: Window & { VortexRuntime?: any; Chat?: any; WebSocket: typeof WebSocket };
  document: Document;
  localStorage: Storage;
  setTimeout: Window["setTimeout"];
  setInterval: Window["setInterval"];
  clearInterval: Window["clearInterval"];
  fetch: typeof fetch;
  crypto: Crypto;
  WebSocket: typeof WebSocket;
  location: Location;
  THREE: any;
  Chat: any;
  runtimeApi: any;
  scene: any;
};

export type MultiplayerBridgeDependencyResult =
  | { ok: true; deps: MultiplayerBridgeDependencies }
  | { ok: false; reason: string };

export function resolveMultiplayerBridgeDependencies(windowRef: Window, documentRef: Document, runtimeApi: unknown): MultiplayerBridgeDependencyResult {
  const window = windowRef as MultiplayerBridgeDependencies["window"];
  const document = documentRef;
  const THREE = window.VortexRuntime?.renderer?.getHandles?.()?.three;
  const Chat = window.Chat;
  const api = runtimeApi as any;

  if (!api) return { ok: false, reason: "runtime exports are not ready" };
  if (!THREE) return { ok: false, reason: "THREE is not ready" };
  if (!Chat) return { ok: false, reason: "chat service is not ready" };

  return {
    ok: true,
    deps: {
      window,
      document,
      localStorage: window.localStorage,
      setTimeout: window.setTimeout.bind(window),
      setInterval: window.setInterval.bind(window),
      clearInterval: window.clearInterval.bind(window),
      fetch: window.fetch.bind(window),
      crypto: window.crypto,
      WebSocket: window.WebSocket,
      location: window.location,
      THREE,
      Chat,
      runtimeApi: api,
      scene: api?.scene
    }
  };
}
