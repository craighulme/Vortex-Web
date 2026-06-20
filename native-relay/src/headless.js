import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const configPath = path.resolve(process.argv[2] || path.join(rootDir, "headless.json"));
const MIN_SPOOF_INTERVAL_MS = 500;
const VALID_SHIRTS = [0, ...Array.from({ length: 22 }, (_, i) => i + 2)];
const VALID_PANTS = [0, ...Array.from({ length: 14 }, (_, i) => i + 24)];
const VALID_FACES = [0, ...Array.from({ length: 21 }, (_, i) => i + 38)];
const BODY_TYPES = ["male", "female"];
const BODY_PALETTE = [
  "#ffffff", "#000000", "#ff0000", "#00ff00", "#0000ff", "#e3618f",
  "#82262e", "#2e2682", "#e0ccff", "#8f61e3", "#eaff00", "#29ac20",
];

process.on("unhandledRejection", (err) => {
  console.error(`[headless] unhandled rejection: ${err?.stack || err?.message || err}`);
});

process.on("uncaughtException", (err) => {
  console.error(`[headless] uncaught exception: ${err?.stack || err?.message || err}`);
});

const defaults = {
  relayUrl: "ws://127.0.0.1:27822/ws",
  apiBase: "https://playvortex.io",
  gameId: 1,
  maxBots: 1,
  absoluteMaxBots: 64,
  launchDelayMs: 1000,
  durationSeconds: 0,
  registrationLog: "",
  registrationLogLimit: 0,
  movement: {
    pps: 10,
    shape: "circle",
    radius: 12,
    center: { x: 102, y: 3.6, z: 15 },
    jumpEverySeconds: 0,
  },
  chat: {
    enabled: false,
    message: "headless test",
    everySeconds: 30,
  },
  bots: [],
  commands: [],
};

function readConfig() {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}\nCopy native-relay/headless.example.json to native-relay/headless.json first.`);
  }
  const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return mergeConfig(defaults, raw);
}

function mergeConfig(base, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return patch ?? base;
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = value && typeof value === "object" && !Array.isArray(value)
      ? mergeConfig(base?.[key] || {}, value)
      : value;
  }
  return out;
}

function safeInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanString(value) {
  return String(value || "").trim();
}

class RateLimitError extends Error {
  constructor(label, retryAfterMs) {
    super(`${label} rate limited; retrying in ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

function retryAfterMs(headers, fallbackMs = 15000) {
  const raw = headers?.get?.("retry-after");
  if (!raw) return fallbackMs;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1000, seconds * 1000);
  const dateMs = Date.parse(raw);
  if (Number.isFinite(dateMs)) return Math.max(1000, dateMs - Date.now());
  return fallbackMs;
}

function delay(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

function cookieHeader(bot) {
  const token = cleanString(bot.sessionToken || bot.session_token);
  if (!token) return "";
  return `session_token=${token}`;
}

function readSetCookie(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const value = headers.get("set-cookie");
  return value ? [value] : [];
}

function sessionTokenFromCookies(headers) {
  for (const cookie of readSetCookie(headers)) {
    const match = String(cookie).match(/(?:^|;\s*)session_token=([^;]+)/);
    if (match) return match[1];
  }
  return "";
}

function loadRegistrationBots(config) {
  const logPath = cleanString(config.registrationLog);
  if (!logPath) return { bots: [], eligible: 0, unique: 0 };
  const resolved = path.resolve(logPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`registrationLog not found: ${resolved}`);
  }

  const seen = new Set();
  const bots = [];
  let eligible = 0;
  const limit = safeInt(config.registrationLogLimit, 0);
  const lines = fs.readFileSync(resolved, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const username = cleanString(entry.username);
    const password = cleanString(entry.password);
    if (!entry.success || !username || !password) continue;
    eligible += 1;
    if (seen.has(username)) continue;
    seen.add(username);
    bots.push({
      label: username,
      username,
      password,
      source: "registration_log",
    });
    if (limit > 0 && bots.length >= limit) break;
  }
  return { bots, eligible, unique: seen.size };
}

function extractLaunchUri(html) {
  const match = String(html || "").match(/vortex:\/\/play\?game=(\d+)&token=([a-f0-9]{64})/i);
  if (!match) return null;
  return {
    gameId: Number(match[1]),
    launchToken: match[2],
    uri: match[0],
  };
}

async function fetchLaunch(config, bot) {
  if (bot.launchToken) {
    return {
      gameId: safeInt(bot.gameId, safeInt(config.gameId, 1)),
      launchToken: cleanString(bot.launchToken),
      uri: `vortex://play?game=${safeInt(bot.gameId, safeInt(config.gameId, 1))}&token=${cleanString(bot.launchToken)}`,
    };
  }

  if ((bot.username || bot.password) && !bot.sessionToken && !bot.session_token) {
    const sessionToken = await loginWithPassword(config, bot);
    bot.sessionToken = sessionToken;
  }

  const cookie = cookieHeader(bot);
  if (!cookie) {
    throw new Error(`${bot.label || "bot"} is missing sessionToken or launchToken`);
  }

  const gameId = safeInt(bot.gameId, safeInt(config.gameId, 1));
  const res = await fetch(`${config.apiBase.replace(/\/$/, "")}/games/${gameId}/play`, {
    redirect: "manual",
    headers: {
      accept: "text/html,application/xhtml+xml",
      cookie,
      "user-agent": "Mozilla/5.0 Vortex2Plus2Headless/0.1",
    },
  });

  const text = await res.text();
  if (res.status === 429) {
    throw new RateLimitError(`${bot.label || "bot"} launch fetch`, retryAfterMs(res.headers));
  }
  if (!res.ok) {
    throw new Error(`${bot.label || "bot"} launch fetch failed HTTP ${res.status}: ${text.slice(0, 160)}`);
  }

  const launch = extractLaunchUri(text);
  if (!launch) {
    throw new Error(`${bot.label || "bot"} launch page did not contain a vortex:// token`);
  }
  return launch;
}

async function loginWithPassword(config, bot) {
  const username = cleanString(bot.username);
  const password = cleanString(bot.password);
  const label = bot.label || username || "bot";
  if (!username || !password) {
    throw new Error(`${label} is missing username or password`);
  }

  const res = await fetch(`${config.apiBase.replace(/\/$/, "")}/login`, {
    method: "POST",
    redirect: "manual",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "Mozilla/5.0 Vortex2Plus2Headless/0.1",
    },
    body: new URLSearchParams({
      username,
      password,
      fingerprint: "",
      fp_token: "",
    }),
  });

  const sessionToken = sessionTokenFromCookies(res.headers);
  if (sessionToken) {
    console.log(`[headless] ${label} login OK`);
    return sessionToken;
  }

  if (res.status === 429) {
    throw new RateLimitError(`${label} login`, retryAfterMs(res.headers));
  }

  let detail = "";
  try {
    const text = await res.text();
    const data = JSON.parse(text);
    detail = data?.detail || data?.message || text;
  } catch {
    detail = `${res.status} ${res.statusText}`;
  }
  throw new Error(`${label} login failed HTTP ${res.status}: ${String(detail || "unknown").slice(0, 180)}`);
}

async function retryStep(label, fn, attempts = 2) {
  let lastErr = null;
  let rateLimitWaits = 0;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err instanceof RateLimitError && rateLimitWaits < 5) {
        rateLimitWaits += 1;
        const waitMs = Math.max(1000, Math.min(60000, err.retryAfterMs || 15000));
        console.warn(`[headless] ${label} hit rate limit (${rateLimitWaits}/5); waiting ${Math.ceil(waitMs / 1000)}s`);
        await delay(waitMs);
        i -= 1;
        continue;
      }
      if (i < attempts) {
        console.warn(`[headless] ${label} failed attempt ${i}/${attempts}: ${err?.message || err}`);
        await delay(1500 * i);
      }
    }
  }
  throw lastErr;
}

function relayUrl(config, gameId) {
  const url = new URL(config.relayUrl);
  url.searchParams.set("game", String(gameId));
  return url.toString();
}

class HeadlessBot {
  constructor(config, bot, launch) {
    this.config = config;
    this.bot = bot;
    this.launch = launch;
    this.label = bot.label || bot.username || `bot-${launch.gameId}`;
    this.ws = null;
    this.stateTimer = null;
    this.chatTimer = null;
    this.stopTimer = null;
    this.commandTimers = [];
    this.startedAt = Date.now();
    this.sentStates = 0;
    this.recvStates = 0;
    this.players = new Map();
    this.identity = null;
    this.angle = Math.random() * Math.PI * 2;
    this.overrideState = null;
    this.followTarget = null;
    this.defaultAvatar = null;
    this.spoofTimer = null;
    this.spoofRemaining = 0;
    this.mexicanWave = null;
  }

  start() {
    return new Promise((resolve, reject) => {
      const url = relayUrl(this.config, this.launch.gameId);
      this.ws = new WebSocket(url);
      let settled = false;

      const fail = (err) => {
        if (!settled) {
          settled = true;
          reject(err);
        }
      };

      this.ws.on("open", () => {
        this.ws.send(JSON.stringify({
          type: "hello",
          launchToken: this.launch.launchToken,
        }));
      });

      this.ws.on("message", (data) => {
        this.onMessage(data);
        if (!settled && this.identity) {
          settled = true;
          resolve(this);
        }
      });

      this.ws.on("close", () => this.close());
      this.ws.on("error", fail);

      setTimeout(() => fail(new Error(`${this.label} did not initialize in time`)), 15000);
    });
  }

  onMessage(data) {
    let msg;
    try {
      msg = JSON.parse(Buffer.isBuffer(data) ? data.toString("utf8") : String(data));
    } catch {
      return;
    }

    if (msg.type === "init") {
      this.identity = {
        id: msg.id,
        username: msg.username,
        gameId: msg.game_id || this.launch.gameId,
      };
      this.defaultAvatar = {
        shirt_id: safeInt(msg.shirt_id, 0),
        pant_id: safeInt(msg.pant_id, 0),
        face_id: safeInt(msg.face_id, 0),
        body_type: cleanString(msg.body_type) || "male",
        body_colors: Array.isArray(msg.body_colors) ? msg.body_colors.slice(0, 6) : [],
      };
      console.log(`[headless] ${this.label} joined as ${msg.username} #${msg.id} game=${this.identity.gameId}`);
      this.startLoops();
      return;
    }

    if (msg.type === "states" && Array.isArray(msg.players)) {
      this.recvStates += 1;
      for (const player of msg.players) this.players.set(player.id, player);
      return;
    }

    if (msg.type === "join") {
      this.players.set(msg.id, msg);
      console.log(`[headless] ${this.label} saw ${msg.username} #${msg.id}`);
      return;
    }

    if (msg.type === "leave") {
      this.players.delete(msg.id);
      return;
    }

    if (msg.type === "chat") {
      if (this.config.logChat) console.log(`[chat:${this.label}] ${msg.username}: ${msg.msg}`);
      return;
    }

    if (msg.type === "chat_throttled" || msg.type === "chat_blocked" || msg.type === "system_red") {
      console.warn(`[headless] ${this.label} ${msg.type}: ${msg.msg || msg.wait || ""}`);
    }
  }

  startLoops() {
    const movement = this.config.movement || {};
    const pps = Math.max(1, Math.min(30, safeNumber(this.bot.pps, safeNumber(movement.pps, 10))));
    const intervalMs = Math.round(1000 / pps);
    this.stateTimer = setInterval(() => this.sendState(), intervalMs);

    const chat = { ...(this.config.chat || {}), ...(this.bot.chat || {}) };
    if (chat.enabled) {
      const everyMs = Math.max(5000, safeNumber(chat.everySeconds, 30) * 1000);
      this.chatTimer = setInterval(() => {
        this.send({ type: "chat", msg: String(chat.message || "headless test").slice(0, 200) });
      }, everyMs);
    }

    const duration = safeNumber(this.bot.durationSeconds, safeNumber(this.config.durationSeconds, 0));
    if (duration > 0) this.stopTimer = setTimeout(() => this.close(), duration * 1000);

    this.scheduleCommands();
  }

  sendState() {
    const movement = this.config.movement || {};
    const pathConfig = this.pathConfig(movement);
    const center = pathConfig.center;
    const radius = pathConfig.radius;
    const speed = safeNumber(this.bot.angularSpeed, 0.75);
    const elapsed = (Date.now() - this.startedAt) / 1000;
    const jumpEvery = safeNumber(this.bot.jumpEverySeconds, safeNumber(movement.jumpEverySeconds, 0));
    const timedJumping = jumpEvery > 0 && (elapsed % jumpEvery) < 0.35;
    const waveJumping = this.isMexicanWaveJumping();

    let state;
    if (this.overrideState && Date.now() < this.overrideState.until) {
      state = { ...this.overrideState.state };
    } else {
      this.overrideState = null;
      state = this.pathState(center, radius, speed, elapsed, pathConfig.shape);
    }

    const x = state.x;
    const y = state.y + (timedJumping ? 4 : 0);
    const z = state.z;
    const ry = state.ry;
    const anim = (timedJumping || waveJumping) ? "jump" : state.anim;

    this.send({ type: "state", x, y, z, ry, anim });
    this.sentStates += 1;
  }

  pathConfig(movement) {
    let center = { ...(movement.center || {}), ...(this.bot.center || {}) };
    let radius = Math.max(0, safeNumber(this.bot.radius, safeNumber(movement.radius, 12)));
    let shape = String(this.bot.shape || movement.shape || "circle").toLowerCase();

    if (this.followTarget) {
      const target = this.findPlayer(this.followTarget.target);
      if (target) {
        center = { x: target.x, y: target.y, z: target.z };
        radius = this.followTarget.radius;
        shape = this.followTarget.shape;
      }
    }

    return { center, radius, shape };
  }

  pathState(center, radius, speed, elapsed, shape) {
    shape = String(shape || "circle").toLowerCase();
    const cx = safeNumber(center.x, 0);
    const cy = safeNumber(center.y, 0);
    const cz = safeNumber(center.z, 0);

    if (!radius) return { x: cx, y: cy, z: cz, ry: 0, anim: "idle" };

    if (shape === "square") {
      const side = radius * 2;
      const period = Math.max(0.25, (Math.PI * 2) / Math.max(0.05, speed));
      const t = ((elapsed % period) / period) * 4;
      const leg = Math.floor(t);
      const local = t - leg;
      const points = [
        [cx - radius, cz - radius],
        [cx + radius, cz - radius],
        [cx + radius, cz + radius],
        [cx - radius, cz + radius],
      ];
      const [x0, z0] = points[leg % 4];
      const [x1, z1] = points[(leg + 1) % 4];
      const x = x0 + (x1 - x0) * local;
      const z = z0 + (z1 - z0) * local;
      const ry = Math.atan2(x1 - x0, z1 - z0);
      return { x, y: cy, z, ry, anim: side > 0 ? "walk" : "idle" };
    }

    if (shape === "line") {
      const period = Math.max(0.25, (Math.PI * 2) / Math.max(0.05, speed));
      const t = (elapsed % period) / period;
      const phase = t < 0.5 ? t * 2 : (1 - t) * 2;
      const x = cx - radius + phase * radius * 2;
      const ry = t < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      return { x, y: cy, z: cz, ry, anim: "walk" };
    }

    const angle = this.angle + elapsed * speed;
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy,
      z: cz + Math.sin(angle) * radius,
      ry: -angle + Math.PI / 2,
      anim: "walk",
    };
  }

  scheduleCommands() {
    const commands = [
      ...(Array.isArray(this.config.commands) ? this.config.commands : []),
      ...(Array.isArray(this.bot.commands) ? this.bot.commands : []),
    ];

    for (const command of commands) {
      const cmd = typeof command === "string" ? parseCommandString(command) : command;
      if (!cmd || typeof cmd !== "object") continue;
      const delayMs = Math.max(0, safeNumber(cmd.afterSeconds, 0) * 1000);
      const timer = setTimeout(() => this.runCommand(cmd), delayMs);
      this.commandTimers.push(timer);
    }
  }

  runCommand(cmd) {
    const type = String(cmd.type || cmd.command || "").toLowerCase();
    if (type === "say" || type === "chat") {
      const msg = cleanString(cmd.message || cmd.msg || cmd.text);
      if (msg) this.send({ type: "chat", msg: msg.slice(0, 200) });
      return;
    }

    if (type === "moveto" || type === "tp" || type === "teleport") {
      const holdSeconds = Math.max(0.2, safeNumber(cmd.holdSeconds, 2));
      this.overrideState = {
        until: Date.now() + holdSeconds * 1000,
        state: {
          x: safeNumber(cmd.x, 0),
          y: safeNumber(cmd.y, 0),
          z: safeNumber(cmd.z, 0),
          ry: safeNumber(cmd.ry, 0),
          anim: cleanString(cmd.anim) || "idle",
        },
      };
      return;
    }

    if (type === "avatar") {
      this.sendAvatar(cmd);
    }
  }

  setFollowShape(shape, target, radius) {
    this.followTarget = {
      shape: String(shape || "circle").toLowerCase(),
      target,
      radius: Math.max(0, safeNumber(radius, 12)),
    };
  }

  clearFollowShape() {
    this.followTarget = null;
  }

  setMexicanWave(index, total, intervalMs, holdMs) {
    const safeTotal = Math.max(1, safeInt(total, 1));
    const interval = Math.max(150, safeNumber(intervalMs, 350));
    const hold = Math.max(100, Math.min(interval, safeNumber(holdMs, 220)));
    this.mexicanWave = {
      startedAt: Date.now(),
      phaseMs: (safeInt(index, 0) % safeTotal) * interval,
      cycleMs: safeTotal * interval,
      holdMs: hold,
    };
  }

  clearMexicanWave() {
    this.mexicanWave = null;
  }

  isMexicanWaveJumping() {
    if (!this.mexicanWave) return false;
    const wave = this.mexicanWave;
    const elapsed = Date.now() - wave.startedAt;
    const local = ((elapsed - wave.phaseMs) % wave.cycleMs + wave.cycleMs) % wave.cycleMs;
    return local < wave.holdMs;
  }

  findPlayer(query) {
    const needle = normalizeName(query);
    if (!needle) return null;
    for (const player of this.players.values()) {
      if (String(player.id) === String(query)) return player;
      if (normalizeName(player.username).includes(needle)) return player;
    }
    return null;
  }

  sendAvatar(raw) {
    this.send({
      type: "spoof_avatar",
      shirt_id: raw.shirt_id ?? raw.shirtId,
      pant_id: raw.pant_id ?? raw.pantId,
      face_id: raw.face_id ?? raw.faceId,
      body_type: raw.body_type ?? raw.bodyType,
      body_colors: raw.body_colors ?? raw.bodyColors,
    });
  }

  randomAvatar() {
    return {
      shirt_id: randomPick(VALID_SHIRTS),
      pant_id: randomPick(VALID_PANTS),
      face_id: randomPick(VALID_FACES),
      body_type: randomPick(BODY_TYPES),
      body_colors: Array.from({ length: 6 }, () => randomPick(BODY_PALETTE)),
    };
  }

  startClothesSpoof(intervalMs, count) {
    this.stopClothesSpoof(false);
    const actual = Math.max(0, parseInt(intervalMs) || 0);
    this.spoofRemaining = Math.max(0, safeInt(count, 0));
    this.spoofTimer = setInterval(() => {
      this.sendAvatar(this.randomAvatar());
      if (this.spoofRemaining > 0) {
        this.spoofRemaining -= 1;
        if (this.spoofRemaining <= 0) this.stopClothesSpoof(true);
      }
    }, actual);
    this.sendAvatar(this.randomAvatar());
    return actual;
  }

  stopClothesSpoof(reset = true) {
    if (this.spoofTimer) clearInterval(this.spoofTimer);
    this.spoofTimer = null;
    this.spoofRemaining = 0;
    if (reset && this.defaultAvatar) this.sendAvatar(this.defaultAvatar);
  }

  close() {
    for (const timer of this.commandTimers) clearTimeout(timer);
    this.commandTimers = [];
    this.stopClothesSpoof(false);
    if (this.stateTimer) clearInterval(this.stateTimer);
    if (this.chatTimer) clearInterval(this.chatTimer);
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.stateTimer = null;
    this.chatTimer = null;
    this.stopTimer = null;
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.close();
  }

  send(payload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }
}

function parseCommandString(line) {
  const parts = String(line || "").trim().split(/\s+/);
  if (!parts.length || !parts[0]) return null;
  const head = parts[0].toLowerCase();
  if (head === "say" || head === "chat") return { type: "say", message: parts.slice(1).join(" ") };
  if ((head === "tp" || head === "moveto") && parts.length >= 4) {
    return { type: "moveTo", x: Number(parts[1]), y: Number(parts[2]), z: Number(parts[3]) };
  }
  return { type: head };
}

function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function randomPick(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function parseTargetAndRadius(input, fallbackRadius = 12) {
  const text = String(input || "").trim();
  if (!text) return { target: "", radius: fallbackRadius };

  const braced = text.match(/^\{(.+?)\}(?:\s+(\d+(?:\.\d+)?))?$/);
  if (braced) {
    return {
      target: braced[1].trim(),
      radius: safeNumber(braced[2], fallbackRadius),
    };
  }

  const parts = text.split(/\s+/);
  const last = parts[parts.length - 1];
  const radius = /^\d+(?:\.\d+)?$/.test(last) ? safeNumber(parts.pop(), fallbackRadius) : fallbackRadius;
  return { target: parts.join(" "), radius };
}

function startTerminal(sessions, failures, totalBots, shutdown) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "headless> ",
  });

  const printHelp = () => {
    console.log("commands:");
    console.log("  bots");
    console.log("  players [bot]");
    console.log("  say <message>");
    console.log("  circle {player} [radius]");
    console.log("  square {player} [radius]");
    console.log("  line {player} [radius]");
    console.log("  idle");
    console.log("  mexicanWave [intervalMs] [holdMs]");
    console.log("  stopMexicanWave");
    console.log("  tp <x> <y> <z> [holdSeconds]");
    console.log(`  spoofClothes <intervalMs> <count>  (interval is clamped to ${MIN_SPOOF_INTERVAL_MS}ms; count 0 runs until spoofStop)`);
    console.log("  spoofStop");
    console.log("  quit");
  };

  const active = () => sessions.filter((session) => session.ws?.readyState === WebSocket.OPEN);

  const runLine = (line) => {
    const trimmed = String(line || "").trim();
    if (!trimmed) return;
    const [rawCommand, ...restParts] = trimmed.split(/\s+/);
    const command = rawCommand.toLowerCase();
    const rest = trimmed.slice(rawCommand.length).trim();
    const targets = active();

    if (command === "help" || command === "?") {
      printHelp();
      return;
    }

    if (command === "quit" || command === "exit") {
      shutdown();
      return;
    }

    if (command === "bots") {
      console.log(`live=${active().length} launched=${sessions.length} failed=${failures.length} total=${totalBots}`);
      for (const session of sessions) {
        const id = session.identity ? `#${session.identity.id}` : "#?";
        const name = session.identity?.username || session.label;
        console.log(`${name} ${id} states=${session.sentStates} updates=${session.recvStates} players=${session.players.size}`);
      }
      return;
    }

    if (command === "players") {
      const filter = normalizeName(restParts.join(" "));
      for (const session of targets) {
        const name = session.identity?.username || session.label;
        if (filter && !normalizeName(name).includes(filter)) continue;
        console.log(`[${name}]`);
        for (const player of session.players.values()) {
          console.log(`  ${player.username || "unknown"} #${player.id} (${num(player.x)}, ${num(player.y)}, ${num(player.z)})`);
        }
      }
      return;
    }

    if (command === "say" || command === "chat") {
      const msg = rest.slice(0, 200);
      if (!msg) {
        console.log("usage: say <message>");
        return;
      }
      for (const session of targets) session.send({ type: "chat", msg });
      console.log(`sent chat from ${targets.length} bot(s)`);
      return;
    }

    if (command === "circle" || command === "square" || command === "line") {
      const { target, radius } = parseTargetAndRadius(rest, 12);
      if (!target) {
        console.log(`usage: ${command} {player} [radius]`);
        return;
      }
      let seen = 0;
      for (const session of targets) {
        if (session.findPlayer(target)) seen += 1;
        session.setFollowShape(command, target, radius);
      }
      console.log(`${command} around "${target}" radius=${radius} on ${targets.length} bot(s); target currently visible to ${seen}`);
      return;
    }

    if (command === "idle" || command === "stopshape") {
      for (const session of targets) session.clearFollowShape();
      console.log(`cleared shape target on ${targets.length} bot(s)`);
      return;
    }

    if (command === "mexicanwave" || command === "wave") {
      const intervalMs = safeNumber(restParts[0], 350);
      const holdMs = safeNumber(restParts[1], 220);
      targets.forEach((session, index) => session.setMexicanWave(index, targets.length, intervalMs, holdMs));
      console.log(`mexicanWave started on ${targets.length} bot(s), interval=${Math.max(150, intervalMs)}ms hold=${Math.max(100, holdMs)}ms`);
      return;
    }

    if (command === "stopmexicanwave" || command === "waveoff" || command === "stopwave") {
      for (const session of targets) session.clearMexicanWave();
      console.log(`mexicanWave stopped on ${targets.length} bot(s)`);
      return;
    }

    if (command === "tp" || command === "moveto") {
      const [x, y, z, holdSeconds] = restParts.map(Number);
      if (![x, y, z].every(Number.isFinite)) {
        console.log("usage: tp <x> <y> <z> [holdSeconds]");
        return;
      }
      for (const session of targets) session.runCommand({ type: "moveTo", x, y, z, holdSeconds: Number.isFinite(holdSeconds) ? holdSeconds : 2 });
      console.log(`moved ${targets.length} bot(s) to (${x}, ${y}, ${z})`);
      return;
    }

    if (command === "spoofclothes" || command === "spoofclothing") {
      const requestedMs = restParts[0] !== undefined ? parseInt(restParts[0], 10) : 500;
      const count = safeInt(restParts[1], 0);
      let actualMs = 0;
      for (const session of targets) actualMs = session.startClothesSpoof(requestedMs, count);
      console.log(`spoofClothes started on ${targets.length} bot(s), interval=${actualMs}ms, count=${count || "until spoofStop"}`);
      return;
    }

    if (command === "spoofstop" || command === "clothestop") {
      for (const session of targets) session.stopClothesSpoof(true);
      console.log(`spoofClothes stopped/reset on ${targets.length} bot(s)`);
      return;
    }

    console.log(`unknown command: ${rawCommand}. type help`);
  };

  rl.on("line", (line) => {
    try {
      runLine(line);
    } catch (err) {
      console.warn(`[headless] command failed: ${err?.message || err}`);
    }
    rl.prompt();
  });

  rl.on("close", shutdown);
  printHelp();
  rl.prompt();
  return rl;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "?";
}

async function launchBotsInBackground(config, bots, sessions, failures, delayMs) {
  for (let i = 0; i < bots.length; i += 1) {
    const bot = bots[i];
    const label = bot.label || bot.username || `bot-${i + 1}`;
    try {
      console.log(`[headless] launching ${i + 1}/${bots.length}: ${label}`);
      const launch = await retryStep(`${label} launch`, () => fetchLaunch(config, bot), 2);
      const session = new HeadlessBot(config, bot, launch);
      await retryStep(`${label} relay init`, () => session.start(), 2);
      sessions.push(session);
    } catch (err) {
      failures.push({ label, error: err?.message || String(err) });
      console.warn(`[headless] skipped ${label}: ${err?.message || err}`);
    }
    if (delayMs) await delay(delayMs);
  }

  console.log(`[headless] launch complete: live=${sessions.length} failed=${failures.length}`);
  if (failures.length) {
    for (const failure of failures.slice(0, 10)) {
      console.warn(`[headless] failed ${failure.label}: ${failure.error}`);
    }
    if (failures.length > 10) console.warn(`[headless] ${failures.length - 10} more failure(s) hidden`);
  }
}

async function main() {
  const config = readConfig();
  const imported = loadRegistrationBots(config);
  const importedBots = imported.bots;
  const configuredBots = Array.isArray(config.bots) ? config.bots : [];
  const allBots = [...configuredBots, ...importedBots];

  if (!allBots.length) {
    throw new Error("No bots configured.");
  }

  const absoluteMax = Math.max(1, safeInt(config.absoluteMaxBots, 64));
  const requestedMax = safeInt(config.maxBots, allBots.length);
  const maxBots = requestedMax === 0 ? Math.min(absoluteMax, allBots.length) : Math.max(1, Math.min(absoluteMax, requestedMax));
  const bots = allBots.slice(0, maxBots);
  const delayMs = Math.max(0, safeNumber(config.launchDelayMs, 1000));
  const sessions = [];
  const failures = [];

  console.log(`[headless] config=${configPath}`);
  console.log(`[headless] relay=${config.relayUrl} game=${config.gameId} bots=${bots.length}/${allBots.length} imported=${importedBots.length} eligible=${imported.eligible} unique=${imported.unique} max=${requestedMax || "all"} absoluteMax=${absoluteMax}`);

  const statsTimer = setInterval(() => {
    for (const session of sessions) {
      const name = session.identity?.username || session.label;
      console.log(`[headless] ${name} states=${session.sentStates} updates=${session.recvStates} players=${session.players.size}`);
    }
  }, 5000);

  const shutdown = () => {
    clearInterval(statsTimer);
    for (const session of sessions) session.close();
    setTimeout(() => process.exit(0), 250);
  };

  startTerminal(sessions, failures, bots.length, shutdown);
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  launchBotsInBackground(config, bots, sessions, failures, delayMs).catch((err) => {
    console.error(`[headless] launcher stopped: ${err?.stack || err?.message || err}`);
  });
}

main().catch((err) => {
  console.error(`[headless] ${err?.stack || err?.message || err}`);
  process.exit(1);
});
