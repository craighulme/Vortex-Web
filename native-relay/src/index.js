import dgram from "node:dgram";
import crypto from "node:crypto";
import { WebSocketServer } from "ws";

const listenHost = process.env.V22_RELAY_HOST || "127.0.0.1";
const listenPort = Number(process.env.V22_RELAY_PORT || 27822);
const nativeHost = process.env.VORTEX_NATIVE_HOST || "connect.playvortex.io";
const nativePort = Number(process.env.VORTEX_NATIVE_PORT || 7777);
const heartbeatType = Number(process.env.V22_HEARTBEAT_TYPE || 6);
const nativeLeaveGraceMs = Number(process.env.V22_NATIVE_LEAVE_GRACE_MS || 5000);

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const wss = new WebSocketServer({ host: listenHost, port: listenPort });

console.log(`[native-relay] listening ws://${listenHost}:${listenPort}/ws`);
console.log(`[native-relay] native UDP ${nativeHost}:${nativePort}`);
console.log(`[native-relay] heartbeat packet type=${heartbeatType}`);

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/ws", `ws://${req.headers.host || `${listenHost}:${listenPort}`}`);
  const game = safeInt(url.searchParams.get("game"));
  const session = new NativeSession(ws, game);
  console.log(`[native-relay] browser connected game=${game || "unknown"}`);
  ws.on("message", (data) => session.onBrowserMessage(data));
  ws.on("close", () => session.close());
  ws.on("error", () => session.close());
});

class NativeSession {
  constructor(ws, requestedGame) {
    this.ws = ws;
    this.requestedGame = requestedGame;
    this.udp = null;
    this.player = null;
    this.authTokens = [];
    this.authIndex = 0;
    this.tokenSource = "none";
    this.heartbeatTimer = null;
    this.authFallbackTimer = null;
    this.statsTimer = null;
    this.bootstrapTimer = null;
    this.joined = new Set();
    this.remoteNames = new Map();
    this.missingCounts = new Map();
    this.lastSeenAt = new Map();
    this.recvPackets = 0;
    this.sendPackets = 0;
    this.lastAnimClock = 0;
    this.lastState = { x: 0, y: 0, z: 0, ry: 0, anim: "idle" };
    this.browserStateSeen = false;
    this.probeSeq = 0;
    this.pendingProbes = new Map();
  }

  onBrowserMessage(data) {
    let msg;
    try {
      msg = JSON.parse(Buffer.isBuffer(data) ? data.toString("utf8") : String(data));
    } catch {
      return;
    }

    if (msg.type === "hello") {
      this.start(msg).catch((err) => {
        console.warn(`[native-relay] start failed: ${err?.message || err}`);
        this.close(1011, "start failed");
      });
      return;
    }

    if (!this.player || !this.udp) return;

    if (msg.type === "spoof_avatar") {
      this.applyAvatarPatch(msg);
      return;
    }

    if (msg.type === "probe_packet") {
      this.sendProbePacket(msg);
      return;
    }

    if (msg.type === "state") {
      this.browserStateSeen = true;
      this.lastState = {
        x: Number(msg.x || 0),
        y: Number(msg.y || 0),
        z: Number(msg.z || 0),
        ry: Number(msg.ry || 0),
        anim: String(msg.anim || "idle"),
      };
      this.sendNative(encodeMovement(this.player, msg, this.nextAnimClock()));
      return;
    }

    if (msg.type === "chat") {
      const text = String(msg.msg || "").slice(0, 512);
      if (text.trim()) this.sendNative(encodeChat(this.player, text));
    }
  }

  applyAvatarPatch(raw) {
    const next = normalizeAvatarPatch(raw, this.player);
    this.player.shirtId = next.shirtId;
    this.player.pantId = next.pantId;
    this.player.bodyType = next.bodyType;
    this.player.bodyColors = next.bodyColors;
    this.player.faceId = next.faceId;
    console.log(`[native-relay] ${this.player.username} spoof avatar shirt=${this.player.shirtId} pants=${this.player.pantId} face=${this.player.faceId} body=${this.player.bodyType}`);
    if (raw.flush !== false && this.lastState) this.sendNative(encodeMovement(this.player, this.lastState, this.nextAnimClock()));
  }

  sendProbePacket(raw) {
    const seq = ++this.probeSeq;
    const result = encodeProbeMovement(this.player, this.lastState, this.nextAnimClock(), { ...raw, seq });
    if (!result) {
      this.sendBrowser({ type: "probe_sent", ok: false, reason: "invalid_probe" });
      return;
    }
    const pending = {
      seq,
      case: result.report.case,
      mutation: result.report.mutation,
      marker: result.report.marker,
      sentAt: Date.now(),
      timer: null,
    };
    pending.timer = setTimeout(() => this.finishProbe(seq, "no_echo"), clampInt(raw.timeoutMs ?? 1200, 250, 5000));
    this.pendingProbes.set(seq, pending);
    this.sendNative(result.buffer);
    console.warn(`[native-relay] ${this.player.username} probe #${seq} ${result.report.case} bytes=${result.report.bytes} mutation=${result.report.mutation}`);
    this.sendBrowser({ type: "probe_sent", ok: true, ...result.report });
  }

  finishProbe(seq, result, details = {}) {
    const pending = this.pendingProbes.get(seq);
    if (!pending) return;
    if (pending.timer) clearTimeout(pending.timer);
    this.pendingProbes.delete(seq);
    const latencyMs = Date.now() - pending.sentAt;
    this.sendBrowser({
      type: "probe_result",
      seq,
      case: pending.case,
      mutation: pending.mutation,
      result,
      latency_ms: latencyMs,
      ...details,
      at: new Date().toISOString(),
    });
    console.warn(`[native-relay] ${this.player.username} probe #${seq} ${pending.case} result=${result} latency=${latencyMs}ms`);
  }

  async start(hello) {
    if (this.player) return;

    const verified = await verifyLaunchToken(hello.launchToken);
    const browserIdentity = hasBrowserIdentity(hello);
    const identity = verified.id ? verified : browserIdentity;

    this.authTokens = chooseAuthTokens(hello, verified);
    if (!this.authTokens.length) {
      this.close(1008, "missing auth token");
      return;
    }

    this.player = {
      id: safeInt(identity.id),
      username: safeName(identity.username),
      gameId: safeInt(identity.gameId) || this.requestedGame,
      shirtId: safeInt(identity.shirtId),
      pantId: safeInt(identity.pantId),
      bodyType: safeBodyType(identity.bodyType),
      bodyColors: safeBodyColors(identity.bodyColors),
      faceId: safeInt(identity.faceId),
    };

    if (!this.player.id || !this.player.gameId) {
      this.close(1008, "invalid identity");
      return;
    }

    this.tokenSource = this.authTokens[0].source;
    this.openUdpSocket();
    this.sendBrowser({
      type: "init",
      id: this.player.id,
      username: this.player.username,
      game_id: this.player.gameId,
      is_staff: false,
      is_booster: false,
      shirt_id: this.player.shirtId || 0,
      pant_id: this.player.pantId || 0,
      body_type: this.player.bodyType,
      body_colors: this.player.bodyColors,
      face_id: this.player.faceId || 0,
      players: [],
    });

    this.sendHeartbeat();
    this.startBootstrapMovement();
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), 4000);
    this.authFallbackTimer = setInterval(() => this.rotateAuthIfNeeded(), 3000);
    this.statsTimer = setInterval(() => {
      console.log(`[native-relay] ${this.player.username} game=${this.player.gameId} sends=${this.sendPackets} recvs=${this.recvPackets} players=${this.joined.size} token=${this.tokenSource}`);
    }, 5000);

    console.log(`[native-relay] ${this.player.username} #${this.player.id} game=${this.player.gameId} started token=${this.tokenSource}`);
  }

  openUdpSocket() {
    if (this.udp) {
      try { this.udp.close(); } catch {}
    }
    this.udp = dgram.createSocket("udp4");
    this.udp.on("message", (buf) => this.onNativeMessage(buf));
    this.udp.on("error", (err) => {
      console.warn(`[native-relay] udp error ${err.message}`);
      this.close();
    });
  }

  rotateAuthIfNeeded() {
    if (this.recvPackets > 0) {
      clearInterval(this.authFallbackTimer);
      this.authFallbackTimer = null;
      return;
    }

    if (this.authIndex + 1 >= this.authTokens.length) return;
    this.authIndex += 1;
    this.tokenSource = this.authTokens[this.authIndex].source;
    this.openUdpSocket();
    console.warn(`[native-relay] ${this.player?.username || "unknown"} no native replies; retrying ${this.tokenSource}`);
    this.sendHeartbeat();
  }

  sendHeartbeat() {
    const token = this.authTokens[this.authIndex]?.value;
    if (token) this.sendNative(encodeHeartbeat(token));
  }

  startBootstrapMovement() {
    let ticks = 0;
    this.bootstrapTimer = setInterval(() => {
      ticks += 1;
      if (!this.udp || this.recvPackets > 0 || ticks > 30) {
        clearInterval(this.bootstrapTimer);
        this.bootstrapTimer = null;
        return;
      }
      this.sendNative(encodeMovement(this.player, this.lastState, this.nextAnimClock()));
    }, 100);
  }

  sendNative(buf) {
    if (!this.udp) return;
    this.sendPackets += 1;
    this.udp.send(buf, nativePort, nativeHost);
  }

  onNativeMessage(buf) {
    this.recvPackets += 1;

    const players = parsePlayersPacket(buf);
    if (players) {
      const summary = summarizeNativePacket(buf, players);
      if (summary.anomalies.length) this.sendBrowser({ type: "debug_packet", ...summary });
      this.matchProbeEcho(players);
      this.sendBrowser({ type: "debug_players", source: "native_players_packet", players: players.map(playerDebugState) });
      const present = new Set();
      const states = players
        .filter((p) => p.id !== this.player?.id)
        .map((p) => {
          const state = {
            id: p.id,
            username: p.name,
            is_staff: false,
            is_booster: false,
            x: p.x,
            y: p.y,
            z: p.z,
            ry: p.yaw,
            anim: p.state1 === 0 ? "jump" : p.state0 ? "walk" : "idle",
          };
          if (p.hasAvatar) {
            if (p.shirtId) state.shirt_id = p.shirtId;
            if (p.pantId) state.pant_id = p.pantId;
            if (p.bodyType) state.body_type = p.bodyType;
            if (Array.isArray(p.bodyColors) && p.bodyColors.length === 6) state.body_colors = p.bodyColors;
            if (p.faceId) state.face_id = p.faceId;
          }
          return state;
        });

      for (const p of states) {
        present.add(p.id);
        this.remoteNames.set(p.id, p.username);
        this.missingCounts.set(p.id, 0);
        this.lastSeenAt.set(p.id, Date.now());
        if (!this.joined.has(p.id)) {
          this.joined.add(p.id);
          console.log(`[native-relay] player ${p.username} #${p.id}`);
          this.sendBrowser({ type: "join", ...p });
        }
      }

      for (const id of [...this.joined]) {
        if (present.has(id)) continue;
        const missing = (this.missingCounts.get(id) || 0) + 1;
        const lastSeenAt = this.lastSeenAt.get(id) || 0;
        if (missing >= 20 && Date.now() - lastSeenAt >= nativeLeaveGraceMs) {
          const username = this.remoteNames.get(id) || `#${id}`;
          this.joined.delete(id);
          this.remoteNames.delete(id);
          this.missingCounts.delete(id);
          this.lastSeenAt.delete(id);
          console.log(`[native-relay] player left ${username} #${id}`);
          this.sendBrowser({ type: "leave", id, username });
        } else {
          this.missingCounts.set(id, missing);
        }
      }

      this.sendBrowser({ type: "states", players: states });
      return;
    }

    const packetType = buf.length >= 4 ? buf.readUInt32LE(0) : null;
    if (packetType === 1) {
      this.sendBrowser({
        type: "debug_packet",
        packet_type: packetType,
        bytes: buf.length,
        expected: readU64(buf, 4),
        records: 0,
        anomalies: ["players_packet_parse_failed"],
        at: new Date().toISOString(),
      });
    }

    const chat = parseChatPacket(buf);
    if (chat) {
      this.sendBrowser({
        type: "chat",
        id: chat.playerId,
        username: chat.username,
        msg: chat.message,
        is_staff: false,
        is_owner: false,
        is_booster: false,
      });
      return;
    }

    const notice = parseSystemPacket(buf);
    if (notice) {
      this.sendBrowser(classifySystemMessage(notice.message));
    }
  }

  matchProbeEcho(players) {
    if (!this.pendingProbes.size || !this.player) return;
    const self = players.find((p) => p.id === this.player.id);
    if (!self?.hasAvatar || !Array.isArray(self.bodyColors)) return;
    for (const pending of [...this.pendingProbes.values()]) {
      if (!sameColors(self.bodyColors, pending.marker)) continue;
      this.finishProbe(pending.seq, "echoed", { player: playerDebugState(self) });
    }
  }

  sendBrowser(payload) {
    try {
      if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(payload));
    } catch {
      this.close();
    }
  }

  nextAnimClock() {
    this.lastAnimClock += 0.05;
    return this.lastAnimClock;
  }

  close(code, reason) {
    if (this.authFallbackTimer) clearInterval(this.authFallbackTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.statsTimer) clearInterval(this.statsTimer);
    if (this.bootstrapTimer) clearInterval(this.bootstrapTimer);
    this.authFallbackTimer = null;
    this.heartbeatTimer = null;
    this.statsTimer = null;
    this.bootstrapTimer = null;

    if (this.udp) {
      try { this.udp.close(); } catch {}
      this.udp = null;
    }

    if (code && this.ws.readyState === this.ws.OPEN) {
      try { this.ws.close(code, reason); } catch {}
    }
  }
}

async function verifyLaunchToken(launchToken) {
  const token = String(launchToken || "").trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) return {};

  const requestedClientToken = crypto.randomBytes(32).toString("hex");
  try {
    const res = await fetch(`https://playvortex.io/api/verify-launch?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "user-agent": "Vortex/0.1.93",
        "X-Client-Token": requestedClientToken,
      },
    });

    if (!res.ok) {
      console.warn(`[native-relay] verify-launch HTTP ${res.status}`);
      return {};
    }

    const raw = await res.json();
    return {
      clientToken: raw.client_token || raw.clientToken || "",
      appToken: raw.app_token || raw.appToken || "",
      requestedClientToken,
      id: raw.user_id || raw.userId || raw.id || 0,
      username: raw.username || raw.name || "",
      gameId: raw.game_id || raw.gameId || raw.game || 0,
      shirtId: raw.shirt_id || raw.shirtId || 0,
      pantId: raw.pant_id || raw.pantId || 0,
      bodyType: raw.body_type || raw.bodyType || "male",
      bodyColors: raw.body_colors || raw.bodyColors || [],
      faceId: raw.face_id || raw.faceId || 0,
    };
  } catch (err) {
    console.warn(`[native-relay] verify-launch failed: ${err?.message || err}`);
    return {};
  }
}

function hasBrowserIdentity(hello) {
  return {
    clientToken: hello.clientToken || "",
    appToken: hello.appToken || "",
    id: safeInt(hello.id),
    username: safeName(hello.username),
    gameId: safeInt(hello.gameId),
    shirtId: safeInt(hello.shirt_id || hello.shirtId),
    pantId: safeInt(hello.pant_id || hello.pantId),
    bodyType: safeBodyType(hello.body_type || hello.bodyType),
    bodyColors: safeBodyColors(hello.body_colors || hello.bodyColors),
    faceId: safeInt(hello.face_id || hello.faceId),
  };
}

function normalizeAvatarPatch(raw, fallback) {
  return {
    shirtId: safeInt(raw.shirt_id ?? raw.shirtId ?? fallback?.shirtId),
    pantId: safeInt(raw.pant_id ?? raw.pantId ?? fallback?.pantId),
    bodyType: safeBodyType(raw.body_type ?? raw.bodyType ?? fallback?.bodyType),
    bodyColors: safeBodyColors(raw.body_colors ?? raw.bodyColors ?? fallback?.bodyColors),
    faceId: safeInt(raw.face_id ?? raw.faceId ?? fallback?.faceId),
  };
}

function chooseAuthTokens(hello, verified) {
  const candidates = [
    ["env", process.env.V22_NATIVE_AUTH_TOKEN],
    ["serverClientToken", verified.clientToken],
    ["clientToken", hello.clientToken],
    ["requestedClientToken", verified.requestedClientToken],
    ["serverAppToken", verified.appToken],
    ["appToken", hello.appToken],
    ["launchToken", hello.launchToken],
  ];
  const seen = new Set();
  const out = [];

  for (const [source, value] of candidates) {
    const token = String(value || "").trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(token) || seen.has(token)) continue;
    seen.add(token);
    out.push({ source, value: token });
  }

  return out;
}

function encodeHeartbeat(token) {
  const bytes = encoder.encode(token.slice(0, 64));
  const buf = Buffer.alloc(12 + bytes.length);
  buf.writeUInt32LE(heartbeatType, 0);
  writeU64(buf, 4, bytes.length);
  Buffer.from(bytes).copy(buf, 12);
  return buf;
}

function encodeMovement(player, data, animClock) {
  const nameBytes = encoder.encode(player.username);
  const buf = Buffer.alloc(4 + 8 + 8 + 8 + nameBytes.length + 1 + 16 + 2 + 4 + 41);
  let off = 0;
  buf.writeUInt32LE(0, off); off += 4;
  writeU64(buf, off, player.id); off += 8;
  writeU64(buf, off, player.gameId); off += 8;
  writeU64(buf, off, nameBytes.length); off += 8;
  Buffer.from(nameBytes).copy(buf, off); off += nameBytes.length;
  buf.writeUInt8(0, off); off += 1;
  buf.writeFloatLE(Number(data.x || 0), off); off += 4;
  buf.writeFloatLE(Number(data.y || 0), off); off += 4;
  buf.writeFloatLE(Number(data.z || 0), off); off += 4;
  buf.writeFloatLE(Number(data.ry || 0), off); off += 4;

  const anim = String(data.anim || "idle");
  buf.writeUInt8(anim === "idle" ? 0 : 1, off); off += 1;
  buf.writeUInt8(anim === "jump" ? 0 : 1, off); off += 1;
  buf.writeFloatLE(animClock, off); off += 4;
  const colors = safeBodyColors(player.bodyColors);
  const bodyType = player.bodyType === "female" ? 2 : 1;
  const shirtId = safeInt(player.shirtId);
  const faceId = safeInt(player.faceId);
  buf.writeUInt8(1, off); off += 1;
  buf.writeUInt32LE(shirtId, off); off += 4;
  buf.writeUInt8(bodyType, off); off += 1;
  buf.writeUInt32LE(safeInt(player.pantId), off); off += 4;
  buf.writeUInt8(0, off); off += 1;
  for (let i = 0; i < 6; i += 1) {
    buf.writeUInt32LE(colorToPacketInt(colors[i]), off);
    off += 4;
  }
  buf.writeUInt8(bodyType, off); off += 1;
  buf.writeUInt32LE(faceId, off); off += 4;
  buf.writeUInt8(0, off);
  return buf;
}

function encodeProbeMovement(player, data, animClock, raw = {}) {
  const base = encodeMovement(player, data, animClock);
  const nameBytes = encoder.encode(player.username);
  const foff = 4 + 8 + 8 + 8 + nameBytes.length + 1;
  const probeCase = String(raw.case || raw.probe || "append_tail").toLowerCase();
  const report = {
    case: probeCase,
    bytes: base.length,
    mutation: "none",
    at: new Date().toISOString(),
  };

  const append = (length, pattern) => {
    const tail = patternBytes(length, pattern);
    report.bytes = base.length + tail.length;
    report.mutation = `append:${tail.length}:${pattern}`;
    return Buffer.concat([base, tail]);
  };

  let out = Buffer.from(base);
  switch (probeCase) {
    case "append_tail":
    case "tail":
      out = append(raw.bytes ?? raw.length ?? 16, raw.pattern || "zero");
      break;
    case "random_tail":
      out = append(raw.bytes ?? raw.length ?? 32, "random");
      break;
    case "ff_tail":
      out = append(raw.bytes ?? raw.length ?? 32, "ff");
      break;
    case "ascii_tail":
      out = append(raw.bytes ?? raw.length ?? 32, "ascii");
      break;
    case "truncate_tail": {
      const cut = clampInt(raw.bytes ?? raw.length ?? 8, 1, 40);
      out = out.subarray(0, Math.max(0, out.length - cut));
      report.bytes = out.length;
      report.mutation = `truncate:${cut}`;
      break;
    }
    case "nan_pos":
      writeProbeFloat(out, foff + probeAxisOffset(raw.axis), NaN);
      report.mutation = `float:${raw.axis || "x"}:NaN`;
      break;
    case "inf_pos":
      writeProbeFloat(out, foff + probeAxisOffset(raw.axis), Number.POSITIVE_INFINITY);
      report.mutation = `float:${raw.axis || "x"}:Infinity`;
      break;
    case "huge_pos":
      writeProbeFloat(out, foff + probeAxisOffset(raw.axis), Number(raw.value || 1e12));
      report.mutation = `float:${raw.axis || "x"}:${Number(raw.value || 1e12)}`;
      break;
    case "bad_state":
      out.writeUInt8(clampInt(raw.state0 ?? 255, 0, 255), foff + 16);
      out.writeUInt8(clampInt(raw.state1 ?? 255, 0, 255), foff + 17);
      report.mutation = `state:${out.readUInt8(foff + 16)},${out.readUInt8(foff + 17)}`;
      break;
    case "bad_avatar_ids":
      out.writeUInt32LE(clampUint32(raw.shirt ?? 0xffffffff), foff + 23);
      out.writeUInt32LE(clampUint32(raw.pants ?? 0xffffffff), foff + 28);
      out.writeUInt32LE(clampUint32(raw.face ?? 0xffffffff), foff + 58);
      report.mutation = "avatar_ids:uint32_max";
      break;
    case "bad_body_type":
      out.writeUInt8(clampInt(raw.value ?? 255, 0, 255), foff + 27);
      out.writeUInt8(clampInt(raw.value ?? 255, 0, 255), foff + 57);
      report.mutation = `body_type:${out.readUInt8(foff + 27)}`;
      break;
    case "bad_marker":
      out.writeUInt8(clampInt(raw.value ?? 255, 0, 255), foff + 22);
      report.mutation = `avatar_marker:${out.readUInt8(foff + 22)}`;
      break;
    case "bad_name_len":
      writeU64(out, 20, clampInt(raw.value ?? 1024, 0, 4096));
      report.mutation = `name_len:${readU64(out, 20)}`;
      break;
    case "byteflip": {
      const offset = clampInt(raw.offset ?? (foff + 22), 0, out.length - 1);
      const xor = clampInt(raw.xor ?? 0xff, 0, 255);
      out.writeUInt8(out.readUInt8(offset) ^ xor, offset);
      report.mutation = `byteflip:${offset}:xor${xor}`;
      break;
    }
    default:
      return null;
  }

  report.bytes = out.length;
  return { buffer: out, report };
}

function encodeChat(player, msg) {
  const name = encoder.encode(player.username);
  const text = encoder.encode(String(msg || "").slice(0, 512));
  const buf = Buffer.alloc(4 + 8 + 8 + name.length + 8 + text.length + 1);
  let off = 0;
  buf.writeUInt32LE(2, off); off += 4;
  writeU64(buf, off, player.id); off += 8;
  writeU64(buf, off, name.length); off += 8;
  Buffer.from(name).copy(buf, off); off += name.length;
  writeU64(buf, off, text.length); off += 8;
  Buffer.from(text).copy(buf, off); off += text.length;
  buf.writeUInt8(0, off);
  return buf;
}

function summarizeNativePacket(buf, players) {
  const expected = readU64(buf, 4);
  const anomalies = [];
  if (expected != null && expected !== players.length) anomalies.push(`record_count:${players.length}/${expected}`);
  return {
    packet_type: 1,
    bytes: buf.length,
    expected,
    records: players.length,
    anomalies,
    at: new Date().toISOString(),
  };
}

function patternBytes(length, pattern) {
  const n = clampInt(length, 1, 256);
  const out = Buffer.alloc(n);
  if (pattern === "ff") out.fill(0xff);
  else if (pattern === "random") crypto.randomFillSync(out);
  else if (pattern === "ascii") {
    const text = Buffer.from("V22_PROBE");
    for (let i = 0; i < n; i += 1) out[i] = text[i % text.length];
  }
  return out;
}

function probeAxisOffset(axis) {
  const key = String(axis || "x").toLowerCase();
  if (key === "y") return 4;
  if (key === "z") return 8;
  if (key === "ry" || key === "yaw") return 12;
  return 0;
}

function writeProbeFloat(buf, offset, value) {
  if (offset >= 0 && offset + 4 <= buf.length) buf.writeFloatLE(value, offset);
}

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function clampUint32(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(0xffffffff, Math.floor(n)));
}

function parsePlayersPacket(buf) {
  if (buf.length < 16 || buf.readUInt32LE(0) !== 1) return null;
  const expected = readU64(buf, 4);
  if (expected == null) return null;

  const records = [];
  const seen = new Set();
  let off = 12;
  while (off + 32 < buf.length && records.length < 128 && (!expected || records.length < expected)) {
    const rec = parseMovementRecord(buf, off, false);
    if (!rec) {
      off += 1;
      continue;
    }

    if (!seen.has(rec.id)) {
      seen.add(rec.id);
      records.push(rec);
    }

    const next = findNextRecord(buf, off, rec);
    off = next == null ? off + 1 : next;
  }

  return records;
}

function playerDebugState(p) {
  const state = {
    id: p.id,
    username: p.name,
    game: p.game,
    x: p.x,
    y: p.y,
    z: p.z,
    ry: p.yaw,
    state0: p.state0,
    state1: p.state1,
    animTime: p.animTime,
    hasAvatar: !!p.hasAvatar,
    recordBytes: p.recordBytes || 0,
    floatOffset: p.floatOffset || 0,
  };
  if (p.hasAvatar) {
    state.shirt_id = p.shirtId || 0;
    state.pant_id = p.pantId || 0;
    state.body_type = p.bodyType || "male";
    state.body_colors = Array.isArray(p.bodyColors) ? p.bodyColors : [];
    state.face_id = p.faceId || 0;
  }
  return state;
}

function parseMovementRecord(buf, offset, hasPacketType) {
  const start = offset + (hasPacketType ? 4 : 0);
  if (buf.length < start + 34) return null;

  const id = readU64(buf, start);
  const game = readU64(buf, start + 8);
  const nameLen = readU64(buf, start + 16);
  if (id == null || game == null || !nameLen || nameLen > 64) return null;

  const nameOff = start + 24;
  if (nameOff + nameLen > buf.length) return null;

  const name = decoder.decode(buf.subarray(nameOff, nameOff + nameLen));
  if (!textOk(name)) return null;

  const firstFloat = nameOff + nameLen;
  const offsets = [firstFloat + 1, firstFloat + 2, firstFloat];
  let best = null;

  for (const foff of offsets) {
    if (foff + 22 > buf.length) continue;

    const x = buf.readFloatLE(foff);
    const y = buf.readFloatLE(foff + 4);
    const z = buf.readFloatLE(foff + 8);
    const yaw = buf.readFloatLE(foff + 12);
    if (![x, y, z, yaw].every(Number.isFinite)) continue;
    if (Math.abs(x) > 1000000 || Math.abs(y) > 1000000 || Math.abs(z) > 1000000) continue;

    const state0 = buf.readUInt8(foff + 16);
    const state1 = buf.readUInt8(foff + 17);
    if (state0 > 2 || state1 > 2) continue;

    const hasModernTail = foff + 63 <= buf.length && buf.readUInt8(foff + 22) === 1;
    const avatar = readPacketAvatar(buf, foff);
    if (hasModernTail && !avatar.valid) continue;
    const rec = {
      id,
      game,
      name,
      x,
      y,
      z,
      yaw,
      state0,
      state1,
      animTime: foff + 22 <= buf.length ? buf.readFloatLE(foff + 18) : 0,
      ...avatar,
      floatOffset: foff - offset,
      recordBytes: hasModernTail ? 63 : (foff + 55 <= buf.length ? 55 : 22),
    };

    let score = 0;
    if (state0 <= 1 && state1 <= 1) score += 100;
    if (Math.abs(yaw) <= 8) score += 20;
    if (foff === firstFloat + 1) score += 4;
    else if (foff === firstFloat + 2) score += 2;
    if (!best || score > best.score) best = { rec, score };
  }

  return best?.rec || null;
}

function packetColorHex(value) {
  return `#${(Number(value || 0) & 0xffffff).toString(16).padStart(6, "0")}`;
}

function readPacketAvatar(buf, foff) {
  const avatar = {
    shirtId: 0,
    pantId: 0,
    bodyType: "male",
    bodyColors: [],
    faceId: 0,
    hasAvatar: false,
    valid: true,
  };
  if (foff + 63 <= buf.length && buf.readUInt8(foff + 22) === 1) {
    const firstId = buf.readUInt32LE(foff + 23);
    avatar.shirtId = firstId;
    avatar.pantId = buf.readUInt32LE(foff + 28);
    const colors = [];
    let off = foff + 33;
    for (let i = 0; i < 6; i += 1) {
      colors.push(packetColorHex(buf.readUInt32LE(off)));
      off += 4;
    }
    avatar.bodyColors = colors;
    const bodyTypeByte = buf.readUInt8(off);
    avatar.bodyType = bodyTypeByte === 2 ? "female" : "male";
    avatar.faceId = buf.readUInt32LE(off + 1);
    avatar.valid = (bodyTypeByte === 1 || bodyTypeByte === 2) &&
      avatar.shirtId >= 0 && avatar.shirtId < 1000 &&
      avatar.pantId >= 0 && avatar.pantId < 1000 &&
      avatar.faceId >= 0 && avatar.faceId < 1000;
    avatar.hasAvatar = avatar.valid;
  } else if (foff + 55 <= buf.length) {
    avatar.shirtId = buf.readUInt8(foff + 22);
    avatar.pantId = buf.readUInt8(foff + 23);
    const colors = [];
    let off = foff + 25;
    for (let i = 0; i < 6; i += 1) {
      colors.push(packetColorHex(buf.readUInt32LE(off)));
      off += 4;
    }
    avatar.bodyColors = colors;
    const bodyTypeByte = buf.readUInt8(off);
    avatar.bodyType = bodyTypeByte === 2 ? "female" : "male";
    avatar.faceId = buf.readUInt32LE(off + 1);
    avatar.valid = (bodyTypeByte === 1 || bodyTypeByte === 2) &&
      avatar.shirtId >= 0 && avatar.shirtId < 1000 &&
      avatar.pantId >= 0 && avatar.pantId < 1000 &&
      avatar.faceId >= 0 && avatar.faceId < 1000;
    avatar.hasAvatar = avatar.valid;
  } else if (foff + 27 <= buf.length && buf.readUInt8(foff + 22) === 1) {
    avatar.faceId = buf.readUInt32LE(foff + 23);
  } else if (foff + 26 <= buf.length) {
    avatar.shirtId = buf.readUInt32LE(foff + 22);
  }
  if (avatar.shirtId < 0 || avatar.shirtId >= 1000) avatar.shirtId = 0;
  if (avatar.pantId < 0 || avatar.pantId >= 1000) avatar.pantId = 0;
  if (avatar.faceId < 0 || avatar.faceId >= 1000) avatar.faceId = 0;
  return avatar;
}

function safeBodyType(value) {
  return String(value || "male").toLowerCase() === "female" ? "female" : "male";
}

function safeBodyColors(value) {
  const input = Array.isArray(value) ? value : [];
  const out = [];
  for (let i = 0; i < 6; i += 1) {
    const color = String(input[i] || "#ffffff").trim();
    out.push(/^#?[0-9a-f]{6}$/i.test(color) ? (color.startsWith("#") ? color : `#${color}`) : "#ffffff");
  }
  return out;
}

function colorToPacketInt(color) {
  const match = String(color || "").match(/^#?([0-9a-f]{6})$/i);
  return match ? parseInt(match[1], 16) : 0xffffff;
}

function findNextRecord(buf, off, rec) {
  const minNext = off + rec.floatOffset + (rec.recordBytes || 22);
  const maxNext = Math.min(buf.length, off + rec.floatOffset + 96);
  for (let next = minNext; next <= maxNext; next++) {
    if (parseMovementRecord(buf, next, false)) return next;
  }
  return null;
}

function parseChatPacket(buf) {
  if (buf.length < 24 || buf.readUInt32LE(0) !== 2) return null;

  const playerId = readU64(buf, 4);
  const nameLen = readU64(buf, 12);
  if (playerId == null || !nameLen || nameLen > 64) return null;

  let off = 20;
  if (off + nameLen + 8 > buf.length) return null;
  const username = decoder.decode(buf.subarray(off, off + nameLen));
  if (!textOk(username)) return null;

  off += nameLen;
  const msgLen = readU64(buf, off);
  if (!msgLen || msgLen > 512) return null;

  off += 8;
  if (off + msgLen > buf.length) return null;
  const message = decoder.decode(buf.subarray(off, off + msgLen));
  if (!textOk(message)) return null;

  return { playerId, username, message };
}

function parseSystemPacket(buf) {
  if (buf.length < 12 || buf.readUInt32LE(0) !== 5) return null;
  const msgLen = readU64(buf, 4);
  if (!msgLen || msgLen > 1024 || 12 + msgLen > buf.length) return null;
  const message = decoder.decode(buf.subarray(12, 12 + msgLen));
  return textOk(message) ? { message } : null;
}

function classifySystemMessage(message) {
  const text = String(message || "");
  if (/wait|slow down|too fast|rate limit|throttle/i.test(text)) {
    const wait = Number(text.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|second)/i)?.[1] || 0);
    return { type: "chat_throttled", wait: wait || "a moment" };
  }
  if (/blocked|filtered|not allowed|inappropriate|moderation/i.test(text)) {
    return { type: "chat_blocked", msg: text };
  }
  if (/kick|ban|disconnect|already playing|another window/i.test(text)) {
    return { type: "system_red", msg: text };
  }
  return { type: "system", msg: text };
}

function writeU64(buf, off, value) {
  buf.writeBigUInt64LE(BigInt(Math.max(0, Math.floor(Number(value) || 0))), off);
}

function readU64(buf, off) {
  if (off + 8 > buf.length) return null;
  const value = buf.readBigUInt64LE(off);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(value);
}

function safeInt(value) {
  const n = Number(value || 0);
  return Number.isInteger(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER ? n : 0;
}

function safeName(value) {
  return String(value || "BrowserPlayer").replace(/[^\x20-\x7e]/g, "").slice(0, 32) || "BrowserPlayer";
}

function textOk(text) {
  return !!text && [...text].every((c) => {
    const n = c.codePointAt(0);
    return n === 9 || n === 10 || n === 13 || (n >= 32 && n !== 0x7f);
  });
}
