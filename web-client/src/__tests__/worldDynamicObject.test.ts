import { describe, expect, it } from "vitest";
import { WorldDynamicObjectService } from "../world/WorldDynamicObjectService";

describe("WorldDynamicObjectService", () => {
  it("spawns parts and meshes through a world-owned dynamic object API", () => {
    const added: unknown[] = [];
    const parts = {
      addPart: (...args: unknown[]) => ["part", args.length] as [unknown, number],
      removePart: (id: number) => added.push(`remove:${id}`)
    };
    const service = new WorldDynamicObjectService();
    const api = service.configure({
      THREE: {
        Mesh: class {
          castShadow = false;
          receiveShadow = false;
          constructor(public geometry: unknown, public material: unknown) {}
        },
        BufferGeometry: class {
          attrs: Record<string, unknown> = {};
          setAttribute(name: string, value: unknown) {
            this.attrs[name] = value;
          }
        },
        Float32BufferAttribute: class {
          constructor(public array: ArrayLike<number>, public itemSize: number) {}
        }
      },
      scene: { add: (object: unknown) => added.push(object) },
      objects: [],
      parts: parts as never,
      shadowsActive: () => true
    });

    expect(api.spawnPart({ size: [1, 2, 3], position: [4, 5, 6], type: "Test" })).toEqual(["part", 16]);
    api.removeObject(7);
    expect(added).toContain("remove:7");

    const mesh = api.spawnMesh("geo", "mat");
    expect(api.objects).toContain(mesh);
    expect(added).toContain(mesh);
    expect(mesh).toMatchObject({ castShadow: true, receiveShadow: true });

    expect(api.createGeometry({ position: { array: [0, 1, 2], itemSize: 3 } })).toMatchObject({
      attrs: {
        position: { array: [0, 1, 2], itemSize: 3 }
      }
    });
  });
});
