import { EntityRegistry, type EntityRecord } from "../runtime/EntityRegistry";

export type WorldPart = {
  id?: string;
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
  color?: number;
  canCollide?: boolean;
};

export class WorldService {
  readonly entities = new EntityRegistry();

  registerPart(part: WorldPart): EntityRecord<WorldPart> {
    return this.entities.create("part", part, part.id);
  }

  remove(id: string): boolean {
    return this.entities.remove(id);
  }
}
