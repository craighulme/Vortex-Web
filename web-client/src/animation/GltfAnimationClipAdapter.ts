import { runtimeBoneAliases } from "../avatar/rig/RigBoneAliases";
import type { AnimationService } from "./AnimationService";
import type { AnimationClip, AnimationPoseContext, RigBoneLike, RuntimeAnimationSlot } from "./AnimationPose";

type GltfLoaderLike = {
  loadAsync(url: string): Promise<{ animations?: GltfAnimationClipLike[] }>;
};

type ThreeLike = {
  Quaternion?: new (x?: number, y?: number, z?: number, w?: number) => {
    set(x: number, y: number, z: number, w: number): unknown;
  };
};

type GltfAnimationClipLike = {
  name?: string;
  duration?: number;
  tracks?: GltfTrackLike[];
};

type GltfTrackLike = {
  name?: string;
  times?: ArrayLike<number>;
  values?: ArrayLike<number>;
  ValueTypeName?: string;
  getValueSize?(): number;
  createInterpolant?(result: number[]): { evaluate(time: number): ArrayLike<number> };
};

type RuntimeGltfTrack = {
  boneAliases: string[];
  property: "position" | "quaternion" | "scale";
  size: number;
  times?: number[];
  evaluate(time: number): ArrayLike<number>;
};

type RuntimeGltfClip = {
  slot: RuntimeAnimationSlot;
  duration: number;
  sampleDuration: number;
  tracks: RuntimeGltfTrack[];
};

const DEFAULT_PACK_SLOT_NAMES: Record<string, RuntimeAnimationSlot> = {
  idle: "idle",
  walk: "walk",
  run: "run",
  jump: "jump",
  fall: "fall",
  climb: "climb",
  climbidle: "climb_idle",
  climb_idle: "climb_idle"
};

export async function registerGltfAnimationPack(options: {
  animation: AnimationService;
  loader: GltfLoaderLike;
  url: string | null | undefined;
  THREE: ThreeLike;
  diagnostics?: { warn?(event: string, payload?: unknown): void; info?(event: string, payload?: unknown): void };
}): Promise<{ registered: string[]; url: string } | null> {
  const url = String(options.url || "").trim();
  if (!url) return null;
  try {
    const clips = await loadRuntimeGltfClips(options.loader, url);
    const registered: string[] = [];
    for (const clip of clips) {
      options.animation.registerClip(String(clip.slot), createRuntimeAnimationClip(clip, options.THREE));
      registered.push(String(clip.slot));
    }
    options.diagnostics?.info?.("avatar.animation-pack.ready", { url, clips: registered });
    return { registered, url };
  } catch (error) {
    options.diagnostics?.warn?.("avatar.animation-pack.failed", {
      url,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

export async function loadGltfAnimationClipMap(options: {
  loader: GltfLoaderLike;
  url: string | null | undefined;
  THREE: ThreeLike;
  slots?: Record<string, string>;
}): Promise<Record<string, AnimationClip> | null> {
  const url = String(options.url || "").trim();
  if (!url) return null;
  const clips = await loadRuntimeGltfClips(options.loader, url, options.slots);
  const out: Record<string, AnimationClip> = {};
  for (const clip of clips) out[String(clip.slot)] = createRuntimeAnimationClip(clip, options.THREE);
  return Object.keys(out).length ? out : null;
}

async function loadRuntimeGltfClips(loader: GltfLoaderLike, url: string, slots?: Record<string, string>): Promise<RuntimeGltfClip[]> {
  const asset = await loader.loadAsync(url);
  return (asset.animations || [])
    .map((clip) => toRuntimeGltfClip(clip, slots))
    .filter((clip): clip is RuntimeGltfClip => Boolean(clip));
}

function toRuntimeGltfClip(clip: GltfAnimationClipLike, slots?: Record<string, string>): RuntimeGltfClip | null {
  const slot = slotFromClipName(clip.name, slots);
  const duration = Math.max(0.01, Number(clip.duration || 0));
  const tracks = (clip.tracks || [])
    .map(toRuntimeGltfTrack)
    .filter((track): track is RuntimeGltfTrack => Boolean(track));
  if (!slot || tracks.length === 0) return null;
  return { slot, duration, sampleDuration: loopSampleDuration(tracks, duration), tracks };
}

function toRuntimeGltfTrack(track: GltfTrackLike): RuntimeGltfTrack | null {
  const target = parseTrackTarget(track.name);
  if (!target) return null;
  const size = Number(track.getValueSize?.() || propertySize(target.property));
  if (!Number.isFinite(size) || size <= 0) return null;
  const buffer = new Array(size).fill(0);
  const times = toNumberArray(track.times);
  const interpolant = track.createInterpolant?.(buffer);
  if (interpolant) {
    return {
      ...target,
      size,
      times,
      evaluate: (time) => interpolant.evaluate(time)
    };
  }
  const values = toNumberArray(track.values);
  if (times.length === 0 || values.length < size) return null;
  return {
    ...target,
    size,
    times,
    evaluate: (time) => sampleTrack(times, values, size, time, buffer)
  };
}

function createRuntimeAnimationClip(clip: RuntimeGltfClip, THREE: ThreeLike): AnimationClip {
  const scratchQuaternion = THREE.Quaternion ? new THREE.Quaternion() : null;
  return (context: AnimationPoseContext) => {
    const time = sampleClipTime(Number(context.time || 0), clip);
    const alpha = Math.min(1, Math.max(0.35, Number(context.dt || 0) * 22));
    for (const track of clip.tracks) {
      const bone = findBone(context.bones, track.boneAliases);
      if (!bone) continue;
      const values = track.evaluate(time);
      if (track.property === "quaternion") {
        applyQuaternion(bone, values, alpha, scratchQuaternion);
      } else if (track.property === "position") {
        applyVectorProperty(bone.position, values, alpha);
      } else if (bone.scale) {
        applyVectorProperty(bone.scale, values, alpha);
      }
    }
  };
}

function sampleClipTime(time: number, clip: RuntimeGltfClip): number {
  const safeTime = Math.max(0, Number(time) || 0);
  if (clip.slot === "jump" || clip.slot === "fall") return Math.min(safeTime, clip.sampleDuration);
  return wrapTime(safeTime, clip.sampleDuration);
}

function loopSampleDuration(tracks: RuntimeGltfTrack[], fallback: number): number {
  const times = tracks
    .map((track) => track.times)
    .filter((value): value is number[] => Array.isArray(value) && value.length > 1);
  let shortestStep = Number.POSITIVE_INFINITY;
  let maxTime = 0;
  for (const trackTimes of times) {
    maxTime = Math.max(maxTime, trackTimes[trackTimes.length - 1] || 0);
    for (let i = 1; i < trackTimes.length; i += 1) {
      const step = Number(trackTimes[i]) - Number(trackTimes[i - 1]);
      if (step > 0 && step < shortestStep) shortestStep = step;
    }
  }
  if (!Number.isFinite(maxTime) || maxTime <= 0) return fallback;
  if (!Number.isFinite(shortestStep)) return maxTime;
  return Math.max(0.01, maxTime - shortestStep);
}

function parseTrackTarget(name: unknown): Pick<RuntimeGltfTrack, "boneAliases" | "property"> | null {
  const raw = String(name || "");
  const propertyMatch = raw.match(/\.(position|quaternion|scale)$/);
  if (!propertyMatch) return null;
  const property = propertyMatch[1] as RuntimeGltfTrack["property"];
  const rawNode = raw.slice(0, -propertyMatch[0].length);
  const bracketNode = rawNode.match(/\[([^\]]+)\]\s*$/)?.[1];
  const nodeName = (bracketNode || rawNode)
    .replace(/^.*\//, "")
    .replace(/^\./, "")
    .trim();
  if (!nodeName || /^VWEB_Attach_/i.test(nodeName) || /^IK_/i.test(nodeName)) return null;
  const aliases = runtimeBoneAliases(nodeName);
  if (aliases.length === 0) return null;
  return { boneAliases: aliases, property };
}

function slotFromClipName(name: unknown, slots?: Record<string, string>): RuntimeAnimationSlot | null {
  const normalized = String(name || "").trim().replace(/[\s-]+/g, "_").toLowerCase();
  if (slots) {
    for (const [slot, clipName] of Object.entries(slots)) {
      const candidate = String(clipName || "").trim().replace(/[\s-]+/g, "_").toLowerCase();
      if (candidate === normalized) return slot;
    }
  }
  return DEFAULT_PACK_SLOT_NAMES[normalized] || null;
}

function findBone(bones: Record<string, RigBoneLike | undefined>, aliases: string[]): RigBoneLike | undefined {
  for (const alias of aliases) {
    if (bones[alias]) return bones[alias];
  }
  const lower = new Map(Object.entries(bones).map(([key, value]) => [key.toLowerCase(), value] as const));
  for (const alias of aliases) {
    const bone = lower.get(alias.toLowerCase());
    if (bone) return bone;
  }
  return undefined;
}

function applyQuaternion(
  bone: RigBoneLike,
  values: ArrayLike<number>,
  alpha: number,
  scratchQuaternion: { set(x: number, y: number, z: number, w: number): unknown } | null
): void {
  const x = Number(values[0] || 0);
  const y = Number(values[1] || 0);
  const z = Number(values[2] || 0);
  const w = Number(values[3] ?? 1);
  const quaternion = (bone as RigBoneLike & { quaternion?: { set?(x: number, y: number, z: number, w: number): void; slerp?(target: unknown, alpha: number): void } }).quaternion;
  if (!quaternion) return;
  if (scratchQuaternion && typeof quaternion.slerp === "function") {
    scratchQuaternion.set(x, y, z, w);
    quaternion.slerp(scratchQuaternion, alpha);
  } else {
    quaternion.set?.(x, y, z, w);
  }
}

function applyVectorProperty(target: Record<string, number>, values: ArrayLike<number>, alpha: number): void {
  target.x = lerp(Number(target.x || 0), Number(values[0] || 0), alpha);
  target.y = lerp(Number(target.y || 0), Number(values[1] || 0), alpha);
  target.z = lerp(Number(target.z || 0), Number(values[2] || 0), alpha);
}

function sampleTrack(times: number[], values: number[], size: number, time: number, out: number[]): number[] {
  const firstTime = times[0] ?? 0;
  if (times.length === 1 || time <= firstTime) return copySample(values, 0, size, out);
  const last = times.length - 1;
  const lastTime = times[last] ?? firstTime;
  if (time >= lastTime) return copySample(values, last, size, out);
  let index = 0;
  while (index < last && (times[index + 1] ?? lastTime) < time) index += 1;
  const start = times[index] ?? firstTime;
  const end = times[index + 1] ?? lastTime;
  const alpha = end > start ? (time - start) / (end - start) : 0;
  for (let i = 0; i < size; i += 1) {
    out[i] = lerp(values[index * size + i] || 0, values[(index + 1) * size + i] || 0, alpha);
  }
  return out;
}

function copySample(values: number[], index: number, size: number, out: number[]): number[] {
  for (let i = 0; i < size; i += 1) out[i] = values[index * size + i] || 0;
  return out;
}

function wrapTime(time: number, duration: number): number {
  if (!Number.isFinite(time) || time <= 0) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return time;
  return time % duration;
}

function propertySize(property: RuntimeGltfTrack["property"]): number {
  return property === "quaternion" ? 4 : 3;
}

function toNumberArray(values: ArrayLike<number> | undefined): number[] {
  return values ? Array.from(values, Number) : [];
}

function lerp(current: number, target: number, alpha: number): number {
  return current + (target - current) * alpha;
}
