import { describe, expect, it } from "vitest";
import { PermissionSet } from "../scripting/permissions";
import { SCRIPT_API_VERSION, validateScriptPackage } from "../scripting/ScriptRuntime";

describe("script runtime contracts", () => {
  it("requires integrity for relay-delivered script urls", () => {
    expect(validateScriptPackage({
      id: "game-script",
      apiVersion: SCRIPT_API_VERSION,
      language: "lua",
      sourceUrl: "https://relay.example/script.lua"
    })).toBe("remote script packages require integrity");
  });

  it("enforces explicit permissions", () => {
    const permissions = new PermissionSet(["world.read"]);

    expect(permissions.has("world.read")).toBe(true);
    expect(() => permissions.require("world.write")).toThrow("script permission denied");
  });
});
