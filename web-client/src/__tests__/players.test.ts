import { describe, expect, it } from "vitest";
import { PlayerService } from "../players/PlayerService";

describe("PlayerService", () => {
  it("exposes self and remote players through a small runtime service", () => {
    const remote = { username: "RemoteUser" };
    const remotes = new Map<unknown, unknown>([[22, remote]]);
    const service = new PlayerService();
    service.attachRemoteSession({
      selfId: 11,
      remotes,
      get: (id: unknown) => remotes.get(id)
    } as never);

    expect(service.get(11)).toMatchObject({ id: 11, self: true });
    expect(service.get(22)).toMatchObject({ id: 22, username: "RemoteUser", self: false });
    expect(service.list()).toHaveLength(2);
    expect(service.snapshot()).toEqual({ selfId: 11, players: 2, remotes: 1 });
  });
});
