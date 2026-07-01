// @ts-nocheck
import { createMultiplayerAccessBridge } from "./MultiplayerAccessBridge";
import { resolveMultiplayerBridgeDependencies } from "./MultiplayerBridgeDependencies";
import { createMultiplayerAvatarSpoofBridge } from "./MultiplayerAvatarSpoofBridge";
import { createMultiplayerBubbleBridge } from "./MultiplayerBubbleBridge";
import { createMultiplayerBroadcastBridge } from "./MultiplayerBroadcastBridge";
import { createMultiplayerConnectionBridge } from "./MultiplayerConnectionBridge";
import { createMultiplayerCoordinateBridge } from "./MultiplayerCoordinateBridge";
import { installMultiplayerConsoleBridge } from "./MultiplayerConsoleBridge";
import { installMultiplayerDebugConsole } from "./MultiplayerDebugConsoleBridge";
import { installMultiplayerFrameBridge } from "./MultiplayerFrameBridge";
import { createMultiplayerRemoteAvatarBridge } from "./MultiplayerRemoteAvatarBridge";
import { createMultiplayerRemoteBridge } from "./MultiplayerRemoteBridge";
import { createMultiplayerRuntimeServices } from "./MultiplayerRuntimeServices";
import { handleMultiplayerBridgeMessage } from "./MultiplayerRouterBridgeContext";
import { createMultiplayerLaunchState } from "./MultiplayerLaunchState";

export class MultiplayerBridgeService {
  private mounted = false;
  private frameBridge = null;
  private runtimeApi = null;

  constructor(
    private readonly windowRef: Window,
    private readonly documentRef: Document
  ) {}

  setRuntimeApi(api) {
    this.runtimeApi = api;
  }

  mount(runtime: unknown): boolean {
    if (this.mounted) return false;

    const resolved = resolveMultiplayerBridgeDependencies(this.windowRef, this.documentRef, this.runtimeApi);
    if (!resolved.ok) return false;
    const {
      window,
      document,
      localStorage,
      setTimeout,
      setInterval,
      clearInterval,
      fetch,
      crypto,
      WebSocket,
      location,
      THREE,
      Chat,
      runtimeApi,
      scene
    } = resolved.deps;
    const runtimeServices = runtime;
    const services = createMultiplayerRuntimeServices(runtimeServices);
    window.VortexRuntime = runtimeServices;
    this.mounted = true;

    function _hasRuntimeApi() {
        return !!runtimeApi;
    }
    
    function _queueUntilRuntimeApi(message) {
        return _runtimeMultiplayer().queueUntilRuntimeApiReady(message, _hasRuntimeApi());
    }
    
    function _flushPendingRuntimeApiMessages() {
        _runtimeMultiplayer().flushQueuedRuntimeApiMessages(_hasRuntimeApi, handle);
    }
    
    window.addEventListener("vweb-runtime-exports-ready", _flushPendingRuntimeApiMessages);
    window.addEventListener("vweb-runtime-ready", () => setTimeout(_flushPendingRuntimeApiMessages, 0));
    
    function _normalizeAvatarFields(data = {}) {
        return services.normalizeAvatarFields(data);
    }
    
    const launchState = createMultiplayerLaunchState();
    
    function _statusFor(id) {
        return _runtimeMultiplayer().friendStatus(id);
    }
    
    function _runtimeMultiplayer() {
        return services.multiplayer();
    }
    
    function _runtimeSession() {
        return services.session();
    }
    
    function _runtimeConnection() {
        return services.connection();
    }
    
    function _runtimeRouter() {
        return services.router();
    }
    
    function _runtimeRemoteSession() {
        return services.remoteSession();
    }
    
    function _runtimeAccess() {
        return services.access();
    }

    function _runtimeCommunity() {
        return services.community();
    }
    
    function _leaderboard() {
        return services.leaderboard();
    }
    const coordinateBridge = createMultiplayerCoordinateBridge({
        runtimeApi,
        runtimeMultiplayer: _runtimeMultiplayer
    });

    const {
        nativeFootOffset: _nativeFootOffset,
        sceneFootOffset: _sceneFootOffset,
        nativeYToSceneY: _nativeYToSceneY,
        sceneYToNativeY: _sceneYToNativeY
    } = coordinateBridge;

    const bubbleBridge = createMultiplayerBubbleBridge({
        THREE,
        document,
        window,
        runtimeApi,
        chatBubbles: runtimeServices.chatBubbles,
        runtimeRemoteSession: _runtimeRemoteSession
    });

    const remoteAvatarBridge = createMultiplayerRemoteAvatarBridge({
        THREE,
        document,
        runtimeApi,
        remotePlayers: runtimeServices.remotePlayers,
        animation: runtimeServices.animation
    });
    
    function _playerDisplayName(id, username) {
        return _runtimeMultiplayer().playerDisplayName(id, username);
    }
    
    function _applyKnownPlayerName(id, username) {
        const playerId = Number(id);
        if (!Number.isFinite(playerId) || playerId <= 0) return;
        return _runtimeRemoteSession().applyKnownPlayerName(playerId, username, {
            remember: (id, value) => _runtimeMultiplayer().rememberPlayerName(id, value),
            setNameLabel: remoteAvatarBridge.setNameLabel,
            addLeaderboard: (player) => _leaderboard().addPlayer(player)
        });
    }

    _runtimeCommunity()?.onVortexUserProfile?.((profile) => {
        if (!profile?.username) return;
        _applyKnownPlayerName(profile.id, profile.username);
    });
    
    async function fetchFriendData() {
        await _runtimeMultiplayer().fetchAndReplaceFriendLists(fetch);
        _leaderboard().setFriendStatuses(_runtimeMultiplayer().friendStatusMap(_runtimeRemoteSession().remotes.keys()));
    }
    
    function _scheduleReconnect(label = "relay") {
        broadcastBridge.stop();
        const closedWs = _runtimeSession().resetForReconnect();
        const plan = _runtimeMultiplayer().planReconnect(label, !!closedWs?._kicked);
        if (plan.kicked) return;
        if (plan.exhausted) {
            try { Chat.warn(plan.message); } catch { }
            return;
        }
        try { Chat.system(plan.message); } catch { }
        setTimeout(connect, plan.delayMs);
    }
    
    function getBridgeConfig() {
        return services.bridgeConfig();
    }

    let connectionBridge = null;
    
    function bridgeOpen() {
        return connectionBridge ? connectionBridge.isOpen() : _runtimeMultiplayer().isSocketOpen(_runtimeSession().socket);
    }
    
    let _skipNextRemoteAvatarRebuild = false;
    
    function _runtimePacketDebug() {
        return services.packetDebug();
    }
    
    function _recordReplicatedPlayers(source, players) {
        return _runtimePacketDebug().recordReplicatedPlayers(source, players, {
            fallbackGameId: window.GAME_ID || 0,
            normalizeAvatar: _normalizeAvatarFields,
            log: console
        });
    }
    
    function _avatarSignature(avatar) {
        return _runtimePacketDebug().avatarSignature(avatar, _normalizeAvatarFields);
    }
    
    function _recordProbeEvent(event) {
        return _runtimePacketDebug().recordProbeEvent(event, console);
    }

    const remoteBridge = createMultiplayerRemoteBridge({
        THREE,
        runtimeApi,
        fetch,
        localStorage,
        console,
        runtimeMultiplayer: _runtimeMultiplayer,
        runtimeRemoteSession: _runtimeRemoteSession,
        runtimePacketDebug: _runtimePacketDebug,
        community: _runtimeCommunity,
        normalizeAvatarFields: _normalizeAvatarFields,
        avatarSignature: _avatarSignature,
        nativeYToSceneY: _nativeYToSceneY,
        playerDisplayName: _playerDisplayName,
        makeRemote: remoteAvatarBridge.make,
        setRemoteNameLabel: remoteAvatarBridge.setNameLabel,
        disposeRemote: remoteAvatarBridge.dispose,
        clearBubble: bubbleBridge.clear,
        leaderboard: _leaderboard,
        statusFor: _statusFor
    });

    const accessBridge = createMultiplayerAccessBridge({
        localStorage,
        Chat,
        runtimeAccess: _runtimeAccess,
        runtimePacketDebug: _runtimePacketDebug,
        runtimeMultiplayer: _runtimeMultiplayer,
        getBridgeConfig,
        getLaunchInfo: launchState.getLaunchInfo
    });
    
    const avatarSpoof = createMultiplayerAvatarSpoofBridge({
        localStorage,
        console,
        setTimeout,
        normalizeAvatarFields: _normalizeAvatarFields,
        hasAvatarSpoofAccess: accessBridge.hasAvatarSpoofAccess,
        runtimePacketDebug: _runtimePacketDebug,
        runtimeSession: _runtimeSession,
        runtimeMultiplayer: _runtimeMultiplayer,
        runtimeApi,
        bridgeOpen,
        bridgeSend,
        sceneFootOffset: _sceneFootOffset,
        sceneYToNativeY: _sceneYToNativeY,
        getLaunchInfo: launchState.getLaunchInfo,
        updateLaunchAvatar: launchState.updateLaunchAvatar,
        setSkipNextRemoteAvatarRebuild(value) {
            _skipNextRemoteAvatarRebuild = !!value;
        }
    });

    connectionBridge = createMultiplayerConnectionBridge({
        window,
        fetch,
        crypto,
        WebSocket,
        Chat,
        console,
        runtimeSession: _runtimeSession,
        runtimeMultiplayer: _runtimeMultiplayer,
        runtimeConnection: _runtimeConnection,
        runtimeRemoteSession: _runtimeRemoteSession,
        getBridgeConfig,
        getLaunchInfo: launchState.getLaunchInfo,
        setLaunchInfo: launchState.setLaunchInfo,
        getSelfId: launchState.getSelfId,
        getFallbackGameId: () => window.GAME_ID || 0,
        handleMessage: handle,
        scheduleReconnect: _scheduleReconnect,
        protocol: () => runtimeServices.protocol,
        avatarSpoof,
        accessBridge
    });
    
    function _sendProbe(options = {}) {
        accessBridge.assertPacketDebugAccess();
        if (!_runtimeSession().hubMode || !bridgeOpen()) throw new Error("probe requires the local relay connection");
        const probeCase = String(options.case || options.probe || "append_tail");
        const payload = { ...options, type: "probe_packet", case: probeCase };
        _runtimeSession().sendJson(payload);
        return _recordProbeEvent({ type: "probe_requested", case: probeCase, payload });
    }
    
    installMultiplayerDebugConsole({
        window,
        console,
        runtime: runtimeServices,
        setTimeout,
        setInterval,
        clearInterval,
        assertPacketDebugAccess: accessBridge.assertPacketDebugAccess,
        runtimePacketDebug: _runtimePacketDebug,
        runtimeMultiplayer: _runtimeMultiplayer,
        remoteDebugRows: remoteBridge.remoteDebugRows,
        nativeFootOffset: _nativeFootOffset,
        sceneFootOffset: _sceneFootOffset,
        getRemoteYOffset: remoteBridge.getRemoteYOffset,
        setRemoteYOffset: remoteBridge.setRemoteYOffset,
        setJoinAvatarOverride: avatarSpoof.setJoinAvatarOverride,
        joinAvatarOverride: avatarSpoof.joinAvatarOverride,
        clearJoinAvatarOverride: avatarSpoof.clearJoinAvatarOverride,
        setOutboundAvatar: avatarSpoof.setOutboundAvatar,
        spoofAvatarResync: avatarSpoof.spoofAvatarResync,
        spoofAvatarDropResync: avatarSpoof.spoofAvatarDropResync,
        spoofAvatarReset: avatarSpoof.spoofAvatarReset,
        spoofAvatarRejoin: avatarSpoof.spoofAvatarRejoin,
        setMovementFormat: avatarSpoof.setMovementFormat,
        bridgeOpen,
        bridgeSend,
        sendProbe: _sendProbe,
        currentLaunchAvatar: avatarSpoof.currentLaunchAvatar
    });
    
    function bridgeSend(payload) {
        return connectionBridge.send(payload);
    }
    
    async function connect() {
        return connectionBridge.connect();
    }
    
    function encodeNetworkData(data) {
        return connectionBridge.encodeNetworkData(data);
    }

    const broadcastBridge = createMultiplayerBroadcastBridge({
        window,
        setInterval,
        clearInterval,
        runtimeApi,
        runtimeSession: _runtimeSession,
        runtimeMultiplayer: _runtimeMultiplayer,
        sceneYToNativeY: _sceneYToNativeY,
        bridgeOpen,
        encodeNetworkData,
        bridgeSend
    });
    
    function handle(d) {
        handleMultiplayerBridgeMessage(d, {
            window,
            Chat,
            runtimeApi,
            queueUntilRuntimeApi: _queueUntilRuntimeApi,
            runtimeRouter: _runtimeRouter,
            runtimeSession: _runtimeSession,
            runtimeRemoteSession: _runtimeRemoteSession,
            runtimeMultiplayer: _runtimeMultiplayer,
            runtimePacketDebug: _runtimePacketDebug,
            remoteBridge,
            getSelfId: launchState.getSelfId,
            setSelfId: launchState.setSelfId,
            getLaunchInfo: launchState.getLaunchInfo,
            setLaunchInfo: launchState.setLaunchInfo,
            playerDisplayName: _playerDisplayName,
            applyKnownPlayerName: _applyKnownPlayerName,
            recordReplicatedPlayers: _recordReplicatedPlayers,
            recordProbeEvent: _recordProbeEvent,
            normalizeAvatarFields: _normalizeAvatarFields,
            leaderboard: _leaderboard,
            fetchFriendData,
            startBroadcast: broadcastBridge.start,
            showBubble: bubbleBridge.show
        });
    }
    
    window._mpSetFriendStatus = function (id, status) {
        const next = _runtimeMultiplayer().setFriendStatus(id, status);
        _leaderboard().setFriendStatus(id, next);
    };
    this.frameBridge = installMultiplayerFrameBridge({
        window,
        runtimeApi,
        runtimeRemoteSession: _runtimeRemoteSession,
        remotePlayerService: remoteAvatarBridge.service,
        normalizeAvatarFields: _normalizeAvatarFields,
        playerDisplayName: _playerDisplayName,
        noteRemoteState: remoteBridge.noteRemoteState,
        animateRemote: remoteAvatarBridge.animate,
        hasBubbles: bubbleBridge.hasBubbles,
        updateBubblePositions: () => bubbleBridge.updatePositions(launchState.getSelfId()),
        shouldSkipAvatarRebuild: () => _skipNextRemoteAvatarRebuild,
        clearSkipAvatarRebuild: () => {
            _skipNextRemoteAvatarRebuild = false;
        }
    });
    
    const consoleBridge = installMultiplayerConsoleBridge({
        window,
        fetch,
        Chat,
        chatCommands: runtimeServices.chatCommands,
        avatar: runtimeServices.avatar,
        avatarAssets: runtimeServices.avatarAssets,
        avatarMaterials: runtimeServices.avatarMaterials,
        remotePlayers: runtimeServices.remotePlayers,
        remoteSession: runtimeServices.remoteSession,
        packetDebug: runtimeServices.packetDebug,
        runtimeApi,
        runtimeRemoteSession: _runtimeRemoteSession,
        normalizeAvatarFields: _normalizeAvatarFields,
        requireLicenseFeature: accessBridge.requireLicenseFeature,
        assertLicenseFeature: accessBridge.assertLicenseFeature,
        getLaunchInfo: launchState.getLaunchInfo,
        getLocalPlayerId: launchState.getSelfId,
        setLaunchInfoAvatar: launchState.updateLaunchAvatar
    });
    runtimeServices.chat?.configureOutbound?.({
        handleCommand: consoleBridge.handleChatCommand,
        sendMessage: (msg) => bridgeSend({ type: "chat", msg })
    });
    
    connect();
    return true;
  }

  updateFrame(dt) {
    this.frameBridge?.updateFrame?.(dt);
  }
}
