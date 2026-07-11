export type KeybindAction =
  | "settings"
  | "chatToggle"
  | "chatFocus"
  | "playerList"
  | "scriptExplorer"
  | "moveForward"
  | "moveBackward"
  | "moveLeft"
  | "moveRight"
  | "jump"
  | "cameraLeft"
  | "cameraRight"
  | "cameraSnapLeft"
  | "cameraSnapRight";

export type KeybindMap = Record<KeybindAction, string[]>;

export const KEYBIND_STORAGE_KEY = "vwebKeybinds";

export const DEFAULT_KEYBINDS: KeybindMap = {
  settings: ["Escape"],
  chatToggle: ["KeyH"],
  chatFocus: ["Slash"],
  playerList: ["Tab"],
  scriptExplorer: ["F2"],
  moveForward: ["KeyW", "ArrowUp"],
  moveBackward: ["KeyS", "ArrowDown"],
  moveLeft: ["KeyA", "ArrowLeft"],
  moveRight: ["KeyD", "ArrowRight"],
  jump: ["Space"],
  cameraLeft: ["ArrowLeft"],
  cameraRight: ["ArrowRight"],
  cameraSnapLeft: ["Comma"],
  cameraSnapRight: ["Period"]
};

export function readKeybinds(storage: Pick<Storage, "getItem"> = globalThis.localStorage): KeybindMap {
  try {
    const parsed = JSON.parse(storage.getItem(KEYBIND_STORAGE_KEY) || "null");
    return normalizeKeybinds(parsed);
  } catch {
    return normalizeKeybinds(null);
  }
}

export function writeKeybind(storage: Pick<Storage, "getItem" | "setItem">, action: KeybindAction, index: number, code: string): KeybindMap {
  const next = readKeybinds(storage);
  const safeIndex = index === 1 ? 1 : 0;
  next[action] = [...(next[action] || DEFAULT_KEYBINDS[action] || [])];
  next[action][safeIndex] = code;
  next[action] = dedupeBindings(next[action]).slice(0, 2);
  storage.setItem(KEYBIND_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function matchesKeybind(event: KeyboardEvent, action: KeybindAction, storage?: Pick<Storage, "getItem">): boolean {
  const code = event.code || event.key || "";
  return matchesKeybindCode(code, action, storage);
}

export function matchesKeybindCode(code: string, action: KeybindAction, storage?: Pick<Storage, "getItem">): boolean {
  return (readKeybinds(storage)[action] || []).includes(code);
}

export function keybindLabel(code: string): string {
  const labels: Record<string, string> = {
    Escape: "Esc",
    Slash: "/",
    Space: "Space",
    Tab: "Tab",
    Comma: ",",
    Period: ".",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right"
  };
  if (labels[code]) return labels[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  return code || "Unbound";
}

export function normalizeKeybinds(value: unknown): KeybindMap {
  const source = value && typeof value === "object" ? value as Partial<Record<KeybindAction, unknown>> : {};
  const out = { ...DEFAULT_KEYBINDS };
  for (const action of Object.keys(DEFAULT_KEYBINDS) as KeybindAction[]) {
    const bindings = Array.isArray(source[action]) ? source[action] : DEFAULT_KEYBINDS[action];
    out[action] = dedupeBindings(bindings.map((item) => String(item || "")).filter(Boolean)).slice(0, 2);
    if (!out[action].length) out[action] = [...DEFAULT_KEYBINDS[action]];
  }
  return out;
}

function dedupeBindings(bindings: string[]): string[] {
  return [...new Set(bindings)];
}
