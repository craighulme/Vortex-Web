import type { WorldPartService } from "./WorldPartService";

export type DynamicGeometryAttributes = Record<string, { array: ArrayLike<number>; itemSize: number }>;

export type WorldDynamicObjectConfig = {
  THREE: Record<string, unknown>;
  scene: unknown;
  objects: unknown[];
  parts: WorldPartService;
  bufferGeometryUtils?: unknown;
  shadowsActive(): boolean;
};

export type SpawnPartOptions = {
  size: [number, number, number];
  position: [number, number, number];
  color?: number;
  rotation?: [number, number, number];
  shape?: string;
  transparency?: number;
  staticMesh?: boolean;
  canCollide?: boolean;
  rotationOrder?: string;
  type?: string;
};

export type WorldDynamicAdapter = {
  spawnPart(options: SpawnPartOptions): [unknown, number];
  removeObject(id: number): void;
  spawnMesh(geometry: unknown, material: unknown, options?: { addToScene?: boolean; trackObject?: boolean }): unknown;
  createBatchMesh(geometry: unknown, material: unknown): unknown;
  createRuntimeMesh(geometry: unknown, material: unknown): unknown;
  createGeometry(attributes: DynamicGeometryAttributes): unknown;
  scene: unknown;
  objects: unknown[];
  bufferGeometryUtils?: unknown;
  shadowsActive(): boolean;
};

export class WorldDynamicObjectService {
  private config: WorldDynamicObjectConfig | null = null;

  configure(config: WorldDynamicObjectConfig): WorldDynamicAdapter {
    this.config = config;
    return {
      spawnPart: (options) => this.spawnPart(options),
      removeObject: (id) => this.removeObject(id),
      spawnMesh: (geometry, material, options) => this.spawnMesh(geometry, material, options),
      createBatchMesh: (geometry, material) => this.createMesh(geometry, material),
      createRuntimeMesh: (geometry, material) => this.createMesh(geometry, material),
      createGeometry: (attributes) => this.createGeometry(attributes),
      scene: config.scene,
      objects: config.objects,
      bufferGeometryUtils: config.bufferGeometryUtils,
      shadowsActive: () => config.shadowsActive()
    };
  }

  spawnPart(options: SpawnPartOptions): [unknown, number] {
    const config = this.assertConfigured();
    return config.parts.addPart(
      options.size[0],
      options.size[1],
      options.size[2],
      options.color ?? 0x808080,
      options.position[0],
      options.position[1],
      options.position[2],
      options.rotation?.[0] ?? 0,
      options.rotation?.[1] ?? 0,
      options.rotation?.[2] ?? 0,
      options.shape ?? "Block",
      options.transparency ?? 0,
      options.staticMesh ?? false,
      options.canCollide ?? true,
      options.rotationOrder ?? "YXZ",
      options.type
    );
  }

  removeObject(id: number): void {
    this.assertConfigured().parts.removePart(id);
  }

  spawnMesh(geometry: unknown, material: unknown, options: { addToScene?: boolean; trackObject?: boolean } = {}): unknown {
    const config = this.assertConfigured();
    const mesh = this.createMesh(geometry, material) as { castShadow?: boolean; receiveShadow?: boolean };
    mesh.castShadow = config.shadowsActive();
    mesh.receiveShadow = config.shadowsActive();
    if (options.addToScene !== false) readSceneAdd(config.scene)?.call(config.scene, mesh);
    if (options.trackObject !== false) config.objects.push(mesh);
    return mesh;
  }

  createGeometry(attributes: DynamicGeometryAttributes): unknown {
    const config = this.assertConfigured();
    const Geometry = config.THREE.BufferGeometry as new () => { setAttribute(name: string, attribute: unknown): void };
    const Attribute = config.THREE.Float32BufferAttribute as new (array: ArrayLike<number>, itemSize: number) => unknown;
    const geometry = new Geometry();
    for (const [name, attribute] of Object.entries(attributes || {})) {
      geometry.setAttribute(name, new Attribute(attribute.array, attribute.itemSize));
    }
    return geometry;
  }

  private createMesh(geometry: unknown, material: unknown): unknown {
    const Mesh = this.assertConfigured().THREE.Mesh as new (geometry: unknown, material: unknown) => unknown;
    return new Mesh(geometry, material);
  }

  private assertConfigured(): WorldDynamicObjectConfig {
    if (!this.config) throw new Error("WorldDynamicObjectService is not configured");
    return this.config;
  }
}

function readSceneAdd(scene: unknown): ((object: unknown) => void) | null {
  if (!scene || typeof scene !== "object") return null;
  const add = (scene as { add?: unknown }).add;
  return typeof add === "function" ? add as (object: unknown) => void : null;
}
