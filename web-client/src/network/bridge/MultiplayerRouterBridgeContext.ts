type MultiplayerRouterBridgeContext = Record<string, any>;
type AnyValue = any;

export function handleMultiplayerBridgeMessage(d: Record<string, any>, ctx: MultiplayerRouterBridgeContext) {
  if (ctx.queueUntilRuntimeApi(d)) return;
  ctx.remoteBridge.recordMultiplayerMessage(d);
  ctx.runtimeRouter().handle(d, {
    selfId: ctx.getSelfId,
    setSelfId: (id: AnyValue) => {
      ctx.setSelfId(id);
      ctx.runtimeRemoteSession().selfId = id;
    },
    launchInfo: ctx.getLaunchInfo,
    setLaunchInfoFromInit: (message: Record<string, any>, username: AnyValue) => {
      const launchInfo = {
        id: message.id,
        username,
        gameId: message.game_id || message.gameId || Number(ctx.window.GAME_ID || 0),
        shirtId: message.shirt_id || 0,
        pantId: message.pant_id || 0,
        bodyType: message.body_type || "male",
        bodyColors: message.body_colors || [],
        faceId: message.face_id || 0,
        clientToken: "",
        raw: message
      };
      ctx.setLaunchInfo(launchInfo);
      ctx.runtimeSession().launchInfo = launchInfo;
    },
    fallbackGameId: () => Number(ctx.window.GAME_ID || 0),
    displayName: ctx.playerDisplayName,
    applyKnownPlayerName: ctx.applyKnownPlayerName,
    recordPlayers: ctx.recordReplicatedPlayers,
    recordProbe: ctx.recordProbeEvent,
    recordLeave: (id: AnyValue, username: AnyValue) => ctx.runtimePacketDebug().recordLeave(id, username),
    hasRemote: (id: AnyValue) => ctx.runtimeRemoteSession().has(id),
    getRemote: (id: AnyValue) => ctx.runtimeRemoteSession().get(id),
    addRemote: ctx.remoteBridge.addRemote,
    removeRemote: ctx.remoteBridge.removeRemote,
    decodeRemoteState: ctx.remoteBridge.decodeNetworkData,
    prefetchAvatarImages: (value: AnyValue) => ctx.runtimeApi.prefetchAvatarImages?.(value),
    applyLocalAvatar: (value: AnyValue) => ctx.runtimeApi.applyAvatar?.(value),
    applyAvatarToRemote: (remote: Record<string, any>, data: Record<string, any>) => {
      const avatar = ctx.normalizeAvatarFields({ ...(remote.avatar || {}), ...data });
      remote.avatar = avatar;
      if (remote.meshes) {
        ctx.runtimeApi.applyAvatarToMeshes?.(remote.meshes, {
          ...avatar,
          id: remote.id,
          playerId: remote.id,
          username: remote.username
        });
        return true;
      }
      return false;
    },
    updatePendingShirt: (id: AnyValue, shirtId: AnyValue) => {
      const pending = ctx.runtimeRemoteSession().pendingAvatars.get(id);
      if (pending) pending.shirt_id = shirtId;
    },
    setLeaderboardSelf: (id: AnyValue) => ctx.leaderboard().setMyId(id),
    addLeaderboardPlayer: (player: AnyValue) => ctx.leaderboard().addPlayer(player),
    setLeaderboardFriendStatus: (id: AnyValue, status: AnyValue) => ctx.leaderboard().setFriendStatus(id, status),
    setRuntimeFriendStatus: (id: AnyValue, status: AnyValue) => ctx.runtimeMultiplayer().setFriendStatus(id, status),
    fetchFriendData: ctx.fetchFriendData,
    startBroadcast: ctx.startBroadcast,
    kicked: () => {
      const socket = ctx.runtimeSession().socket;
      if (socket) socket._kicked = true;
      socket?.close?.();
      ctx.window.location.href = "/";
    },
    openScreen: (screenId: AnyValue, token: AnyValue) => ctx.window.openScreen?.(screenId, token),
    chat: {
      system: (message: AnyValue) => ctx.Chat.system(message),
      systemRed: (message: AnyValue) => ctx.Chat.systemRed(message),
      systemPlayer: (username: AnyValue, message: AnyValue) => ctx.Chat.systemPlayer(username, message),
      clearPlayerMsg: (username: AnyValue) => ctx.Chat.clearPlayerMsg(username),
      message: (username: AnyValue, message: AnyValue, self: AnyValue, isStaff: AnyValue, isOwner: AnyValue, isBooster: AnyValue, playerId: AnyValue) => ctx.Chat.message(username, message, self, isStaff, isOwner, isBooster, playerId),
      warn: (message: AnyValue) => ctx.Chat.warn(message)
    },
    bubble: ctx.showBubble,
    notifications: {
      friendRequest: (fromId: AnyValue, username: AnyValue) => ctx.window.Notifications?.friendRequest(fromId, username),
      friendRequestCancelled: (fromId: AnyValue) => ctx.window.Notifications?.friendRequestCancelled?.(fromId),
      friendAccepted: (username: AnyValue) => ctx.window.Notifications?.friendAccepted(username),
      followed: (username: AnyValue) => ctx.window.Notifications?.followed?.(username),
      unfollowed: (username: AnyValue) => ctx.window.Notifications?.unfollowed?.(username)
    }
  });
}
