type AccessBridgeConfig = {
  devLocalRelay?: unknown;
  hubUrl?: unknown;
};

type AccessBridgeContext = {
  localStorage: Storage;
  Chat: { warn(message: string): void };
  runtimeAccess(): {
    hasLicenseFeature(feature: string, options: Record<string, unknown>): boolean;
    packetDebug(options: Record<string, unknown>): boolean;
    avatarSpoof(options: Record<string, unknown>): boolean;
    hasDevTools(options: Record<string, unknown>): boolean;
  };
  runtimePacketDebug(): {
    syncAccess(value: boolean): boolean;
  };
  runtimeMultiplayer(): {
    isLocalRelayUrl(url: unknown): boolean;
  };
  getBridgeConfig(): AccessBridgeConfig;
  getLaunchInfo(): unknown;
};

export function createMultiplayerAccessBridge(context: AccessBridgeContext) {
  const {
    localStorage,
    Chat,
    runtimeAccess,
    runtimePacketDebug,
    runtimeMultiplayer,
    getBridgeConfig,
    getLaunchInfo
  } = context;

  function isLocalDevRelay() {
    const cfg = getBridgeConfig();
    return !!(cfg.devLocalRelay && cfg.hubUrl && runtimeMultiplayer().isLocalRelayUrl(cfg.hubUrl));
  }

  function hasLicenseFeature(feature: string) {
    return runtimeAccess().hasLicenseFeature(feature, {
      launchInfo: getLaunchInfo(),
      isLocalDevRelay: isLocalDevRelay()
    });
  }

  function hasPacketDebugAccess() {
    return runtimeAccess().packetDebug({
      config: getBridgeConfig(),
      launchInfo: getLaunchInfo(),
      isLocalDevRelay: isLocalDevRelay()
    });
  }

  function hasAvatarSpoofAccess() {
    return runtimeAccess().avatarSpoof({
      config: getBridgeConfig(),
      launchInfo: getLaunchInfo(),
      isLocalDevRelay: isLocalDevRelay()
    });
  }

  function syncPacketDebugAccess() {
    return runtimePacketDebug().syncAccess(hasPacketDebugAccess());
  }

  function assertPacketDebugAccess() {
    if (hasPacketDebugAccess()) return true;
    runtimePacketDebug().syncAccess(false);
    localStorage.removeItem("vwebPacketDebug");
    throw new Error("packet debug is not enabled on this license");
  }

  function hasDevToolsEnabled() {
    return runtimeAccess().hasDevTools({
      config: getBridgeConfig(),
      isLocalDevRelay: isLocalDevRelay()
    });
  }

  function requireLicenseFeature(feature: string, label?: string) {
    if (hasLicenseFeature(feature)) return true;
    const name = label || feature;
    try { Chat.warn(`${name} is not enabled on this license.`); } catch { }
    return false;
  }

  function assertLicenseFeature(feature: string, label?: string) {
    if (hasLicenseFeature(feature)) return true;
    throw new Error(`${label || feature} is not enabled on this license`);
  }

  return {
    isLocalDevRelay,
    hasLicenseFeature,
    hasPacketDebugAccess,
    hasAvatarSpoofAccess,
    syncPacketDebugAccess,
    assertPacketDebugAccess,
    hasDevToolsEnabled,
    requireLicenseFeature,
    assertLicenseFeature
  };
}
