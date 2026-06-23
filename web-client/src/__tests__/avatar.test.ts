import { describe, expect, it } from "vitest";
import { ATTACHMENT_SLOTS, AvatarService } from "../avatar/AvatarService";

describe("avatar service", () => {
  it("defines production attachment slots and normalizes avatar data", () => {
    const avatar = new AvatarService().normalize({
      bodyType: "female",
      bodyColors: ["#000000", "bad"],
      shirtId: 12,
      attachments: { Hat: "asset-hat" }
    });

    expect(ATTACHMENT_SLOTS).toContain("RightHand");
    expect(avatar.bodyType).toBe("female");
    expect(avatar.bodyColors[1]).toBe("#ffffff");
    expect(avatar.attachments.Hat).toBe("asset-hat");
  });
});
