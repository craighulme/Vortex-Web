import { runtimeBoneAliases } from "../rig/RigBoneAliases";

type RuntimeMesh = any;
type UvBox = number[];
type UvTemplate = Record<string, UvBox>;
type Bounds = { xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number };

let THREE: any = null;

export function configureAvatarOverlayGeometry(config: Record<string, any> = {}) {
  THREE = config.THREE || THREE;
}

function _canonicalBoneName(name: unknown) {
  return String(name || "").replace(/\s+/g, "_");
}

function canonicalClothingBone(name: unknown): "Torso" | "Left_Arm" | "Right_Arm" | "Left_Leg" | "Right_Leg" | string {
  const aliases = runtimeBoneAliases(name);
  if (aliases.some((alias) => TORSO_CLOTHING_BONES.has(alias))) return "Torso";
  if (aliases.some((alias) => LEFT_ARM_CLOTHING_BONES.has(alias))) return "Left_Arm";
  if (aliases.some((alias) => RIGHT_ARM_CLOTHING_BONES.has(alias))) return "Right_Arm";
  if (aliases.some((alias) => LEFT_LEG_CLOTHING_BONES.has(alias))) return "Left_Leg";
  if (aliases.some((alias) => RIGHT_LEG_CLOTHING_BONES.has(alias))) return "Right_Leg";
  return _canonicalBoneName(name);
}

function clothingBoneGroups(kind: string): Set<string> {
  return kind === "pants"
    ? new Set(["Left_Leg", "Right_Leg"])
    : new Set(["Torso", "Left_Arm", "Right_Arm"]);
}

const TORSO_CLOTHING_BONES = new Set(["Torso", "Chest", "Spine", "Hips", "UpperTorso", "LowerTorso"]);
const LEFT_ARM_CLOTHING_BONES = new Set(["Left_Arm", "LeftUpperArm", "LeftLowerArm", "LeftHand", "mixamorigLeftArm", "mixamorigLeftForeArm", "mixamorigLeftHand"]);
const RIGHT_ARM_CLOTHING_BONES = new Set(["Right_Arm", "RightUpperArm", "RightLowerArm", "RightHand", "mixamorigRightArm", "mixamorigRightForeArm", "mixamorigRightHand"]);
const LEFT_LEG_CLOTHING_BONES = new Set(["Left_Leg", "LeftUpperLeg", "LeftLowerLeg", "LeftFoot", "mixamorigLeftUpLeg", "mixamorigLeftLeg", "mixamorigLeftFoot"]);
const RIGHT_LEG_CLOTHING_BONES = new Set(["Right_Leg", "RightUpperLeg", "RightLowerLeg", "RightFoot", "mixamorigRightUpLeg", "mixamorigRightLeg", "mixamorigRightFoot"]);

function _uvTemplates(): { torso: UvTemplate; leftLimb: UvTemplate; rightLimb: UvTemplate } {
  const torso = {
    top:    [0.39487179487179486, 0.8711985688729875, 0.6136752136752137, 0.9856887298747764],
    front:  [0.39487179487179486, 0.6386404293381038, 0.6136752136752137, 0.8676207513416816],
    bottom: [0.39487179487179486, 0.5205724508050089, 0.6136752136752137, 0.6350626118067979],
    left:   [0.6170940170940171, 0.6386404293381038, 0.7264957264957265, 0.8676207513416816],
    right:  [0.28205128205128205, 0.6386404293381038, 0.39145299145299145, 0.8676207513416816],
    back:   [0.7299145299145299, 0.6386404293381038, 0.9487179487179487, 0.8676207513416816]
  };

  const leftLimb = {
    top:    [0.37094017094017095, 0.368515205724508, 0.48034188034188036, 0.483005366726297],
    left:   [0.03247863247863248, 0.13595706618962433, 0.14188034188034188, 0.3649373881932021],
    front:  [0.37094017094017095, 0.13595706618962433, 0.48034188034188036, 0.3649373881932021],
    right:  [0.25811965811965815, 0.13595706618962433, 0.36752136752136755, 0.3649373881932021],
    back:   [0.1452991452991453, 0.13595706618962433, 0.2547008547008547, 0.3649373881932021],
    bottom: [0.37094017094017095, 0.017889087656529523, 0.48034188034188036, 0.1323792486583184]
  };

  const rightLimb = {
    top:    [0.5264957264957265, 0.368515205724508, 0.6358974358974359, 0.483005366726297],
    front:  [0.5264957264957265, 0.13595706618962433, 0.6358974358974359, 0.3649373881932021],
    left:   [0.6393162393162393, 0.13595706618962433, 0.7487179487179487, 0.3649373881932021],
    right:  [0.864957264957265, 0.13595706618962433, 0.9743589743589743, 0.3649373881932021],
    back:   [0.7521367521367521, 0.13595706618962433, 0.8615384615384616, 0.3649373881932021],
    bottom: [0.5264957264957265, 0.017889087656529523, 0.6358974358974359, 0.1323792486583184]
  };

  return { torso, leftLimb, rightLimb };
}

function _buildClothingOverlay(characterModel: RuntimeMesh, kind = "shirt") {
  const { torso, leftLimb, rightLimb } = _uvTemplates();
  const wantedBones = clothingBoneGroups(kind);

  const bodyMeshes: RuntimeMesh[] = [];

  characterModel.traverse((child: RuntimeMesh) => {
    if (child.isSkinnedMesh && !/Overlay$/.test(child.name || "")) {
      bodyMeshes.push(child);
    }
  });

  if (!bodyMeshes.length) {
    return null;
  }

  const overlays: RuntimeMesh[] = [];
  for (const bodyMesh of bodyMeshes) {
    const overlay = _buildClothingOverlayForMesh(bodyMesh, kind, wantedBones, torso, leftLimb, rightLimb);
    if (overlay) overlays.push(overlay);
  }

  if (!overlays.length) {
    console.warn(`[avatar] no ${kind} faces found`);
    return null;
  }

  if (overlays.length === 1) {
    bodyMeshes[0]?.parent?.add(overlays[0]);
    return overlays[0];
  }

  const group = new THREE.Group();
  group.name = kind === "pants" ? "PantsOverlay" : "ShirtOverlay";
  group.visible = false;
  for (const overlay of overlays) group.add(overlay);
  characterModel.add(group);
  return group;
}

function _buildClothingOverlayForMesh(
  bodyMesh: RuntimeMesh,
  kind: string,
  wantedBones: Set<string>,
  torso: UvTemplate,
  leftLimb: UvTemplate,
  rightLimb: UvTemplate
) {
  const geometry = bodyMesh.geometry;
  const positions = geometry.attributes.position.array;
  const normals = geometry.attributes.normal.array;
  const sourceUvs = geometry.attributes.uv?.array || geometry.attributes.uv0?.array || null;
  const skinIndices = geometry.attributes.skinIndex.array;
  const skinWeights = geometry.attributes.skinWeight.array;
  const indices = geometry.index ? geometry.index.array : null;
  const boneNames = bodyMesh.skeleton.bones.map((bone: RuntimeMesh) => canonicalClothingBone(bone.name));

  function getDominantBone(vertexIndex: number) {
    let bestWeight = -1;
    let bestBoneName = "";

    for (let i = 0; i < 4; i++) {
      const weight = skinWeights[vertexIndex * 4 + i];
      if (weight > bestWeight) {
        bestWeight = weight;
        bestBoneName = boneNames[skinIndices[vertexIndex * 4 + i]] || "";
      }
    }

    return bestBoneName;
  }

  const triangleCount = indices ? indices.length / 3 : positions.length / 9;

  function chooseTriangleBone(a: number, b: number, c: number) {
    const boneA = getDominantBone(a);
    const boneB = getDominantBone(b);
    const boneC = getDominantBone(c);

    if (wantedBones.has(boneA) && boneA === boneB && boneA === boneC) return boneA;
    if (wantedBones.has(boneA) && boneA === boneB) return boneA;
    if (wantedBones.has(boneB) && boneB === boneC) return boneB;
    if (wantedBones.has(boneA)) return boneA;
    return null;
  }

  const boneBounds: Record<string, Bounds> = {};
  for (const boneName of wantedBones) {
    boneBounds[boneName] = {
      xMin: Infinity,
      xMax: -Infinity,
      yMin: Infinity,
      yMax: -Infinity,
      zMin: Infinity,
      zMax: -Infinity
    };
  }

  for (let tri = 0; tri < triangleCount; tri++) {
    const a = indices ? indices[tri * 3 + 0] : tri * 3 + 0;
    const b = indices ? indices[tri * 3 + 1] : tri * 3 + 1;
    const c = indices ? indices[tri * 3 + 2] : tri * 3 + 2;

    const boneName = chooseTriangleBone(a, b, c);
    if (!boneName) continue;

    for (const vertexIndex of [a, b, c]) {
      const x = positions[vertexIndex * 3 + 0];
      const y = positions[vertexIndex * 3 + 1];
      const z = positions[vertexIndex * 3 + 2];
      const bounds = boneBounds[boneName];
      if (!bounds) continue;

      bounds.xMin = Math.min(bounds.xMin, x);
      bounds.xMax = Math.max(bounds.xMax, x);
      bounds.yMin = Math.min(bounds.yMin, y);
      bounds.yMax = Math.max(bounds.yMax, y);
      bounds.zMin = Math.min(bounds.zMin, z);
      bounds.zMax = Math.max(bounds.zMax, z);
    }
  }

  const outPositions: number[] = [];
  const outNormals: number[] = [];
  const outUvs: number[] = [];
  const outSkinIndices: number[] = [];
  const outSkinWeights: number[] = [];

  for (let tri = 0; tri < triangleCount; tri++) {
    const a = indices ? indices[tri * 3 + 0] : tri * 3 + 0;
    const b = indices ? indices[tri * 3 + 1] : tri * 3 + 1;
    const c = indices ? indices[tri * 3 + 2] : tri * 3 + 2;

    const boneName = chooseTriangleBone(a, b, c);
    if (!boneName) continue;

    const triangleNormals = [a, b, c].map((vertexIndex) => [
      normals[vertexIndex * 3 + 0] ?? 0,
      normals[vertexIndex * 3 + 1] ?? 0,
      normals[vertexIndex * 3 + 2] ?? 0
    ]);

    const n0 = triangleNormals[0] || [0, 0, 0];
    const n1 = triangleNormals[1] || [0, 0, 0];
    const n2 = triangleNormals[2] || [0, 0, 0];
    let nx = ((n0[0] ?? 0) + (n1[0] ?? 0) + (n2[0] ?? 0)) / 3;
    let ny = ((n0[1] ?? 0) + (n1[1] ?? 0) + (n2[1] ?? 0)) / 3;
    let nz = ((n0[2] ?? 0) + (n1[2] ?? 0) + (n2[2] ?? 0)) / 3;

    const length = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= length;
    ny /= length;
    nz /= length;

    const absX = Math.abs(nx);
    const absY = Math.abs(ny);
    const absZ = Math.abs(nz);
    const dominantAxis = Math.max(absX, absY, absZ);
    const signX = dominantAxis === absX ? Math.sign(nx) : 0;
    const signY = dominantAxis === absY ? Math.sign(ny) : 0;
    const signZ = dominantAxis === absZ ? Math.sign(nz) : 0;

    let faceDirection: string;
    if (signZ < 0) faceDirection = "front";
    else if (signZ > 0) faceDirection = "back";
    else if (signX > 0) faceDirection = "+x";
    else if (signX < 0) faceDirection = "-x";
    else if (signY > 0) faceDirection = "top";
    else faceDirection = "bottom";

    const uvBoxes =
      boneName === "Torso"
        ? torso
        : boneName === "Right_Arm" || boneName === "Right_Leg"
          ? leftLimb
          : rightLimb;

    const faceUvBox = {
      front: uvBoxes.front,
      back: uvBoxes.back,
      top: uvBoxes.top,
      bottom: uvBoxes.bottom,
      "+x": uvBoxes.right,
      "-x": uvBoxes.left
    }[faceDirection];

    const bounds = boneBounds[boneName];
    if (!bounds) continue;

    for (const vertexIndex of [a, b, c]) {
      const x = positions[vertexIndex * 3 + 0];
      const y = positions[vertexIndex * 3 + 1];
      const z = positions[vertexIndex * 3 + 2];

      outPositions.push(x, y, z);
      outNormals.push(
        normals[vertexIndex * 3 + 0],
        normals[vertexIndex * 3 + 1],
        normals[vertexIndex * 3 + 2]
      );

      if (sourceUvs) {
        outUvs.push(sourceUvs[vertexIndex * 2 + 0], sourceUvs[vertexIndex * 2 + 1]);
      } else {
        const u = bounds.xMax > bounds.xMin ? (x - bounds.xMin) / (bounds.xMax - bounds.xMin) : 0.5;
        const v = bounds.yMax > bounds.yMin ? (y - bounds.yMin) / (bounds.yMax - bounds.yMin) : 0.5;
        const w = bounds.zMax > bounds.zMin ? (z - bounds.zMin) / (bounds.zMax - bounds.zMin) : 0.5;

        let uvX;
        let uvY;

        switch (faceDirection) {
          case "front":
            uvX = u;
            uvY = v;
            break;
          case "back":
            uvX = 1 - u;
            uvY = v;
            break;
          case "+x":
            uvX = 1 - w;
            uvY = v;
            break;
          case "-x":
            uvX = w;
            uvY = v;
            break;
          case "top":
            uvX = u;
            uvY = 1 - w;
            break;
          case "bottom":
            uvX = u;
            uvY = w;
            break;
          default:
            uvX = u;
            uvY = v;
            break;
        }

        uvX = Math.min(1, Math.max(0, uvX));
        uvY = Math.min(1, Math.max(0, uvY));

        const [u0 = 0, v0 = 0, u1 = 1, v1 = 1] = faceUvBox || [0, 0, 1, 1];
        outUvs.push(u0 + uvX * (u1 - u0), v0 + uvY * (v1 - v0));
      }

      for (let i = 0; i < 4; i++) {
        outSkinIndices.push(skinIndices[vertexIndex * 4 + i]);
        outSkinWeights.push(skinWeights[vertexIndex * 4 + i]);
      }
    }
  }

  if (!outPositions.length) {
    return null;
  }

  const overlayGeometry = new THREE.BufferGeometry();
  overlayGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(outPositions), 3));
  overlayGeometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(outNormals), 3));
  overlayGeometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(outUvs), 2));
  overlayGeometry.setAttribute("skinIndex", new THREE.BufferAttribute(new Uint16Array(outSkinIndices), 4));
  overlayGeometry.setAttribute("skinWeight", new THREE.BufferAttribute(new Float32Array(outSkinWeights), 4));

  const overlayMesh = new THREE.SkinnedMesh(
    overlayGeometry,
    new THREE.MeshStandardMaterial({
      transparent: true,
      depthWrite: false,
      alphaTest: 0.01,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
      roughness: 0.7,
      metalness: 0
    })
  );

  overlayMesh.name = kind === "pants" ? "PantsOverlay" : "ShirtOverlay";
  overlayMesh.visible = false;
  overlayMesh.renderOrder = 1;
  if (sourceUvs) overlayMesh.userData.vwebTextureFlipY = false;
  overlayMesh.bind(bodyMesh.skeleton, bodyMesh.bindMatrix);
  return overlayMesh;
}

function _buildShirtOverlay(characterModel: RuntimeMesh) {
  return _buildClothingOverlay(characterModel, "shirt");
}

function _buildPantsOverlay(characterModel: RuntimeMesh) {
  return _buildClothingOverlay(characterModel, "pants");
}

function _buildFaceOverlay(characterModel: RuntimeMesh) {
  let bodyMesh: RuntimeMesh | null = null;
  let headBoneIndex = -1;

  characterModel.traverse((child: RuntimeMesh) => {
    if (!bodyMesh && child.isSkinnedMesh && !/Overlay$/.test(child.name || "")) {
      const bones = child.skeleton?.bones || [];
      const index = bones.findIndex((bone: RuntimeMesh) => runtimeBoneAliases(bone.name).some((alias) => alias === "Head"));
      if (index >= 0) {
        bodyMesh = child;
        headBoneIndex = index;
      }
    }
  });

  if (!bodyMesh || headBoneIndex < 0) return null;

  const position = bodyMesh.geometry.attributes.position;
  const skinIndex = bodyMesh.geometry.attributes.skinIndex;
  const skinWeight = bodyMesh.geometry.attributes.skinWeight;
  const skinIndexArray = skinIndex.array;
  const skinWeightArray = skinWeight.array;
  const headBounds = {
    xMin: Infinity,
    xMax: -Infinity,
    yMin: Infinity,
    yMax: -Infinity,
    zMin: Infinity,
    zMax: -Infinity
  };

  for (let i = 0; i < position.count; i += 1) {
    let headInfluence = 0;
    for (let j = 0; j < 4; j += 1) {
      const offset = i * 4 + j;
      if (skinIndexArray[offset] === headBoneIndex) {
        headInfluence += skinWeightArray[offset];
      }
    }
    if (headInfluence < 0.5) continue;
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    headBounds.xMin = Math.min(headBounds.xMin, x);
    headBounds.xMax = Math.max(headBounds.xMax, x);
    headBounds.yMin = Math.min(headBounds.yMin, y);
    headBounds.yMax = Math.max(headBounds.yMax, y);
    headBounds.zMin = Math.min(headBounds.zMin, z);
    headBounds.zMax = Math.max(headBounds.zMax, z);
  }

  if (!Number.isFinite(headBounds.xMin)) return null;

  const headWidth = headBounds.xMax - headBounds.xMin;
  const headHeight = headBounds.yMax - headBounds.yMin;
  const cx = (headBounds.xMin + headBounds.xMax) * 0.5;
  const cy = headBounds.yMin + headHeight * 0.54;
  const faceSize = Math.min(headWidth * 0.96, headHeight * 0.82);
  const halfFaceWidth = faceSize * 0.5;
  const halfFaceHeight = faceSize * 0.5;
  const x0 = cx - halfFaceWidth;
  const x1 = cx + halfFaceWidth;
  const y0 = cy - halfFaceHeight;
  const y1 = cy + halfFaceHeight;

  const surfaceFace = _buildFaceSurfaceOverlay(bodyMesh, headBoneIndex, { x0, x1, y0, y1 });
  if (surfaceFace) {
    bodyMesh.parent.add(surfaceFace);
    return surfaceFace;
  }

  const cardFace = _buildFaceCardOverlay(bodyMesh, headBoneIndex, { x0, x1, y0, y1, z: headBounds.zMin });
  if (cardFace) bodyMesh.parent.add(cardFace);
  return cardFace;
}

function _buildFaceSurfaceOverlay(
  bodyMesh: RuntimeMesh,
  headBoneIndex: number,
  bounds: { x0: number; x1: number; y0: number; y1: number }
) {
  const geometry = bodyMesh.geometry;
  const position = geometry?.attributes?.position;
  const normal = geometry?.attributes?.normal;
  const skinIndex = geometry?.attributes?.skinIndex;
  const skinWeight = geometry?.attributes?.skinWeight;
  if (!position?.array || !normal?.array || !skinIndex?.array || !skinWeight?.array) return null;

  const indices = geometry.index?.array || null;
  const triangleCount = indices ? indices.length / 3 : position.count / 3;
  const frontCandidates = _collectFaceSurfaceTriangles({
    position,
    normal,
    skinIndex,
    skinWeight,
    indices,
    triangleCount,
    headBoneIndex,
    bounds,
    frontSign: -1
  });
  const candidates = frontCandidates.positions.length ? frontCandidates : _collectFaceSurfaceTriangles({
    position,
    normal,
    skinIndex,
    skinWeight,
    indices,
    triangleCount,
    headBoneIndex,
    bounds,
    frontSign: 1
  });

  if (!candidates.positions.length) return null;

  const overlayGeometry = new THREE.BufferGeometry();
  overlayGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(candidates.positions), 3));
  overlayGeometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(candidates.normals), 3));
  overlayGeometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(candidates.uvs), 2));
  overlayGeometry.setAttribute("skinIndex", new THREE.BufferAttribute(new Uint16Array(candidates.skinIndices), 4));
  overlayGeometry.setAttribute("skinWeight", new THREE.BufferAttribute(new Float32Array(candidates.skinWeights), 4));

  const face = _createFaceOverlayMesh(overlayGeometry);
  face.bind(bodyMesh.skeleton, bodyMesh.bindMatrix);
  return face;
}

function _collectFaceSurfaceTriangles(options: {
  position: RuntimeMesh;
  normal: RuntimeMesh;
  skinIndex: RuntimeMesh;
  skinWeight: RuntimeMesh;
  indices: RuntimeMesh | null;
  triangleCount: number;
  headBoneIndex: number;
  bounds: { x0: number; x1: number; y0: number; y1: number };
  frontSign: -1 | 1;
}) {
  const { position, normal, skinIndex, skinWeight, indices, triangleCount, headBoneIndex, bounds, frontSign } = options;
  const outPositions: number[] = [];
  const outNormals: number[] = [];
  const outUvs: number[] = [];
  const outSkinIndices: number[] = [];
  const outSkinWeights: number[] = [];
  const paddingX = Math.max(0.01, (bounds.x1 - bounds.x0) * 0.03);
  const paddingY = Math.max(0.01, (bounds.y1 - bounds.y0) * 0.03);

  for (let tri = 0; tri < triangleCount; tri += 1) {
    const a = indices ? indices[tri * 3 + 0] : tri * 3 + 0;
    const b = indices ? indices[tri * 3 + 1] : tri * 3 + 1;
    const c = indices ? indices[tri * 3 + 2] : tri * 3 + 2;
    if (!_isHeadTriangle([a, b, c], skinIndex.array, skinWeight.array, headBoneIndex)) continue;

    const cx = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
    const cy = (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
    if (cx < bounds.x0 - paddingX || cx > bounds.x1 + paddingX || cy < bounds.y0 - paddingY || cy > bounds.y1 + paddingY) continue;

    const nx = (normal.getX(a) + normal.getX(b) + normal.getX(c)) / 3;
    const ny = (normal.getY(a) + normal.getY(b) + normal.getY(c)) / 3;
    const nz = (normal.getZ(a) + normal.getZ(b) + normal.getZ(c)) / 3;
    const length = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    const unitNormal = { x: nx / length, y: ny / length, z: nz / length };
    if (unitNormal.z * frontSign < 0.2) continue;

    for (const vertexIndex of [a, b, c]) {
      const vx = position.getX(vertexIndex);
      const vy = position.getY(vertexIndex);
      const vz = position.getZ(vertexIndex);
      outPositions.push(
        vx + unitNormal.x * 0.002,
        vy + unitNormal.y * 0.002,
        vz + unitNormal.z * 0.002
      );
      outNormals.push(normal.getX(vertexIndex), normal.getY(vertexIndex), normal.getZ(vertexIndex));
      outUvs.push(
        clamp01((vx - bounds.x0) / (bounds.x1 - bounds.x0)),
        clamp01(1 - (vy - bounds.y0) / (bounds.y1 - bounds.y0))
      );
      for (let i = 0; i < 4; i += 1) {
        outSkinIndices.push(skinIndex.array[vertexIndex * 4 + i]);
        outSkinWeights.push(skinWeight.array[vertexIndex * 4 + i]);
      }
    }
  }

  return { positions: outPositions, normals: outNormals, uvs: outUvs, skinIndices: outSkinIndices, skinWeights: outSkinWeights };
}

function _isHeadTriangle(vertexIndices: number[], skinIndices: RuntimeMesh, skinWeights: RuntimeMesh, headBoneIndex: number) {
  let influencedVertices = 0;
  for (const vertexIndex of vertexIndices) {
    let headInfluence = 0;
    for (let i = 0; i < 4; i += 1) {
      const offset = vertexIndex * 4 + i;
      if (skinIndices[offset] === headBoneIndex) headInfluence += skinWeights[offset] || 0;
    }
    if (headInfluence >= 0.45) influencedVertices += 1;
  }
  return influencedVertices >= 2;
}

function _buildFaceCardOverlay(
  bodyMesh: RuntimeMesh,
  headBoneIndex: number,
  bounds: { x0: number; x1: number; y0: number; y1: number; z: number }
) {
  const headDepth = Math.max(0.01, Math.abs(bounds.z) * 0.002);
  const z = bounds.z - headDepth;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([
        bounds.x0, bounds.y0, z,
        bounds.x1, bounds.y0, z,
        bounds.x1, bounds.y1, z,
        bounds.x0, bounds.y1, z
      ]),
      3
    )
  );
  geometry.setAttribute(
    "normal",
    new THREE.BufferAttribute(
      new Float32Array([
        0, 0, -1,
        0, 0, -1,
        0, 0, -1,
        0, 0, -1
      ]),
      3
    )
  );
  geometry.setAttribute(
    "uv",
    new THREE.BufferAttribute(
      new Float32Array([
        0, 1,
        1, 1,
        1, 0,
        0, 0
      ]),
      2
    )
  );
  geometry.setAttribute(
    "skinIndex",
    new THREE.BufferAttribute(
      new Uint16Array([
        headBoneIndex, 0, 0, 0,
        headBoneIndex, 0, 0, 0,
        headBoneIndex, 0, 0, 0,
        headBoneIndex, 0, 0, 0
      ]),
      4
    )
  );
  geometry.setAttribute(
    "skinWeight",
    new THREE.BufferAttribute(
      new Float32Array([
        1, 0, 0, 0,
        1, 0, 0, 0,
        1, 0, 0, 0,
        1, 0, 0, 0
      ]),
      4
    )
  );
  geometry.setIndex([0, 2, 1, 0, 3, 2]);

  const face = _createFaceOverlayMesh(geometry);
  face.bind(bodyMesh.skeleton, bodyMesh.bindMatrix);
  return face;
}

function _createFaceOverlayMesh(geometry: RuntimeMesh) {
  const face = new THREE.SkinnedMesh(
    geometry,
    new THREE.MeshBasicMaterial({
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.FrontSide,
      alphaTest: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -0.25,
      polygonOffsetUnits: -1
    })
  );

  face.name = "FaceOverlay";
  face.visible = false;
  face.renderOrder = 0;
  face.userData.vwebTextureFlipY = false;
  return face;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}


export const buildShirtOverlay = _buildShirtOverlay;
export const buildPantsOverlay = _buildPantsOverlay;
export const buildFaceOverlay = _buildFaceOverlay;
