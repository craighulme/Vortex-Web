let shirtTextureLoader = null;

function _applyShirtToMesh(mesh, textureUrl) {
  if (!mesh) {
    return;
  }

  if (!textureUrl) {
    mesh.visible = false;
    return;
  }

  if (!shirtTextureLoader) {
    shirtTextureLoader = new THREE.TextureLoader();
  }

  shirtTextureLoader.load(textureUrl, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;

    mesh.material.map?.dispose?.();
    mesh.material.map = texture;
    mesh.material.needsUpdate = true;
    mesh.visible = true;
  });
}

function _buildShirtOverlay(characterModel) {
  const torsoUvBoxes = {
    top:    [0.39487179487179486, 0.8711985688729875, 0.6136752136752137, 0.9856887298747764],
    front:  [0.39487179487179486, 0.6386404293381038, 0.6136752136752137, 0.8676207513416816],
    bottom: [0.39487179487179486, 0.5205724508050089, 0.6136752136752137, 0.6350626118067979],
    left:   [0.6170940170940171, 0.6386404293381038, 0.7264957264957265, 0.8676207513416816],
    right:  [0.28205128205128205, 0.6386404293381038, 0.39145299145299145, 0.8676207513416816],
    back:   [0.7299145299145299, 0.6386404293381038, 0.9487179487179487, 0.8676207513416816]
  };

  const leftArmUvBoxes = {
    top:    [0.37094017094017095, 0.368515205724508, 0.48034188034188036, 0.483005366726297],
    left:   [0.03247863247863248, 0.13595706618962433, 0.14188034188034188, 0.3649373881932021],
    front:  [0.37094017094017095, 0.13595706618962433, 0.48034188034188036, 0.3649373881932021],
    right:  [0.25811965811965815, 0.13595706618962433, 0.36752136752136755, 0.3649373881932021],
    back:   [0.1452991452991453, 0.13595706618962433, 0.2547008547008547, 0.3649373881932021],
    bottom: [0.37094017094017095, 0.017889087656529523, 0.48034188034188036, 0.1323792486583184]
  };

  const rightArmUvBoxes = {
    top:    [0.5264957264957265, 0.368515205724508, 0.6358974358974359, 0.483005366726297],
    front:  [0.5264957264957265, 0.13595706618962433, 0.6358974358974359, 0.3649373881932021],
    left:   [0.6393162393162393, 0.13595706618962433, 0.7487179487179487, 0.3649373881932021],
    right:  [0.864957264957265, 0.13595706618962433, 0.9743589743589743, 0.3649373881932021],
    back:   [0.7521367521367521, 0.13595706618962433, 0.8615384615384616, 0.3649373881932021],
    bottom: [0.5264957264957265, 0.017889087656529523, 0.6358974358974359, 0.1323792486583184]
  };

  let bodyMesh = null;

  characterModel.traverse((child) => {
    if (child.isSkinnedMesh && !bodyMesh) {
      bodyMesh = child;
    }
  });

  if (!bodyMesh) {
    return null;
  }

  const geometry = bodyMesh.geometry;
  const positions = geometry.attributes.position.array;
  const normals = geometry.attributes.normal.array;
  const skinIndices = geometry.attributes.skinIndex.array;
  const skinWeights = geometry.attributes.skinWeight.array;
  const indices = geometry.index ? geometry.index.array : null;

  const boneNames = bodyMesh.skeleton.bones.map((bone) => bone.name);
  const shirtBones = new Set(["Torso", "Left_Arm", "Right_Arm"]);

  function getDominantBone(vertexIndex) {
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

  function chooseTriangleBone(a, b, c) {
    const boneA = getDominantBone(a);
    const boneB = getDominantBone(b);
    const boneC = getDominantBone(c);

    if (shirtBones.has(boneA) && boneA === boneB && boneA === boneC) {
      return boneA;
    }

    if (shirtBones.has(boneA) && boneA === boneB) {
      return boneA;
    }

    if (shirtBones.has(boneB) && boneB === boneC) {
      return boneB;
    }

    if (shirtBones.has(boneA)) {
      return boneA;
    }

    return null;
  }

  const boneBounds = {};
  for (const boneName of shirtBones) {
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
    if (!boneName) {
      continue;
    }

    for (const vertexIndex of [a, b, c]) {
      const x = positions[vertexIndex * 3 + 0];
      const y = positions[vertexIndex * 3 + 1];
      const z = positions[vertexIndex * 3 + 2];
      const bounds = boneBounds[boneName];

      bounds.xMin = Math.min(bounds.xMin, x);
      bounds.xMax = Math.max(bounds.xMax, x);
      bounds.yMin = Math.min(bounds.yMin, y);
      bounds.yMax = Math.max(bounds.yMax, y);
      bounds.zMin = Math.min(bounds.zMin, z);
      bounds.zMax = Math.max(bounds.zMax, z);
    }
  }

  const outPositions = [];
  const outNormals = [];
  const outUvs = [];
  const outSkinIndices = [];
  const outSkinWeights = [];

  for (let tri = 0; tri < triangleCount; tri++) {
    const a = indices ? indices[tri * 3 + 0] : tri * 3 + 0;
    const b = indices ? indices[tri * 3 + 1] : tri * 3 + 1;
    const c = indices ? indices[tri * 3 + 2] : tri * 3 + 2;

    const boneName = chooseTriangleBone(a, b, c);
    if (!boneName) {
      continue;
    }

    const triangleNormals = [a, b, c].map((vertexIndex) => [
      normals[vertexIndex * 3 + 0],
      normals[vertexIndex * 3 + 1],
      normals[vertexIndex * 3 + 2]
    ]);

    let nx = (triangleNormals[0][0] + triangleNormals[1][0] + triangleNormals[2][0]) / 3;
    let ny = (triangleNormals[0][1] + triangleNormals[1][1] + triangleNormals[2][1]) / 3;
    let nz = (triangleNormals[0][2] + triangleNormals[1][2] + triangleNormals[2][2]) / 3;

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

    let faceDirection;
    if (signY > 0) {
      faceDirection = "front";
    } else if (signY < 0) {
      faceDirection = "back";
    } else if (signX > 0) {
      faceDirection = "+x";
    } else if (signX < 0) {
      faceDirection = "-x";
    } else if (signZ > 0) {
      faceDirection = "top";
    } else {
      faceDirection = "bottom";
    }

    const uvBoxes =
      boneName === "Torso"
        ? torsoUvBoxes
        : boneName === "Right_Arm"
          ? rightArmUvBoxes
          : leftArmUvBoxes;

    const faceUvBox = {
      front: uvBoxes.front,
      back: uvBoxes.back,
      top: uvBoxes.bottom,
      bottom: uvBoxes.top,
      "+x": uvBoxes.left,
      "-x": uvBoxes.right
    }[faceDirection];

    const bounds = boneBounds[boneName];

    for (const vertexIndex of [a, b, c]) {
      const x = positions[vertexIndex * 3 + 0];
      const y = positions[vertexIndex * 3 + 1];
      const z = positions[vertexIndex * 3 + 2];

      const u = bounds.xMax > bounds.xMin ? (x - bounds.xMin) / (bounds.xMax - bounds.xMin) : 0.5;
      const v = bounds.yMax > bounds.yMin ? (y - bounds.yMin) / (bounds.yMax - bounds.yMin) : 0.5;
      const w = bounds.zMax > bounds.zMin ? (z - bounds.zMin) / (bounds.zMax - bounds.zMin) : 0.5;

      let uvX;
      let uvY;

      switch (faceDirection) {
        case "front":
        case "back":
          uvX = u;
          uvY = 1 - w;
          break;

        case "+x":
          uvX = v;
          uvY = 1 - w;
          break;

        case "-x":
          uvX = 1 - v;
          uvY = 1 - w;
          break;

        case "top":
          uvX = 1 - u;
          uvY = v;
          break;

        case "bottom":
          uvX = 1 - u;
          uvY = 1 - v;
          break;

        default:
          uvX = u;
          uvY = v;
          break;
      }

      uvX = Math.min(1, Math.max(0, uvX));
      uvY = Math.min(1, Math.max(0, uvY));

      outPositions.push(x, y, z);
      outNormals.push(
        normals[vertexIndex * 3 + 0],
        normals[vertexIndex * 3 + 1],
        normals[vertexIndex * 3 + 2]
      );

      const [u0, v0, u1, v1] = faceUvBox;
      outUvs.push(
        u0 + uvX * (u1 - u0),
        v0 + uvY * (v1 - v0)
      );

      for (let i = 0; i < 4; i++) {
        outSkinIndices.push(skinIndices[vertexIndex * 4 + i]);
        outSkinWeights.push(skinWeights[vertexIndex * 4 + i]);
      }
    }
  }

  if (!outPositions.length) {
    console.warn("[avatar] no shirt faces found");
    return null;
  }

  const shirtGeometry = new THREE.BufferGeometry();
  shirtGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(outPositions), 3));
  shirtGeometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(outNormals), 3));
  shirtGeometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(outUvs), 2));
  shirtGeometry.setAttribute("skinIndex", new THREE.BufferAttribute(new Uint16Array(outSkinIndices), 4));
  shirtGeometry.setAttribute("skinWeight", new THREE.BufferAttribute(new Float32Array(outSkinWeights), 4));

  const shirtMesh = new THREE.SkinnedMesh(
    shirtGeometry,
    new THREE.MeshLambertMaterial({
      transparent: true,
      depthWrite: false,
      alphaTest: 0.01,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4
    })
  );

  shirtMesh.name = "ShirtOverlay";
  shirtMesh.visible = false;
  shirtMesh.renderOrder = 1;
  shirtMesh.bind(bodyMesh.skeleton, bodyMesh.bindMatrix);

  bodyMesh.parent.add(shirtMesh);
  return shirtMesh;
}