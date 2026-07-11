import * as THRE from "../../public/vendor/three.webgpu.js";
import * as BufferGeometryUtils from "../../public/vendor/BufferGeometryUtils.js";
import { GLTFLoader } from "../../public/vendor/GLTFLoader.js";
import { CSMShadowNode } from "../../public/vendor/CSMShadowNode.js";
import { attachRuntimeApi } from "./createRuntime";
import type { VortexRuntime } from "./types";

const VortexBufferGeometryUtils = {
    ...BufferGeometryUtils,
};

const THREE = {
    ...THRE,
    GLTFLoader: GLTFLoader,
    BufferGeometryUtils: VortexBufferGeometryUtils,
};

type RuntimeWindow = Window & {
    _importedAssets?: { content?: unknown };
    VortexChunkDebug?: unknown;
    VortexAvatarRig?: unknown;
    G?: number;
    locked?: boolean;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export async function launchRuntime(VortexRuntime: VortexRuntime): Promise<void> {
const runtimeWindow = window as RuntimeWindow;
const STUDS_PER_TILE = 4;
const scene = new THREE.Scene();

let fov = 85;
const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 3200);
const renderChunkForward = new THREE.Vector3();
const cameraService = VortexRuntime.camera;
if (!cameraService) {
    throw new Error('[camera] VortexRuntime camera service is required before the runtime starts.');
}
VortexRuntime.loading?.mount?.();
VortexRuntime.loading?.attachThreeLoadingManager?.(THREE.DefaultLoadingManager);

const runtimeRendererService = VortexRuntime.renderer;
if (!runtimeRendererService) {
    throw new Error('[renderer] VortexRuntime renderer service is required before the runtime starts.');
}

const sceneRuntime = await VortexRuntime.sceneSetup.configure({
    windowRef: runtimeWindow,
    document,
    localStorage,
    THREE,
    CSMShadowNode,
    scene,
    camera,
    rendererService: runtimeRendererService,
    sceneSettings: VortexRuntime.sceneSettings,
    shadowRuntime: VortexRuntime.shadowRuntime,
    perf: VortexRuntime.perf,
    settingsStore: VortexRuntime.settingsStore,
});
const {
    renderer,
    isWebGpuRuntime,
    ambient,
    shadows,
    shadowConfig,
    shadowMapSize,
    perf: VortexPerf,
    readStorageFlag,
    shadowsActive,
    setShadowsEnabled,
    setShadowQuality,
    updateLightingForFrame,
} = sceneRuntime;
const sceneSettings = VortexRuntime.sceneSettings;

const runtimeAssets = VortexRuntime.assets;
const cursorService = VortexRuntime.cursor;
const worldRuntime = VortexRuntime.worldBridge.configure({
    THREE,
    scene,
    renderer,
    windowRef: window,
    assets: runtimeAssets,
    assetResolver: VortexRuntime.assetResolver,
    fallbackAssetRaw: runtimeWindow._importedAssets?.content == null ? null : String(runtimeWindow._importedAssets.content),
    worldRuntime: VortexRuntime.worldRuntime,
    textures: VortexRuntime.textures,
    geometry: VortexRuntime.worldGeometry,
    materials: VortexRuntime.worldMaterials,
    colliders: VortexRuntime.worldColliders,
    parts: VortexRuntime.worldParts,
    dynamicObjects: VortexRuntime.worldDynamicObjects,
    sceneSettings,
    shadows,
    debugVisuals: VortexRuntime.debugVisuals,
    worldPicking: VortexRuntime.worldPicking,
    cursor: cursorService,
    camera,
    studsPerTile: STUDS_PER_TILE,
});
const worldRuntimeHandles = worldRuntime.worldRuntime;
const runtimeAsset = worldRuntime.runtimeAsset;
applyStoredRenderDistance(VortexRuntime.world, localStorage);
const chunkDebug = createChunkDebugController(THREE, scene, VortexRuntime.world);
runtimeWindow.VortexChunkDebug = chunkDebug.api;

const WORLD_FLOOR_Y = 1.5;
const G = WORLD_FLOOR_Y;
runtimeWindow.G = G;

runtimeWindow.locked = false;

const anim = { time: 0, bones: {}, rest: {} };

const gltfLoader = new THREE.GLTFLoader();
const storedAvatarRigVersion = localStorage.getItem("vwebAvatarRigVersion");
const avatarRigVersion = storedAvatarRigVersion === "legacy-vortex-r7" ? "legacy-vortex-r7" : "vweb-rig-v1";
runtimeWindow.VortexAvatarRig = createAvatarRigDebugController(localStorage, avatarRigVersion);
VortexRuntime.avatarUgcEquipment.configure({
    THREE,
    loader: gltfLoader,
    windowRef: runtimeWindow as Window,
    localStorage,
    diagnostics: VortexRuntime.diagnostics,
    localAnimation: anim,
    getLocalPlayerId: () => VortexRuntime.multiplayerSession.launchInfo?.id
        || VortexRuntime.platform.normalizeLaunchIdentity(VortexRuntime.platform.bridgeConfig.identity, {
            defaultGameId: Number(VortexRuntime.platform.bridgeConfig.officialGameId || 0),
            includeLease: true,
        })?.id
        || null,
});
const avatarRuntime = VortexRuntime.avatarSetup.configure({
    THREE,
    scene,
    document,
    windowRef: runtimeWindow as Window & Record<string, unknown>,
    loader: gltfLoader,
    avatarService: VortexRuntime.avatar,
    avatarAssets: VortexRuntime.avatarAssets,
    avatarMaterials: VortexRuntime.avatarMaterials,
    equipment: VortexRuntime.avatarEquipment,
    localAvatar: VortexRuntime.localAvatar,
    remoteAvatarAppearance: VortexRuntime.remoteAvatarAppearance,
    characterSpawn: VortexRuntime.characterSpawn,
    animation: anim,
    isWebGpuRuntime,
    floorY: G,
    resolveAsset: (bodyType) => String(resolveAvatarAsset(bodyType, avatarRigVersion, runtimeAsset)),
    shadowsActive,
    markShadowsDirty: () => shadows.markNeedsUpdate(),
    onCharacterChanged: (character) => {
        void VortexRuntime.avatarUgcEquipment.applyToLocal(character);
    },
});
const {
    avatarMaterials,
    avatarAssets,
    characterSpawn,
    localAvatar,
    remoteAvatarAppearance,
} = avatarRuntime;
const getCharacter = avatarRuntime.getCharacter;
const characterMetrics = avatarRuntime.getMetrics;

function toggleDebug() {
    worldRuntime.toggleDebug(characterMetrics());
}

let hudRuntime: any = null;
let isFirstPerson = false;

function setMouseLock(sl: unknown) {
    hudRuntime?.setMouseLock(!!sl);
}

const localPlayerRuntime = VortexRuntime.localPlayerSetup.configure({
    THREE,
    runtime: VortexRuntime,
    cameraObject: camera,
    animationState: anim,
    characterSpawn,
    localAvatar,
    windowRef: runtimeWindow as Window & Record<string, unknown>,
    getCharacter,
    getNearbyColliders: worldRuntime.getNearbyColliders,
    getMetrics: characterMetrics,
    setMouseLock,
    setFirstPerson: (value) => { isFirstPerson = !!value; },
});
const localMovement = localPlayerRuntime.localMovement;

const runtimeInput = VortexRuntime.input;
if (!runtimeInput || typeof runtimeInput.attachTarget !== 'function') {
    throw new Error('[input] VortexRuntime input service is required before the runtime starts.');
}
const keys = runtimeInput.keys;

hudRuntime = VortexRuntime.hudSetup.configure({
    document,
    windowRef: window,
    runtime: VortexRuntime,
    renderer,
    rendererService: runtimeRendererService,
    shadows,
    shadowConfig,
    perf: VortexPerf,
    readStorageFlag,
    runtimeAsset,
    resetCharacterToSpawn: () => localMovement.resetCharacterToSpawn(),
    readCharacterPosition: () => getCharacter()?.position || null,
    readFogSettings: () => sceneSettings.readFogSettings(),
    readToneMappingMode: () => sceneSettings.readToneMappingMode(),
    readShadowsEnabled: () => sceneRuntime.readShadowsEnabled(),
    readStudTexturesEnabled: worldRuntime.useStudTextures,
    setShadowsEnabled,
    setShadowQuality,
    setToneMappingMode: (value) => sceneSettings.setToneMappingMode(value),
    setRenderFog: (value) => sceneSettings.setRenderFog(value),
    setFogDistance: (value) => sceneSettings.setFogDistance(value),
    setRenderDistance: (value, profile) => VortexRuntime.world.setRenderDistance(value, profile),
    refreshStudMaterialTextures: worldRuntime.refreshStudMaterialTextures,
    markSceneMaterialsForShaderUpdate: () => sceneSettings.markMaterialsForShaderUpdate(),
    input: runtimeInput,
    cursor: cursorService,
    camera: cameraService,
    localMovement,
    getCharacter,
    isFirstPerson: () => isFirstPerson,
    onToggleDebug: toggleDebug,
});

const getScriptLocalPlayer = () => {
    const launch = VortexRuntime.multiplayerSession.launchInfo as any;
    const fallback = VortexRuntime.platform.normalizeLaunchIdentity(VortexRuntime.platform.bridgeConfig.identity, {
        defaultGameId: Number(VortexRuntime.platform.bridgeConfig.officialGameId || 0),
        includeLease: true,
    }) as any;
    const id = launch?.id ?? fallback?.id ?? VortexRuntime.remoteSession.selfId ?? "local";
    const name = String(launch?.username || fallback?.username || "me");
    return { id, name, local: true };
};
const scriptWorldMarkers = new Map<string, string>();
const spawnScriptWorldPart = (input: any, fallbackPosition?: [number, number, number]) => {
    const base = getCharacter()?.position as any;
    const position = readScriptVector(input.position, fallbackPosition || [
        Number(base?.x) || 0,
        (Number(base?.y) || G) + 4,
        (Number(base?.z) || 0) - 8,
    ]);
    const size = readScriptVector(input.size, [4, 1, 4], { min: 0.1, max: 128 });
    const rotation = input.rotation === undefined ? undefined : readScriptVector(input.rotation, [0, 0, 0], { min: -Math.PI * 8, max: Math.PI * 8 });
    const part = {
        position,
        size,
        color: readScriptColor(input.color, 0x3b82f6),
        transparency: clampNumber(Number(input.transparency ?? 0), 0, 1),
        canCollide: input.canCollide !== false,
        shape: String(input.shape || "Block"),
        type: String(input.type || "LuaPart"),
    };
    if (rotation !== undefined) (part as { rotation?: [number, number, number] }).rotation = rotation;
    const entity = VortexRuntime.world.spawnPart(part);
    return { id: entity.id, position, size };
};
const resolveLuaAssetUrl = (value: unknown) => {
    const localOrPackaged = VortexRuntime.scriptExplorer.assetUrl(value);
    if (localOrPackaged) return localOrPackaged;
    return resolveScriptAssetUrl(value, window.location.href);
};
const resolveScriptRaycastPart = (collider: unknown, point?: [number, number, number]) => {
    const world = VortexRuntime.world;
    const colliderId = String(collider ?? "");
    if (colliderId) {
        const exact = world.getPart?.(colliderId);
        if (exact) return exact;
        const staticIndex = /^static-(\d+)$/i.exec(colliderId);
        if (staticIndex) {
            const byIndex = world.listParts?.()[Number(staticIndex[1])];
            if (byIndex) return byIndex;
        }
    }
    if (!point) return null;
    const parts = world.listParts?.() ?? [];
    if (parts.length > 5000) return null;
    const epsilon = 0.08;
    let best: any = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const part of parts) {
        const position = part?.position;
        const size = part?.size;
        if (!Array.isArray(position) || !Array.isArray(size)) continue;
        const halfX = Math.max(0.01, Number(size[0]) / 2) + epsilon;
        const halfY = Math.max(0.01, Number(size[1]) / 2) + epsilon;
        const halfZ = Math.max(0.01, Number(size[2]) / 2) + epsilon;
        const dx = Math.abs(point[0] - Number(position[0]));
        const dy = Math.abs(point[1] - Number(position[1]));
        const dz = Math.abs(point[2] - Number(position[2]));
        if (dx > halfX || dy > halfY || dz > halfZ) continue;
        const score = dx / halfX + dy / halfY + dz / halfZ;
        if (score < bestScore) {
            best = part;
            bestScore = score;
        }
    }
    return best;
};
VortexRuntime.scripting.configure({
    documentRef: document,
    windowRef: runtimeWindow as Window,
    storage: localStorage,
    getLocalPlayer: getScriptLocalPlayer,
    getPlayers: () => {
        const players = [getScriptLocalPlayer()];
        for (const [id, remote] of VortexRuntime.remoteSession.remotes) {
            players.push({ id, name: String((remote as any)?.username || `#${id}`), local: false });
        }
        return players;
    },
    getPlayerRoot: (query) => {
        const raw = String(query ?? "me").trim().toLowerCase();
        if (!raw || raw === "me" || raw === "local" || raw === "self") return getCharacter() as any;
        for (const [id, remote] of VortexRuntime.remoteSession.remotes) {
            const name = String((remote as any)?.username || "").toLowerCase();
            if (String(id).toLowerCase() === raw || (name && name.includes(raw))) {
                return ((remote as any)?.meshes?.grp || null) as any;
            }
        }
        return null;
    },
    setPlayerBodyColors: (query, colors) => {
        const root = (() => {
            const raw = String(query ?? "me").trim().toLowerCase();
            if (!raw || raw === "me" || raw === "local" || raw === "self") return getCharacter() as any;
            for (const [id, remote] of VortexRuntime.remoteSession.remotes) {
                const name = String((remote as any)?.username || "").toLowerCase();
                if (String(id).toLowerCase() === raw || (name && name.includes(raw))) return ((remote as any)?.meshes?.grp || null) as any;
            }
            return null;
        })();
        if (!root) return false;
        const nextColors = normalizeScriptBodyColors(colors, root.userData?.vwebScriptBodyColors);
        root.userData = { ...(root.userData || {}), vwebScriptBodyColors: nextColors };
        VortexRuntime.avatarMaterials.applyBodyColors(root, nextColors);
        return true;
    },
    setPlayerTexture: (query, slot, url) => {
        const normalizedSlot = normalizePlayerTextureSlot(slot);
        if (!normalizedSlot) return false;
        const textureUrl = resolveLuaAssetUrl(url);
        const raw = String(query ?? "me").trim().toLowerCase();
        if (!raw || raw === "me" || raw === "local" || raw === "self") {
            const mesh =
                normalizedSlot === "shirt" ? localAvatar.getShirtMesh?.() :
                normalizedSlot === "pants" ? localAvatar.getPantsMesh?.() :
                localAvatar.getFaceMesh?.();
            if (!mesh) return false;
            VortexRuntime.avatarMaterials.applyShirtToMesh(mesh, textureUrl, { slot: normalizedSlot, source: "lua" });
            return true;
        }
        for (const [id, remote] of VortexRuntime.remoteSession.remotes) {
            const name = String((remote as any)?.username || "").toLowerCase();
            if (String(id).toLowerCase() !== raw && (!name || !name.includes(raw))) continue;
            const meshes = (remote as any)?.meshes || {};
            const mesh =
                normalizedSlot === "shirt" ? meshes.shirtMesh :
                normalizedSlot === "pants" ? meshes.pantsMesh :
                meshes.faceMesh;
            if (!mesh) return false;
            VortexRuntime.avatarMaterials.applyShirtToMesh(mesh, textureUrl, { slot: normalizedSlot, source: "lua" });
            return true;
        }
        return false;
    },
    getLocalPosition: () => {
        const position = getCharacter()?.position as any;
        if (!position) return null;
        return [Number(position.x) || 0, Number(position.y) || 0, Number(position.z) || 0];
    },
    getCameraState: () => cameraService.snapshot() as any,
    setCameraDistanceOverride: (distance) => cameraService.setDistanceOverride(distance) as any,
    clearCameraDistanceOverride: () => cameraService.clearDistanceOverride() as any,
    screenPointToRay: (x, y) => {
        const screenX = typeof x === "object" && x !== null ? readScriptProperty(x, "x", 1) : x;
        const screenY = typeof x === "object" && x !== null ? readScriptProperty(x, "y", 2) : y;
        const rect = renderer.domElement?.getBoundingClientRect?.() || { left: 0, top: 0, width: window.innerWidth || 1, height: window.innerHeight || 1 };
        const width = rect.width || window.innerWidth || 1;
        const height = rect.height || window.innerHeight || 1;
        const nx = ((Number(screenX) - rect.left) / width) * 2 - 1;
        const ny = -(((Number(screenY) - rect.top) / height) * 2 - 1);
        const origin = new THREE.Vector3();
        const far = new THREE.Vector3(nx, ny, 1);
        camera.getWorldPosition?.(origin);
        far.unproject(camera);
        far.sub(origin).normalize();
        return {
            origin: [origin.x, origin.y, origin.z],
            direction: [far.x, far.y, far.z],
        };
    },
    worldToScreen: (point) => {
        const position = readScriptVector(point, [0, 0, 0]);
        const projected = new THREE.Vector3(position[0], position[1], position[2]);
        projected.project(camera);
        const rect = renderer.domElement?.getBoundingClientRect?.() || { left: 0, top: 0, width: window.innerWidth || 1, height: window.innerHeight || 1 };
        const x = rect.left + (projected.x + 1) * 0.5 * rect.width;
        const y = rect.top + (1 - projected.y) * 0.5 * rect.height;
        return {
            x,
            y,
            z: projected.z,
            visible: projected.z >= -1 && projected.z <= 1 && x >= rect.left && y >= rect.top && x <= rect.left + rect.width && y <= rect.top + rect.height,
        };
    },
    raycast: (origin, direction, maxDistance) => {
        const hit = VortexRuntime.physics.raycast(
            readScriptVector(origin, [0, 0, 0]),
            readScriptVector(direction, [0, -1, 0]),
            clampNumber(Number(maxDistance ?? 500), 0.1, 10000)
        );
        if (!hit) return { hit: false };
        const part = resolveScriptRaycastPart(hit.collider, hit.point);
        return {
            hit: true,
            point: hit.point,
            position: hit.point,
            normal: hit.normal,
            distance: hit.distance,
            collider: hit.collider,
            partId: part?.id ?? null,
            part,
        };
    },
    getMousePosition: () => cursorService.position(),
    isKeyDown: (code) => Boolean(runtimeInput.keys[String(code || "")]),
    spawnWorldPart: (input) => {
        return spawnScriptWorldPart(input);
    },
    removeWorldPart: (id) => VortexRuntime.world.removeObject(id),
    listWorldParts: () => VortexRuntime.world.listParts(),
    getWorldPart: (id) => VortexRuntime.world.getPart(id),
    setWorldPartColor: (id, color) => VortexRuntime.world.setPartColor(id, readScriptColor(color, 0x808080)),
    setWorldPartTransparency: (id, transparency) => VortexRuntime.world.setPartTransparency(id, clampNumber(Number(transparency ?? 0), 0, 1)),
    setWorldPartCollision: (id, canCollide) => VortexRuntime.world.setPartCollision(id, canCollide !== false),
    setWorldMarker: (id, input) => {
        const key = String(id || "marker").trim() || "marker";
        const existing = scriptWorldMarkers.get(key);
        if (existing) VortexRuntime.world.removeObject(existing);
        const marker = spawnScriptWorldPart({
            ...input,
            size: input.size ?? [4, 0.08, 4],
            transparency: input.transparency ?? 0.25,
            canCollide: false,
            type: input.type ?? "LuaMarker",
        });
        scriptWorldMarkers.set(key, marker.id);
        return marker;
    },
    clearWorldMarker: (id) => {
        const key = String(id || "marker").trim() || "marker";
        const existing = scriptWorldMarkers.get(key);
        if (!existing) return false;
        scriptWorldMarkers.delete(key);
        return VortexRuntime.world.removeObject(existing);
    },
    walkLocalTo: (position, options) => {
        const target = readScriptVector(position, [NaN, NaN, NaN]);
        if (!target.every(Number.isFinite)) return { ok: false, reason: "bad-position" };
        const hit = VortexRuntime.physics.raycast([target[0], target[1] + 64, target[2]], [0, -1, 0], 180);
        if (!hit?.point) return { ok: false, reason: "no-ground" };
        const result = localMovement.setWalkTarget(
            { x: hit.point[0], y: hit.point[1], z: hit.point[2] },
            {
                speed: readScriptProperty(options || {}, "speed", 1),
                stopDistance: readScriptProperty(options || {}, "stopDistance", 2),
            }
        );
        return result.ok ? { ok: true, target: hit.point } : result;
    },
    stopLocalWalk: () => localMovement.clearWalkTarget(),
    setMouseLook: (enabled) => setMouseLock(!!enabled),
    setCursorImage: (options) => {
        const cursorElement = document.getElementById("cursor") as HTMLElement | null;
        if (!cursorElement) return { mode: "default" as const };
        const url = resolveLuaAssetUrl(options.url);
        const width = clampNumber(Number(options.width ?? 32), 8, 256);
        const height = clampNumber(Number(options.height ?? width), 8, 256);
        const hotspot = readScriptVector(options.hotspot, [0, 0, 0], { min: -256, max: 256 });
        cursorElement.style.setProperty("--vw-script-cursor-url", `url("${url.replace(/"/g, "%22")}")`);
        cursorElement.style.setProperty("--vw-script-cursor-width", `${width}px`);
        cursorElement.style.setProperty("--vw-script-cursor-height", `${height}px`);
        cursorElement.style.setProperty("--vw-script-cursor-hotspot-x", `${hotspot[0]}px`);
        cursorElement.style.setProperty("--vw-script-cursor-hotspot-y", `${hotspot[1]}px`);
        document.body.classList.add("vw-script-cursor-image");
        document.body.classList.remove("vw-lua-cursor-classic");
        return { mode: "image" as const, url, width, height, hotspot };
    },
    clearCursor: () => {
        const cursorElement = document.getElementById("cursor") as HTMLElement | null;
        cursorElement?.style.removeProperty("--vw-script-cursor-url");
        cursorElement?.style.removeProperty("--vw-script-cursor-width");
        cursorElement?.style.removeProperty("--vw-script-cursor-height");
        cursorElement?.style.removeProperty("--vw-script-cursor-hotspot-x");
        cursorElement?.style.removeProperty("--vw-script-cursor-hotspot-y");
        document.body.classList.remove("vw-script-cursor-image", "vw-lua-cursor-classic");
        delete document.body.dataset.vwebLuaCursor;
        return { mode: "default" as const };
    },
    resolveAssetUrl: (path) => resolveLuaAssetUrl(path),
    ui: VortexRuntime.scriptUi,
    sendChatMessage: (text) => {
        VortexRuntime.multiplayerSession.sendPayload(
            { type: "chat", msg: text },
            {
                encodeMovement: (state: any) => VortexRuntime.multiplayerSession.encodeMovementPacket(VortexRuntime.protocol, state),
                encodeChat: (message: unknown) => VortexRuntime.multiplayerSession.encodeChatPacket(VortexRuntime.protocol, message),
            }
        );
    },
    systemChatMessage: (text) => VortexRuntime.chat.api()?.system(String(text || "")),
    hasLuaAccess: () => VortexRuntime.access.hasLicenseFeature("lua", {
        launchInfo: VortexRuntime.multiplayerSession.launchInfo || VortexRuntime.platform.bridgeConfig.identity || null,
        isLocalDevRelay: Boolean(
            VortexRuntime.platform.bridgeConfig.devLocalRelay &&
            VortexRuntime.platform.bridgeConfig.hubUrl &&
            VortexRuntime.multiplayer.isLocalRelayUrl(VortexRuntime.platform.bridgeConfig.hubUrl)
        )
    }),
    snapshot: () => ({
        input: VortexRuntime.input.snapshot(),
        remotes: VortexRuntime.remoteSession.snapshot(),
        renderer: VortexRuntime.renderer.snapshot?.(),
        chunks: VortexRuntime.world.renderChunkSnapshot?.()
    })
});
VortexRuntime.scriptExplorer.mount();

VortexRuntime.runtimeStartup.install({
    windowRef: runtimeWindow as Window & Record<string, unknown>,
    localStorage,
    three: THREE,
    scene,
    renderer,
    cameraObject: camera,
    avatarMaterials,
    avatarAssets,
    localAvatar,
    remoteAvatarAppearance,
    avatarUgcEquipment: VortexRuntime.avatarUgcEquipment,
    characterSpawn,
    localMovement,
    camera: cameraService,
    animation: VortexRuntime.animation,
    shadows,
    shadowQuality: () => shadowConfig.quality,
    shadowMapSize: () => shadowMapSize,
    shadowsActive,
    setShadowsEnabled,
    setShadowQuality,
    sceneSettings,
    rendererService: runtimeRendererService,
    quality: VortexRuntime.quality,
    runtimeApiExports: VortexRuntime.runtimeApiExports,
    setRuntimeApi: (api) => attachRuntimeApi(VortexRuntime, api),
    frameLoop: VortexRuntime.frameLoop,
    profiler: VortexPerf,
    worldService: VortexRuntime.world,
    worldRuntime: worldRuntimeHandles,
    keys,
    anim,
    getCharacter,
    getCharHeight: avatarRuntime.getCharHeight,
    getCharFootOffset: avatarRuntime.getCharFootOffset,
    getCharStandY: avatarRuntime.getCharStandY,
    readStorageFlag,
    requestPointerLock: () => hudRuntime?.requestPointerLock(),
    resetCharacterToSpawn: () => localMovement.resetCharacterToSpawn(),
    pick: () => worldRuntime.getClicked3DPoint(),
    update: (dt) => {
        localMovement.update(dt);
        VortexRuntime.avatarUgcEquipment.update(dt);
    },
    updateCamera: (dt) => localMovement.updateCamera(dt),
    updateDebug: () => {
        camera.getWorldDirection?.(renderChunkForward);
        VortexRuntime.world.updateRenderChunks({
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            forward: {
                x: renderChunkForward.x,
                y: renderChunkForward.y,
                z: renderChunkForward.z,
            },
            verticalFovDegrees: camera.fov,
            aspect: camera.aspect,
        });
        chunkDebug.update();
        worldRuntime.updateDebug(getCharacter(), characterMetrics());
    },
    updateMultiplayer: (dt) => {
        VortexRuntime.multiplayerBridge.updateFrame(dt);
        VortexRuntime.scripting.update(dt);
    },
    updateLighting: updateLightingForFrame,
});
}

function readScriptVector(
    value: unknown,
    fallback: [number, number, number],
    options: { min?: number; max?: number } = {}
): [number, number, number] {
    const array = Array.isArray(value)
        ? value
        : value && typeof value === "object"
            ? [readScriptProperty(value, "x", 1), readScriptProperty(value, "y", 2), readScriptProperty(value, "z", 3)]
            : [];
    return [
        readScriptNumber(array[0], fallback[0], options),
        readScriptNumber(array[1], fallback[1], options),
        readScriptNumber(array[2], fallback[2], options),
    ];
}

function readScriptProperty(value: unknown, namedKey: string, numericKey: number): unknown {
    const record = value as Record<string | number, unknown>;
    return record[namedKey] ?? record[numericKey];
}

function readScriptNumber(value: unknown, fallback: number, options: { min?: number; max?: number }): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return clampNumber(parsed, options.min ?? -100000, options.max ?? 100000);
}

function readScriptColor(value: unknown, fallback: number): number {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const text = String(value ?? "").trim();
    if (!text) return fallback;
    if (/^#[0-9a-f]{6}$/i.test(text)) return Number.parseInt(text.slice(1), 16);
    if (/^0x[0-9a-f]{1,6}$/i.test(text)) return Number.parseInt(text.slice(2), 16);
    return fallback;
}

function normalizeScriptBodyColors(value: unknown, previous: unknown): string[] {
    const fallback = Array.isArray(previous) && previous.length >= 6
        ? previous.map((item) => normalizeScriptColorString(item, "#ffffff"))
        : ["#d7d7d7", "#512a95", "#ffffff", "#ffffff", "#111b59", "#111b59"];
    if (Array.isArray(value)) {
        const next = [...fallback];
        for (let index = 0; index < Math.min(6, value.length); index += 1) {
            next[index] = normalizeScriptColorString(value[index], next[index] || "#ffffff");
        }
        return next;
    }
    if (!value || typeof value !== "object") return fallback;
    const record = value as Record<string, unknown>;
    if (record.slot !== undefined && record.color !== undefined) {
        const next = [...fallback];
        const index = bodyColorSlotIndex(record.slot);
        if (index >= 0) next[index] = normalizeScriptColorString(record.color, next[index] || "#ffffff");
        return next;
    }
    const next = [...fallback];
    for (const [key, raw] of Object.entries(record)) {
        const index = bodyColorSlotIndex(key);
        if (index >= 0) next[index] = normalizeScriptColorString(raw, next[index] || "#ffffff");
    }
    return next;
}

function bodyColorSlotIndex(value: unknown): number {
    const text = String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (text === "0" || text === "head") return 0;
    if (text === "1" || text === "torso" || text === "body" || text === "chest") return 1;
    if (text === "2" || text === "leftarm" || text === "larm") return 2;
    if (text === "3" || text === "rightarm" || text === "rarm") return 3;
    if (text === "4" || text === "leftleg" || text === "lleg") return 4;
    if (text === "5" || text === "rightleg" || text === "rleg") return 5;
    return -1;
}

function normalizeScriptColorString(value: unknown, fallback: string): string {
    if (typeof value === "number" && Number.isFinite(value)) return `#${Math.round(value).toString(16).padStart(6, "0").slice(-6)}`;
    const text = String(value ?? "").trim();
    if (/^#[0-9a-f]{6}$/i.test(text)) return text;
    if (/^[0-9a-f]{6}$/i.test(text)) return `#${text}`;
    return fallback;
}

function normalizePlayerTextureSlot(value: unknown): "shirt" | "pants" | "face" | null {
    const text = String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (text === "shirt" || text === "top" || text === "torso") return "shirt";
    if (text === "pants" || text === "pant" || text === "legs" || text === "bottom") return "pants";
    if (text === "face" || text === "head") return "face";
    return null;
}

function resolveScriptAssetUrl(value: unknown, baseUrl: string): string {
    const raw = String(value || "").trim();
    if (!raw) throw new Error("cursor image url is required");
    const url = new URL(raw, baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:" && url.protocol !== "chrome-extension:" && url.protocol !== "blob:") {
        throw new Error(`unsupported cursor image protocol: ${url.protocol}`);
    }
    if (url.protocol === "http:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
        throw new Error("http cursor images are only allowed for local development");
    }
    return url.href;
}

function clampNumber(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

function applyStoredRenderDistance(worldService: any, storage: StorageLike) {
    const distance = Number(storage.getItem("vwebRenderDistance"));
    if (!Number.isFinite(distance)) return;
    const rawProfile = storage.getItem("vwebRenderDistanceProfile");
    const profile = rawProfile === "performance" || rawProfile === "visual" ? rawProfile : "balanced";
    worldService.setRenderDistance?.(distance, profile);
}

function resolveAvatarAsset(
    bodyType: "male" | "female",
    rigVersion: "legacy-vortex-r7" | "vweb-rig-v1",
    runtimeAsset: (path: string, fallbackKey?: string | null) => string | null
) {
    if (rigVersion === "vweb-rig-v1") {
        const v1Asset = bodyType === "female"
            ? runtimeAsset("meshes.femalePlayerGlbV1", "femalePlayerGlbV1")
            : runtimeAsset("meshes.malePlayerGlbV1", "malePlayerGlbV1");
        if (v1Asset) return v1Asset;
    }
    return bodyType === "female"
        ? runtimeAsset("meshes.femalePlayerGlb", "femalePlayerGlb")
        : runtimeAsset("meshes.malePlayerGlb", "malePlayerGlb");
}

function createAvatarRigDebugController(storage: StorageLike, current: "legacy-vortex-r7" | "vweb-rig-v1") {
    return {
        current() {
            return {
                version: current,
                experimental: current === "vweb-rig-v1",
                storageKey: "vwebAvatarRigVersion"
            };
        },
        use(version: unknown) {
            const next = version === "vweb-rig-v1" ? "vweb-rig-v1" : "legacy-vortex-r7";
            if (next === "legacy-vortex-r7") storage.setItem("vwebAvatarRigVersion", next);
            else storage.removeItem("vwebAvatarRigVersion");
            return {
                version: next,
                reloadRequired: true
            };
        },
        useV1() {
            return this.use("vweb-rig-v1");
        },
        useLegacy() {
            return this.use("legacy-vortex-r7");
        }
    };
}

function createChunkDebugController(THREE: any, scene: any, worldService: any) {
    const helpers = new Map<string, any>();
    let visible = false;

    function rows() {
        return worldService.renderChunkDebugRows?.() || [];
    }

    function snapshot() {
        return worldService.renderChunkSnapshot?.() || null;
    }

    function clear() {
        for (const helper of helpers.values()) {
            scene.remove(helper);
            helper.geometry?.dispose?.();
            helper.material?.dispose?.();
        }
        helpers.clear();
    }

    function makeHelper(row: any) {
        if (!row?.min || !row?.max) return null;
        const box = new THREE.Box3(
            new THREE.Vector3(row.min.x, row.min.y, row.min.z),
            new THREE.Vector3(row.max.x, row.max.y, row.max.z)
        );
        const helper = new THREE.Box3Helper(box, row.visible ? 0x38d46f : 0xff4d4d);
        helper.name = `VortexRenderChunk:${row.chunkKey}`;
        helper.renderOrder = 9999;
        helper.userData = {
            ...(helper.userData || {}),
            vwebRuntimeKind: "render-chunk-debug",
            vwebRenderChunk: row.chunkKey
        };
        return helper;
    }

    function update() {
        if (!visible) return;
        const nextRows = rows();
        const nextIds = new Set(nextRows.map((row: any) => row.id));
        for (const [id, helper] of helpers) {
            if (nextIds.has(id)) continue;
            scene.remove(helper);
            helper.geometry?.dispose?.();
            helper.material?.dispose?.();
            helpers.delete(id);
        }
        for (const row of nextRows) {
            const helper = helpers.get(row.id);
            if (helper) {
                helper.visible = true;
                helper.material?.color?.setHex?.(row.visible ? 0x38d46f : 0xff4d4d);
                continue;
            }
            const next = makeHelper(row);
            if (!next) continue;
            helpers.set(row.id, next);
            scene.add(next);
        }
    }

    const api = {
        show() {
            visible = true;
            update();
            return snapshot();
        },
        hide() {
            visible = false;
            clear();
            return snapshot();
        },
        toggle() {
            return visible ? api.hide() : api.show();
        },
        rows() {
            const data = rows();
            console.table(data.map((row: any) => ({
                chunk: row.chunkKey,
                visible: row.visible,
                objects: row.objects,
                x: Math.round(row.center?.x ?? 0),
                y: Math.round(row.center?.y ?? 0),
                z: Math.round(row.center?.z ?? 0),
                radius: Math.round(row.radius)
            })));
            return data;
        },
        snapshot,
        setDistance(value: unknown) {
            const result = worldService.setRenderDistance?.(Number(value), "balanced") || worldService.setRenderChunkCullDistance?.(Number(value));
            update();
            return result || snapshot();
        },
        setNear(value: unknown) {
            const result = worldService.setRenderChunkMinimumVisibleDistance?.(Number(value));
            update();
            return { ...snapshot(), minimumVisibleDistance: result };
        },
        setViewCulling(value: unknown) {
            worldService.setRenderChunkViewCullingEnabled?.(!!value);
            update();
            return snapshot();
        }
    };

    return { api, update };
}
