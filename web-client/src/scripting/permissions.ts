export type ScriptPermission =
  | "world.read"
  | "world.write"
  | "players.read"
  | "players.write"
  | "avatar.write"
  | "cursor.write"
  | "ui.write"
  | "storage.scoped"
  | "network.relay"
  | "audio.play";

export class PermissionSet {
  private readonly allowed: Set<ScriptPermission>;

  constructor(permissions: Iterable<ScriptPermission> = []) {
    this.allowed = new Set(permissions);
  }

  has(permission: ScriptPermission): boolean {
    return this.allowed.has(permission);
  }

  require(permission: ScriptPermission): void {
    if (!this.has(permission)) throw new Error(`script permission denied: ${permission}`);
  }

  list(): ScriptPermission[] {
    return [...this.allowed];
  }
}
