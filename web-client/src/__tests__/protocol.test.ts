import { describe, expect, it } from "vitest";
import { createProtocolService, PROTOCOL_VERSION } from "../network/protocol";

describe("protocol service", () => {
  it("accepts known client and server message types", () => {
    const protocol = createProtocolService();

    expect(protocol.version).toBe(PROTOCOL_VERSION);
    expect(protocol.isClientMessage({ type: "hello", protocolVersion: PROTOCOL_VERSION })).toBe(true);
    expect(protocol.isServerMessage({ type: "script_package", package: {} })).toBe(true);
    expect(protocol.isClientMessage({ type: "raw_socket" })).toBe(false);
  });
});
