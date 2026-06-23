export type EntityKind =
  | "player"
  | "part"
  | "attachment"
  | "tool"
  | "pickup"
  | "ui"
  | "script";

export type EntityRecord<TData = unknown> = {
  id: string;
  kind: EntityKind;
  data: TData;
  createdAt: number;
};

export class EntityRegistry {
  private readonly entities = new Map<string, EntityRecord>();

  create<TData>(kind: EntityKind, data: TData, id: string = crypto.randomUUID()): EntityRecord<TData> {
    const entity: EntityRecord<TData> = { id, kind, data, createdAt: Date.now() };
    this.entities.set(id, entity);
    return entity;
  }

  get<TData = unknown>(id: string): EntityRecord<TData> | null {
    return (this.entities.get(id) as EntityRecord<TData> | undefined) ?? null;
  }

  remove(id: string): boolean {
    return this.entities.delete(id);
  }

  byKind<TData = unknown>(kind: EntityKind): EntityRecord<TData>[] {
    return [...this.entities.values()].filter((entity) => entity.kind === kind) as EntityRecord<TData>[];
  }
}
