export type PhysicsBackend = "legacy" | "rapier";

export type PhysicsWorldOptions = {
  backend: PhysicsBackend;
};

export type ColliderHandle = string;

export type StaticBoxCollider = {
  id?: string;
  center: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
};

export type RayHit = {
  collider: ColliderHandle;
  point: [number, number, number];
  normal: [number, number, number];
  distance: number;
};

export type PhysicsWorld = {
  backend: PhysicsBackend;
  step(dt: number): void;
  addStaticBox(collider: StaticBoxCollider): ColliderHandle;
  removeCollider(handle: ColliderHandle): void;
  castRay(origin: [number, number, number], direction: [number, number, number], maxDistance: number): RayHit | null;
  dispose(): void;
};
