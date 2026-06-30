import { describe, expect, it } from "vitest";
import {
  DEFAULT_KEYBINDS,
  KEYBIND_STORAGE_KEY,
  keybindLabel,
  matchesKeybindCode,
  readKeybinds,
  writeKeybind
} from "../input/KeybindSettings";

describe("KeybindSettings", () => {
  it("loads defaults when storage is empty or invalid", () => {
    expect(readKeybinds(memoryStorage()).chatToggle).toEqual(["KeyH"]);
    expect(readKeybinds(memoryStorage({ [KEYBIND_STORAGE_KEY]: "bad-json" })).jump).toEqual(["Space"]);
  });

  it("stores up to two deduped binds per action", () => {
    const storage = memoryStorage();

    writeKeybind(storage, "chatToggle", 1, "KeyJ");
    writeKeybind(storage, "chatToggle", 0, "KeyJ");

    expect(readKeybinds(storage).chatToggle).toEqual(["KeyJ"]);
    expect(matchesKeybindCode("KeyJ", "chatToggle", storage)).toBe(true);
    expect(matchesKeybindCode("KeyH", "chatToggle", storage)).toBe(false);
  });

  it("formats common key labels for the controls UI", () => {
    expect(keybindLabel(DEFAULT_KEYBINDS.settings[0]!)).toBe("Esc");
    expect(keybindLabel("Slash")).toBe("/");
    expect(keybindLabel("KeyZ")).toBe("Z");
    expect(keybindLabel("")).toBe("Unbound");
  });
});

function memoryStorage(initial: Record<string, string> = {}): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    }
  };
}
