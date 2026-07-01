import { describe, expect, it } from "vitest";
import { AssetManager } from "../assets/AssetManager";

describe("AssetManager", () => {
  it("loads and dedupes custom asset loaders", async () => {
    let calls = 0;
    const assets = new AssetManager({} as never, { warn: () => undefined } as never);
    const loader = async () => {
      calls += 1;
      return { ok: true };
    };

    await expect(assets.load("custom:model", loader)).resolves.toEqual({ ok: true });
    await expect(assets.load("custom:model", loader)).resolves.toEqual({ ok: true });

    expect(calls).toBe(1);
  });
});
