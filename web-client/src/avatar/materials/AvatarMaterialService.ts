import { DEFAULT_BODY_COLORS } from "../AvatarService";
import { setLocalFirstPersonHidden } from "./AvatarFirstPersonVisibility";
import {
  applyAvatarTextureToOverlay,
  avatarTextureDiagnosticsSnapshot,
  clearAvatarTextureDiagnostics,
  configureAvatarTexturePipeline,
  loadModernAvatarTexture
} from "./AvatarTexturePipeline";
import {
  buildFaceOverlay,
  buildPantsOverlay,
  buildShirtOverlay,
  configureAvatarOverlayGeometry
} from "./AvatarOverlayGeometry";

type RuntimeMaterial = Record<string, any>;
type RuntimeMesh = Record<string, any>;
type AvatarMaterialBuckets = {
  shirtMaterials: RuntimeMaterial[];
  pantMaterials: RuntimeMaterial[];
  headMaterials: RuntimeMaterial[];
  bodySlotMaterials: RuntimeMaterial[][];
  tickets: { shirt: number; pants: number; face: number };
};

let THREE: any = null;
let webGpuRuntime = false;


function _bodyPartIndexForMaterial(material: RuntimeMaterial | null | undefined, fallbackIndex = 0) {
  const materialName = String(material?.name || "");
  if (/Material\.002/i.test(materialName)) return 0;
  if (/Material\.001|Material\.003/i.test(materialName)) return 1;
  if (/Material\.004/i.test(materialName)) return 2;
  if (/Material\.005/i.test(materialName)) return 3;
  if (/Material\.007/i.test(materialName)) return 4;
  if (/Material\.008/i.test(materialName)) return 5;

  return [0, 2, 4, 3, 5, 1][fallbackIndex] ?? 0;
}

function _isWebGpuRuntime() {
  return webGpuRuntime;
}

function _makeWebGpuSafeAvatarMaterial(source: RuntimeMaterial | null | undefined) {
  const color = source?.color?.clone?.() || new THREE.Color(0xffffff);
  const material = new THREE.MeshStandardMaterial({
    name: source?.name || "",
    color,
    roughness: 0.68,
    metalness: 0,
    transparent: false,
    opacity: 1,
    fog: true
  });
  material.userData.vwebWebGpuSafe = true;
  return material;
}

function _replaceAvatarMaterial(node: RuntimeMesh, index: number, material: RuntimeMaterial) {
  if (Array.isArray(node.material)) {
    node.material[index] = material;
  } else {
    node.material = material;
  }
}

function _setBodyMaterialColor(material: RuntimeMaterial | null | undefined, color: string) {
  if (!material) return;

  if (!material.userData?.vwebKeepVertexColors) {
    material.vertexColors = false;
  }
  material.color?.set(color);
  material.needsUpdate = true;
}

const _MODERN_SHIRT_MATS = new Set(["Material.001", "Material.003", "Material.004", "Material.005"]);
const _MODERN_PANT_MATS = new Set(["Material.007", "Material.008"]);
const _MODERN_HEAD_MAT = "Material.002";

function _cloneMaterialForAvatar(mesh: RuntimeMesh) {
  if (!mesh?.material || mesh.userData.vwebCatalogMaterialsCloned) return;

  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map((material: RuntimeMaterial) => material?.clone ? material.clone() : material);
    mesh.userData.vwebClonedBodyMaterials = true;
  } else if (mesh.material.clone) {
    mesh.material = mesh.material.clone();
    mesh.userData.vwebClonedBodyMaterial = true;
  }
  mesh.userData.vwebCatalogMaterialsCloned = true;
}

function _prepareModernAvatarMaterials(characterModel: RuntimeMesh | null | undefined): AvatarMaterialBuckets | null {
  if (!characterModel) return null;
  if (characterModel.userData.vwebModernAvatarMaterials) {
    return characterModel.userData.vwebModernAvatarMaterials;
  }

  const webGpuRuntime = _isWebGpuRuntime();
  const materials: AvatarMaterialBuckets = {
    shirtMaterials: [],
    pantMaterials: [],
    headMaterials: [],
    bodySlotMaterials: [[], [], [], [], [], []],
    tickets: { shirt: 0, pants: 0, face: 0 }
  };
  const seen = new Set<string>();

  characterModel.traverse((node: RuntimeMesh) => {
    if (!node.isMesh || /Overlay$/.test(node.name || "")) return;
    _cloneMaterialForAvatar(node);

    const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
    for (let i = 0; i < nodeMaterials.length; i += 1) {
      let material = nodeMaterials[i];
      if (!material || seen.has(material.uuid)) continue;

      if (webGpuRuntime && !material.userData?.vwebWebGpuSafe) {
        material = _makeWebGpuSafeAvatarMaterial(material);
        _replaceAvatarMaterial(node, i, material);
        nodeMaterials[i] = material;
      }

      seen.add(material.uuid);

      const materialName = String(material.name || "");
      const slot = _bodyPartIndexForMaterial(material, -1);
      if (slot >= 0 && slot < 6 && /Material\.00[1234578]/i.test(materialName)) {
        materials.bodySlotMaterials[slot]?.push(material);
      }

      if (_MODERN_SHIRT_MATS.has(materialName)) {
        material.vertexColors = false;
        material.transparent = false;
        materials.shirtMaterials.push(material);
      } else if (_MODERN_PANT_MATS.has(materialName)) {
        material.vertexColors = false;
        material.transparent = false;
        materials.pantMaterials.push(material);
      } else if (materialName === _MODERN_HEAD_MAT) {
        material.vertexColors = false;
        material.transparent = false;
        materials.headMaterials.push(material);
      } else {
        material.vertexColors = false;
        material.map = null;
      }

      material.needsUpdate = true;
    }
  });

  characterModel.userData.vwebModernAvatarMaterials = materials;
  return materials;
}

function _applyModernAvatarTextures(characterModel: RuntimeMesh, urls: Record<string, any> = {}) {
  if (_isWebGpuRuntime()) return;
  const materials = _prepareModernAvatarMaterials(characterModel);
  loadModernAvatarTexture(materials, urls.shirtUrl, "shirt");
  loadModernAvatarTexture(materials, urls.pantsUrl, "pants");
  loadModernAvatarTexture(materials, urls.faceUrl, "face");
}

function _applyBodyColors(characterModel: RuntimeMesh, bodyColors: unknown) {
  const colors = Array.isArray(bodyColors) ? bodyColors : [];
  const normalized: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const fallback = DEFAULT_BODY_COLORS[i] || "#ffffff";
    const value = String(colors[i] || fallback).trim();
    normalized.push(/^#?[0-9a-f]{6}$/i.test(value) ? (value.startsWith("#") ? value : `#${value}`) : fallback);
  }

  const modernMaterials = characterModel.userData?.vwebModernAvatarMaterials;
  if (modernMaterials) {
    for (let slot = 0; slot < 6; slot += 1) {
      for (const material of modernMaterials.bodySlotMaterials[slot] || []) {
        _setBodyMaterialColor(material, normalized[slot] || DEFAULT_BODY_COLORS[slot] || "#ffffff");
      }
    }
    return;
  }

  characterModel.traverse((mesh: RuntimeMesh) => {
    if (!mesh.isMesh || /Overlay$/.test(mesh.name || "")) return;

    if (Array.isArray(mesh.material) && mesh.material.length >= 6) {
      if (!mesh.userData.vwebClonedBodyMaterials) {
        mesh.material = mesh.material.map((m: RuntimeMaterial) => m.clone());
        mesh.userData.vwebClonedBodyMaterials = true;
      }

      for (let i = 0; i < Math.min(6, mesh.material.length); i += 1) {
        const color = normalized[_bodyPartIndexForMaterial(mesh.material[i], i)] || DEFAULT_BODY_COLORS[i] || "#ffffff";
        _setBodyMaterialColor(mesh.material[i], color);
      }
      return;
    }

    if (mesh.material?.color && !mesh.userData.vwebKeepMaterialColor) {
      if (!mesh.userData.vwebClonedBodyMaterial) {
        mesh.material = mesh.material.clone();
        mesh.userData.vwebClonedBodyMaterial = true;
      }

      const materialName = String(mesh.material.name || "");
      const meshName = String(mesh.name || "");
      const partIndex =
        /Head|Material\.002/i.test(`${meshName} ${materialName}`) ? 0 :
        /Torso|Material\.001|Material\.003/i.test(`${meshName} ${materialName}`) ? 1 :
        /LArm|Left.?Arm|Material\.004/i.test(`${meshName} ${materialName}`) ? 2 :
        /RArm|Right.?Arm|Material\.005/i.test(`${meshName} ${materialName}`) ? 3 :
        /LLeg|Left.?Leg|Material\.007/i.test(`${meshName} ${materialName}`) ? 4 :
        /RLeg|Right.?Leg|Material\.008/i.test(`${meshName} ${materialName}`) ? 5 :
        0;

      _setBodyMaterialColor(mesh.material, normalized[partIndex] || DEFAULT_BODY_COLORS[partIndex] || "#ffffff");
    }
  });
}

export class AvatarMaterialService {
  configure(config: Record<string, any> = {}) {
    THREE = config.THREE || THREE;
    webGpuRuntime = config.isWebGpuRuntime === true;
    configureAvatarTexturePipeline(config);
    configureAvatarOverlayGeometry(config);
    return this;
  }

  applyShirtToMesh(mesh: any, textureUrl: string | null | undefined, context: Record<string, unknown> = {}) {
    return applyAvatarTextureToOverlay(mesh, textureUrl, context);
  }

  prepareModernAvatarMaterials(characterModel: any) {
    return _prepareModernAvatarMaterials(characterModel);
  }

  applyModernAvatarTextures(characterModel: any, urls: Record<string, any> = {}) {
    return _applyModernAvatarTextures(characterModel, urls);
  }

  applyBodyColors(characterModel: any, bodyColors: unknown) {
    return _applyBodyColors(characterModel, bodyColors);
  }

  alignVisualToRootFoot(visual: any, footOffset: unknown) {
    if (!visual || !THREE?.Box3) return 0;
    visual.updateMatrixWorld?.(true);
    const box = new THREE.Box3().setFromObject(visual);
    const visualFootY = Number.isFinite(box.min?.y) ? box.min.y : 0;
    const delta = -Number(footOffset || 0) - visualFootY;
    visual.position.y += delta;
    return delta;
  }

  buildShirtOverlay(characterModel: any) {
    return buildShirtOverlay(characterModel);
  }

  buildPantsOverlay(characterModel: any) {
    return buildPantsOverlay(characterModel);
  }

  buildFaceOverlay(characterModel: any) {
    return buildFaceOverlay(characterModel);
  }

  setLocalFirstPersonHidden(characterModel: any, hidden: boolean, options: Record<string, unknown> = {}) {
    return setLocalFirstPersonHidden(characterModel, hidden, options, _prepareModernAvatarMaterials);
  }

  snapshot() {
    return {
      diagnostics: avatarTextureDiagnosticsSnapshot(40)
    };
  }

  clearDiagnostics() {
    clearAvatarTextureDiagnostics();
  }
}
