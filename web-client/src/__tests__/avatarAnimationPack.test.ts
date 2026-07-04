import { describe, expect, it } from "vitest";
import { AvatarAnimationPackService } from "../avatar/AvatarAnimationPackService";
import { AssetStreamService } from "../streaming/AssetStreamService";

describe("AvatarAnimationPackService", () => {
  it("registers animation clips through the stream service and creates a web payload", () => {
    const streaming = new AssetStreamService({ warn: () => undefined });
    const packs = new AvatarAnimationPackService(streaming);

    const record = packs.register({
      id: "anim:starter",
      name: "Starter Pack",
      clips: [
        { slot: "idle", assetUrl: "https://assets.example.invalid/idle.glb", clipName: "Idle" },
        { slot: "walk", assetUrl: "https://assets.example.invalid/walk.glb", clipName: "Walk" },
        { slot: "bad" as never, assetUrl: "https://assets.example.invalid/bad.glb" }
      ],
      tags: ["animation", "starter"]
    });

    expect(record?.streams).toHaveLength(2);
    expect(streaming.byKind("animation")).toHaveLength(2);
    expect(packs.select("anim:starter")).toBe(true);
    expect(packs.toWebPayload()).toEqual({
      id: "anim:starter",
      version: 1,
      slots: {
        idle: "https://assets.example.invalid/idle.glb#Idle",
        walk: "https://assets.example.invalid/walk.glb#Walk"
      }
    });
  });

  it("rejects empty packs and omits rejected streams from payloads", () => {
    const packs = new AvatarAnimationPackService(new AssetStreamService({ warn: () => undefined }));

    expect(packs.register({ id: "anim:empty", clips: [] })).toBeNull();
    const rejected = packs.register({
      id: "anim:bad",
      clips: [
        { slot: "idle", assetUrl: "javascript:alert(1)" },
        { slot: "walk", assetUrl: "https://assets.example.invalid/walk.glb" }
      ]
    });

    expect(rejected?.streams.some((stream) => stream.status === "rejected")).toBe(true);
    expect(packs.toWebPayload(rejected)).toEqual({
      id: "anim:bad",
      version: 1,
      slots: {
        walk: "https://assets.example.invalid/walk.glb"
      }
    });
  });

  it("builds selectable packs from streamed animation records", () => {
    const streaming = new AssetStreamService({ warn: () => undefined });
    const packs = new AvatarAnimationPackService(streaming);
    const idle = streaming.register({
      id: "animations/idle.glb",
      kind: "animation",
      apiVersion: 1,
      url: "https://assets.example.invalid/idle.glb"
    }, {
      source: "remote-manifest",
      remote: { rigVersion: "vweb-rig-v1", version: "2", slot: "idle" }
    });
    const walk = streaming.register({
      id: "animations/walk.glb",
      kind: "animation",
      apiVersion: 1,
      url: "https://assets.example.invalid/walk.glb"
    }, {
      source: "remote-manifest",
      remote: { rigVersion: "vweb-rig-v1", version: "2", slot: "walk" }
    });

    const registered = packs.registerStreamRecords([idle, walk]);

    expect(registered).toHaveLength(1);
    expect(packs.selected()?.id).toBe("anim:vweb-rig-v1:2");
    expect(packs.toWebPayload()).toEqual({
      id: "anim:vweb-rig-v1:2",
      version: 2,
      slots: {
        idle: "https://assets.example.invalid/idle.glb",
        walk: "https://assets.example.invalid/walk.glb"
      }
    });
  });
});
