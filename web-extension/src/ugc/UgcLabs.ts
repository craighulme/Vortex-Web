import { UgcDraftStore, draftFileRef } from "./UgcDraftStore";
import { defaultParticleEmitter, defaultTransform, UgcStudioViewer } from "./UgcStudioViewer";
import { UgcInspectorPane } from "./UgcInspectorPane";
import { UgcEquipmentStore, UgcStoreApi } from "./UgcStoreApi";
import type { UgcAssetKind, UgcDraft, UgcEquippedStoreItem, UgcItemManifest, UgcParticleFacing, UgcParticleKind, UgcParticleMotion, UgcParticleSpec, UgcStoreItem, UgcTransform, UgcVfxGraph, UgcVfxNode } from "./UgcTypes";
import type { UgcParticleEmitterState } from "./UgcStudioViewer";

const ROOT_ID = "vweb-ugc-root";
const STYLE_ID = "vweb-ugc-style";
const NAV_ID = "vweb-ugc-nav";
const DEBUG_BRIDGE_ID = "vweb-ugc-debug-bridge";
const RIG_VERSION = "vweb-rig-v1";
const ROUTES = new Set(["/vweb/ugc", "/vweb/ugc/studio", "/vweb/ugc/store"]);

const ATTACHMENT_SLOTS = [
  "Hat",
  "Face",
  "Mask",
  "Back",
  "LeftHand",
  "RightHand",
  "LeftFoot",
  "RightFoot",
  "Torso",
  "Shoulder"
];

const ANIMATION_SLOTS = ["idle", "walk", "run", "jump", "fall", "climb", "climb_idle"];

let cameraDebugTimer = 0;

type StudioState = {
  file: File | null;
  objectUrl: string;
  publishing: boolean;
  ownerUserId: number | null;
  viewer: UgcStudioViewer | null;
  transform: UgcTransform;
  particles: UgcParticleEmitterState[];
  activeParticleId: string;
  animationDragging: boolean;
  inspectorPane: UgcInspectorPane | null;
};

export function installUgcLabs(): void {
  if (isGamePage()) return;
  injectStyle();
  normalizeUgcRouteRedirect();
  const drafts = new UgcDraftStore();
  const api = new UgcStoreApi();
  const state: StudioState = {
    file: null,
    objectUrl: "",
    publishing: false,
    ownerUserId: null,
    viewer: null,
    transform: defaultTransform(),
    particles: [defaultParticleEmitter()],
    activeParticleId: "emitter-1",
    animationDragging: false,
    inspectorPane: null
  };

  const render = () => {
    injectNav();
    if (isUgcRoute(location.pathname)) renderRoute(drafts, api, state);
    else unmountRoute(state);
  };

  loadOwnUserId().then((userId) => {
    state.ownerUserId = userId || null;
  }).catch(() => {
    state.ownerUserId = null;
  });

  window.addEventListener("popstate", render);
  document.addEventListener("click", (event) => {
    const anchor = (event.target as Element | null)?.closest?.("a[data-vweb-ugc-link]") as HTMLAnchorElement | null;
    if (!anchor) return;
    event.preventDefault();
    history.pushState({}, "", anchor.href);
    render();
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }
}

function injectNav(): void {
  if (document.getElementById(NAV_ID)) return;
  const nav = findSiteNav();
  if (!nav) return;
  const item = document.createElement("div");
  item.id = NAV_ID;
  item.className = "vweb-ugc-nav";
  item.innerHTML = `
    <a class="vweb-ugc-nav-main" href="/vweb/ugc/studio" data-vweb-ugc-link>UGC Labs</a>
    <div class="vweb-ugc-nav-menu" role="menu">
      <a href="/vweb/ugc/studio" data-vweb-ugc-link role="menuitem">UGC Studio</a>
      <a href="/vweb/ugc/store" data-vweb-ugc-link role="menuitem">UGC Store</a>
    </div>
  `;
  insertAfterCatalog(nav, item);
}

function renderRoute(drafts: UgcDraftStore, api: UgcStoreApi, state: StudioState): void {
  document.body.dataset.vwebUgcRoute = "1";
  document.title = "UGC Labs - Vortex Web";
  state.inspectorPane?.dispose();
  state.inspectorPane = null;
  state.viewer?.dispose();
  state.viewer = null;
  const route = location.pathname === "/vweb/ugc/store" ? "store" : "studio";
  const root = ensureRoot();
  root.innerHTML = `
    <section class="vweb-ugc-shell">
      <header class="vweb-ugc-hero">
        <div>
          <h1>UGC Labs</h1>
          <p>Build and test web-only avatar items, morphs, particles, and animation packs.</p>
        </div>
        <nav class="vweb-ugc-tabs" aria-label="UGC Labs">
          <a class="${route === "studio" ? "active" : ""}" href="/vweb/ugc/studio" data-vweb-ugc-link>Studio</a>
          <a class="${route === "store" ? "active" : ""}" href="/vweb/ugc/store" data-vweb-ugc-link>Store</a>
        </nav>
      </header>
      <div class="vweb-ugc-view"></div>
    </section>
  `;
  const view = root.querySelector(".vweb-ugc-view") as HTMLElement;
  if (route === "store") renderStore(view, api, state);
  else renderStudioEditor(view, drafts, api, state);
}

function renderStudioEditor(container: HTMLElement, drafts: UgcDraftStore, api: UgcStoreApi, state: StudioState): void {
  container.innerHTML = `
    <section class="vweb-ugc-studio">
      <section class="vweb-ugc-panel vweb-ugc-editor">
        <div class="vweb-ugc-panel-head">
          <h2>Preview</h2>
          <p>Drag to orbit, scroll to zoom, then test your model against the Vortex Web rig.</p>
        </div>
        <div class="vweb-ugc-editor-stage">
          <div class="vweb-ugc-viewport" data-vweb-ugc-viewport></div>
          <div class="vweb-ugc-viewport-toolbar">
            <button type="button" data-vweb-reset-camera>Reset camera</button>
            <div class="vweb-ugc-tool-modes" aria-label="Transform tool">
              <button type="button" class="active" data-vweb-transform-mode="translate">Move</button>
              <button type="button" data-vweb-transform-mode="rotate">Rotate</button>
              <button type="button" data-vweb-transform-mode="scale">Scale</button>
            </div>
            <div class="vweb-ugc-target-modes" aria-label="Transform target">
              <button type="button" class="active" data-vweb-transform-target="model">Model</button>
              <button type="button" data-vweb-transform-target="particles">Particles</button>
            </div>
            <div class="vweb-ugc-animation-controls">
              <select data-vweb-animation>
                <option value="none">Animation: still</option>
                ${ANIMATION_SLOTS.map((slot) => `<option value="${escapeHtml(slot)}">Animation: ${escapeHtml(slot.replace("_", " "))}</option>`).join("")}
              </select>
              <button type="button" data-vweb-animation-play disabled>Play</button>
              <input type="range" min="0" max="1000" value="0" data-vweb-animation-time disabled aria-label="Animation frame">
              <span data-vweb-animation-label>0.00s</span>
            </div>
          </div>
        </div>
      </section>
      <aside class="vweb-ugc-inspector">
        <form class="vweb-ugc-panel vweb-ugc-studio-form">
          <div class="vweb-ugc-panel-head">
            <h2>Asset</h2>
            <p>Choose what you are making. The editor only shows controls that apply.</p>
          </div>
          <label class="vweb-ugc-field"><span>Name</span><input name="name" type="text" maxlength="80" placeholder="Traffic Cone Hat" required></label>
          <label class="vweb-ugc-field">
            <span>Type</span>
            <select name="kind">
              <option value="avatar-item">Avatar accessory</option>
              <option value="character-morph">Full character morph</option>
              <option value="animation-pack">Animation override pack</option>
            </select>
          </label>
          <label class="vweb-ugc-field" data-kind-panel="accessory">
            <span>Attachment slot</span>
            <select name="slot">${ATTACHMENT_SLOTS.map((slot) => `<option value="${escapeHtml(slot)}">${escapeHtml(slot)}</option>`).join("")}</select>
          </label>
          <label class="vweb-ugc-field"><span>GLB file</span><input name="file" type="file" accept=".glb,model/gltf-binary"></label>
          <div class="vweb-ugc-kind-note" data-kind-panel="accessory">Accessories attach to a rig anchor and can include particles.</div>
          <div class="vweb-ugc-kind-note" data-kind-panel="morph" hidden>Morphs replace the visible avatar model for web users. They keep the same network root.</div>
          <div class="vweb-ugc-kind-note" data-kind-panel="animation" hidden>Animation packs override standard clips such as idle, walk, run, jump, and climb.</div>

          <section class="vweb-ugc-form-section" data-kind-panel="animation" hidden>
            <div class="vweb-ugc-section-title">Animation clips</div>
            <div class="vweb-ugc-clip-list">
              ${ANIMATION_SLOTS.map((slot) => `<label><span>${escapeHtml(slot.replace("_", " "))}</span><input name="clip-${escapeHtml(slot)}" type="text" placeholder="clip name in GLB"></label>`).join("")}
            </div>
          </section>

          <section class="vweb-ugc-form-section" data-kind-panel="transform">
            <div class="vweb-ugc-section-title">Transform</div>
            <div class="vweb-ugc-tweakpane" data-vweb-transform-pane></div>
            <div class="vweb-ugc-backing-fields" aria-hidden="true">
              ${["x", "y", "z"].map((axis, index) => `<label><span>Pos ${axis.toUpperCase()}</span><input name="pos-${axis}" type="number" step="any" value="${state.transform.position[index]}"></label>`).join("")}
              ${["x", "y", "z"].map((axis, index) => `<label><span>Rot ${axis.toUpperCase()}</span><input name="rot-${axis}" type="number" step="any" value="${state.transform.rotation[index]}"></label>`).join("")}
              ${["x", "y", "z"].map((axis, index) => `<label><span>Scale ${axis.toUpperCase()}</span><input name="scale-${axis}" type="number" step="any" min="0.01" value="${state.transform.scale[index]}"></label>`).join("")}
            </div>
          </section>

          <section class="vweb-ugc-form-section" data-kind-panel="particles">
            <div class="vweb-ugc-section-title">Particles</div>
            <div class="vweb-ugc-tweakpane" data-vweb-particle-pane></div>
            <label class="vweb-ugc-field vweb-ugc-texture-field"><span>Texture</span><input name="particle-file" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"></label>
            <details class="vweb-ugc-vfx-graph">
              <summary>
                <span>Advanced VFX data</span>
                <small>.vwebvfx export/import</small>
              </summary>
              <p class="vweb-ugc-vfx-note">This uses Vortex Web's own saved effect format. Online Unity/Unreal graph JSON is not supported here; use PNG or flipbook textures for normal imports.</p>
              <div class="vweb-ugc-vfx-nodes" data-vweb-vfx-nodes></div>
              <div class="vweb-ugc-vfx-actions">
                <label class="vweb-ugc-field"><span>Import .vwebvfx</span><input name="vfx-file" type="file" accept=".vwebvfx"></label>
                <button type="button" data-vweb-copy-vfx>Copy .vwebvfx</button>
              </div>
            </details>
          </section>

          <div class="vweb-ugc-actions">
            <button type="submit">Save draft</button>
            <button type="button" data-vweb-publish-draft>Publish for review</button>
            <button type="button" data-vweb-copy-manifest>Copy manifest</button>
            <button type="button" data-vweb-reset-transform>Reset transform</button>
          </div>
          <p class="vweb-ugc-status" aria-live="polite"></p>
          <div class="vweb-ugc-metadata">
            <div><strong>Attach bone</strong><span data-vweb-attach-bone>Head</span></div>
            <div><strong>Model</strong><span data-vweb-model-file>No GLB selected</span></div>
            <div><strong>Particle file</strong><span data-vweb-particle-file>None</span></div>
          </div>
        </form>
      </aside>
    </section>
    <section class="vweb-ugc-panel">
      <div class="vweb-ugc-panel-head">
        <h2>Drafts</h2>
        <p>Saved locally in this browser. Publishing requires the Vortex account you linked by launching a game.</p>
      </div>
      <div class="vweb-ugc-drafts"></div>
    </section>
  `;

  const form = container.querySelector(".vweb-ugc-studio-form") as HTMLFormElement;
  const status = container.querySelector(".vweb-ugc-status") as HTMLElement;
  const viewport = container.querySelector("[data-vweb-ugc-viewport]") as HTMLElement;
  const transformPane = container.querySelector("[data-vweb-transform-pane]") as HTMLElement;
  const particlePane = container.querySelector("[data-vweb-particle-pane]") as HTMLElement;
  const fileInput = form.elements.namedItem("file") as HTMLInputElement;
  const particleFileInput = form.elements.namedItem("particle-file") as HTMLInputElement;
  const vfxFileInput = form.elements.namedItem("vfx-file") as HTMLInputElement;
  const kindInput = form.elements.namedItem("kind") as HTMLSelectElement;
  const slotInput = form.elements.namedItem("slot") as HTMLSelectElement;
  const attachBone = container.querySelector("[data-vweb-attach-bone]") as HTMLElement;
  const modelFile = container.querySelector("[data-vweb-model-file]") as HTMLElement;
  const particleFile = container.querySelector("[data-vweb-particle-file]") as HTMLElement;
  const animationSelect = container.querySelector("[data-vweb-animation]") as HTMLSelectElement;
  const animationPlay = container.querySelector("[data-vweb-animation-play]") as HTMLButtonElement;
  const animationTime = container.querySelector("[data-vweb-animation-time]") as HTMLInputElement;
  const animationLabel = container.querySelector("[data-vweb-animation-label]") as HTMLElement;
  const vfxNodes = container.querySelector("[data-vweb-vfx-nodes]") as HTMLElement;

  state.viewer = new UgcStudioViewer({
    stage: viewport,
    status,
    runtimeUrl,
    onTransformUpdate: (snapshot) => {
      if (snapshot.target === "model") {
        state.transform = snapshot.transform;
        writeTransform(form, snapshot.transform);
        state.inspectorPane?.refresh();
        return;
      }
      const emitter = activeEmitter(state);
      if (!emitter || emitter.id !== snapshot.particleId) return;
      emitter.transform = snapshot.transform;
      state.inspectorPane?.refresh();
    },
    onAnimationUpdate: (snapshot) => {
      animationPlay.disabled = snapshot.name === "none" || snapshot.duration <= 0;
      animationTime.disabled = snapshot.name === "none" || snapshot.duration <= 0;
      animationPlay.textContent = snapshot.playing ? "Pause" : "Play";
      animationLabel.textContent = snapshot.duration ? `${snapshot.time.toFixed(2)}s / ${snapshot.duration.toFixed(2)}s` : "0.00s";
      if (!state.animationDragging) animationTime.value = String(Math.round(snapshot.normalized * 1000));
    }
  });
  exposeStudioDebug(state);
  state.viewer.mount().then(async () => {
    state.viewer?.applySlot(slotInput.value);
    state.viewer?.applyTransform(readTransform(form));
    state.viewer?.applyAvatarAppearance(await loadCatalogAppearance());
  }).catch((error) => {
    status.textContent = error instanceof Error ? error.message : "3D editor failed to start.";
    status.className = "vweb-ugc-status error";
  });

  const syncKind = () => {
    const kind = normalizeKind(kindInput.value);
    const isAccessory = kind === "avatar-item";
    const isMorph = kind === "character-morph";
    const isAnimation = kind === "animation-pack";
    container.querySelectorAll<HTMLElement>("[data-kind-panel]").forEach((panel) => {
      const target = panel.dataset.kindPanel || "";
      panel.hidden = !(
        (target === "accessory" && isAccessory) ||
        (target === "morph" && isMorph) ||
        (target === "animation" && isAnimation) ||
        (target === "transform" && !isAnimation) ||
        (target === "particles" && !isAnimation)
      );
    });
    attachBone.closest("div")!.hidden = !isAccessory;
    if (isAnimation) {
      state.viewer?.setParticleEmitters(state.particles.map((emitter) => ({ ...emitter, enabled: false })), state.activeParticleId);
    } else {
      state.viewer?.setParticleEmitters(state.particles, state.activeParticleId);
    }
  };
  const syncSlot = () => {
    const bone = slotToBone(slotInput.value);
    attachBone.textContent = bone;
    state.viewer?.applySlot(slotInput.value);
  };
  const syncTransform = () => {
    state.transform = readTransform(form);
    state.viewer?.applyTransform(state.transform);
    state.inspectorPane?.refresh();
  };
  const refreshParticleControls = (rebuild = false) => {
    const pageScroll = window.scrollY;
    const inspectorScrollHost = particlePane.closest(".vweb-ugc-inspector") as HTMLElement | null;
    const inspectorScroll = inspectorScrollHost?.scrollTop ?? 0;
    renderVfxGraphPreview(vfxNodes, createVfxGraphFromEmitters(state.particles));
    if (rebuild) state.inspectorPane?.rebuild();
    else state.inspectorPane?.refresh();
    window.scrollTo({ top: pageScroll, left: window.scrollX, behavior: "instant" });
    if (inspectorScrollHost) inspectorScrollHost.scrollTop = inspectorScroll;
  };
  const writeActiveEmitterToForm = () => {
    const emitter = activeEmitter(state);
    if (!emitter) return;
    particleFile.textContent = emitter.file ? emitter.file.name : "None";
    refreshParticleControls();
  };
  const loadDraftIntoEditor = async (draft: UgcDraft) => {
    const manifest = draft.manifest || {};
    (form.elements.namedItem("name") as HTMLInputElement).value = draft.name;
    kindInput.value = draft.kind;
    if (draft.slot) slotInput.value = draft.slot;
    writeTransform(form, manifest.transform || defaultTransform());
    state.transform = readTransform(form);
    const particleFiles = await drafts.loadParticleFiles(draft);
    state.particles = emittersFromParticleSpecs(manifest.particles || [], particleFiles);
    state.activeParticleId = state.particles[0]?.id || "emitter-1";
    syncKind();
    syncSlot();
    syncTransform();
    writeClipMap(form, manifest.clips || {});
    refreshParticleControls(true);
    writeActiveEmitterToForm();
    state.viewer?.setParticleEmitters(state.particles, state.activeParticleId);
    state.inspectorPane?.refresh();
    modelFile.textContent = draft.fileName || "No GLB selected";
    status.className = "vweb-ugc-status";
    try {
      const file = await drafts.loadModelFile(draft);
      if (!file) throw new Error("missing source file");
      state.file = file;
      if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = URL.createObjectURL(file);
      if (kindInput.value === "animation-pack") {
        state.viewer?.clearAccessory();
        const clipNames = await state.viewer?.loadAnimationPack(file, clipMapFromManifest(manifest.clips));
        autoFillClipMap(form, clipNames || []);
        writeClipMap(form, manifest.clips || {});
      } else {
        await state.viewer?.loadAccessory(file);
      }
      status.textContent = "Draft loaded. You can keep editing or publish it for review.";
      status.className = "vweb-ugc-status ok";
    } catch {
      state.file = null;
      state.objectUrl = "";
      status.textContent = "Draft settings loaded, but the original GLB needs to be selected again before publish.";
      status.className = "vweb-ugc-status error";
    }
  };
  const selectEmitter = (id: string) => {
    state.activeParticleId = id || state.particles[0]?.id || "emitter-1";
    state.viewer?.setActiveParticle(state.activeParticleId);
    writeActiveEmitterToForm();
  };
  const addEmitter = () => {
    const nextIndex = state.particles.length + 1;
    const emitter = defaultParticleEmitter(`emitter-${Date.now().toString(36)}`);
    emitter.name = `Emitter ${nextIndex}`;
    state.particles.push(emitter);
    state.activeParticleId = emitter.id;
    refreshParticleControls(true);
    writeActiveEmitterToForm();
    state.viewer?.setParticleEmitters(state.particles, state.activeParticleId);
  };
  const removeEmitter = () => {
    if (state.particles.length <= 1) {
      state.particles = [defaultParticleEmitter()];
    } else {
      state.particles = state.particles.filter((emitter) => emitter.id !== state.activeParticleId);
    }
    state.activeParticleId = state.particles[0]?.id || "emitter-1";
    refreshParticleControls(true);
    writeActiveEmitterToForm();
    state.viewer?.setParticleEmitters(state.particles, state.activeParticleId);
  };

  state.inspectorPane = new UgcInspectorPane({
    transformContainer: transformPane,
    particleContainer: particlePane,
    getSnapshot: () => ({
      transform: readTransform(form),
      particles: state.particles,
      activeParticleId: state.activeParticleId
    }),
    onTransformChange: (transform) => {
      writeTransform(form, transform);
      state.transform = transform;
      state.viewer?.applyTransform(transform);
    },
    onParticleChange: (particle) => {
      const emitter = activeEmitter(state);
      if (!emitter) return;
      Object.assign(emitter, particle);
      state.viewer?.setParticleEmitters(state.particles, state.activeParticleId);
      writeActiveEmitterToForm();
    },
    onEmitterSelect: selectEmitter,
    onEmitterAdd: addEmitter,
    onEmitterRemove: removeEmitter
  });

  kindInput.addEventListener("change", syncKind);
  slotInput.addEventListener("change", syncSlot);
  refreshParticleControls(true);
  writeActiveEmitterToForm();
  syncKind();
  syncSlot();

  fileInput.addEventListener("change", async () => {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.file = fileInput.files?.[0] ?? null;
    state.objectUrl = state.file ? URL.createObjectURL(state.file) : "";
    modelFile.textContent = state.file ? state.file.name : "No GLB selected";
    if (state.file) {
      if (kindInput.value === "animation-pack") {
        state.viewer?.clearAccessory();
        const clipNames = await state.viewer?.loadAnimationPack(state.file);
        autoFillClipMap(form, clipNames || []);
      } else {
        await state.viewer?.loadAccessory(state.file);
      }
    }
  });

  particleFileInput.addEventListener("change", () => {
    const emitter = activeEmitter(state);
    if (emitter) {
      emitter.file = particleFileInput.files?.[0] ?? null;
      emitter.kind = emitter.file ? "file" : "none";
      if (emitter.file) emitter.enabled = true;
    }
    particleFile.textContent = emitter?.file ? emitter.file.name : "None";
    state.viewer?.setParticleEmitters(state.particles, state.activeParticleId);
    refreshParticleControls();
  });

  vfxFileInput.addEventListener("change", async () => {
    const file = vfxFileInput.files?.[0];
    if (!file) return;
    try {
      const graph = normalizeVfxGraph(JSON.parse(await file.text()));
      const imported = emittersFromVfxGraph(graph, state.particles);
      if (!imported.length) throw new Error("The graph does not contain any emitter nodes.");
      state.particles = imported;
      state.activeParticleId = imported[0]?.id || "emitter-1";
      refreshParticleControls(true);
      writeActiveEmitterToForm();
      state.viewer?.setParticleEmitters(state.particles, state.activeParticleId);
      status.textContent = "Vortex Web VFX data imported.";
      status.className = "vweb-ugc-status ok";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Vortex Web VFX data import failed.";
      status.className = "vweb-ugc-status error";
    }
  });

  animationSelect.addEventListener("change", () => {
    state.viewer?.playAnimation(animationSelect.value);
  });
  animationPlay.addEventListener("click", () => {
    const snapshot = state.viewer?.snapshotAnimation();
    state.viewer?.setAnimationPlaying(!snapshot?.playing);
  });
  animationTime.addEventListener("pointerdown", () => {
    state.animationDragging = true;
  });
  animationTime.addEventListener("pointerup", () => {
    state.animationDragging = false;
  });
  animationTime.addEventListener("input", () => {
    state.viewer?.setAnimationPlaying(false);
    state.viewer?.setAnimationTime(Number(animationTime.value) / 1000);
  });
  container.querySelector("[data-vweb-reset-camera]")?.addEventListener("click", () => state.viewer?.resetView());
  container.querySelectorAll<HTMLButtonElement>("[data-vweb-transform-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.vwebTransformMode;
      if (mode !== "translate" && mode !== "rotate" && mode !== "scale") return;
      container.querySelectorAll("[data-vweb-transform-mode]").forEach((item) => item.classList.toggle("active", item === button));
      state.viewer?.setTransformMode(mode);
    });
  });
  container.querySelectorAll<HTMLButtonElement>("[data-vweb-transform-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.vwebTransformTarget;
      if (target !== "model" && target !== "particles") return;
      container.querySelectorAll("[data-vweb-transform-target]").forEach((item) => item.classList.toggle("active", item === button));
      state.viewer?.setTransformTarget(target);
    });
  });
  container.querySelector("[data-vweb-reset-transform]")?.addEventListener("click", () => {
    writeTransform(form, defaultTransform());
    syncTransform();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await ensureOwnerUserId(state);
    const draft = draftFromForm(form, state);
    if (!draft) {
      status.textContent = "Choose a GLB file before saving.";
      status.className = "vweb-ugc-status error";
      return;
    }
    try {
      await drafts.save(draft, draftFilesFromState(draft, state));
      status.textContent = "Draft saved locally.";
      status.className = "vweb-ugc-status ok";
      renderDrafts(container, drafts, loadDraftIntoEditor, api);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Draft save failed.";
      status.className = "vweb-ugc-status error";
    }
  });

  container.querySelector("[data-vweb-copy-manifest]")?.addEventListener("click", async () => {
    const draft = draftFromForm(form, state);
    if (!draft) {
      status.textContent = "Choose a GLB file before copying a manifest.";
      status.className = "vweb-ugc-status error";
      return;
    }
    await navigator.clipboard?.writeText(JSON.stringify(draft.manifest, null, 2)).catch(() => null);
    status.textContent = "Manifest copied.";
    status.className = "vweb-ugc-status ok";
  });

  container.querySelector("[data-vweb-copy-vfx]")?.addEventListener("click", async () => {
    const graph = createVfxGraphFromEmitters(state.viewer?.snapshotParticles() ?? state.particles);
    await navigator.clipboard?.writeText(JSON.stringify(graph, null, 2)).catch(() => null);
    status.textContent = "Vortex Web VFX data copied.";
    status.className = "vweb-ugc-status ok";
  });

  container.querySelector("[data-vweb-publish-draft]")?.addEventListener("click", async () => {
    const button = container.querySelector("[data-vweb-publish-draft]") as HTMLButtonElement | null;
    await ensureOwnerUserId(state);
    let draft = draftFromForm(form, state);
    if (!draft || !state.file) {
      status.textContent = "Choose a GLB file before publishing.";
      status.className = "vweb-ugc-status error";
      return;
    }
    if (state.publishing) return;
    state.publishing = true;
    if (button) button.disabled = true;
    status.textContent = "Preparing auth...";
    status.className = "vweb-ugc-status";
    try {
      const token = await freshProfileToken();
      if (!token) throw new Error("Launch a game once to link this browser, then try again.");
      status.textContent = "Uploading to moderation queue...";
      const files = draftFilesFromState(draft, state);
      draft = draftWithUploadableParticles(draft, files.particles);
      let published;
      try {
        published = await api.publishDraft({ draft, file: state.file, particles: files.particles, token });
      } catch (uploadError) {
        if (!isAuthTokenError(uploadError)) throw uploadError;
        status.textContent = "Refreshing linked browser auth...";
        const refreshedToken = await freshProfileToken();
        if (!refreshedToken) throw new Error("Launch a game once to link this browser, then try again.");
        status.textContent = "Uploading to moderation queue...";
        published = await api.publishDraft({ draft, file: state.file, particles: files.particles, token: refreshedToken });
      }
      await drafts.save({
        ...draft,
        remoteItemId: published.id,
        remoteStatus: published.status || "pending",
        submittedAt: Date.now(),
        updatedAt: Date.now()
      }, files);
      status.textContent = published.status === "approved"
        ? "Update saved. It is currently approved in the store."
        : "Submitted for review. This draft will keep its review status here.";
      status.className = "vweb-ugc-status ok";
      renderDrafts(container, drafts, loadDraftIntoEditor, api);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Publish failed.";
      status.className = "vweb-ugc-status error";
    } finally {
      state.publishing = false;
      if (button) button.disabled = false;
    }
  });

  renderDrafts(container, drafts, loadDraftIntoEditor, api);
}

async function currentProfileToken(): Promise<string> {
  return profileTokenWithOptions(false);
}

async function freshProfileToken(): Promise<string> {
  return profileTokenWithOptions(true);
}

async function loadOwnUserId(): Promise<number | null> {
  const cosmetics = (window as Window & {
    VortexWebCosmetics?: {
      load?: () => Promise<{ ownUserId?: number | null }>;
      loadCached?: () => Promise<{ ownUserId?: number | null }>;
    };
  }).VortexWebCosmetics;
  const state = (cosmetics?.loadCached
    ? await cosmetics.loadCached().catch(() => null)
    : cosmetics?.load
      ? await cosmetics.load().catch(() => null)
      : null) as { ownUserId?: number | null } | null;
  const userId = Number(state?.ownUserId || 0);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

async function ensureOwnerUserId(state: StudioState): Promise<number | null> {
  if (state.ownerUserId) return state.ownerUserId;
  state.ownerUserId = await loadOwnUserId().catch(() => null);
  return state.ownerUserId;
}

function isAuthTokenError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return message === "profile_token_invalid" ||
    message === "missing_profile_token" ||
    message === "account_not_linked" ||
    message === "license_inactive";
}

async function profileTokenWithOptions(forceRefresh: boolean): Promise<string> {
  type CosmeticsState = { ownUserId?: number | null };
  const cosmetics = (window as Window & {
    VortexWebCosmetics?: {
      load?: () => Promise<CosmeticsState>;
      profileAuthToken?: (userId: number, options?: { forceRefresh?: boolean }) => Promise<string>;
    };
  }).VortexWebCosmetics;
  const state: CosmeticsState | null = await cosmetics?.load?.().catch(() => null) ?? null;
  const userId = Number(state?.ownUserId || 0);
  if (!userId || !cosmetics?.profileAuthToken) return "";
  return cosmetics.profileAuthToken(userId, forceRefresh ? { forceRefresh: true } : undefined).catch(() => "");
}

async function reconcileDraftStatuses(
  container: HTMLElement,
  drafts: UgcDraftStore,
  onLoad: ((draft: UgcDraft) => void | Promise<void>) | undefined,
  api: UgcStoreApi
): Promise<void> {
  if (container.dataset.vwebUgcReconciling === "1") return;
  const localDrafts = drafts.list().filter((draft) => draft.remoteItemId || draft.identityKey);
  if (!localDrafts.length) return;
  container.dataset.vwebUgcReconciling = "1";
  try {
    const token = await currentProfileToken();
    if (!token) return;
    const remoteItems = await api.listOwn(token);
    const byId = new Map(remoteItems.map((item) => [item.key, item]));
    const byIdentity = new Map(remoteItems.filter((item) => item.identityKey).map((item) => [item.identityKey as string, item]));
    let changed = false;
    for (const draft of localDrafts) {
      const remote = (draft.remoteItemId && byId.get(draft.remoteItemId)) ||
        (draft.identityKey && byIdentity.get(draft.identityKey));
      if (!remote) continue;
      const nextStatus = remote.status || draft.remoteStatus || "pending";
      if (remote.key !== draft.remoteItemId || nextStatus !== draft.remoteStatus) {
        drafts.updateMetadata(draft.id, {
          remoteItemId: remote.key,
          remoteStatus: nextStatus,
          updatedAt: Date.now()
        });
        changed = true;
      }
    }
    if (changed) renderDrafts(container, drafts, onLoad, api);
  } finally {
    delete container.dataset.vwebUgcReconciling;
  }
}

function renderDrafts(container: HTMLElement, drafts: UgcDraftStore, onLoad?: (draft: UgcDraft) => void | Promise<void>, api?: UgcStoreApi): void {
  const target = container.querySelector(".vweb-ugc-drafts") as HTMLElement | null;
  if (!target) return;
  const items = drafts.list();
  target.innerHTML = items.length ? items.map((draft) => `
    <article class="vweb-ugc-card">
      <div>
        <h3>${escapeHtml(draft.name)}</h3>
        <p>${formatKind(draft.kind)}${draft.slot ? ` &middot; ${escapeHtml(draft.slot)}` : ""} &middot; ${escapeHtml(draft.rigVersion)}</p>
        <small>${escapeHtml(draft.fileName || "GLB file")} &middot; ${escapeHtml(draft.remoteStatus || "local draft")} &middot; ${new Date(draft.updatedAt).toLocaleString()}</small>
      </div>
      <div class="vweb-ugc-card-actions">
        <button type="button" data-vweb-load-draft="${escapeHtml(draft.id)}">Load</button>
        <button type="button" data-vweb-delete-draft="${escapeHtml(draft.id)}">Delete</button>
      </div>
    </article>
  `).join("") : `<p class="vweb-ugc-empty">No drafts yet.</p>`;

  target.querySelectorAll("[data-vweb-load-draft]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = (button as HTMLElement).dataset.vwebLoadDraft || "";
      const draft = drafts.list().find((item) => item.id === id);
      if (draft) void onLoad?.(draft);
    });
  });
  target.querySelectorAll("[data-vweb-delete-draft]").forEach((button) => {
    button.addEventListener("click", async () => {
      await drafts.remove((button as HTMLElement).dataset.vwebDeleteDraft || "");
      renderDrafts(container, drafts, onLoad, api);
    });
  });
  if (api) void reconcileDraftStatuses(container, drafts, onLoad, api);
}

async function renderStore(container: HTMLElement, api: UgcStoreApi, state: StudioState): Promise<void> {
  container.innerHTML = `
    <section class="vweb-ugc-store">
      <section class="vweb-ugc-panel vweb-ugc-store-preview">
        <div class="vweb-ugc-panel-head">
          <h2>Preview</h2>
          <p>Try approved Vortex Web items against the standard avatar rig.</p>
        </div>
        <div class="vweb-ugc-store-stage" data-vweb-store-viewport></div>
        <div class="vweb-ugc-store-animation" data-vweb-store-animation hidden>
          <div class="vweb-ugc-store-animation-head">
            <strong>Animation preview</strong>
            <span data-vweb-store-animation-count>No clips</span>
          </div>
          <div class="vweb-ugc-animation-controls">
            <select data-vweb-store-animation-select disabled>
              <option value="none">No playable clips</option>
            </select>
            <button type="button" data-vweb-store-animation-play disabled>Play</button>
            <input type="range" min="0" max="1000" value="0" data-vweb-store-animation-time disabled aria-label="Animation frame">
            <span data-vweb-store-animation-label>0.00s</span>
          </div>
        </div>
        <div class="vweb-ugc-store-selected" data-vweb-store-selected>
          <h3>Select an item</h3>
          <p>Choose a published item from the catalog to preview it here.</p>
        </div>
      </section>
      <section class="vweb-ugc-panel vweb-ugc-store-catalog">
        <div class="vweb-ugc-panel-head">
          <h2>Store</h2>
          <p>Web-only UGC. Equipped items sync to your linked Vortex Web profile.</p>
        </div>
        <div class="vweb-ugc-filters">
          <select data-vweb-filter-kind>
            <option value="">All types</option>
            <option value="avatar-item">UGC items</option>
            <option value="character-morph">Character morphs</option>
            <option value="animation-pack">Animation packs</option>
          </select>
          <input data-vweb-filter-query type="search" placeholder="Search published assets">
        </div>
        <div class="vweb-ugc-equipped" data-vweb-equipped></div>
        <div class="vweb-ugc-store-list"><p class="vweb-ugc-empty">Loading store...</p></div>
      </section>
    </section>
  `;
  const list = container.querySelector(".vweb-ugc-store-list") as HTMLElement;
  const kind = container.querySelector("[data-vweb-filter-kind]") as HTMLSelectElement;
  const query = container.querySelector("[data-vweb-filter-query]") as HTMLInputElement;
  const selectedPanel = container.querySelector("[data-vweb-store-selected]") as HTMLElement;
  const equippedPanel = container.querySelector("[data-vweb-equipped]") as HTMLElement;
  const viewport = container.querySelector("[data-vweb-store-viewport]") as HTMLElement;
  const animationPanel = container.querySelector("[data-vweb-store-animation]") as HTMLElement;
  const animationCount = container.querySelector("[data-vweb-store-animation-count]") as HTMLElement;
  const animationSelect = container.querySelector("[data-vweb-store-animation-select]") as HTMLSelectElement;
  const animationPlay = container.querySelector("[data-vweb-store-animation-play]") as HTMLButtonElement;
  const animationTime = container.querySelector("[data-vweb-store-animation-time]") as HTMLInputElement;
  const animationLabel = container.querySelector("[data-vweb-store-animation-label]") as HTMLElement;
  let animationDragging = false;
  const equipment = new UgcEquipmentStore();
  const viewer = new UgcStudioViewer({
    stage: viewport,
    status: null,
    runtimeUrl,
    editable: false,
    onAnimationUpdate: (snapshot) => {
      animationPlay.disabled = snapshot.name === "none" || snapshot.duration <= 0;
      animationTime.disabled = snapshot.name === "none" || snapshot.duration <= 0;
      animationPlay.textContent = snapshot.playing ? "Pause" : "Play";
      animationLabel.textContent = snapshot.duration ? `${snapshot.time.toFixed(2)}s / ${snapshot.duration.toFixed(2)}s` : "0.00s";
      if (!animationDragging) animationTime.value = String(Math.round(snapshot.normalized * 1000));
    }
  });
  state.viewer = viewer;
  let selected: UgcStoreItem | null = null;
  let items: UgcStoreItem[] = [];
  let equipmentToken = "";
  let equipmentSync: "cloud" | "local" = "local";
  let previewToken = 0;
  const setAnimationControls = (slots: string[], visible: boolean) => {
    animationPanel.hidden = !visible;
    const playable = slots.filter((slot) => ANIMATION_SLOTS.includes(slot));
    animationCount.textContent = playable.length ? `${playable.length} clip${playable.length === 1 ? "" : "s"}` : "No clips";
    animationSelect.innerHTML = playable.length
      ? playable.map((slot) => `<option value="${escapeAttribute(slot)}">${escapeHtml(slot.replace("_", " "))}</option>`).join("")
      : `<option value="none">No playable clips</option>`;
    animationSelect.disabled = !playable.length;
    animationPlay.disabled = !playable.length;
    animationTime.disabled = !playable.length;
    animationTime.value = "0";
    animationLabel.textContent = "0.00s";
    if (playable.length) animationSelect.value = playable[0] || "none";
  };
  try {
    await viewer.mount();
    viewer.applyAvatarAppearance(await loadCatalogAppearance());
    const [published, token] = await Promise.all([
      api.listPublished(),
      currentProfileToken().catch(() => "")
    ]);
    items = published;
    equipmentToken = token;
    if (equipmentToken) {
      const ownerUserId = await ensureOwnerUserId(state).catch(() => 0);
      if (ownerUserId) {
        const remoteEquipment = await api.listEquipment([ownerUserId]);
        const remoteItems = remoteEquipment.users[String(ownerUserId)]?.items || [];
        if (remoteItems.length) equipment.replace(remoteItems);
        equipmentSync = "cloud";
      }
    }
  } catch {
    list.innerHTML = `<p class="vweb-ugc-empty">Store could not load right now.</p>`;
    return;
  }
  const selectItem = (item: UgcStoreItem) => {
    selected = item;
    renderStoreSelection(selectedPanel, item, equipment.isEquipped(item));
    const token = ++previewToken;
    setAnimationControls([], item.kind === "animation-pack");
    void previewStoreItem(viewer, item, selectedPanel).then((slots) => {
      if (token !== previewToken) return;
      setAnimationControls(slots, item.kind === "animation-pack");
    });
    render();
  };
  const equipSelected = async () => {
    if (!selected) return;
    if (equipment.isEquipped(selected)) equipment.unequip(selected);
    else equipment.equip(selected);
    renderStoreSelection(selectedPanel, selected, equipment.isEquipped(selected));
    render();
    if (!equipmentToken) {
      renderStoreSyncStatus(selectedPanel, "Saved locally. Launch a game once to link this browser before cloud sync.");
      return;
    }
    try {
      const saved = await api.saveEquipment(equipmentToken, equipment.load());
      equipment.replace(saved);
      equipmentSync = "cloud";
      renderStoreSelection(selectedPanel, selected, equipment.isEquipped(selected), equipmentSync);
      render();
    } catch (error) {
      renderStoreSyncStatus(selectedPanel, error instanceof Error ? error.message : "Cloud sync failed.");
    }
  };
  const render = () => {
    renderEquippedItems(equippedPanel, equipment.load(), equipmentSync);
    renderStoreItems(list, filterStoreItems(items, kind.value, query.value), {
      selectedId: selected?.id || "",
      equippedIds: new Set(equipment.load().map((item) => item.id)),
      onSelect: selectItem
    });
  };
  selectedPanel.addEventListener("click", (event) => {
    const action = (event.target as Element | null)?.closest?.("[data-vweb-store-action]") as HTMLElement | null;
    if (!action) return;
    void equipSelected();
  });
  animationSelect.addEventListener("change", () => {
    viewer.playAnimation(animationSelect.value);
  });
  animationPlay.addEventListener("click", () => {
    const snapshot = viewer.snapshotAnimation();
    viewer.setAnimationPlaying(!snapshot.playing);
  });
  animationTime.addEventListener("pointerdown", () => {
    animationDragging = true;
  });
  animationTime.addEventListener("pointerup", () => {
    animationDragging = false;
  });
  animationTime.addEventListener("input", () => {
    viewer.setAnimationTime(Number(animationTime.value) / 1000);
  });
  kind.addEventListener("change", render);
  query.addEventListener("input", render);
  const firstEquipped = equipment.load()[0];
  const firstItem = firstEquipped ? items.find((item) => item.id === firstEquipped.id) : items[0];
  if (firstItem) selectItem(firstItem);
  render();
}

async function loadCatalogAppearance(): Promise<{ bodyColors: string[]; shirtUrl: string | null; pantsUrl: string | null; faceUrl: string | null }> {
  try {
    const response = await fetch("/api/catalog/init", {
      credentials: "include",
      cache: "no-store",
      headers: { accept: "application/json" }
    });
    if (!response.ok) return { bodyColors: [], shirtUrl: null, pantsUrl: null, faceUrl: null };
    return extractCatalogAppearance(await response.json());
  } catch {
    return { bodyColors: [], shirtUrl: null, pantsUrl: null, faceUrl: null };
  }
}

type CatalogAppearance = { bodyColors: string[]; shirtUrl: string | null; pantsUrl: string | null; faceUrl: string | null };

function emptyCatalogAppearance(): CatalogAppearance {
  return { bodyColors: [], shirtUrl: null, pantsUrl: null, faceUrl: null };
}

function extractCatalogAppearance(payload: unknown): CatalogAppearance {
  const direct = extractCatalogAppearanceFromRecord(payload);
  if (direct.shirtUrl || direct.pantsUrl || direct.faceUrl || direct.bodyColors.length) return direct;

  const equippedCandidates = collectLikelyEquippedCatalogArrays(payload);
  for (const items of equippedCandidates) {
    const fromItems = appearanceFromCatalogItems(items);
    if (fromItems.shirtUrl || fromItems.pantsUrl || fromItems.faceUrl) {
      return { ...fromItems, bodyColors: direct.bodyColors };
    }
  }

  return direct;
}

function extractCatalogAppearanceFromRecord(value: unknown): CatalogAppearance {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const bodyColors = normalizeBodyColors(record.body_colors ?? record.bodyColors ?? record.colors ?? record.bodyColours);
  return {
    bodyColors,
    shirtUrl: clothingImageUrl(record.shirt_id ?? record.shirtId ?? record.shirt),
    pantsUrl: clothingImageUrl(record.pant_id ?? record.pantId ?? record.pants_id ?? record.pantsId ?? record.pants),
    faceUrl: clothingImageUrl(record.face_id ?? record.faceId ?? record.face)
  };
}

function collectLikelyEquippedCatalogArrays(value: unknown): unknown[][] {
  const candidates: unknown[][] = [];
  const visit = (node: unknown, key = "", depth = 0): void => {
    if (depth > 5 || !node) return;
    if (Array.isArray(node)) {
      if (keyLooksEquipped(key) || containsCatalogWearables(node)) candidates.unshift(node);
      for (const child of node.slice(-4)) visit(child, key, depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    for (const [childKey, child] of Object.entries(node as Record<string, unknown>)) {
      visit(child, childKey, depth + 1);
    }
  };
  visit(value);
  return candidates;
}

function keyLooksEquipped(key: string): boolean {
  return /wear|worn|equip|avatar|current|selected/i.test(key);
}

function containsCatalogWearables(items: unknown[]): boolean {
  if (!items.length || items.length > 40) return false;
  return items.some((item) => catalogItemKind(item) !== "");
}

function appearanceFromCatalogItems(items: unknown[]): CatalogAppearance {
  const appearance = emptyCatalogAppearance();
  for (const item of items) {
    const kind = catalogItemKind(item);
    const id = catalogItemId(item);
    if (!id) continue;
    if (kind === "shirt" && !appearance.shirtUrl) appearance.shirtUrl = clothingImageUrl(id);
    if (kind === "pants" && !appearance.pantsUrl) appearance.pantsUrl = clothingImageUrl(id);
    if (kind === "face" && !appearance.faceUrl) appearance.faceUrl = clothingImageUrl(id);
  }
  return appearance;
}

function catalogItemKind(item: unknown): "shirt" | "pants" | "face" | "" {
  if (!item || typeof item !== "object") return "";
  const record = item as Record<string, unknown>;
  const text = [
    record.type,
    record.kind,
    record.category,
    record.itemType,
    record.item_type,
    record.assetType,
    record.asset_type,
    record.name,
    record.title
  ].map((part) => String(part || "").toLowerCase()).join(" ");
  if (/\bshirt\b/.test(text)) return "shirt";
  if (/\bpants?\b|\btrousers?\b/.test(text)) return "pants";
  if (/\bface\b/.test(text)) return "face";
  return "";
}

function catalogItemId(item: unknown): unknown {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  return record.id ?? record.item_id ?? record.itemId ?? record.asset_id ?? record.assetId ?? record.clothing_id ?? record.clothingId;
}

function normalizeBodyColors(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((color) => String(color || "")).filter((color) => /^#[0-9a-f]{3,8}$/i.test(color)).slice(0, 6)
    : [];
}

function clothingImageUrl(id: unknown): string | null {
  const safeId = Number(id || 0);
  return Number.isFinite(safeId) && safeId > 0 ? `/api/clothing/image/${encodeURIComponent(safeId)}` : null;
}

function renderStoreItems(target: HTMLElement, items: UgcStoreItem[], options: {
  selectedId: string;
  equippedIds: Set<string>;
  onSelect: (item: UgcStoreItem) => void;
}): void {
  target.innerHTML = items.length ? items.map((item) => `
    <article class="vweb-ugc-card vweb-ugc-store-card ${item.id === options.selectedId ? "selected" : ""}" data-vweb-store-item="${escapeAttribute(item.id)}">
      <div>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${formatKind(item.kind)}${item.slot ? ` &middot; ${escapeHtml(item.slot)}` : ""} &middot; ${escapeHtml(item.rigVersion)}</p>
        <small>${storeItemSummary(item)}</small>
      </div>
      <button type="button">${options.equippedIds.has(item.id) ? "Equipped" : "Preview"}</button>
    </article>
  `).join("") : `<p class="vweb-ugc-empty">No published assets match that filter.</p>`;
  target.querySelectorAll("[data-vweb-store-item]").forEach((card) => {
    card.addEventListener("click", () => {
      const id = (card as HTMLElement).dataset.vwebStoreItem || "";
      const item = items.find((entry) => entry.id === id);
      if (item) options.onSelect(item);
    });
  });
}

function storeItemSummary(item: UgcStoreItem): string {
  return [
    item.size ? formatBytes(item.size) : "",
    particleSummary(item)
  ].filter(Boolean).map(escapeHtml).join(" &middot; ");
}

function publicAssetLabel(item: UgcStoreItem): string {
  if (item.kind === "animation-pack") return "Animation pack";
  if (item.kind === "character-morph") return "Character morph";
  return `${item.slot || "Avatar"} accessory`;
}

function particleSummary(item: UgcStoreItem): string {
  const count = Array.isArray(item.manifest?.particles) ? item.manifest.particles.length : 0;
  return count ? `${count} particle texture${count === 1 ? "" : "s"}` : "No particles";
}

function renderStoreSelection(target: HTMLElement, item: UgcStoreItem, equipped: boolean, sync: "cloud" | "local" = "local"): void {
  target.innerHTML = `
    <div class="vweb-ugc-store-selected-main">
      <div>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${formatKind(item.kind)}${item.slot ? ` &middot; ${escapeHtml(item.slot)}` : ""} &middot; ${escapeHtml(item.rigVersion)}</p>
      </div>
      <button type="button" data-vweb-store-action>${equipped ? "Unequip" : "Equip"}</button>
    </div>
    <dl>
      <div><dt>Asset</dt><dd>${escapeHtml(publicAssetLabel(item))}</dd></div>
      <div><dt>Size</dt><dd>${formatBytes(item.size)}</dd></div>
      <div><dt>VFX</dt><dd>${escapeHtml(particleSummary(item))}</dd></div>
      <div><dt>Runtime</dt><dd>${sync === "cloud" ? "Synced for Vortex Web users." : "Saved locally until browser auth is linked."}</dd></div>
    </dl>
    <p class="vweb-ugc-status" data-vweb-store-status>Loading preview...</p>
  `;
}

function renderStoreSyncStatus(target: HTMLElement, message: string): void {
  const status = target.querySelector("[data-vweb-store-status]") as HTMLElement | null;
  if (!status) return;
  status.className = "vweb-ugc-status error";
  status.textContent = message;
}

function renderEquippedItems(target: HTMLElement, items: UgcEquippedStoreItem[], sync: "cloud" | "local" = "local"): void {
  target.innerHTML = items.length ? `
    <div class="vweb-ugc-equipped-title">Equipped ${sync === "cloud" ? "on profile" : "locally"}</div>
    <div class="vweb-ugc-equipped-list">
      ${items.map((item) => `<span title="${escapeAttribute(item.key)}">${escapeHtml(item.slot || formatKind(item.kind))}: ${escapeHtml(item.name)}</span>`).join("")}
    </div>
  ` : `
    <div class="vweb-ugc-equipped-title">Equipped ${sync === "cloud" ? "on profile" : "locally"}</div>
    <p>No Vortex Web UGC equipped yet.</p>
  `;
}

async function previewStoreItem(viewer: UgcStudioViewer, item: UgcStoreItem, panel: HTMLElement): Promise<string[]> {
  const status = panel.querySelector("[data-vweb-store-status]") as HTMLElement | null;
  if (status) {
    status.className = "vweb-ugc-status";
    status.textContent = "Loading preview...";
  }
  try {
    const manifest = item.manifest;
    viewer.applySlot(manifest?.slot || item.slot || "Hat");
    viewer.applyTransform(manifest?.transform || defaultTransform());
    const file = await storeItemFile(item);
    if (item.kind === "animation-pack") {
      viewer.clearAccessory();
      const clipNames = await viewer.loadAnimationPack(file, clipMapFromManifest(manifest?.clips));
      const playableSlots = animationSlotsForPreview(clipNames, manifest?.clips);
      const firstClip = playableSlots[0] || null;
      if (firstClip) viewer.playAnimation(firstClip);
      viewer.setParticleEmitters([defaultParticleEmitter()]);
      if (status) {
        status.className = "vweb-ugc-status ok";
        status.textContent = playableSlots.length ? `Preview loaded with ${playableSlots.length} playable clip${playableSlots.length === 1 ? "" : "s"}.` : "Preview loaded, but no playable clips were mapped.";
      }
      return playableSlots;
    } else {
      await viewer.loadAccessory(file);
      viewer.applyTransform(manifest?.transform || defaultTransform());
    }
    if (manifest?.particles?.length) {
      const particleFiles = await loadStoreParticleFiles(manifest.particles);
      viewer.setParticleEmitters(emittersFromParticleSpecs(manifest.particles, particleFiles));
    } else {
      viewer.setParticleEmitters([defaultParticleEmitter()]);
    }
    if (status) {
      status.className = "vweb-ugc-status ok";
      status.textContent = "Preview loaded.";
    }
    return [];
  } catch (error) {
    if (status) {
      status.className = "vweb-ugc-status error";
      status.textContent = `Preview failed: ${error instanceof Error ? error.message : "asset could not load"}`;
    }
    return [];
  }
}

async function storeItemFile(item: UgcStoreItem): Promise<File> {
  const response = await fetch(item.manifest?.modelUrl || item.url, { credentials: "omit", cache: "force-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  return new File([blob], item.key.split("/").pop() || `${item.id}.glb`, { type: item.contentType || blob.type || "model/gltf-binary" });
}

async function loadStoreParticleFiles(particles: UgcParticleSpec[]): Promise<Map<string, File>> {
  const files = new Map<string, File>();
  await Promise.all(particles.map(async (particle, index) => {
    if (!particle.url) return;
    const id = particle.id || `emitter-${index + 1}`;
    try {
      const response = await fetch(particle.url, { credentials: "omit", cache: "force-cache" });
      if (!response.ok) return;
      const blob = await response.blob();
      files.set(id, new File([blob], particle.fileName || `${id}.png`, { type: blob.type || "image/png" }));
    } catch {}
  }));
  return files;
}

function filterStoreItems(items: UgcStoreItem[], kind: string, query: string): UgcStoreItem[] {
  const needle = query.trim().toLowerCase();
  return items.filter((item) => {
    if (kind && item.kind !== kind) return false;
    if (!needle) return true;
    return [item.name, item.key, item.slot, item.rigVersion].some((value) => value.toLowerCase().includes(needle));
  });
}

function draftFromForm(form: HTMLFormElement, state: StudioState): UgcDraft | null {
  if (!state.file) return null;
  const formData = new FormData(form);
  const kind = normalizeKind(formData.get("kind"));
  const name = cleanText(formData.get("name"), 80) || state.file.name.replace(/\.[a-z0-9]+$/i, "");
  const slot = kind === "avatar-item" ? cleanText(formData.get("slot"), 48) || "Hat" : "";
  const identityKey = draftIdentityKey({ ownerUserId: state.ownerUserId, kind, slot, name });
  const id = `draft:${identityKey}`;
  const transform = state.viewer?.snapshotTransform() ?? readTransform(form);
  const modelFile = draftFileRef(`${id}:model`, state.file);
  const particles = (state.viewer?.snapshotParticles() ?? state.particles)
    .map((emitter) => ({
      id: emitter.id,
      name: emitter.name,
      enabled: emitter.enabled,
      kind: "file" as UgcParticleKind,
      motion: emitter.motion,
      facing: emitter.facing,
      fileId: emitter.file ? `${id}:particle:${emitter.id}` : undefined,
      fileName: emitter.file?.name || undefined,
      color: emitter.color,
      transform: emitter.transform,
      rate: emitter.rate,
      count: emitter.count,
      size: emitter.size,
      spread: emitter.spread,
      speed: emitter.speed,
      verticalSpeed: emitter.verticalSpeed,
      lifetime: emitter.lifetime,
      opacity: emitter.opacity,
      spin: emitter.spin
    }));
  const particleFiles = (state.viewer?.snapshotParticles() ?? state.particles)
    .filter((emitter) => !!emitter.file)
    .map((emitter) => ({
      emitterId: emitter.id,
      file: draftFileRef(`${id}:particle:${emitter.id}`, emitter.file as File)
    }));
  const manifest = createDraftManifest({
    id,
    name,
    kind,
    slot,
    modelUrl: modelFile.id,
    transform,
    clips: readClipMap(form, modelFile.id),
    particles,
    vfxGraph: createVfxGraphFromEmitters(state.viewer?.snapshotParticles() ?? state.particles)
  });
  return {
    schemaVersion: 1,
    id,
    identityKey,
    ownerUserId: state.ownerUserId || undefined,
    name,
    kind,
    slot,
    rigVersion: RIG_VERSION,
    fileName: state.file.name,
    modelFile,
    particleFiles,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    manifest
  };
}

function draftIdentityKey(input: { ownerUserId: number | null; kind: UgcAssetKind; slot: string; name: string }): string {
  const owner = input.ownerUserId && Number.isFinite(input.ownerUserId) ? `u${input.ownerUserId}` : "local";
  const slot = input.kind === "avatar-item" ? slugify(input.slot || "none") : "none";
  return [owner, input.kind, slot, slugify(input.name || "ugc")].join(":");
}

function draftFilesFromState(draft: UgcDraft, state: StudioState): { model: File; particles: Map<string, File> } {
  if (!state.file) throw new Error("Choose a GLB file before saving.");
  const particles = new Map<string, File>();
  for (const emitter of state.viewer?.snapshotParticles() ?? state.particles) {
    if (emitter.file && draft.particleFiles.some((particle) => particle.emitterId === emitter.id)) {
      particles.set(emitter.id, emitter.file);
    }
  }
  return { model: state.file, particles };
}

function draftWithUploadableParticles(draft: UgcDraft, files: Map<string, File>): UgcDraft {
  const particleFiles = draft.particleFiles.filter((particle) => files.has(particle.emitterId));
  const uploadableIds = new Set(particleFiles.map((particle) => particle.emitterId));
  const particles = (draft.manifest.particles || []).map((particle) => {
    if (!particle.id || !uploadableIds.has(particle.id)) {
      const { fileId: _fileId, fileName: _fileName, url: _url, ...rest } = particle;
      return { ...rest, kind: "none" as UgcParticleKind, enabled: false };
    }
    return particle;
  });
  return {
    ...draft,
    particleFiles,
    manifest: {
      ...draft.manifest,
      particles
    }
  };
}

function createDraftManifest(input: {
  id: string;
  name: string;
  kind: UgcAssetKind;
  slot: string;
  modelUrl: string;
  transform: UgcTransform;
  clips: Partial<Record<typeof ANIMATION_SLOTS[number], string>>;
  particles: UgcItemManifest["particles"];
  vfxGraph: UgcVfxGraph;
}): UgcItemManifest {
  if (input.kind === "animation-pack") {
    return {
      apiVersion: 1,
      id: input.id,
      name: input.name,
      kind: input.kind,
      rigVersion: RIG_VERSION,
      modelUrl: input.modelUrl,
      clips: input.clips
    };
  }
  if (input.kind === "character-morph") {
    return {
      apiVersion: 1,
      id: input.id,
      name: input.name,
      kind: input.kind,
    rigVersion: RIG_VERSION,
    modelUrl: input.modelUrl,
    transform: input.transform,
    particles: input.particles,
    vfxGraph: input.vfxGraph
  };
}
  return {
    apiVersion: 1,
    id: input.id,
    name: input.name,
    kind: input.kind,
    rigVersion: RIG_VERSION,
    modelUrl: input.modelUrl,
    slot: input.slot,
    attachBone: slotToBone(input.slot),
    transform: input.transform,
    particles: input.particles,
    vfxGraph: input.vfxGraph
  };
}

function unmountRoute(state: StudioState): void {
  delete document.body.dataset.vwebUgcRoute;
  delete document.documentElement.dataset.vwebUgcCamera;
  if (cameraDebugTimer) {
    window.clearInterval(cameraDebugTimer);
    cameraDebugTimer = 0;
  }
  state.inspectorPane?.dispose();
  state.inspectorPane = null;
  state.viewer?.dispose();
  state.viewer = null;
  document.getElementById(ROOT_ID)?.remove();
}

function ensureRoot(): HTMLElement {
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement("main");
    root.id = ROOT_ID;
    document.body.appendChild(root);
  }
  return root;
}

function findSiteNav(): HTMLElement | null {
  return document.querySelector(".navbar, nav, header nav") as HTMLElement | null;
}

function insertAfterCatalog(nav: HTMLElement, item: HTMLElement): void {
  const links = Array.from(nav.querySelectorAll("a"));
  const catalog = links.find((link) => (link.textContent || "").trim().toLowerCase() === "catalog");
  if (catalog) {
    catalog.insertAdjacentElement("afterend", item);
    return;
  }
  nav.appendChild(item);
}

function runtimeUrl(path: string): string {
  const api = (globalThis as { chrome?: MinimalExtensionApi }).chrome || (globalThis as { browser?: MinimalExtensionApi }).browser;
  return api?.runtime?.getURL?.(path) || `/${path.replace(/^\/+/, "")}`;
}

function isUgcRoute(pathname: string): boolean {
  return ROUTES.has(pathname.replace(/\/+$/, "") || "/vweb/ugc");
}

function normalizeUgcRouteRedirect(): void {
  try {
    const url = new URL(location.href);
    const route = url.searchParams.get("VWEBUgcRoute");
    if (!route || !isUgcRoute(route)) return;
    history.replaceState({}, "", route);
  } catch {
    // Ignore malformed URLs; normal routing still handles standard pages.
  }
}

function isGamePage(): boolean {
  try {
    const url = new URL(location.href);
    return url.searchParams.has("Play") || url.searchParams.has("VWEBLaunch");
  } catch {
    return false;
  }
}

function normalizeKind(value: FormDataEntryValue | null): UgcAssetKind {
  return value === "character-morph" || value === "animation-pack" ? value : "avatar-item";
}

function slotToBone(slot: string): string {
  if (["Hat", "Face", "Mask"].includes(slot)) return "Head";
  if (["LeftHand"].includes(slot)) return "LeftHand";
  if (["RightHand"].includes(slot)) return "RightHand";
  if (["LeftFoot"].includes(slot)) return "LeftFoot";
  if (["RightFoot"].includes(slot)) return "RightFoot";
  if (slot === "Back" || slot === "Shoulder") return "Chest";
  return "Torso";
}

function formatKind(kind: UgcAssetKind): string {
  if (kind === "character-morph") return "Character morph";
  if (kind === "animation-pack") return "Animation pack";
  return "UGC item";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readTransform(form: HTMLFormElement): UgcTransform {
  const read = (name: string, fallback: number) => Number((form.elements.namedItem(name) as HTMLInputElement | null)?.value) || fallback;
  return {
    position: [read("pos-x", 0), read("pos-y", 0), read("pos-z", 0)],
    rotation: [read("rot-x", 0), read("rot-y", 0), read("rot-z", 0)],
    scale: [read("scale-x", 1), read("scale-y", 1), read("scale-z", 1)]
  };
}

function writeTransform(form: HTMLFormElement, transform: UgcTransform): void {
  const write = (name: string, value: number) => {
    const input = form.elements.namedItem(name) as HTMLInputElement | null;
    if (input) input.value = String(value);
  };
  ["x", "y", "z"].forEach((axis, index) => {
    write(`pos-${axis}`, transform.position[index] ?? 0);
    write(`rot-${axis}`, transform.rotation[index] ?? 0);
    write(`scale-${axis}`, transform.scale[index] ?? 1);
  });
}

function writeClipMap(form: HTMLFormElement, clips: unknown): void {
  const record = clips && typeof clips === "object" ? clips as Record<string, unknown> : {};
  for (const slot of ANIMATION_SLOTS) {
    const input = form.elements.namedItem(`clip-${slot}`) as HTMLInputElement | null;
    if (!input) continue;
    const raw = String(record[slot] || "");
    input.value = raw.includes("#") ? raw.split("#").pop() || "" : raw;
  }
}

function clipMapFromManifest(clips: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const record = clips && typeof clips === "object" ? clips as Record<string, unknown> : {};
  for (const slot of ANIMATION_SLOTS) {
    const raw = String(record[slot] || "");
    const clipName = raw.includes("#") ? raw.split("#").pop() || "" : raw;
    if (clipName) out[slot] = clipName;
  }
  return out;
}

function animationSlotsForPreview(clipNames: string[], clips: unknown): string[] {
  const normalizedNames = new Set(clipNames.map(normalizeClipSlot).filter(Boolean));
  const mapped = clipMapFromManifest(clips);
  const slots: string[] = [];
  for (const slot of ANIMATION_SLOTS) {
    const mappedName = normalizeClipSlot(mapped[slot]);
    const directName = normalizeClipSlot(slot);
    if ((mappedName && normalizedNames.has(mappedName)) || normalizedNames.has(directName)) slots.push(slot);
  }
  return slots;
}

function autoFillClipMap(form: HTMLFormElement, clipNames: string[]): void {
  const bySlot = new Map<string, string>();
  for (const name of clipNames) {
    const normalized = normalizeClipSlot(name);
    if (ANIMATION_SLOTS.includes(normalized as typeof ANIMATION_SLOTS[number]) && !bySlot.has(normalized)) {
      bySlot.set(normalized, name);
    }
  }
  for (const slot of ANIMATION_SLOTS) {
    const input = form.elements.namedItem(`clip-${slot}`) as HTMLInputElement | null;
    if (!input) continue;
    input.value = bySlot.get(slot) || "";
  }
}

function normalizeClipSlot(value: unknown): string {
  return String(value || "").trim().replace(/[\s-]+/g, "_").toLowerCase();
}

function readClipMap(form: HTMLFormElement, modelUrl: string): Partial<Record<typeof ANIMATION_SLOTS[number], string>> {
  const clips: Partial<Record<typeof ANIMATION_SLOTS[number], string>> = {};
  for (const slot of ANIMATION_SLOTS) {
    const value = cleanText((form.elements.namedItem(`clip-${slot}`) as HTMLInputElement | null)?.value, 80);
    if (!value) continue;
    clips[slot] = `${modelUrl}#${value}`;
  }
  return clips;
}

function cleanParticleMotion(value: unknown): UgcParticleMotion {
  return value === "fountain" ||
    value === "orbit" ||
    value === "trail" ||
    value === "burst" ||
    value === "drift" ||
    value === "beam" ||
    value === "helix" ||
    value === "shockwave"
    ? value
    : "aura";
}

function cleanParticleFacing(value: unknown): UgcParticleFacing {
  return value === "front" || value === "ground" ? value : "billboard";
}

function createVfxGraphFromEmitters(emitters: UgcParticleEmitterState[]): UgcVfxGraph {
  const nodes: UgcVfxNode[] = [];
  const edges: UgcVfxGraph["edges"] = [];
  const enabled = emitters.filter((emitter) => emitter.enabled);
  for (const emitter of enabled) {
    const id = cleanNodeId(emitter.id || `emitter-${nodes.length + 1}`);
    const textureId = `${id}:texture`;
    const emitterId = `${id}:emitter`;
    const motionId = `${id}:motion`;
    const rendererId = `${id}:renderer`;
    const outputId = `${id}:output`;
    nodes.push(
      {
        id: textureId,
        type: "texture",
        label: emitter.file?.name || "Generated texture",
        params: {
          source: emitter.file?.name || "generated",
          color: emitter.color
        }
      },
      {
        id: emitterId,
        type: "emitter",
        label: emitter.name || id,
        params: {
          enabled: emitter.enabled,
          rate: emitter.rate,
          count: emitter.count,
          lifetime: emitter.lifetime,
          position: emitter.transform.position,
          rotation: emitter.transform.rotation,
          scale: emitter.transform.scale
        }
      },
      {
        id: motionId,
        type: "motion",
        label: emitter.motion,
        params: {
          mode: emitter.motion,
          spread: emitter.spread,
          speed: emitter.speed,
          rise: emitter.verticalSpeed,
          spin: emitter.spin
        }
      },
      {
        id: rendererId,
        type: "renderer",
        label: emitter.facing === "billboard" ? "Billboard renderer" : "Static plane renderer",
        params: {
          shape: emitter.facing === "billboard" ? "sprite" : "plane",
          facing: emitter.facing,
          size: emitter.size,
          opacity: emitter.opacity,
          blend: "alpha",
          color: emitter.color
        }
      },
      {
        id: outputId,
        type: "output",
        label: "Attachment output",
        params: {
          target: "attachment"
        }
      }
    );
    edges.push(
      { from: textureId, to: rendererId, out: "texture", in: "map" },
      { from: emitterId, to: motionId, out: "particles", in: "particles" },
      { from: motionId, to: rendererId, out: "particles", in: "particles" },
      { from: rendererId, to: outputId, out: "draw", in: "draw" }
    );
  }
  return { apiVersion: 1, nodes, edges };
}

function renderVfxGraphPreview(target: HTMLElement | null, graph: UgcVfxGraph): void {
  if (!target) return;
  const nodes = graph.nodes.slice(0, 28);
  target.innerHTML = nodes.length ? nodes.map((node) => (
    `<span class="vweb-ugc-vfx-node" data-type="${escapeAttribute(node.type)}"><strong>${escapeHtml(node.type)}</strong>${escapeHtml(node.label || node.id)}</span>`
  )).join("") : `<span class="vweb-ugc-vfx-empty">Enable an emitter to create graph nodes.</span>`;
}

function normalizeVfxGraph(value: unknown): UgcVfxGraph {
  if (!value || typeof value !== "object") throw new Error("Vortex Web VFX data must be a JSON object.");
  const input = value as Partial<UgcVfxGraph>;
  if (input.apiVersion !== 1) throw new Error("Unsupported Vortex Web VFX data version.");
  const nodes = Array.isArray(input.nodes) ? input.nodes : [];
  const edges = Array.isArray(input.edges) ? input.edges : [];
  return {
    apiVersion: 1,
    nodes: nodes.map((node) => ({
      id: cleanNodeId(node?.id),
      type: cleanNodeType(node?.type),
      label: cleanText(node?.label, 80),
      params: sanitizeVfxParams(node?.params)
    })).filter((node) => node.id),
    edges: edges.map((edge) => ({
      from: cleanNodeId(edge?.from),
      to: cleanNodeId(edge?.to),
      out: cleanText(edge?.out, 40) || undefined,
      in: cleanText(edge?.in, 40) || undefined
    })).filter((edge) => edge.from && edge.to)
  };
}

function emittersFromVfxGraph(graph: UgcVfxGraph, previous: UgcParticleEmitterState[]): UgcParticleEmitterState[] {
  const previousById = new Map(previous.map((emitter) => [emitter.id, emitter]));
  const emitters = graph.nodes.filter((node) => node.type === "emitter");
  return emitters.map((node, index) => {
    const baseId = cleanNodeId(node.id.replace(/:emitter$/, "")) || `emitter-${index + 1}`;
    const motionNode = findConnectedNode(graph, node.id, "motion") || graph.nodes.find((candidate) => candidate.id === `${baseId}:motion`);
    const rendererNode = findConnectedNode(graph, motionNode?.id || node.id, "renderer") || graph.nodes.find((candidate) => candidate.id === `${baseId}:renderer`);
    const textureNode = graph.edges
      .filter((edge) => edge.to === rendererNode?.id)
      .map((edge) => graph.nodes.find((candidate) => candidate.id === edge.from && candidate.type === "texture"))
      .find(Boolean) || graph.nodes.find((candidate) => candidate.id === `${baseId}:texture`);
    const previousEmitter = previousById.get(baseId);
    return {
      ...defaultParticleEmitter(baseId),
      ...previousEmitter,
      id: baseId,
      name: cleanText(node.label, 48) || previousEmitter?.name || `Emitter ${index + 1}`,
      enabled: paramBool(node.params?.enabled, true),
      kind: "file" as UgcParticleKind,
      motion: cleanParticleMotion(motionNode?.params?.mode),
      facing: cleanParticleFacing(rendererNode?.params?.facing || previousEmitter?.facing),
      file: previousEmitter?.file || null,
      color: cleanText(rendererNode?.params?.color || textureNode?.params?.color || previousEmitter?.color, 20) || "#8bd3ff",
      transform: {
        position: paramVec3(node.params?.position, previousEmitter?.transform.position || [0, 0, 0]),
        rotation: paramVec3(node.params?.rotation, previousEmitter?.transform.rotation || [0, 0, 0]),
        scale: paramVec3(node.params?.scale, previousEmitter?.transform.scale || [1, 1, 1])
      },
      rate: paramNumber(node.params?.rate, previousEmitter?.rate ?? 18),
      count: Math.round(paramNumber(node.params?.count, previousEmitter?.count ?? 24)),
      lifetime: paramNumber(node.params?.lifetime, previousEmitter?.lifetime ?? 1.8),
      spread: paramNumber(motionNode?.params?.spread, previousEmitter?.spread ?? 0.58),
      speed: paramNumber(motionNode?.params?.speed, previousEmitter?.speed ?? 0.28),
      verticalSpeed: paramNumber(motionNode?.params?.rise, previousEmitter?.verticalSpeed ?? 0.22),
      spin: paramNumber(motionNode?.params?.spin, previousEmitter?.spin ?? 0.8),
      size: paramNumber(rendererNode?.params?.size, previousEmitter?.size ?? 0.08),
      opacity: paramNumber(rendererNode?.params?.opacity, previousEmitter?.opacity ?? 0.86)
    };
  });
}

function emittersFromParticleSpecs(specs: UgcParticleSpec[], files = new Map<string, File>()): UgcParticleEmitterState[] {
  const emitters = specs.map((spec, index) => {
    const id = cleanNodeId(spec.id) || `emitter-${index + 1}`;
    return {
      ...defaultParticleEmitter(id),
      id,
      name: cleanText(spec.name, 48) || `Emitter ${index + 1}`,
      enabled: spec.enabled !== false,
      kind: "file" as UgcParticleKind,
      motion: cleanParticleMotion(spec.motion),
      facing: cleanParticleFacing(spec.facing),
      file: files.get(id) || null,
      color: cleanText(spec.color, 20) || "#8bd3ff",
      transform: {
        position: paramVec3(spec.transform?.position, [0, 0, 0]),
        rotation: paramVec3(spec.transform?.rotation, [0, 0, 0]),
        scale: paramVec3(spec.transform?.scale, [1, 1, 1])
      },
      rate: paramNumber(spec.rate, 18),
      count: Math.round(paramNumber(spec.count, 24)),
      size: paramNumber(spec.size, 0.08),
      spread: paramNumber(spec.spread, 0.58),
      speed: paramNumber(spec.speed, 0.28),
      verticalSpeed: paramNumber(spec.verticalSpeed, 0.22),
      lifetime: paramNumber(spec.lifetime, 1.8),
      opacity: paramNumber(spec.opacity, 0.86),
      spin: paramNumber(spec.spin, 0.8)
    };
  });
  return emitters.length ? emitters : [defaultParticleEmitter()];
}

function findConnectedNode(graph: UgcVfxGraph, from: string, type: UgcVfxNode["type"]): UgcVfxNode | undefined {
  return graph.edges
    .filter((edge) => edge.from === from)
    .map((edge) => graph.nodes.find((node) => node.id === edge.to && node.type === type))
    .find(Boolean);
}

function sanitizeVfxParams(params: unknown): UgcVfxNode["params"] {
  if (!params || typeof params !== "object") return {};
  const output: UgcVfxNode["params"] = {};
  for (const [key, value] of Object.entries(params as Record<string, unknown>).slice(0, 64)) {
    const safeKey = cleanText(key, 48);
    if (!safeKey) continue;
    if (typeof value === "string") output[safeKey] = cleanText(value, 256);
    else if (typeof value === "number" && Number.isFinite(value)) output[safeKey] = value;
    else if (typeof value === "boolean") output[safeKey] = value;
    else if (Array.isArray(value)) output[safeKey] = value.slice(0, 4).map((entry) => Number(entry) || 0);
    else if (value === null) output[safeKey] = null;
  }
  return output;
}

function cleanNodeId(value: unknown): string {
  return cleanText(value, 96).replace(/[^a-zA-Z0-9:_-]/g, "-");
}

function cleanNodeType(value: unknown): UgcVfxNode["type"] {
  return value === "texture" || value === "emitter" || value === "motion" || value === "renderer" || value === "output" ? value : "emitter";
}

function paramNumber(value: unknown, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function paramBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function paramVec3(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(value)) return fallback;
  return [
    Number(value[0]) || fallback[0],
    Number(value[1]) || fallback[1],
    Number(value[2]) || fallback[2]
  ];
}

function activeEmitter(state: StudioState): UgcParticleEmitterState | null {
  return state.particles.find((emitter) => emitter.id === state.activeParticleId) || state.particles[0] || null;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "ugc";
}

function cleanText(value: unknown, max: number): string {
  return String(value || "").trim().replace(/[^\x20-\x7e]/g, "").slice(0, max);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: unknown): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function exposeStudioDebug(state: StudioState): void {
  injectStudioDebugBridge();
  const sync = () => {
    const camera = state.viewer?.snapshotCamera?.() ?? null;
    document.documentElement.dataset.vwebUgcCamera = JSON.stringify(camera);
  };
  sync();
  if (cameraDebugTimer) window.clearInterval(cameraDebugTimer);
  cameraDebugTimer = window.setInterval(sync, 200);
}

function injectStudioDebugBridge(): void {
  if (document.getElementById(DEBUG_BRIDGE_ID)) return;
  const script = document.createElement("script");
  script.id = DEBUG_BRIDGE_ID;
  script.src = runtimeUrl("extension/page-world/ugc-studio-bridge.js");
  (document.head || document.documentElement).appendChild(script);
}

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .vweb-ugc-nav {
      position: relative;
      display: inline-flex;
      align-items: center;
      padding: 8px 0;
      margin: -8px 0;
      font: inherit;
    }
    .vweb-ugc-nav,
    .vweb-ugc-nav * {
      font-family: inherit !important;
    }
    .vweb-ugc-nav-main {
      cursor: pointer;
      color: var(--vweb-ugc-nav-text, inherit) !important;
      text-decoration: none !important;
      background: transparent !important;
      box-shadow: none !important;
      font: inherit !important;
      line-height: inherit !important;
    }
    .vweb-ugc-nav-menu {
      position: absolute;
      top: 100%;
      left: 0;
      min-width: 170px;
      padding: 8px;
      border: 1px solid rgba(148, 163, 184, .25);
      border-radius: 12px;
      background: var(--vweb-ugc-nav-menu, rgba(15, 23, 42, .92));
      box-shadow: var(--vweb-ugc-shadow, 0 18px 40px rgba(2, 6, 23, .22));
      display: none;
      z-index: 2147483600;
    }
    .vweb-ugc-nav:hover .vweb-ugc-nav-menu,
    .vweb-ugc-nav:focus-within .vweb-ugc-nav-menu { display: grid; gap: 4px; }
    .vweb-ugc-nav-menu a { color: var(--vweb-ugc-nav-menu-text, #f8fafc) !important; text-decoration: none; padding: 9px 10px; border-radius: 8px; }
    .vweb-ugc-nav-menu a:hover { background: var(--vweb-ugc-nav-menu-hover, rgba(96, 165, 250, .18)); }
    body[data-vweb-ugc-route="1"] {
      --vweb-ugc-bg: #0b121a;
      --vweb-ugc-bg-soft: rgba(12, 18, 27, .96);
      --vweb-ugc-panel: rgba(12, 18, 27, .96);
      --vweb-ugc-panel-strong: rgba(18, 29, 42, .92);
      --vweb-ugc-panel-soft: rgba(15, 23, 42, .42);
      --vweb-ugc-input: rgba(2, 6, 23, .36);
      --vweb-ugc-border: rgba(148, 163, 184, .24);
      --vweb-ugc-border-soft: rgba(100, 116, 139, .18);
      --vweb-ugc-text: #e7eef8;
      --vweb-ugc-heading: #f8fafc;
      --vweb-ugc-muted: rgba(203, 213, 225, .72);
      --vweb-ugc-faint: rgba(148, 163, 184, .86);
      --vweb-ugc-accent: #60a5fa;
      --vweb-ugc-accent-soft: rgba(59, 130, 246, .26);
      --vweb-ugc-button: rgba(30, 41, 59, .72);
      --vweb-ugc-button-hover: rgba(51, 65, 85, .82);
      --vweb-ugc-canvas-bg: #07111d;
      --vweb-ugc-action-bar: linear-gradient(180deg, rgba(12, 18, 27, .62), rgba(12, 18, 27, .98) 38%);
      --vweb-ugc-control-bg: rgba(3, 7, 12, .72);
      --vweb-ugc-shadow: 0 18px 44px rgba(0, 0, 0, .24);
      --vweb-ugc-nav-menu: rgba(15, 23, 42, .92);
      --vweb-ugc-nav-menu-text: #f8fafc;
      --vweb-ugc-nav-menu-hover: rgba(96, 165, 250, .18);
      color-scheme: dark;
      background: var(--vweb-ugc-bg) !important;
      color: var(--vweb-ugc-text) !important;
    }
    html[theme='light'] body[data-vweb-ugc-route="1"] {
      --vweb-ugc-bg: #f8fafc;
      --vweb-ugc-panel: rgba(255, 255, 255, 0.94);
      --vweb-ugc-panel-strong: rgba(255, 255, 255, 0.98);
      --vweb-ugc-panel-soft: rgba(241, 245, 249, 0.82);
      --vweb-ugc-input: rgba(226, 232, 240, 0.72);
      --vweb-ugc-border: rgba(15, 23, 42, 0.14);
      --vweb-ugc-border-soft: rgba(15, 23, 42, 0.09);
      --vweb-ugc-text: #111827;
      --vweb-ugc-heading: #0f172a;
      --vweb-ugc-muted: rgba(17, 24, 39, 0.62);
      --vweb-ugc-faint: rgba(17, 24, 39, 0.50);
      --vweb-ugc-accent: #2563eb;
      --vweb-ugc-accent-soft: rgba(37, 99, 235, 0.16);
      --vweb-ugc-button: rgba(226, 232, 240, 0.82);
      --vweb-ugc-button-hover: rgba(203, 213, 225, 0.95);
      --vweb-ugc-canvas-bg: #07111d;
      --vweb-ugc-action-bar: linear-gradient(180deg, rgba(255, 255, 255, .58), rgba(255, 255, 255, .98) 38%);
      --vweb-ugc-control-bg: rgba(255, 255, 255, .72);
      --vweb-ugc-shadow: 0 18px 44px rgba(15, 23, 42, .12);
      --vweb-ugc-nav-menu: rgba(255, 255, 255, .97);
      --vweb-ugc-nav-menu-text: #0f172a;
      --vweb-ugc-nav-menu-hover: rgba(37, 99, 235, .10);
      color-scheme: light;
    }
    body[data-vweb-ugc-route="1"] > pre:first-child {
      display: none !important;
    }
    body[data-vweb-ugc-route="1"] footer {
      display: none !important;
    }
    body[data-vweb-ugc-route="1"] #vweb-ugc-root {
      box-sizing: border-box;
      width: min(1480px, calc(100vw - 32px));
      max-width: none;
      margin: 20px auto;
      padding: 0 0 48px;
      color: var(--vweb-ugc-text);
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body[data-vweb-ugc-route="1"] #vweb-ugc-root *,
    body[data-vweb-ugc-route="1"] #vweb-ugc-root *::before,
    body[data-vweb-ugc-route="1"] #vweb-ugc-root *::after {
      box-sizing: border-box;
    }
    body[data-vweb-ugc-route="1"] #vweb-ugc-root [hidden] {
      display: none !important;
    }
    body[data-vweb-ugc-route="1"] main:not(#vweb-ugc-root),
    body[data-vweb-ugc-route="1"] #page,
    body[data-vweb-ugc-route="1"] .page:not(#vweb-ugc-root),
    body[data-vweb-ugc-route="1"] .content {
      display: none !important;
    }
    .vweb-ugc-shell { display: grid; gap: 14px; }
    .vweb-ugc-hero,
    .vweb-ugc-panel {
      border: 1px solid rgba(148, 163, 184, .22);
      background: rgba(18, 29, 42, .92);
      box-shadow: 0 18px 44px rgba(0, 0, 0, .24);
      backdrop-filter: blur(14px);
      border-radius: 14px;
    }
    .vweb-ugc-hero { display: flex; justify-content: space-between; gap: 18px; align-items: center; padding: 18px 20px; }
    .vweb-ugc-hero h1, .vweb-ugc-panel h2, .vweb-ugc-card h3 { margin: 0; color: #f8fafc; }
    .vweb-ugc-hero h1 { font-size: 26px; line-height: 1.1; }
    .vweb-ugc-hero p, .vweb-ugc-panel p, .vweb-ugc-card p, .vweb-ugc-card small { color: rgba(226, 232, 240, .76); }
    .vweb-ugc-hero p { margin: 4px 0 0; }
    .vweb-ugc-tabs { display: inline-flex; gap: 6px; padding: 4px; border-radius: 12px; background: rgba(8, 13, 20, .48); }
    .vweb-ugc-tabs a,
    .vweb-ugc-actions button,
    .vweb-ugc-card button,
    .vweb-ugc-card a {
      border: 1px solid rgba(148, 163, 184, .22);
      border-radius: 9px;
      background: rgba(255, 255, 255, .08);
      color: #f8fafc !important;
      padding: 9px 12px;
      text-decoration: none;
      cursor: pointer;
      font: inherit;
      font-weight: 750;
    }
    .vweb-ugc-actions button:disabled { opacity: .55; cursor: wait; }
    .vweb-ugc-tabs a.active,
    .vweb-ugc-actions button:first-child { background: rgba(59, 130, 246, .36); border-color: rgba(147, 197, 253, .45); }
    .vweb-ugc-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, .8fr); gap: 14px; }
    .vweb-ugc-studio { display: grid; grid-template-columns: minmax(620px, 1fr) minmax(340px, 430px); gap: 14px; align-items: start; }
    .vweb-ugc-inspector { min-width: 0; }
    .vweb-ugc-editor { min-height: 680px; display: grid; grid-template-rows: auto minmax(0, 1fr); }
    .vweb-ugc-editor-stage { min-height: 600px; position: relative; overflow: hidden; border-radius: 12px; border: 1px solid rgba(148, 163, 184, .18); background: #0d1722; }
    .vweb-ugc-viewport { position: absolute; inset: 0; }
    .vweb-ugc-canvas { width: 100% !important; height: 100% !important; display: block; cursor: grab; }
    .vweb-ugc-canvas:active { cursor: grabbing; }
    .vweb-ugc-viewport-toolbar {
      position: absolute;
      left: 14px;
      right: 14px;
      bottom: 14px;
      display: grid;
      grid-template-columns: auto auto auto minmax(0, 1fr);
      gap: 10px;
      pointer-events: none;
      align-items: center;
    }
    .vweb-ugc-viewport-toolbar button,
    .vweb-ugc-viewport-toolbar select {
      pointer-events: auto;
      border: 1px solid rgba(226, 232, 240, .22);
      background: rgba(10, 18, 28, .72);
      color: #f8fafc;
      border-radius: 10px;
      min-height: 38px;
      padding: 8px 10px;
    }
    .vweb-ugc-tool-modes,
    .vweb-ugc-target-modes {
      pointer-events: auto;
      display: inline-flex;
      gap: 4px;
      padding: 4px;
      border: 1px solid rgba(226, 232, 240, .16);
      border-radius: 12px;
      background: rgba(10, 18, 28, .62);
      backdrop-filter: blur(10px);
    }
    .vweb-ugc-tool-modes button.active,
    .vweb-ugc-target-modes button.active {
      background: rgba(96, 165, 250, .34);
      border-color: rgba(147, 197, 253, .45);
    }
    .vweb-ugc-animation-controls {
      pointer-events: auto;
      display: grid;
      grid-template-columns: minmax(160px, 220px) auto minmax(160px, 1fr) auto;
      gap: 8px;
      align-items: center;
      min-width: 0;
      padding: 8px;
      border: 1px solid rgba(226, 232, 240, .16);
      border-radius: 12px;
      background: rgba(10, 18, 28, .62);
      backdrop-filter: blur(10px);
    }
    .vweb-ugc-animation-controls input[type="range"] {
      min-width: 0;
      accent-color: #60a5fa;
    }
    .vweb-ugc-animation-controls span {
      color: rgba(226, 232, 240, .84);
      font-size: 12px;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .vweb-ugc-panel { padding: 16px; }
    .vweb-ugc-panel-head { margin-bottom: 12px; }
    .vweb-ugc-panel-head h2 { font-size: 18px; line-height: 1.1; }
    .vweb-ugc-panel-head p { margin: 6px 0 0; }
    .vweb-ugc-studio-form { display: grid; gap: 12px; max-height: calc(100vh - 150px); overflow: auto; }
    .vweb-ugc-studio-form label { display: grid; gap: 6px; min-width: 0; color: #f8fafc; font-weight: 700; }
    .vweb-ugc-studio-form label span,
    .vweb-ugc-clip-list label span {
      color: rgba(226, 232, 240, .76);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .vweb-ugc-studio-form input,
    .vweb-ugc-studio-form select,
    .vweb-ugc-filters input,
    .vweb-ugc-filters select {
      width: 100%;
      min-width: 0;
      min-height: 39px;
      border: 1px solid rgba(148, 163, 184, .26);
      border-radius: 9px;
      background: rgba(8, 13, 20, .42);
      color: #f8fafc;
      padding: 8px 12px;
      font: inherit;
    }
    .vweb-ugc-studio-form input[type="color"] { padding: 3px; }
    .vweb-ugc-kind-note {
      border: 1px solid rgba(96, 165, 250, .18);
      border-radius: 10px;
      background: rgba(37, 99, 235, .12);
      color: rgba(219, 234, 254, .88);
      padding: 10px 12px;
      font-size: 13px;
      line-height: 1.35;
    }
    .vweb-ugc-actions, .vweb-ugc-filters { display: flex; gap: 10px; flex-wrap: wrap; }
    .vweb-ugc-actions button { flex: 1 1 150px; }
    .vweb-ugc-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .vweb-ugc-emitter-bar { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 10px; align-items: end; margin-bottom: 10px; }
    .vweb-ugc-emitter-bar button { min-height: 42px; }
    .vweb-ugc-form-section { display: grid; gap: 10px; padding-top: 2px; }
    .vweb-ugc-transform-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .vweb-ugc-clip-list { display: grid; gap: 8px; }
    .vweb-ugc-clip-list label { grid-template-columns: 96px minmax(0, 1fr); align-items: center; }
    .vweb-ugc-section-title { color: #dce8f7; font-size: 12px; font-weight: 850; text-transform: uppercase; letter-spacing: .06em; }
    .vweb-ugc-metadata { display: grid; gap: 8px; padding: 10px; border: 1px solid rgba(148, 163, 184, .16); border-radius: 10px; background: rgba(8, 13, 20, .24); }
    .vweb-ugc-metadata div { display: flex; justify-content: space-between; gap: 12px; color: rgba(226, 232, 240, .78); }
    .vweb-ugc-metadata span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .vweb-ugc-metadata strong { color: #f8fafc; }
    .vweb-ugc-drafts, .vweb-ugc-store-list { display: grid; gap: 10px; }
    .vweb-ugc-card { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px; border: 1px solid rgba(148, 163, 184, .16); border-radius: 12px; background: rgba(8, 13, 20, .3); }
    .vweb-ugc-card p, .vweb-ugc-card small { margin: 5px 0 0; display: block; }
    .vweb-ugc-store { display: grid; grid-template-columns: minmax(560px, 1fr) minmax(360px, 500px); gap: 14px; align-items: start; }
    .vweb-ugc-store-preview { position: sticky; top: 12px; display: grid; grid-template-rows: auto minmax(420px, calc(100vh - 360px)) auto; gap: 12px; }
    .vweb-ugc-store-stage { min-height: 420px; border: 1px solid rgba(59, 130, 246, .2); border-radius: 10px; overflow: hidden; background: #07111d; }
    .vweb-ugc-store-animation {
      display: grid;
      gap: 8px;
      padding: 10px;
      border: 1px solid rgba(96, 165, 250, .2);
      border-radius: 10px;
      background: rgba(8, 13, 20, .36);
    }
    .vweb-ugc-store-animation[hidden] { display: none; }
    .vweb-ugc-store-animation-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      color: var(--vweb-ugc-heading);
    }
    .vweb-ugc-store-animation-head strong {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: .05em;
    }
    .vweb-ugc-store-animation-head span {
      color: var(--vweb-ugc-muted);
      font-size: 12px;
    }
    .vweb-ugc-store-selected { display: grid; gap: 10px; padding: 12px; border: 1px solid rgba(100, 116, 139, .22); border-radius: 10px; background: rgba(15, 23, 42, .38); }
    .vweb-ugc-store-selected h3 { margin: 0; color: var(--vweb-ugc-heading); }
    .vweb-ugc-store-selected p { margin: 0; }
    .vweb-ugc-store-selected-main { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
    .vweb-ugc-store-selected-main button,
    .vweb-ugc-store-card button {
      border: 1px solid rgba(148, 163, 184, .22);
      border-radius: 9px;
      background: rgba(59, 130, 246, .24);
      color: var(--vweb-ugc-heading);
      padding: 9px 12px;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
      white-space: nowrap;
    }
    .vweb-ugc-store-selected dl { display: grid; gap: 6px; margin: 0; }
    .vweb-ugc-store-selected dl div { display: grid; grid-template-columns: 80px minmax(0, 1fr); gap: 10px; }
    .vweb-ugc-store-selected dt { color: var(--vweb-ugc-faint); font-size: 12px; font-weight: 800; text-transform: uppercase; }
    .vweb-ugc-store-selected dd { margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--vweb-ugc-text); }
    .vweb-ugc-equipped { display: grid; gap: 8px; margin: 10px 0; padding: 10px; border: 1px solid rgba(100, 116, 139, .18); border-radius: 10px; background: rgba(15, 23, 42, .3); }
    .vweb-ugc-equipped-title { color: var(--vweb-ugc-faint); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .07em; }
    .vweb-ugc-equipped p { margin: 0; color: var(--vweb-ugc-muted); }
    .vweb-ugc-equipped-list { display: flex; gap: 7px; flex-wrap: wrap; }
    .vweb-ugc-equipped-list span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; padding: 6px 8px; border-radius: 999px; background: rgba(96, 165, 250, .16); color: var(--vweb-ugc-text); font-size: 12px; }
    .vweb-ugc-store-card { cursor: pointer; transition: border-color .14s ease, background .14s ease, transform .14s ease; }
    .vweb-ugc-store-card:hover { transform: translateY(-1px); border-color: rgba(96, 165, 250, .42); background: rgba(30, 41, 59, .46); }
    .vweb-ugc-store-card.selected { border-color: rgba(96, 165, 250, .68); background: rgba(37, 99, 235, .18); }
    .vweb-ugc-empty { margin: 0; padding: 16px; border-radius: 12px; background: rgba(8, 13, 20, .3); }
    .vweb-ugc-status { min-height: 20px; margin: 0; }
    .vweb-ugc-status.ok { color: #86efac; }
    .vweb-ugc-status.error { color: #fca5a5; }

    body[data-vweb-ugc-route="1"] #vweb-ugc-root {
      width: min(1560px, calc(100vw - 24px));
      margin-top: 12px;
    }
    .vweb-ugc-shell {
      gap: 10px;
    }
    .vweb-ugc-hero {
      min-height: 54px;
      padding: 10px 12px;
      border-radius: 10px;
      background: linear-gradient(180deg, rgba(22, 31, 43, .98), rgba(12, 18, 27, .98));
      box-shadow: inset 0 -1px 0 rgba(255, 255, 255, .04);
    }
    .vweb-ugc-hero h1 {
      font-size: 18px;
      letter-spacing: 0;
    }
    .vweb-ugc-hero p {
      margin-top: 2px;
      font-size: 12px;
      color: rgba(203, 213, 225, .68);
    }
    .vweb-ugc-tabs {
      border: 1px solid rgba(148, 163, 184, .16);
      border-radius: 9px;
      background: rgba(3, 7, 12, .42);
    }
    .vweb-ugc-tabs a {
      min-width: 82px;
      padding: 7px 10px;
      border-radius: 7px;
      text-align: center;
      font-size: 13px;
    }
    .vweb-ugc-studio {
      grid-template-columns: minmax(680px, 1fr) minmax(360px, 420px);
      gap: 10px;
    }
    .vweb-ugc-panel {
      border-radius: 10px;
      background: rgba(12, 18, 27, .96);
      border-color: rgba(100, 116, 139, .22);
      box-shadow: none;
    }
    .vweb-ugc-panel-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: baseline;
      margin: -2px 0 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(100, 116, 139, .16);
    }
    .vweb-ugc-panel-head h2 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: .055em;
      color: #dbeafe;
    }
    .vweb-ugc-panel-head p {
      max-width: 520px;
      margin: 0;
      font-size: 12px;
      text-align: right;
      color: rgba(148, 163, 184, .8);
    }
    .vweb-ugc-editor {
      min-height: calc(100vh - 118px);
      padding: 10px;
    }
    .vweb-ugc-editor-stage {
      min-height: calc(100vh - 188px);
      border-radius: 8px;
      border-color: rgba(59, 130, 246, .2);
      background:
        radial-gradient(circle at 50% 40%, rgba(30, 64, 175, .22), transparent 38%),
        #07111d;
    }
    .vweb-ugc-inspector {
      position: sticky;
      top: 10px;
    }
    .vweb-ugc-studio-form {
      max-height: calc(100vh - 84px);
      padding: 10px;
      gap: 8px;
      scrollbar-color: rgba(148, 163, 184, .5) rgba(15, 23, 42, .42);
    }
    .vweb-ugc-studio-form::-webkit-scrollbar { width: 10px; }
    .vweb-ugc-studio-form::-webkit-scrollbar-track { background: rgba(15, 23, 42, .35); }
    .vweb-ugc-studio-form::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, .45); border-radius: 999px; border: 2px solid rgba(15, 23, 42, .35); }
    .vweb-ugc-field,
    .vweb-ugc-clip-list label {
      padding: 8px;
      border: 1px solid rgba(100, 116, 139, .18);
      border-radius: 8px;
      background: rgba(15, 23, 42, .42);
    }
    .vweb-ugc-studio-form label {
      gap: 5px;
      font-size: 13px;
    }
    .vweb-ugc-studio-form label span,
    .vweb-ugc-clip-list label span {
      font-size: 10px;
      letter-spacing: .08em;
      color: rgba(148, 163, 184, .9);
    }
    .vweb-ugc-studio-form input,
    .vweb-ugc-studio-form select,
    .vweb-ugc-filters input,
    .vweb-ugc-filters select {
      min-height: 34px;
      border-radius: 7px;
      border-color: rgba(71, 85, 105, .72);
      background: rgba(2, 6, 23, .36);
      color: #e5edf8;
      padding: 6px 8px;
      font-size: 13px;
      outline: none;
    }
    .vweb-ugc-studio-form input:focus,
    .vweb-ugc-studio-form select:focus {
      border-color: rgba(96, 165, 250, .82);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, .2);
    }
    .vweb-ugc-studio-form input[type="file"] {
      padding: 5px;
      color: rgba(226, 232, 240, .78);
    }
    .vweb-ugc-studio-form input[type="file"]::file-selector-button {
      margin-right: 8px;
      border: 1px solid rgba(148, 163, 184, .28);
      border-radius: 6px;
      background: rgba(30, 41, 59, .92);
      color: #f8fafc;
      padding: 5px 9px;
      font: inherit;
      cursor: pointer;
    }
    .vweb-ugc-kind-note {
      padding: 8px 10px;
      border-radius: 8px;
      font-size: 12px;
      background: rgba(30, 64, 175, .12);
    }
    .vweb-ugc-form-section {
      gap: 8px;
      padding: 10px;
      border: 1px solid rgba(100, 116, 139, .18);
      border-radius: 9px;
      background: rgba(5, 10, 18, .22);
    }
    .vweb-ugc-section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #bfdbfe;
      font-size: 11px;
      letter-spacing: .08em;
    }
    .vweb-ugc-section-title::after {
      content: "";
      height: 1px;
      flex: 1;
      background: rgba(100, 116, 139, .22);
    }
    .vweb-ugc-transform-grid {
      gap: 6px;
    }
    .vweb-ugc-form-grid {
      gap: 8px;
    }
    .vweb-ugc-emitter-bar {
      gap: 8px;
      margin-bottom: 2px;
    }
    .vweb-ugc-emitter-bar button,
    .vweb-ugc-actions button,
    .vweb-ugc-viewport-toolbar button,
    .vweb-ugc-viewport-toolbar select,
    .vweb-ugc-card button,
    .vweb-ugc-card a {
      border-radius: 7px;
      background: rgba(30, 41, 59, .72);
      border-color: rgba(148, 163, 184, .24);
      color: #eaf2ff !important;
      transition: background .14s ease, border-color .14s ease, transform .14s ease;
    }
    .vweb-ugc-emitter-bar button:hover,
    .vweb-ugc-actions button:hover,
    .vweb-ugc-viewport-toolbar button:hover,
    .vweb-ugc-card button:hover,
    .vweb-ugc-card a:hover {
      background: rgba(51, 65, 85, .82);
      border-color: rgba(147, 197, 253, .42);
    }
    .vweb-ugc-actions {
      position: sticky;
      bottom: -10px;
      z-index: 5;
      margin: 0 -10px -10px;
      padding: 10px;
      background: linear-gradient(180deg, rgba(12, 18, 27, .62), rgba(12, 18, 27, .98) 38%);
      border-top: 1px solid rgba(100, 116, 139, .16);
    }
    .vweb-ugc-actions button {
      flex: 1 1 130px;
      min-height: 36px;
      font-size: 12px;
    }
    .vweb-ugc-actions button:first-child {
      background: rgba(37, 99, 235, .7);
      border-color: rgba(147, 197, 253, .44);
    }
    .vweb-ugc-status {
      min-height: 18px;
      padding: 0 2px;
      font-size: 12px;
      color: rgba(203, 213, 225, .72);
    }
    .vweb-ugc-metadata {
      padding: 8px;
      border-radius: 8px;
      font-size: 12px;
      background: rgba(2, 6, 23, .28);
    }
    .vweb-ugc-viewport-toolbar {
      grid-template-columns: auto auto auto minmax(240px, 1fr);
      gap: 8px;
      left: 10px;
      right: 10px;
      bottom: 10px;
    }
    .vweb-ugc-tool-modes,
    .vweb-ugc-target-modes,
    .vweb-ugc-animation-controls {
      border-radius: 9px;
      background: rgba(3, 7, 12, .72);
      border-color: rgba(148, 163, 184, .16);
    }
    .vweb-ugc-animation-controls {
      padding: 5px;
      grid-template-columns: minmax(130px, 190px) auto minmax(120px, 1fr) auto;
    }
    .vweb-ugc-tool-modes button.active,
    .vweb-ugc-target-modes button.active {
      background: rgba(37, 99, 235, .72);
    }
    .vweb-ugc-card,
    .vweb-ugc-empty {
      border-radius: 9px;
      background: rgba(8, 13, 20, .42);
    }
    .vweb-ugc-vfx-graph {
      display: grid;
      gap: 8px;
      grid-column: 1 / -1;
      padding: 10px;
      border: 1px solid rgba(96, 165, 250, .16);
      border-radius: 9px;
      background:
        linear-gradient(135deg, rgba(37, 99, 235, .08), transparent 48%),
        rgba(2, 6, 23, .28);
    }
    .vweb-ugc-vfx-nodes {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-height: 32px;
      align-items: center;
    }
    .vweb-ugc-vfx-node,
    .vweb-ugc-vfx-empty {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      max-width: 100%;
      min-height: 28px;
      padding: 5px 8px;
      border: 1px solid rgba(148, 163, 184, .18);
      border-radius: 999px;
      background: rgba(15, 23, 42, .62);
      color: rgba(226, 232, 240, .82);
      font-size: 11px;
      white-space: nowrap;
    }
    .vweb-ugc-vfx-node strong {
      color: #93c5fd;
      text-transform: uppercase;
      font-size: 9px;
      letter-spacing: .08em;
    }
    .vweb-ugc-vfx-node[data-type="emitter"] strong { color: #86efac; }
    .vweb-ugc-vfx-node[data-type="motion"] strong { color: #fbbf24; }
    .vweb-ugc-vfx-node[data-type="renderer"] strong { color: #f0abfc; }
    .vweb-ugc-vfx-actions {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: end;
    }
    .vweb-ugc-backing-fields {
      display: none !important;
    }
    body[data-vweb-ugc-route="1"] #vweb-ugc-root {
      color: var(--vweb-ugc-text);
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-hero,
    body[data-vweb-ugc-route="1"] .vweb-ugc-panel {
      background: var(--vweb-ugc-panel);
      border-color: var(--vweb-ugc-border);
      box-shadow: var(--vweb-ugc-shadow);
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-hero {
      background: var(--vweb-ugc-panel-strong);
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-editor-stage {
      background: var(--vweb-ugc-canvas-bg);
      border-color: var(--vweb-ugc-border);
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-hero h1,
    body[data-vweb-ugc-route="1"] .vweb-ugc-panel h2,
    body[data-vweb-ugc-route="1"] .vweb-ugc-card h3,
    body[data-vweb-ugc-route="1"] .vweb-ugc-metadata strong {
      color: var(--vweb-ugc-heading);
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-hero p,
    body[data-vweb-ugc-route="1"] .vweb-ugc-panel p,
    body[data-vweb-ugc-route="1"] .vweb-ugc-card p,
    body[data-vweb-ugc-route="1"] .vweb-ugc-card small,
    body[data-vweb-ugc-route="1"] .vweb-ugc-status,
    body[data-vweb-ugc-route="1"] .vweb-ugc-metadata div {
      color: var(--vweb-ugc-muted);
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-field,
    body[data-vweb-ugc-route="1"] .vweb-ugc-clip-list label,
    body[data-vweb-ugc-route="1"] .vweb-ugc-form-section,
    body[data-vweb-ugc-route="1"] .vweb-ugc-card,
    body[data-vweb-ugc-route="1"] .vweb-ugc-empty,
    body[data-vweb-ugc-route="1"] .vweb-ugc-metadata,
    body[data-vweb-ugc-route="1"] .vweb-ugc-vfx-graph {
      background: var(--vweb-ugc-panel-soft);
      border-color: var(--vweb-ugc-border-soft);
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-studio-form label span,
    body[data-vweb-ugc-route="1"] .vweb-ugc-clip-list label span,
    body[data-vweb-ugc-route="1"] .vweb-ugc-section-title,
    body[data-vweb-ugc-route="1"] .vweb-ugc-vfx-graph summary small {
      color: var(--vweb-ugc-faint);
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-studio-form input,
    body[data-vweb-ugc-route="1"] .vweb-ugc-studio-form select,
    body[data-vweb-ugc-route="1"] .vweb-ugc-filters input,
    body[data-vweb-ugc-route="1"] .vweb-ugc-filters select {
      background: var(--vweb-ugc-input);
      border-color: var(--vweb-ugc-border);
      color: var(--vweb-ugc-text);
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-studio-form option,
    body[data-vweb-ugc-route="1"] .vweb-ugc-filters option,
    body[data-vweb-ugc-route="1"] .vweb-ugc-viewport-toolbar option {
      background: var(--vweb-ugc-panel);
      color: var(--vweb-ugc-text);
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-emitter-bar button,
    body[data-vweb-ugc-route="1"] .vweb-ugc-actions button,
    body[data-vweb-ugc-route="1"] .vweb-ugc-viewport-toolbar button,
    body[data-vweb-ugc-route="1"] .vweb-ugc-viewport-toolbar select,
    body[data-vweb-ugc-route="1"] .vweb-ugc-card button,
    body[data-vweb-ugc-route="1"] .vweb-ugc-card a,
    body[data-vweb-ugc-route="1"] .vweb-ugc-tabs a {
      background: var(--vweb-ugc-button);
      border-color: var(--vweb-ugc-border);
      color: var(--vweb-ugc-text) !important;
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-emitter-bar button:hover,
    body[data-vweb-ugc-route="1"] .vweb-ugc-actions button:hover,
    body[data-vweb-ugc-route="1"] .vweb-ugc-viewport-toolbar button:hover,
    body[data-vweb-ugc-route="1"] .vweb-ugc-card button:hover,
    body[data-vweb-ugc-route="1"] .vweb-ugc-card a:hover,
    body[data-vweb-ugc-route="1"] .vweb-ugc-tabs a:hover {
      background: var(--vweb-ugc-button-hover);
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-tabs a.active,
    body[data-vweb-ugc-route="1"] .vweb-ugc-actions button:first-child {
      background: var(--vweb-ugc-accent-soft);
      border-color: var(--vweb-ugc-accent);
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-actions {
      background: var(--vweb-ugc-action-bar);
      border-top-color: var(--vweb-ugc-border-soft);
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-tool-modes,
    body[data-vweb-ugc-route="1"] .vweb-ugc-target-modes,
    body[data-vweb-ugc-route="1"] .vweb-ugc-animation-controls {
      background: var(--vweb-ugc-control-bg);
      border-color: var(--vweb-ugc-border-soft);
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-animation-controls select:disabled,
    body[data-vweb-ugc-route="1"] .vweb-ugc-animation-controls input:disabled,
    body[data-vweb-ugc-route="1"] .vweb-ugc-animation-controls button:disabled {
      opacity: .55;
      color: var(--vweb-ugc-muted) !important;
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-card-actions {
      display: inline-flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-tweakpane {
      min-width: 0;
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-tweakpane .tp-rotv {
      width: 100%;
      --bs-bg: transparent;
      --bs-sh: transparent;
      --bs-br: 8px;
      --bs-ff: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --cnt-bg: var(--vweb-ugc-input);
      --cnt-bg-h: var(--vweb-ugc-button-hover);
      --cnt-bg-f: var(--vweb-ugc-input);
      --cnt-bg-a: var(--vweb-ugc-accent-soft);
      --cnt-fg: var(--vweb-ugc-text);
      --lbl-fg: var(--vweb-ugc-muted);
      --in-bg: var(--vweb-ugc-input);
      --in-bg-f: var(--vweb-ugc-input);
      --in-fg: var(--vweb-ugc-text);
      --btn-bg: var(--vweb-ugc-button);
      --btn-bg-h: var(--vweb-ugc-button-hover);
      --btn-fg: var(--vweb-ugc-text);
      --grv-fg: var(--vweb-ugc-border-soft);
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-tweakpane .tp-fldv_b,
    body[data-vweb-ugc-route="1"] .vweb-ugc-tweakpane .tp-rotv_b {
      background: var(--vweb-ugc-panel-soft);
      border: 1px solid var(--vweb-ugc-border-soft);
      border-radius: 8px;
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-tweakpane .tp-fldv_t,
    body[data-vweb-ugc-route="1"] .vweb-ugc-tweakpane .tp-rotv_t {
      color: var(--vweb-ugc-heading);
      font-weight: 800;
      letter-spacing: .01em;
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-tweakpane .tp-lblv_l {
      color: var(--vweb-ugc-muted);
      font-weight: 700;
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-tweakpane .tp-txtv_i,
    body[data-vweb-ugc-route="1"] .vweb-ugc-tweakpane .tp-lstv_s {
      color: var(--vweb-ugc-text);
      background: var(--vweb-ugc-input);
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-tweakpane .tp-fldv_c {
      background: transparent;
      padding-top: 6px;
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-tweakpane + .vweb-ugc-texture-field {
      margin-top: 8px;
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-vfx-graph {
      grid-column: 1 / -1;
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-vfx-graph summary {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      cursor: pointer;
      color: var(--vweb-ugc-heading);
      font-weight: 850;
      text-transform: uppercase;
      letter-spacing: .06em;
      font-size: 11px;
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-vfx-graph summary::-webkit-details-marker {
      display: none;
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-vfx-note {
      margin: 8px 0 0;
      font-size: 12px;
      line-height: 1.35;
      color: var(--vweb-ugc-muted);
    }
    body[data-vweb-ugc-route="1"] .vweb-ugc-vfx-graph:not([open]) .vweb-ugc-vfx-note,
    body[data-vweb-ugc-route="1"] .vweb-ugc-vfx-graph:not([open]) .vweb-ugc-vfx-nodes,
    body[data-vweb-ugc-route="1"] .vweb-ugc-vfx-graph:not([open]) .vweb-ugc-vfx-actions {
      display: none;
    }
    @media (max-width: 1040px) {
      .vweb-ugc-hero, .vweb-ugc-card { align-items: stretch; flex-direction: column; }
      .vweb-ugc-grid, .vweb-ugc-studio, .vweb-ugc-store, .vweb-ugc-form-grid, .vweb-ugc-transform-grid, .vweb-ugc-emitter-bar { grid-template-columns: 1fr; }
      .vweb-ugc-store-preview { position: static; grid-template-rows: auto minmax(360px, 56vh) auto; }
      .vweb-ugc-editor { min-height: 520px; }
      .vweb-ugc-editor-stage { min-height: 460px; }
      .vweb-ugc-studio-form { max-height: none; }
      .vweb-ugc-tabs { width: 100%; }
      .vweb-ugc-tabs a { flex: 1; text-align: center; }
    }
  `;
  document.documentElement.appendChild(style);
}
