import type { RemotePlayerRecord } from "../avatar/RemotePlayerService";
import type { RemoteSessionService } from "../avatar/RemoteSessionService";

export type RuntimePlayer = {
  id: unknown;
  username: string;
  self: boolean;
  remote?: RemotePlayerRecord;
};

export class PlayerService {
  private remoteSession: RemoteSessionService | null = null;

  attachRemoteSession(remoteSession: RemoteSessionService): void {
    this.remoteSession = remoteSession;
  }

  get(id: unknown): RuntimePlayer | null {
    const session = this.remoteSession;
    if (!session) return null;
    if (id === session.selfId) {
      return { id, username: "You", self: true };
    }
    const remote = session.get(id);
    if (!remote) return null;
    return {
      id,
      username: String(remote.username || id),
      self: false,
      remote
    };
  }

  list(): RuntimePlayer[] {
    const session = this.remoteSession;
    if (!session) return [];
    const players: RuntimePlayer[] = [];
    if (session.selfId !== null && session.selfId !== undefined) {
      players.push({ id: session.selfId, username: "You", self: true });
    }
    for (const [id, remote] of session.remotes) {
      players.push({
        id,
        username: String(remote.username || id),
        self: false,
        remote
      });
    }
    return players;
  }

  snapshot(): { selfId: unknown; players: number; remotes: number } {
    const session = this.remoteSession;
    if (!session) return { selfId: null, players: 0, remotes: 0 };
    const remotes = session.remotes.size;
    return {
      selfId: session.selfId,
      players: remotes + (session.selfId === null || session.selfId === undefined ? 0 : 1),
      remotes
    };
  }
}
