type DebugConsoleWindow = Window & {
  VortexPacketDebug?: unknown;
};

type MultiplayerDebugConsoleContext = Record<string, any> & {
  window: DebugConsoleWindow;
  console: Console;
  setTimeout: Window["setTimeout"];
  setInterval: Window["setInterval"];
  clearInterval: Window["clearInterval"];
};

type DebugRow = Record<string, any>;
type ColliderLike = Record<string, any>;
type ColliderSource = {
  colliders?: ColliderLike[];
  getNearbyColliders?: (x: number, y: number, z: number) => ColliderLike[];
};

export function installMultiplayerDebugConsole(context: MultiplayerDebugConsoleContext) {
  const {
    window,
    console,
    runtime,
    setTimeout,
    setInterval,
    clearInterval,
    assertPacketDebugAccess,
    runtimePacketDebug,
    runtimeMultiplayer,
    remoteDebugRows,
    nativeFootOffset,
    sceneFootOffset,
    getRemoteYOffset,
    setRemoteYOffset,
    setJoinAvatarOverride,
    joinAvatarOverride,
    clearJoinAvatarOverride,
    setOutboundAvatar,
    spoofAvatarResync,
    spoofAvatarDropResync,
    spoofAvatarReset,
    spoofAvatarRejoin,
    setMovementFormat,
    bridgeOpen,
    bridgeSend,
    sendProbe,
    currentLaunchAvatar
  } = context;

  window.VortexPacketDebug = {
    enable(value = true) {
      assertPacketDebugAccess();
      return runtimePacketDebug().setEnabled(!!value);
    },
    setLog(value = true) {
      assertPacketDebugAccess();
      return runtimePacketDebug().setLog(!!value);
    },
    table() {
      assertPacketDebugAccess();
      const players = runtimePacketDebug().players();
      console.table(players);
      return players;
    },
    players() {
      assertPacketDebugAccess();
      return runtimePacketDebug().players();
    },
    remotes() {
      assertPacketDebugAccess();
      const rows = remoteDebugRows();
      console.table(rows.map((r: Record<string, any>) => ({
        id: r.id,
        username: r.username,
        visible: r.visible,
        hasPosition: r.hasPosition,
        ageMs: r.ageMs,
        rawY: roundNumber(r.lastRaw?.y),
        targetY: roundNumber(r.target?.y),
        meshY: roundNumber(r.mesh?.y),
        renderLagY: roundNumberDiff(r.target?.y, r.mesh?.y),
        received: r.received,
        accepted: r.accepted,
        rejected: r.rejected,
        hiddenReason: r.hiddenReason,
        lastRejectedReason: r.lastRejectedReason
      })));
      return rows;
    },
    heights() {
      assertPacketDebugAccess();
      const rows = remoteDebugRows();
      const footOffset = Number(runtime?.vortex?.get?.()?.getCharFootOffset?.() ?? 2);
      const colliders = runtime?.worldColliders;
      const renderRows = runtime?.remotePlayers?.profile?.(runtime?.remoteSession?.remotes)?.rows || [];
      const renderById = new Map<number, DebugRow>(renderRows.map((row: DebugRow) => [Number(row.id), row]));
      const heightRows = rows.map((r: Record<string, any>) => {
        const target = r.target;
        const mesh = r.mesh;
        const render = renderById.get(Number(r.id));
        const groundY = target && colliders ? nearestGroundY(colliders, target.x, target.y, target.z) : null;
        const targetFootY = target ? target.y - footOffset : null;
        const meshFootY = mesh ? mesh.y - footOffset : null;
        return {
          id: r.id,
          username: r.username,
          visible: r.visible,
          rawY: roundNumber(r.lastRaw?.y),
          targetY: roundNumber(target?.y),
          meshY: roundNumber(mesh?.y),
          footOffset: roundNumber(footOffset),
          targetFootY: roundNumber(targetFootY),
          meshFootY: roundNumber(meshFootY),
          groundY: roundNumber(groundY),
          targetFootDelta: roundNumberDiff(targetFootY, groundY),
          meshFootDelta: roundNumberDiff(meshFootY, groundY),
          visualMinY: roundNumber(render?.visualMinY),
          visualFootDelta: roundNumberDiff(render?.visualMinY, groundY),
          visualRootDelta: roundNumber(render?.visualFootDelta),
          renderLagY: roundNumberDiff(target?.y, mesh?.y),
          ageMs: r.ageMs,
          anim: r.lastRaw?.anim ?? ""
        };
      });
      console.table(heightRows);
      return heightRows;
    },
    renderCost() {
      assertPacketDebugAccess();
      const camera = runtime?.renderer?.getHandles?.()?.camera?.position || null;
      runtime?.remotePlayers?.updateRenderBudget?.(runtime?.remoteSession?.remotes, camera);
      const profile = runtime?.remotePlayers?.profile?.(runtime?.remoteSession?.remotes);
      const renderer = runtime?.renderer?.snapshot?.() ?? runtime?.renderer?.getHandles?.()?.renderer?.info?.render ?? null;
      const slim = runtime?.slim?.snapshot?.();
      const payload = {
        remotes: runtime?.remoteSession?.snapshot?.(),
        remoteRender: profile,
        renderer,
        slim
      };
      console.log("[Vortex Web] remote render cost", payload);
      if (profile?.rows) console.table(profile.rows);
      return payload;
    },
    offsets() {
      assertPacketDebugAccess();
      const vortex = runtime?.vortex?.get?.();
      const values = {
        nativeFootOffset: roundNumber(typeof nativeFootOffset === "function" ? nativeFootOffset() : null),
        sceneFootOffset: roundNumber(typeof sceneFootOffset === "function" ? sceneFootOffset() : null),
        remoteYOffset: roundNumber(typeof getRemoteYOffset === "function" ? getRemoteYOffset() : null),
        runtimeCharFootOffset: roundNumber(vortex?.getCharFootOffset?.()),
        runtimeCharHeight: roundNumber(vortex?.getCharHeight?.()),
        localY: roundNumber(vortex?.getCharacter?.()?.position?.y)
      };
      console.table([values]);
      return values;
    },
    getRemoteYOffset() {
      assertPacketDebugAccess();
      return typeof getRemoteYOffset === "function" ? getRemoteYOffset() : 0;
    },
    setRemoteYOffset(value: unknown = 0) {
      assertPacketDebugAccess();
      const next = typeof setRemoteYOffset === "function" ? setRemoteYOffset(value) : 0;
      console.log("[Vortex Web] remote Y debug offset", next);
      return next;
    },
    ground(id: unknown) {
      assertPacketDebugAccess();
      const rows = remoteDebugRows();
      const row = rows.find((item: DebugRow) => Number(item.id) === Number(id)) || rows[0];
      if (!row?.target) return null;
      const result = groundCandidates(runtime?.worldColliders, row.target.x, row.target.y, row.target.z);
      console.table(result);
      return { remote: row, candidates: result };
    },
    leaves() {
      assertPacketDebugAccess();
      const leaves = runtimePacketDebug().leaves();
      console.table(leaves);
      return leaves;
    },
    messages() {
      assertPacketDebugAccess();
      const messages = runtimeMultiplayer().messagesSnapshot();
      console.table(messages);
      return messages;
    },
    last(id: unknown) {
      assertPacketDebugAccess();
      return runtimePacketDebug().last(id);
    },
    history() {
      assertPacketDebugAccess();
      return runtimePacketDebug().history();
    },
    setJoinAvatar(patch: Record<string, unknown> = {}) {
      return setJoinAvatarOverride(patch || {});
    },
    getJoinAvatar() {
      return joinAvatarOverride();
    },
    clearJoinAvatar() {
      return clearJoinAvatarOverride();
    },
    setJoinOutfit(patch: Record<string, unknown> = {}) {
      return setJoinAvatarOverride(patch || {});
    },
    spoofAvatar(patch: Record<string, unknown>) {
      return setOutboundAvatar(patch || {});
    },
    spoofAvatarCompact(patch: Record<string, unknown>, options: Record<string, any> = {}) {
      return setOutboundAvatar(patch || {}, true, { ...options, compact: true, persistCompact: !!options.persist });
    },
    spoofAvatarResync(patch: Record<string, unknown>, options: Record<string, unknown> = {}) {
      return spoofAvatarResync(patch || {}, options);
    },
    spoofAvatarDropResync(patch: Record<string, unknown>, options: Record<string, unknown> = {}) {
      return spoofAvatarDropResync(patch || {}, options);
    },
    spoofAvatarReset(patch: Record<string, unknown>, options: Record<string, unknown> = {}) {
      return spoofAvatarReset(patch || {}, options);
    },
    spoofAvatarRejoin(patch: Record<string, unknown>, options: Record<string, unknown> = {}) {
      return spoofAvatarRejoin(patch || {}, options);
    },
    setMovementFormat(format: unknown = "native-auto") {
      assertPacketDebugAccess();
      return setMovementFormat(format);
    },
    spoofShirt(id: unknown) {
      return setOutboundAvatar({ shirt_id: Number(id) || 0 });
    },
    spoofOutfit(shirtId: unknown, pantId: unknown, faceId: unknown) {
      return setOutboundAvatar({ shirt_id: Number(shirtId) || 0, pant_id: Number(pantId) || 0, face_id: Number(faceId) || 0 });
    },
    spoofColors(colors: unknown) {
      return setOutboundAvatar({ body_colors: colors });
    },
    randomSpoof(options: Record<string, unknown> = {}) {
      return runtimePacketDebug().startRandomSpoof(options, {
        bridgeOpen,
        bridgeSend,
        setOutboundAvatar: (patch: Record<string, unknown>, outboundOptions: Record<string, unknown>) => setOutboundAvatar(patch, true, outboundOptions),
        log: (message: unknown, patch: unknown) => console.log(message, patch),
        setTimeoutRef: setTimeout,
        setIntervalRef: setInterval,
        clearIntervalRef: clearInterval
      });
    },
    stopRandomSpoof() {
      return runtimePacketDebug().stopRandomSpoof(clearInterval);
    },
    latencies() {
      assertPacketDebugAccess();
      const latencies = runtimePacketDebug().latencies();
      console.table(latencies);
      return latencies;
    },
    probe(options: Record<string, unknown> = {}) {
      return sendProbe(options);
    },
    probeCases() {
      assertPacketDebugAccess();
      return [
        "append_tail",
        "random_tail",
        "ff_tail",
        "ascii_tail",
        "truncate_tail",
        "nan_pos",
        "inf_pos",
        "huge_pos",
        "bad_state",
        "bad_avatar_ids",
        "bad_body_type",
        "bad_marker",
        "bad_name_len",
        "byteflip"
      ];
    },
    probes() {
      assertPacketDebugAccess();
      const probes = runtimePacketDebug().probes();
      console.table(probes);
      return probes;
    },
    clearSpoof() {
      if (!runtimePacketDebug().hasOriginalAvatar()) return currentLaunchAvatar();
      const original = runtimePacketDebug().takeOriginalAvatar();
      return setOutboundAvatar(original, false, { flush: false });
    }
  };
}

function numberOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundNumber(value: unknown): number | null {
  const number = numberOrNull(value);
  return number === null ? null : Math.round(number * 1000) / 1000;
}

function roundNumberDiff(a: unknown, b: unknown): number | null {
  const left = numberOrNull(a);
  const right = numberOrNull(b);
  return left === null || right === null ? null : roundNumber(left - right);
}

function nearestGroundY(colliders: ColliderSource | null | undefined, x: number, y: number, z: number): number | null {
  if (!colliders || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  const nearby = typeof colliders.getNearbyColliders === "function" ? colliders.getNearbyColliders(x, y, z) : colliders.colliders;
  if (!nearby) return null;
  let best: number | null = null;
  for (const collider of nearby) {
    if (!collider || collider.isOBB) continue;
    if (x < Number(collider.minX) || x > Number(collider.maxX)) continue;
    if (z < Number(collider.minZ) || z > Number(collider.maxZ)) continue;
    const top = Number(collider.maxY);
    if (!Number.isFinite(top)) continue;
    if (top > y + 8) continue;
    if (best === null || Math.abs(y - top) < Math.abs(y - best)) best = top;
  }
  return best;
}

function groundCandidates(colliders: ColliderSource | null | undefined, x: number, y: number, z: number) {
  if (!colliders || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return [];
  const nearby = typeof colliders.getNearbyColliders === "function" ? colliders.getNearbyColliders(x, y, z) : colliders.colliders;
  if (!nearby) return [];
  const rows: Array<Record<string, any>> = [];
  for (const collider of nearby) {
    if (!collider || collider.isOBB) continue;
    const insideX = x >= Number(collider.minX) && x <= Number(collider.maxX);
    const insideZ = z >= Number(collider.minZ) && z <= Number(collider.maxZ);
    const top = Number(collider.maxY);
    if (!Number.isFinite(top)) continue;
    rows.push({
      insideX,
      insideZ,
      top: roundNumber(top),
      deltaFromTargetY: roundNumber(y - top),
      minX: roundNumber(collider.minX),
      maxX: roundNumber(collider.maxX),
      minY: roundNumber(collider.minY),
      maxY: roundNumber(collider.maxY),
      minZ: roundNumber(collider.minZ),
      maxZ: roundNumber(collider.maxZ),
      shape: collider.shape || "",
      partType: collider.partType || ""
    });
  }
  return rows
    .sort((a, b) => {
      const aInside = a.insideX && a.insideZ ? 0 : 1;
      const bInside = b.insideX && b.insideZ ? 0 : 1;
      if (aInside !== bInside) return aInside - bInside;
      return Math.abs(a.deltaFromTargetY || 0) - Math.abs(b.deltaFromTargetY || 0);
    })
    .slice(0, 20);
}
