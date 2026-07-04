import { Pane } from "tweakpane";
import type { UgcParticleFacing, UgcParticleMotion, UgcTransform } from "./UgcTypes";
import type { UgcParticleEmitterState } from "./UgcStudioViewer";

export type UgcInspectorPaneSnapshot = {
  transform: UgcTransform;
  particles: UgcParticleEmitterState[];
  activeParticleId: string;
};

export type UgcInspectorPaneOptions = {
  transformContainer: HTMLElement;
  particleContainer: HTMLElement;
  getSnapshot: () => UgcInspectorPaneSnapshot;
  onTransformChange: (transform: UgcTransform) => void;
  onParticleChange: (particle: Partial<UgcParticleEmitterState>) => void;
  onEmitterSelect: (id: string) => void;
  onEmitterAdd: () => void;
  onEmitterRemove: () => void;
};

type PaneApi = Pane & {
  refresh?: () => void;
};

type BindingApi = {
  on?: (eventName: "change", handler: () => void) => BindingApi;
  refresh?: () => void;
};

const MOTION_OPTIONS: Record<string, UgcParticleMotion> = {
  "Aura pulse": "aura",
  "Fountain rise": "fountain",
  "Orbit ring": "orbit",
  "Trailing stream": "trail",
  "Burst loop": "burst",
  "Soft drift": "drift",
  "Radiant beam": "beam",
  "Helix stream": "helix",
  "Shockwave ring": "shockwave"
};

const FACING_OPTIONS: Record<string, UgcParticleFacing> = {
  "Billboard - faces camera": "billboard",
  "Front plane - world static": "front",
  "Ground plane - floor/ring": "ground"
};

export class UgcInspectorPane {
  private transformPane: PaneApi | null = null;
  private particlePane: PaneApi | null = null;
  private transformParams = createTransformParams();
  private particleParams = createParticleParams();
  private syncing = false;

  constructor(private readonly options: UgcInspectorPaneOptions) {
    this.rebuild();
  }

  dispose(): void {
    this.transformPane?.dispose();
    this.particlePane?.dispose();
    this.transformPane = null;
    this.particlePane = null;
  }

  refresh(): void {
    this.syncing = true;
    const snapshot = this.options.getSnapshot();
    writeTransformParams(this.transformParams, snapshot.transform);
    writeParticleParams(this.particleParams, snapshot);
    this.transformPane?.refresh?.();
    this.particlePane?.refresh?.();
    for (const binding of this.particleBindings) binding.refresh?.();
    for (const binding of this.transformBindings) binding.refresh?.();
    this.syncing = false;
  }

  rebuild(): void {
    this.dispose();
    this.options.transformContainer.replaceChildren();
    this.options.particleContainer.replaceChildren();
    this.transformPane = new Pane({ container: this.options.transformContainer, title: "Transform" }) as PaneApi;
    this.particlePane = new Pane({ container: this.options.particleContainer, title: "Particles" }) as PaneApi;
    this.buildTransformPane(this.transformPane);
    this.buildParticlePane(this.particlePane);
    this.refresh();
  }

  private transformBindings: BindingApi[] = [];
  private particleBindings: BindingApi[] = [];

  private buildTransformPane(pane: PaneApi): void {
    this.transformBindings = [];
    const position = pane.addFolder({ title: "Position", expanded: true });
    this.bindNumber(position, this.transformParams, "posX", "X", -20, 20, 0.01, "transform");
    this.bindNumber(position, this.transformParams, "posY", "Y", -20, 20, 0.01, "transform");
    this.bindNumber(position, this.transformParams, "posZ", "Z", -20, 20, 0.01, "transform");

    const rotation = pane.addFolder({ title: "Rotation", expanded: false });
    this.bindNumber(rotation, this.transformParams, "rotX", "X", -180, 180, 0.5, "transform");
    this.bindNumber(rotation, this.transformParams, "rotY", "Y", -180, 180, 0.5, "transform");
    this.bindNumber(rotation, this.transformParams, "rotZ", "Z", -180, 180, 0.5, "transform");

    const scale = pane.addFolder({ title: "Scale", expanded: false });
    this.bindNumber(scale, this.transformParams, "scaleX", "X", 0.01, 10, 0.01, "transform");
    this.bindNumber(scale, this.transformParams, "scaleY", "Y", 0.01, 10, 0.01, "transform");
    this.bindNumber(scale, this.transformParams, "scaleZ", "Z", 0.01, 10, 0.01, "transform");
  }

  private buildParticlePane(pane: PaneApi): void {
    this.particleBindings = [];
    const emitterOptions = Object.fromEntries(
      this.options.getSnapshot().particles.map((emitter, index) => [emitter.name || `Emitter ${index + 1}`, emitter.id])
    );
    this.bindList(pane, this.particleParams, "emitter", "Emitter", emitterOptions, () => {
      this.options.onEmitterSelect(this.particleParams.emitter);
      this.refresh();
    });
    pane.addButton({ title: "Add emitter" }).on("click", () => {
      this.options.onEmitterAdd();
    });
    pane.addButton({ title: "Remove emitter" }).on("click", () => {
      this.options.onEmitterRemove();
    });
    pane.addBinding(this.particleParams, "enabled", { label: "Enabled" }).on("change", () => this.emitParticleChange());
    this.bindList(pane, this.particleParams, "motion", "Motion", MOTION_OPTIONS, () => this.emitParticleChange());
    this.bindList(pane, this.particleParams, "facing", "Facing", FACING_OPTIONS, () => this.emitParticleChange());
    pane.addBinding(this.particleParams, "color", { label: "Colour" }).on("change", () => this.emitParticleChange());

    const emission = pane.addFolder({ title: "Emission", expanded: true });
    this.bindNumber(emission, this.particleParams, "rate", "Rate", 0, 120, 1, "particle");
    this.bindNumber(emission, this.particleParams, "count", "Count", 1, 180, 1, "particle");
    this.bindNumber(emission, this.particleParams, "lifetime", "Lifetime", 0.2, 10, 0.05, "particle");
    this.bindNumber(emission, this.particleParams, "opacity", "Opacity", 0.05, 1, 0.01, "particle");

    const shape = pane.addFolder({ title: "Shape", expanded: true });
    this.bindNumber(shape, this.particleParams, "size", "Size", 0.01, 1, 0.01, "particle");
    this.bindNumber(shape, this.particleParams, "spread", "Spread", 0, 3, 0.01, "particle");
    this.bindNumber(shape, this.particleParams, "speed", "Speed", 0, 5, 0.01, "particle");
    this.bindNumber(shape, this.particleParams, "rise", "Rise", -3, 3, 0.01, "particle");
    this.bindNumber(shape, this.particleParams, "spin", "Spin", -8, 8, 0.01, "particle");
  }

  private bindNumber(
    target: { addBinding: (...args: any[]) => BindingApi },
    object: Record<string, unknown>,
    key: string,
    label: string,
    min: number,
    max: number,
    step: number,
    kind: "transform" | "particle"
  ): void {
    const binding = target.addBinding(object, key, { label, min, max, step }) as BindingApi;
    binding.on?.("change", () => {
      if (kind === "transform") this.emitTransformChange();
      else this.emitParticleChange();
    });
    if (kind === "transform") this.transformBindings.push(binding);
    else this.particleBindings.push(binding);
  }

  private bindList(
    target: { addBinding: (...args: any[]) => BindingApi },
    object: Record<string, unknown>,
    key: string,
    label: string,
    options: Record<string, string>,
    handler: () => void
  ): void {
    const binding = target.addBinding(object, key, { label, options }) as BindingApi;
    binding.on?.("change", () => {
      if (!this.syncing) handler();
    });
    this.particleBindings.push(binding);
  }

  private emitTransformChange(): void {
    if (this.syncing) return;
    this.options.onTransformChange({
      position: [this.transformParams.posX ?? 0, this.transformParams.posY ?? 0, this.transformParams.posZ ?? 0],
      rotation: [this.transformParams.rotX ?? 0, this.transformParams.rotY ?? 0, this.transformParams.rotZ ?? 0],
      scale: [this.transformParams.scaleX ?? 1, this.transformParams.scaleY ?? 1, this.transformParams.scaleZ ?? 1]
    });
  }

  private emitParticleChange(): void {
    if (this.syncing) return;
    this.options.onParticleChange({
      enabled: this.particleParams.enabled,
      motion: this.particleParams.motion,
      facing: this.particleParams.facing,
      color: this.particleParams.color,
      rate: this.particleParams.rate,
      count: Math.round(this.particleParams.count),
      size: this.particleParams.size,
      spread: this.particleParams.spread,
      speed: this.particleParams.speed,
      verticalSpeed: this.particleParams.rise,
      lifetime: this.particleParams.lifetime,
      opacity: this.particleParams.opacity,
      spin: this.particleParams.spin
    });
  }
}

function createTransformParams(): Record<string, number> {
  return {
    posX: 0,
    posY: 0,
    posZ: 0,
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1
  };
}

function createParticleParams(): Record<string, any> {
  return {
    emitter: "emitter-1",
    enabled: false,
    motion: "aura" as UgcParticleMotion,
    facing: "billboard" as UgcParticleFacing,
    color: "#8bd3ff",
    rate: 18,
    count: 24,
    size: 0.08,
    spread: 0.58,
    speed: 0.28,
    rise: 0.22,
    lifetime: 1.8,
    opacity: 0.86,
    spin: 0.8
  };
}

function writeTransformParams(target: Record<string, number>, transform: UgcTransform): void {
  target.posX = transform.position[0] ?? 0;
  target.posY = transform.position[1] ?? 0;
  target.posZ = transform.position[2] ?? 0;
  target.rotX = transform.rotation[0] ?? 0;
  target.rotY = transform.rotation[1] ?? 0;
  target.rotZ = transform.rotation[2] ?? 0;
  target.scaleX = transform.scale[0] ?? 1;
  target.scaleY = transform.scale[1] ?? 1;
  target.scaleZ = transform.scale[2] ?? 1;
}

function writeParticleParams(target: Record<string, any>, snapshot: UgcInspectorPaneSnapshot): void {
  const active = snapshot.particles.find((emitter) => emitter.id === snapshot.activeParticleId) || snapshot.particles[0];
  if (!active) return;
  target.emitter = active.id;
  target.enabled = active.enabled;
  target.motion = active.motion;
  target.facing = active.facing;
  target.color = active.color;
  target.rate = active.rate;
  target.count = active.count;
  target.size = active.size;
  target.spread = active.spread;
  target.speed = active.speed;
  target.rise = active.verticalSpeed;
  target.lifetime = active.lifetime;
  target.opacity = active.opacity;
  target.spin = active.spin;
}
