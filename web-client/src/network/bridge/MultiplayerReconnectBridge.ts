type MultiplayerReconnectBridgeOptions = {
  Chat: any;
  setTimeout: Window["setTimeout"];
  stopBroadcast: () => void;
  runtimeSession: () => any;
  runtimeMultiplayer: () => any;
  connect: () => unknown;
};

export function createMultiplayerReconnectBridge(options: MultiplayerReconnectBridgeOptions) {
  const scheduleReconnect = (label = "relay") => {
    options.stopBroadcast();
    const session = options.runtimeSession();
    const closedWs = session.resetForReconnect();
    const plan = options.runtimeMultiplayer().planReconnect(label, Boolean(closedWs?._kicked));
    if (plan.kicked) return;
    if (plan.exhausted) {
      try {
        if (session.shouldEmitRelayNotice?.(`reconnect-exhausted:${label}`, 30000) !== false) {
          options.Chat.warn(plan.message);
        }
      } catch {
        // Chat may not be fully mounted during failed startup recovery.
      }
      return;
    }

    try {
      if (session.shouldEmitRelayNotice?.(`reconnect:${label}`, 15000) !== false) {
        options.Chat.warn(plan.message);
      }
    } catch {
      // Chat may not be fully mounted during failed startup recovery.
    }
    options.setTimeout(options.connect, plan.delayMs);
  };

  return {
    scheduleReconnect
  };
}
