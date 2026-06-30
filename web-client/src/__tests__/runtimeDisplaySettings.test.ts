import { describe, expect, it } from "vitest";
import { readRuntimeDisplaySettings } from "../ui/RuntimeDisplaySettings";

describe("readRuntimeDisplaySettings", () => {
  it("defaults cosmetics display settings on", () => {
    expect(readRuntimeDisplaySettings(fakeDocument(""))).toEqual({
      chatNameGradients: true,
      leaderboardCosmetics: true,
      miniProfileCosmetics: true,
      runtimeThemeCss: ""
    });
  });

  it("reads disabled display settings from boot metadata", () => {
    const doc = fakeDocument(JSON.stringify({
      chatNameGradients: false,
      leaderboardCosmetics: false,
      miniProfileCosmetics: false
    }));

    expect(readRuntimeDisplaySettings(doc)).toEqual({
      chatNameGradients: false,
      leaderboardCosmetics: false,
      miniProfileCosmetics: false,
      runtimeThemeCss: ""
    });
  });

  it("reads runtime theme CSS from boot metadata", () => {
    const doc = fakeDocument(JSON.stringify({ runtimeThemeCss: ".x{color:red}" }));

    expect(readRuntimeDisplaySettings(doc).runtimeThemeCss).toBe(".x{color:red}");
  });
});

function fakeDocument(content: string): Document {
  return {
    getElementById: (id: string) => id === "_vortexWebSettings" && content ? { content } : null
  } as unknown as Document;
}
