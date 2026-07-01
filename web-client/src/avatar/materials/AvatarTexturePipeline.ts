// @ts-nocheck
let THREE = null;
let windowRef = globalThis;
let documentRef = globalThis.document;
let textureLoader = null;

const diagnostics = [];
const DIAGNOSTIC_LIMIT = 120;
const RETRY_DELAYS_MS = [600, 1800];

export function configureAvatarTexturePipeline(config = {}) {
  THREE = config.THREE || THREE;
  windowRef = config.window || globalThis;
  documentRef = config.document || globalThis.document;
  textureLoader = null;
}

export function avatarTextureDiagnosticsSnapshot(limit = 40) {
  return diagnostics.slice(-limit);
}

export function clearAvatarTextureDiagnostics() {
  diagnostics.length = 0;
}

export function applyAvatarTextureToOverlay(mesh, textureUrl, context = {}) {
  const label = String(mesh?.name || mesh?.parent?.name || "avatar-overlay");
  const diagnosticContext = { ...context, label };
  if (!mesh) {
    recordDiagnostic({ status: "failed", reason: "missing-mesh", textureUrl: textureUrl || null, ...diagnosticContext });
    return;
  }

  const ticket = (mesh.userData.vwebTextureTicket || 0) + 1;
  mesh.userData.vwebTextureTicket = ticket;

  if (!textureUrl) {
    const clothingId = Number(context?.clothingId || 0);
    recordDiagnostic({
      status: "skipped",
      reason: clothingId > 0 ? "empty-texture-url" : "no-clothing-id",
      textureUrl: null,
      ...diagnosticContext
    });
    mesh.visible = false;
    mesh.traverse?.((child) => {
      if (/Overlay$/.test(child.name || "")) child.visible = false;
    });
    return;
  }

  const startedAt = performance.now?.() || Date.now();
  const retryAttempt = Number(context?.retryAttempt || 0) || 0;
  loader().load(textureUrl, (texture) => {
    if (mesh.userData.vwebTextureTicket !== ticket) {
      recordDiagnostic({ status: "skipped", reason: "stale-texture-ticket", textureUrl, ...diagnosticContext });
      texture.dispose?.();
      return;
    }

    texture.colorSpace = THREE.SRGBColorSpace;

    const targets = new Set();
    if (mesh.material) targets.add(mesh);
    mesh.traverse?.((child) => {
      if (child.material && /Overlay$/.test(child.name || "")) targets.add(child);
    });

    if (!targets.size) {
      recordDiagnostic({ status: "no-targets", reason: "no-overlay-materials", textureUrl, ...diagnosticContext });
      texture.dispose?.();
      return;
    }

    texture.flipY = ![...targets].some((target) => target.userData?.vwebTextureFlipY === false);
    texture.needsUpdate = true;

    let faceTexture = null;
    let clothingTexture = null;
    for (const target of targets) {
      const isFace = /FaceOverlay$/.test(target.name || "");
      const map = isFace ? (faceTexture ||= boostFaceTexture(texture)) : (clothingTexture ||= maskClothingTexture(texture));

      target.material.map?.dispose?.();
      target.material.map = map;
      target.material.color?.set?.(0xffffff);
      target.material.needsUpdate = true;
      target.visible = !target.userData?.vwebFirstPersonHidden;
    }
    mesh.visible = !mesh.userData?.vwebFirstPersonHidden;
    recordDiagnostic({
      status: "loaded",
      textureUrl,
      ...diagnosticContext,
      targets: targets.size,
      elapsedMs: Math.round(((performance.now?.() || Date.now()) - startedAt) * 10) / 10
    });
  }, undefined, (error) => {
    if (mesh.userData.vwebTextureTicket !== ticket) return;
    if (retryAttempt < RETRY_DELAYS_MS.length) {
      const delayMs = RETRY_DELAYS_MS[retryAttempt];
      recordDiagnostic({
        status: "retrying",
        reason: "texture-loader-error",
        textureUrl,
        ...diagnosticContext,
        retryAttempt: retryAttempt + 1,
        retryDelayMs: delayMs,
        error: error?.message || String(error || "")
      });
      windowRef.setTimeout?.(() => {
        if (mesh.userData.vwebTextureTicket !== ticket) return;
        applyAvatarTextureToOverlay(mesh, textureUrl, { ...context, retryAttempt: retryAttempt + 1 });
      }, delayMs);
      return;
    }
    mesh.visible = false;
    recordDiagnostic({
      status: "failed",
      reason: "texture-loader-error",
      textureUrl,
      ...diagnosticContext,
      retryAttempt,
      error: error?.message || String(error || "")
    });
  });
}

export function loadModernAvatarTexture(materials, textureUrl, kind) {
  if (!materials) return;

  const targets =
    kind === "shirt" ? materials.shirtMaterials :
    kind === "pants" ? materials.pantMaterials :
    materials.headMaterials;
  const ticket = (materials.tickets[kind] || 0) + 1;
  materials.tickets[kind] = ticket;

  if (!textureUrl || !targets.length) {
    for (const material of targets) {
      material.map = null;
      material.needsUpdate = true;
    }
    return;
  }

  loader().load(textureUrl, (texture) => {
    if (materials.tickets[kind] !== ticket) {
      texture.dispose?.();
      return;
    }

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.needsUpdate = true;

    for (const material of targets) {
      material.map = texture;
      material.needsUpdate = true;
    }
  });
}

function recordDiagnostic(event) {
  const entry = { at: Date.now(), ...event };
  diagnostics.push(entry);
  if (diagnostics.length > DIAGNOSTIC_LIMIT) {
    diagnostics.splice(0, diagnostics.length - DIAGNOSTIC_LIMIT);
  }
  if (event.status === "failed" || event.status === "no-targets") {
    console.warn("[avatar] texture apply issue", entry);
  } else if (windowRef?.VortexAvatarDebug) {
    console.debug("[avatar] texture apply", entry);
  }
}

function loader() {
  if (!textureLoader) textureLoader = new THREE.TextureLoader();
  return textureLoader;
}

function colorDistance(r, g, b, color) {
  const dr = r - color[0];
  const dg = g - color[1];
  const db = b - color[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function sampleImageBackground(data, width, height) {
  const samples = [];
  const points = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)]
  ];

  for (const [x, y] of points) {
    const i = (y * width + x) * 4;
    if (data[i + 3] > 0) samples.push([data[i], data[i + 1], data[i + 2]]);
  }

  if (!samples.length) return [0, 0, 0];

  return [0, 1, 2].map((channel) => {
    const values = samples.map((sample) => sample[channel]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  });
}

function boostFaceTexture(texture) {
  const image = texture?.image;
  if (!image || !image.width || !image.height) return texture;

  try {
    const canvas = documentRef.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let transparentPixels = 0;
    for (let i = 3; i < data.data.length; i += 4) {
      if (data.data[i] < 16) transparentPixels += 1;
    }
    if (transparentPixels > canvas.width * canvas.height * 0.2) return texture;

    const background = sampleImageBackground(data.data, canvas.width, canvas.height);
    const backgroundBrightness = (background[0] + background[1] + background[2]) / 3;

    for (let i = 0; i < data.data.length; i += 4) {
      const alpha = data.data[i + 3];
      if (alpha === 0) continue;

      const r = data.data[i];
      const g = data.data[i + 1];
      const b = data.data[i + 2];
      const distance = colorDistance(r, g, b, background);
      const brightness = (r + g + b) / 3;

      if (
        alpha < 8 ||
        distance < 34 ||
        (backgroundBrightness < 24 && brightness < 28) ||
        (backgroundBrightness > 232 && brightness > 230 && distance < 80)
      ) {
        data.data[i + 3] = 0;
        continue;
      }

      data.data[i + 3] = Math.min(255, Math.max(alpha, 220));
    }
    ctx.putImageData(data, 0, 0);

    const boosted = new THREE.CanvasTexture(canvas);
    boosted.colorSpace = THREE.SRGBColorSpace;
    boosted.flipY = texture.flipY;
    boosted.needsUpdate = true;
    return boosted;
  } catch (error) {
    console.warn("[avatar] failed to boost face texture", error);
    return texture;
  }
}

function maskClothingTexture(texture) {
  const image = texture?.image;
  if (!image || !image.width || !image.height) return texture;

  try {
    const canvas = documentRef.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const key = [195, 195, 195];

    for (let i = 0; i < data.data.length; i += 4) {
      if (data.data[i + 3] === 0) continue;

      const distance = colorDistance(data.data[i], data.data[i + 1], data.data[i + 2], key);
      if (distance <= 18) {
        data.data[i + 3] = 0;
      } else if (distance <= 34) {
        data.data[i + 3] = Math.min(data.data[i + 3], Math.round((distance - 18) / 16 * 255));
      }
    }

    ctx.putImageData(data, 0, 0);

    const masked = new THREE.CanvasTexture(canvas);
    masked.colorSpace = THREE.SRGBColorSpace;
    masked.flipY = texture.flipY;
    masked.needsUpdate = true;
    return masked;
  } catch (error) {
    console.warn("[avatar] failed to mask clothing texture", error);
    return texture;
  }
}
