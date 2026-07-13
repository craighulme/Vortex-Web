import { describe, expect, it, vi } from "vitest";
import { DiagnosticsService } from "../diagnostics/DiagnosticsService";

describe("DiagnosticsService", () => {
  it("includes payload context in the first console argument", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      new DiagnosticsService().warn("stream.manifest.bootstrap.failed", {
        reason: "invalid community api url",
        apiBase: "\"https://vweb.irongiant.vip\""
      });

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("invalid community api url"),
        expect.objectContaining({ reason: "invalid community api url" })
      );
    } finally {
      spy.mockRestore();
    }
  });
});
