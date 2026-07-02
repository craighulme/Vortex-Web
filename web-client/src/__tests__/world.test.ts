import { describe, expect, it } from "vitest";
import { WorldService } from "../world/WorldService";

describe("WorldService", () => {
  it("uses the dynamic object backend when it is available", () => {
    const world = new WorldService();
    const added: unknown[] = [];
    const removed: unknown[] = [];
    world.attachRuntimeAdapter({
      spawnPart: (options: unknown) => {
        added.push(options);
        return [null, added.length];
      },
      removeObject: (id: number) => removed.push(id)
    });

    world.loadMapParts("studs", [
      { P: [10, 2, 20], S: [4, 2, 6], R: [0, 90, 0], C: "ff0000", T: "Truss", Shape: "Block" }
    ], 0, 0, 0, { preserveWorldCoords: true, rotationRadians: false, rotationOrder: "XYZ" });

    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      size: [4, 2, 6],
      position: [10, 1, 20],
      color: 0xff0000,
      shape: "Block",
      rotationOrder: "XYZ",
      type: "Truss"
    });

    expect(world.unloadMap("studs")).toBe(true);
    expect(removed).toEqual([1]);
  });

  it("exposes dynamic part spawning through the world service", () => {
    const world = new WorldService();
    const spawned: unknown[] = [];
    const removed: unknown[] = [];
    world.attachRuntimeAdapter({
      spawnPart: (part: unknown) => {
        spawned.push(part);
        return ["mesh", 1];
      },
      removeObject: (id: unknown) => removed.push(id)
    });

    const entity = world.spawnPart({
      id: "ball",
      position: [1, 4, 3],
      size: [2, 2, 2],
      color: 0xffffff,
      shape: "Sphere"
    });

    expect(entity.id).toBe("ball");
    expect(spawned).toEqual([{
      size: [2, 2, 2],
      position: [1, 3, 3],
      color: 0xffffff,
      rotation: undefined,
      shape: "Sphere",
      transparency: 0,
      staticMesh: false,
      canCollide: true,
      rotationOrder: "YXZ",
      type: undefined
    }]);
    expect(world.removeObject("ball")).toBe(true);
    expect(removed).toEqual([1]);
  });

  it("loads official maps through the runtime service and sets spawn from map bounds", async () => {
    const world = new WorldService();
    const requests: unknown[][] = [];
    const spawns: unknown[][] = [];
    const added: unknown[] = [];
    world.attachRuntimeAdapter({
      spawnPart: (options: unknown) => {
        added.push(options);
        return [null, added.length];
      },
      setSpawn: (...args: unknown[]) => spawns.push(args)
    });

    const loaded = await world.loadOfficialMap(3, async (input, init) => {
      requests.push([input, init]);
      return {
        ok: true,
        status: 200,
        json: async () => [
          { P: [10, 2, 20], S: [4, 2, 6], C: "ff0000" },
          { P: [14, 4, 20], S: [2, 2, 2], C: "00ff00" }
        ]
      };
    });

    expect(requests).toEqual([[
      "/api/maps/3",
      { credentials: "include", cache: "no-store" }
    ]]);
    expect(loaded.name).toBe("Official Vortex 3");
    expect(loaded.partIds).toHaveLength(2);
    expect(added).toHaveLength(2);
    expect(loaded.spawn).toEqual({ x: 11.5, y: 13, z: 20, ry: 0 });
    expect(spawns).toEqual([[11.5, 13, 20, 0]]);
  });

  it("splits static map batches by render chunk before material", () => {
    const world = new WorldService();
    const scene = {
      added: [] as any[],
      add(mesh: unknown) {
        this.added.push(mesh);
      }
    };
    const material = { uuid: "shared-material" };
    const makeGeometry = (): any => ({
      attributes: { position: { count: 3 } },
      clone: () => makeGeometry(),
      applyMatrix4: () => {},
      computeBoundingBox: () => {},
      computeBoundingSphere: () => {},
      dispose: () => {}
    });
    world.attachRuntimeAdapter({
      scene,
      bufferGeometryUtils: {
        mergeGeometries: (geometries: unknown[]) => ({ ...makeGeometry(), mergedCount: geometries.length })
      },
      createRuntimeMesh: (geometry: unknown, batchMaterial: unknown) => ({
        geometry,
        material: batchMaterial,
        userData: {},
        updateMatrix: () => {}
      }),
      spawnPart: (options: any) => {
        const x = Number(options.position?.[0] || 0);
        const z = Number(options.position?.[2] || 0);
        return [{
          userData: { vwebRenderChunk: `${Math.floor(x / 128)},${Math.floor(z / 128)}` },
          material,
          geometry: makeGeometry(),
          matrix: {},
          updateMatrix: () => {}
        }, Math.floor(x)];
      }
    });

    world.loadMapParts("chunked", [
      { P: [0, 2, 0], S: [4, 2, 4], C: "ff0000" },
      { P: [200, 2, 0], S: [4, 2, 4], C: "ff0000" }
    ], 0, 0, 0, { preserveWorldCoords: true });

    expect(scene.added).toHaveLength(2);
    expect(scene.added.map((mesh) => mesh.userData.vwebRenderChunk).sort()).toEqual(["0,0", "1,0"]);
  });
});
