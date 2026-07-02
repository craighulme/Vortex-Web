type MultiplayerProfileBridgeOptions = {
  fetch: typeof fetch;
  community: () => any;
  runtimeMultiplayer: () => any;
  runtimeRemoteSession: () => any;
  leaderboard: () => any;
  setRemoteNameLabel: (id: number, username: string) => void;
};

export function createMultiplayerProfileBridge(options: MultiplayerProfileBridgeOptions) {
  const playerDisplayName = (id: unknown, username: unknown) => {
    return options.runtimeMultiplayer().playerDisplayName(id, username);
  };

  const applyKnownPlayerName = (id: unknown, username: unknown) => {
    const playerId = Number(id);
    if (!Number.isFinite(playerId) || playerId <= 0) return;

    return options.runtimeRemoteSession().applyKnownPlayerName(playerId, username, {
      remember: (id: number, value: string) => options.runtimeMultiplayer().rememberPlayerName(id, value),
      setNameLabel: options.setRemoteNameLabel,
      addLeaderboard: (player: unknown) => options.leaderboard().addPlayer(player)
    });
  };

  const fetchFriendData = async () => {
    await options.runtimeMultiplayer().fetchAndReplaceFriendLists(options.fetch);
    options.leaderboard().setFriendStatuses(
      options.runtimeMultiplayer().friendStatusMap(options.runtimeRemoteSession().remotes.keys())
    );
  };

  options.community()?.onVortexUserProfile?.((profile: { id?: unknown; username?: unknown }) => {
    if (!profile?.username) return;
    applyKnownPlayerName(profile.id, profile.username);
  });

  return {
    playerDisplayName,
    applyKnownPlayerName,
    fetchFriendData
  };
}
