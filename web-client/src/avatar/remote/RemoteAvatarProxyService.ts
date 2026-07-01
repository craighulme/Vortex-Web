import type { NativeAvatarState } from "../AvatarService";
import type { RemotePlayerRuntimeApi, RuntimeMaterial, RuntimeObject3D, ThreeLike } from "./RemotePlayerTypes";

type RemoteProxyResources = {
  key: string;
  unitBox: unknown;
  materials: Record<string, RuntimeMaterial>;
};

export class RemoteAvatarProxyService {
  private resources: RemoteProxyResources | null = null;

  constructor(
    private readonly THREE: ThreeLike,
    private readonly runtimeApi: RemotePlayerRuntimeApi
  ) {}

  create(avatar: NativeAvatarState): RuntimeObject3D | null {
    const { THREE } = this;
    if (!THREE.Group || !THREE.Mesh || !THREE.BoxGeometry || !THREE.MeshStandardMaterial) return null;
    const resources = this.getResources(avatar);
    const group = new THREE.Group();
    group.name = "RemoteAvatarProxy";
    group.userData = { ...(group.userData || {}), vwebRuntimeKind: "remote-avatar-proxy" };
    const parts = [
      { key: "torso", x: 0, y: 1.9, z: 0, sx: 1.55, sy: 1.9, sz: 0.75 },
      { key: "head", x: 0, y: 3.25, z: 0, sx: 1.1, sy: 1.1, sz: 1.1 },
      { key: "arm", x: -1.15, y: 1.95, z: 0, sx: 0.55, sy: 1.75, sz: 0.55 },
      { key: "arm", x: 1.15, y: 1.95, z: 0, sx: 0.55, sy: 1.75, sz: 0.55 },
      { key: "leg", x: -0.42, y: 0.45, z: 0, sx: 0.62, sy: 1.45, sz: 0.62 },
      { key: "leg", x: 0.42, y: 0.45, z: 0, sx: 0.62, sy: 1.45, sz: 0.62 }
    ];
    for (const part of parts) {
      const mesh = new THREE.Mesh(resources.unitBox, resources.materials[part.key] || resources.materials.torso);
      mesh.position.set?.(part.x, part.y, part.z);
      mesh.scale?.set?.(part.sx, part.sy, part.sz);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData = { ...(mesh.userData || {}), vwebRuntimeKind: "remote-avatar-proxy" };
      group.add?.(mesh);
    }
    group.visible = false;
    this.runtimeApi.scene.add(group);
    return group;
  }

  private getResources(avatar: NativeAvatarState): RemoteProxyResources {
    if (this.resources) return this.resources;
    const BoxGeometry = this.THREE.BoxGeometry;
    const MeshStandardMaterial = this.THREE.MeshStandardMaterial;
    if (!BoxGeometry || !MeshStandardMaterial) throw new Error("remote proxy resources require Three mesh constructors");
    const unitBox = new BoxGeometry(1, 1, 1);
    const material = (color: string) => new MeshStandardMaterial({ color, roughness: 0.82, metalness: 0 });
    const colors = Array.isArray(avatar.body_colors) ? avatar.body_colors : [];
    this.resources = {
      key: "default",
      unitBox,
      materials: {
        torso: material(String(colors[1] || "#4f46e5")),
        head: material(String(colors[0] || "#d8d8d8")),
        arm: material(String(colors[2] || "#d8d8d8")),
        leg: material(String(colors[4] || "#1f2a7a"))
      }
    };
    return this.resources;
  }
}
