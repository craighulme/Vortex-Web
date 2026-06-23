import type { DiagnosticsService } from "../diagnostics/DiagnosticsService";
import type { PhysicsBackend, PhysicsWorld, StaticBoxCollider } from "./types";

type CreatePhysicsWorldOptions = {
  backend: PhysicsBackend;
  diagnostics: DiagnosticsService;
};

export function createPhysicsWorld(options: CreatePhysicsWorldOptions): PhysicsWorld {
  if (options.backend === "rapier") {
    options.diagnostics.warn("physics.rapier.pending", {
      message: "Rapier is reserved behind the adapter; legacy physics remains authoritative in this migration phase."
    });
  }
  return new LegacyPhysicsWorld();
}

class LegacyPhysicsWorld implements PhysicsWorld {
  readonly backend = "legacy";
  private readonly colliders = new Map<string, StaticBoxCollider>();

  step(): void {}

  addStaticBox(collider: StaticBoxCollider): string {
    const handle = collider.id ?? crypto.randomUUID();
    this.colliders.set(handle, collider);
    return handle;
  }

  removeCollider(handle: string): void {
    this.colliders.delete(handle);
  }

  castRay(): null {
    return null;
  }

  dispose(): void {
    this.colliders.clear();
  }
}
