export type PhysicsBackend = "static" | "rapier";

export type PhysicsWorldOptions = {
  backend: PhysicsBackend;
};

export type ColliderHandle = string;

export type StaticBoxCollider = {
  id?: string;
  center: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
  rotationQuaternion?: [number, number, number, number];
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
  syncStaticColliders?(colliders: unknown[]): void;
  castRay(origin: [number, number, number], direction: [number, number, number], maxDistance: number): RayHit | null;
  raycast(origin: [number, number, number], direction: [number, number, number], maxDistance: number): RayHit | null;
  debugRender?(): PhysicsDebugRender | null;
  snapshot(): PhysicsWorldSnapshot;
  dispose(): void;
};

export type PhysicsDebugRender = {
  vertices: Float32Array;
  colors: Float32Array;
};

export type PhysicsWorldSnapshot = {
  backend: PhysicsBackend;
  status: "static" | "loading" | "ready" | "error" | "disposed";
  colliders: number;
  pendingColliders: number;
  lastSyncSource: string;
  version?: string;
  error?: string;
};
