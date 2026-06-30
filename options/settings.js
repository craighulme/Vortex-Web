const extensionApi = globalThis.chrome || globalThis.browser;

const LOCAL_NATIVE_RELAY = "ws://127.0.0.1:27822/ws";
const HOSTED_NATIVE_RELAY = "wss://v22-relay.116.203.155.30.sslip.io/ws";
const HOSTED_LICENSE_API = "https://v22.irongiant.vip";

const SITE_THEME_DARK = `/* Vortex Web dark site theme */
:root {
  --bgcol1: #10171d;
  --bgcol2: #18222b;
  --bgcol3: #202c36;
  --bgcoltopbar: #111920;
  --linecol1: rgba(220, 236, 246, 0.16);
  --linecol2: rgba(220, 236, 246, 0.28);
  --textcol1: rgba(245, 250, 252, 0.96);
  --textcol2: rgba(210, 224, 232, 0.70);
  --vortex-main: rgba(245, 250, 252, 0.96);
  --vortex-secondary: rgba(210, 224, 232, 0.68);
  --accentcol1: #35d39a;
}
html[theme='light'] {
  --bgcol1: #10171d;
  --bgcol2: #18222b;
  --bgcol3: #202c36;
  --bgcoltopbar: #111920;
  --linecol1: rgba(220, 236, 246, 0.16);
  --linecol2: rgba(220, 236, 246, 0.28);
  --textcol1: rgba(245, 250, 252, 0.96);
  --textcol2: rgba(210, 224, 232, 0.70);
  --vortex-main: rgba(245, 250, 252, 0.96);
  --vortex-secondary: rgba(210, 224, 232, 0.68);
}
.navbar a,
.navbar button,
.navbar .btn,
.navbar .nav-link,
.navbar .btn-signout-sm {
  background: transparent !important;
  color: var(--textcol1) !important;
  border-color: transparent !important;
  box-shadow: none !important;
}
.navbar a:hover,
.navbar button:hover,
.navbar .btn:hover,
.navbar .nav-link:hover,
.navbar .btn-signout-sm:hover {
  background: rgba(255, 255, 255, 0.08) !important;
  color: var(--textcol1) !important;
}`;

const SITE_THEME_LIGHT = `/* Vortex Web light site theme */
:root,
html[theme='light'] {
  --bgcol1: #f8fafc;
  --bgcol2: #ffffff;
  --bgcol3: #e8eef4;
  --bgcoltopbar: #ffffff;
  --linecol1: rgba(15, 23, 42, 0.12);
  --linecol2: rgba(15, 23, 42, 0.18);
  --textcol1: #111827;
  --textcol2: rgba(17, 24, 39, 0.70);
  --vortex-main: #111827;
  --vortex-secondary: rgba(17, 24, 39, 0.66);
  --accentcol1: #0ea5e9;
}
.navbar,
.tab-bar {
  background: #ffffff !important;
  color: var(--textcol1) !important;
  border-bottom-color: var(--linecol1) !important;
}
.navbar a,
.navbar button,
.navbar .btn,
.navbar .nav-link,
.navbar .btn-signout-sm {
  background: transparent !important;
  color: var(--textcol1) !important;
  border-color: transparent !important;
  box-shadow: none !important;
}
.navbar a:hover,
.navbar button:hover,
.navbar .btn:hover,
.navbar .nav-link:hover,
.navbar .btn-signout-sm:hover {
  background: rgba(14, 165, 233, 0.11) !important;
  color: #0f172a !important;
}
.navbar .active,
.navbar [aria-current='page'] {
  background: rgba(14, 165, 233, 0.22) !important;
  color: #0f172a !important;
}`;

const SITE_THEME_GLASS = `/* Vortex Web glass site theme */
:root {
  --bgcol1: #0f1720;
  --bgcol2: rgba(20, 31, 40, 0.78);
  --bgcol3: rgba(34, 48, 60, 0.72);
  --bgcoltopbar: rgba(10, 16, 23, 0.78);
  --linecol1: rgba(255, 255, 255, 0.14);
  --linecol2: rgba(255, 255, 255, 0.22);
  --textcol1: rgba(248, 250, 252, 0.96);
  --textcol2: rgba(226, 232, 240, 0.72);
  --accentcol1: #7dd3fc;
}
.navbar,
.tab-bar,
.profile-header,
.game-card,
.card,
.panel,
.modal-content,
.dropdown-menu,
.vw-profile-style,
.vw-badge-card {
  backdrop-filter: blur(16px) saturate(1.12) !important;
  background-color: color-mix(in srgb, var(--bgcol2) 82%, transparent) !important;
}
.navbar a,
.navbar button,
.navbar .btn,
.navbar .nav-link,
.navbar .btn-signout-sm {
  background: transparent !important;
  color: var(--textcol1) !important;
  border-color: transparent !important;
  box-shadow: none !important;
}
.navbar a:hover,
.navbar button:hover,
.navbar .btn:hover,
.navbar .nav-link:hover,
.navbar .btn-signout-sm:hover {
  background: rgba(255, 255, 255, 0.10) !important;
}`;

const SITE_THEME_COMPACT = `/* Vortex Web compact site theme */
:root {
  --bgcol1: #121212;
  --bgcol2: #202020;
  --bgcol3: #292929;
  --bgcoltopbar: #151515;
}
.container,
.profile-header,
.game-card,
.card,
.panel {
  border-radius: 8px !important;
}
.game-card,
.card,
.panel {
  padding: 10px !important;
}
.navbar,
.tab-bar {
  min-height: 42px !important;
}
.navbar a,
.navbar button,
.navbar .btn,
.navbar .nav-link,
.navbar .btn-signout-sm {
  background: transparent !important;
  color: var(--textcol1) !important;
  border-color: transparent !important;
  box-shadow: none !important;
  padding-top: 6px !important;
  padding-bottom: 6px !important;
}
.navbar a:hover,
.navbar button:hover,
.navbar .btn:hover,
.navbar .nav-link:hover,
.navbar .btn-signout-sm:hover {
  background: rgba(255, 255, 255, 0.08) !important;
}`;

const RUNTIME_THEME_DEFAULT = "";

const RUNTIME_THEME_DARK = `/* Dark solid in-game theme */
:root {
  --vw-ui-glass: #111827;
  --vw-ui-glass-strong: #0f172a;
  --vw-ui-glass-menu: #111827;
  --vw-ui-border: rgba(226,232,240,0.18);
  --vw-ui-border-soft: rgba(226,232,240,0.12);
  --vw-ui-text: rgba(248,250,252,0.94);
  --vw-ui-muted: rgba(226,232,240,0.62);
  --vw-ui-accent: #60a5fa;
  --vw-ui-accent-hover: #93c5fd;
  --vw-menu-surface: #111827;
  --vw-menu-bar-surface: #0f172a;
  --vw-panel-surface: #1f2937;
  --vw-panel-border: rgba(226,232,240,0.16);
  --vw-dependent-surface: #273244;
  --vw-control-surface: #334155;
  --vw-control-border: rgba(226,232,240,0.18);
  --vw-tab-surface: #293548;
}`;

const RUNTIME_THEME_LIGHT = `/* Light solid in-game theme */
:root {
  --vw-ui-glass: #f8fafc;
  --vw-ui-glass-strong: #ffffff;
  --vw-ui-glass-menu: #f8fafc;
  --vw-ui-border: rgba(15,23,42,0.18);
  --vw-ui-border-soft: rgba(15,23,42,0.12);
  --vw-ui-text: rgba(15,23,42,0.92);
  --vw-ui-muted: rgba(15,23,42,0.58);
  --vw-ui-faint: rgba(15,23,42,0.36);
  --vw-ui-accent: #2563eb;
  --vw-ui-accent-hover: #1d4ed8;
  --vw-ui-shadow: 0 18px 46px rgba(15,23,42,0.14);
  --vw-menu-surface: #f8fafc;
  --vw-menu-bar-surface: #eef2f7;
  --vw-panel-surface: #ffffff;
  --vw-panel-border: rgba(15,23,42,0.16);
  --vw-dependent-surface: #eef2f7;
  --vw-control-surface: #ffffff;
  --vw-control-border: rgba(15,23,42,0.18);
  --vw-tab-surface: #f1f5f9;
  --vw-active-surface: linear-gradient(135deg, rgba(37,99,235,0.28), rgba(96,165,250,0.18));
  --vw-active-border: rgba(37,99,235,0.34);
}
#chat-window,
.lb-panel,
#lb-player-panel,
.notif {
  color: var(--vw-ui-text);
}`;

const RUNTIME_THEME_DARK_GLASS = `/* Dark clear glass in-game theme */
:root {
  --vw-ui-glass: linear-gradient(135deg, rgba(5,10,18,0.54), rgba(5,10,18,0.26));
  --vw-ui-glass-strong: linear-gradient(135deg, rgba(5,10,18,0.64), rgba(5,10,18,0.34));
  --vw-ui-glass-menu: linear-gradient(135deg, rgba(5,10,18,0.50), rgba(5,10,18,0.22));
  --vw-ui-border: rgba(255,255,255,0.22);
  --vw-ui-border-soft: rgba(255,255,255,0.14);
  --vw-ui-text: rgba(248,250,252,0.94);
  --vw-ui-muted: rgba(255,255,255,0.58);
  --vw-ui-accent: #3b82f6;
  --vw-ui-accent-hover: #60a5fa;
  --vw-menu-surface: linear-gradient(135deg, rgba(5,10,18,0.52), rgba(5,10,18,0.22));
  --vw-menu-bar-surface: linear-gradient(135deg, rgba(5,10,18,0.46), rgba(5,10,18,0.18));
  --vw-panel-surface: linear-gradient(135deg, rgba(15,23,42,0.42), rgba(15,23,42,0.18));
  --vw-panel-border: rgba(255,255,255,0.17);
  --vw-dependent-surface: linear-gradient(135deg, rgba(15,23,42,0.34), rgba(15,23,42,0.14));
  --vw-control-surface: linear-gradient(135deg, rgba(30,41,59,0.48), rgba(30,41,59,0.22));
  --vw-control-border: rgba(255,255,255,0.20);
  --vw-tab-surface: linear-gradient(135deg, rgba(15,23,42,0.40), rgba(15,23,42,0.16));
}`;

const RUNTIME_THEME_LIGHT_GLASS = RUNTIME_THEME_DEFAULT;

const RUNTIME_THEME_COMPACT_DENSITY = `
:root {
  --vw-ui-radius: 6px;
  --vw-ui-radius-sm: 5px;
}
#chat-window {
  width: 330px;
  max-height: 200px;
}
#leaderboard {
  width: 220px;
}
.vw-menu-content {
  padding: 12px;
}
.sp-row,
.vw-field,
.vw-toggle-row,
.vw-keybind-row {
  min-height: 38px !important;
  padding-top: 7px !important;
  padding-bottom: 7px !important;
}`;

const RUNTIME_THEME_COMPACT = `/* Compact dark in-game theme */
${RUNTIME_THEME_DARK}
${RUNTIME_THEME_COMPACT_DENSITY}`;

const RUNTIME_THEME_COMPACT_GLASS = `/* Compact clear glass in-game theme */
${RUNTIME_THEME_DARK_GLASS}
${RUNTIME_THEME_COMPACT_DENSITY}`;

const BUILT_IN_THEME_IDS = new Set(["default", "dark", "light", "dark-glass", "light-glass", "compact", "compact-glass"]);

const THEME_PRESETS = {
  default: {
    site: SITE_THEME_DARK,
    runtime: RUNTIME_THEME_DEFAULT
  },
  dark: {
    site: SITE_THEME_DARK,
    runtime: RUNTIME_THEME_DARK
  },
  light: {
    site: SITE_THEME_LIGHT,
    runtime: RUNTIME_THEME_LIGHT
  },
  current: {
    site: null,
    runtime: null
  },
  "dark-glass": {
    site: SITE_THEME_GLASS,
    runtime: RUNTIME_THEME_DARK_GLASS
  },
  "light-glass": {
    site: `${SITE_THEME_LIGHT}
${SITE_THEME_GLASS}`,
    runtime: RUNTIME_THEME_LIGHT_GLASS
  },
  compact: {
    site: SITE_THEME_COMPACT,
    runtime: RUNTIME_THEME_COMPACT
  },
  "compact-glass": {
    site: `${SITE_THEME_GLASS}
${SITE_THEME_COMPACT}`,
    runtime: RUNTIME_THEME_COMPACT_GLASS
  }
};

const DEFAULTS = {
  hubUrl: HOSTED_NATIVE_RELAY,
  licenseApiUrl: HOSTED_LICENSE_API,
  licenseKey: "",
  chatNameGradients: true,
  leaderboardCosmetics: true,
  miniProfileCosmetics: true,
  siteProfileCosmetics: true,
  vwebThemeSite: "default",
  vwebThemeRuntime: "default",
  vwebThemeSiteCss: SITE_THEME_DARK,
  vwebThemeRuntimeCss: RUNTIME_THEME_DEFAULT,
  vwebThemeLibrary: null,
  vwebLastLicenseLease: null,
  vortexWebProfileAuth: null,
  vortexWebCosmetics: null
};

const els = {
  versionLabel: byId("versionLabel"),
  hostedRelayBtn: byId("hostedRelayBtn"),
  localRelayBtn: byId("localRelayBtn"),
  connectionDot: byId("connectionDot"),
  localRelayField: byId("localRelayField"),
  hubUrl: byId("hubUrl"),
  licenseKey: byId("licenseKey"),
  leaseStatus: byId("leaseStatus"),
  featureStatus: byId("featureStatus"),
  accountStatus: byId("accountStatus"),
  siteProfileCosmetics: byId("siteProfileCosmetics"),
  chatNameGradients: byId("chatNameGradients"),
  leaderboardCosmetics: byId("leaderboardCosmetics"),
  miniProfileCosmetics: byId("miniProfileCosmetics"),
  themeCss: byId("themeCss"),
  themeSelect: byId("themeSelect"),
  themeName: byId("themeName"),
  saveThemeBtn: byId("saveThemeBtn"),
  deleteThemeBtn: byId("deleteThemeBtn"),
  themeEditorLabel: byId("themeEditorLabel"),
  siteThemeTab: byId("siteThemeTab"),
  runtimeThemeTab: byId("runtimeThemeTab"),
  exportSettingsBtn: byId("exportSettingsBtn"),
  resetSettingsBtn: byId("resetSettingsBtn"),
  toast: byId("toast")
};

let saveTimer = 0;
let activeThemeTarget = "site";

init().catch(() => showToast("Could not load settings"));

async function init() {
  els.versionLabel.textContent = `Version ${extensionApi.runtime?.getManifest?.().version || "0.0.0"}`;
  const stored = await storageGet(DEFAULTS);
  await ensureConnectionDefaults(stored);
  await ensureThemeDefaults();
  render(await storageGet(DEFAULTS));
  bind();
}

function bind() {
  els.hostedRelayBtn.addEventListener("click", async () => {
    await storageSet({ hubUrl: HOSTED_NATIVE_RELAY, licenseApiUrl: HOSTED_LICENSE_API });
    render(await storageGet(DEFAULTS));
    showToast("Hosted relay selected");
  });

  els.localRelayBtn.addEventListener("click", async () => {
    const current = normalizeHubUrl(els.hubUrl.value || LOCAL_NATIVE_RELAY);
    await storageSet({ hubUrl: isLocalRelayUrl(current) ? current : LOCAL_NATIVE_RELAY, licenseApiUrl: HOSTED_LICENSE_API });
    render(await storageGet(DEFAULTS));
    showToast("Local relay selected");
  });

  els.hubUrl.addEventListener("input", () => scheduleSave());
  els.hubUrl.addEventListener("change", () => scheduleSave());

  for (const input of [
    els.licenseKey,
    els.siteProfileCosmetics,
    els.chatNameGradients,
    els.leaderboardCosmetics,
    els.miniProfileCosmetics
  ]) {
    input.addEventListener("input", () => scheduleSave());
    input.addEventListener("change", () => scheduleSave());
  }

  els.themeCss.addEventListener("input", () => scheduleSave());
  els.themeCss.addEventListener("change", () => scheduleSave());
  els.themeSelect.addEventListener("change", () => selectSavedTheme(els.themeSelect.value));
  els.saveThemeBtn.addEventListener("click", () => saveNamedTheme());
  els.deleteThemeBtn.addEventListener("click", () => deleteNamedTheme());

  els.siteThemeTab.addEventListener("click", () => void switchThemeTarget("site"));
  els.runtimeThemeTab.addEventListener("click", () => void switchThemeTarget("runtime"));

  for (const button of document.querySelectorAll("[data-theme-preset]")) {
    button.addEventListener("click", () => applyThemePreset(button.dataset.themePreset || "default"));
  }

  for (const button of document.querySelectorAll("[data-token]")) {
    button.addEventListener("click", () => insertThemeToken(button.dataset.token || ""));
  }

  els.exportSettingsBtn.addEventListener("click", async () => {
    const stored = await storageGet(DEFAULTS);
    const exportable = {
      chatNameGradients: stored.chatNameGradients !== false,
      leaderboardCosmetics: stored.leaderboardCosmetics !== false,
      miniProfileCosmetics: stored.miniProfileCosmetics !== false,
      siteProfileCosmetics: stored.siteProfileCosmetics !== false,
      vwebThemeSite: stored.vwebThemeSite || "default",
      vwebThemeRuntime: stored.vwebThemeRuntime || "default",
      vwebThemeSiteCss: stored.vwebThemeSiteCss || "",
      vwebThemeRuntimeCss: stored.vwebThemeRuntimeCss || "",
      vwebThemeLibrary: normalizeThemeLibrary(stored.vwebThemeLibrary)
    };
    await navigator.clipboard?.writeText(JSON.stringify(exportable, null, 2)).catch(() => null);
    showToast("Settings copied without license key");
  });

  els.resetSettingsBtn.addEventListener("click", async () => {
    await storageSet({
      chatNameGradients: true,
      leaderboardCosmetics: true,
      miniProfileCosmetics: true,
      siteProfileCosmetics: true,
      vwebThemeSite: "default",
      vwebThemeRuntime: "default",
      vwebThemeSiteCss: SITE_THEME_DARK,
      vwebThemeRuntimeCss: RUNTIME_THEME_DEFAULT,
      vwebThemeLibrary: defaultThemeLibrary()
    });
    render(await storageGet(DEFAULTS));
    showToast("Display settings reset");
  });
}

function render(stored) {
  const local = isLocalRelayUrl(stored.hubUrl || HOSTED_NATIVE_RELAY);
  els.hubUrl.value = local ? stored.hubUrl : LOCAL_NATIVE_RELAY;
  els.localRelayField.hidden = !local;
  els.localRelayBtn.classList.toggle("active", local);
  els.hostedRelayBtn.classList.toggle("active", !local);
  els.connectionDot.classList.toggle("local", local);

  els.licenseKey.value = stored.licenseKey || "";
  els.siteProfileCosmetics.checked = stored.siteProfileCosmetics !== false;
  els.chatNameGradients.checked = stored.chatNameGradients !== false;
  els.leaderboardCosmetics.checked = stored.leaderboardCosmetics !== false;
  els.miniProfileCosmetics.checked = stored.miniProfileCosmetics !== false;

  renderLease(stored);
  renderThemeEditor(stored);
}

function renderLease(stored) {
  const wrapped = stored.vwebLastLicenseLease && typeof stored.vwebLastLicenseLease === "object" ? stored.vwebLastLicenseLease : null;
  const lease = wrapped?.lease && typeof wrapped.lease === "object" ? wrapped.lease : wrapped;
  const savedAt = Number(wrapped?.savedAt || 0);
  if (!lease) {
    els.leaseStatus.textContent = "None";
    els.featureStatus.textContent = "Unknown";
    els.accountStatus.textContent = linkedAccountsLabel(stored) || "Unknown";
    return;
  }

  els.leaseStatus.textContent = savedAt ? `Saved ${new Date(savedAt).toLocaleString()}` : "Available";
  const features = readFeatureList(lease);
  els.featureStatus.textContent = features.length ? features.map(formatFeatureName).join(", ") : "None in saved lease";
  els.accountStatus.textContent = linkedAccountsLabel(stored) || "Not included in saved lease";
}

function readFeatureList(lease) {
  if (Array.isArray(lease.allowed_features)) return lease.allowed_features.filter(Boolean);
  if (Array.isArray(lease.allowedFeatures)) return lease.allowedFeatures.filter(Boolean);
  if (Array.isArray(lease.features)) return lease.features.filter(Boolean);
  if (lease.features && typeof lease.features === "object") {
    return Object.entries(lease.features).filter(([, enabled]) => enabled).map(([name]) => name);
  }
  return [];
}

function linkedAccountsLabel(stored) {
  const authRecords = stored.vortexWebProfileAuth?.records && typeof stored.vortexWebProfileAuth.records === "object"
    ? Object.values(stored.vortexWebProfileAuth.records)
    : [];
  const accounts = authRecords
    .map((record) => {
      const id = Number(record?.userId);
      if (!Number.isFinite(id) || id <= 0) return null;
      const username = String(record?.username || "").trim();
      return username ? `${username} (${id})` : `User ${id}`;
    })
    .filter(Boolean);

  const ownUserId = Number(stored.vortexWebCosmetics?.ownUserId || 0);
  if (!accounts.length && Number.isFinite(ownUserId) && ownUserId > 0) accounts.push(`User ${ownUserId}`);
  return accounts.length ? accounts.slice(0, 3).join(", ") : "";
}

function formatFeatureName(value) {
  return String(value)
    .replace(/^vortex-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderThemeEditor(stored) {
  const library = normalizeThemeLibrary(stored.vwebThemeLibrary);
  const activeId = activeThemeTarget === "site" ? stored.vwebThemeSite || "default" : stored.vwebThemeRuntime || "default";
  renderThemeSelect(library, activeId);
  els.siteThemeTab.classList.toggle("active", activeThemeTarget === "site");
  els.runtimeThemeTab.classList.toggle("active", activeThemeTarget === "runtime");
  els.themeEditorLabel.textContent = activeThemeTarget === "site" ? "Site theme CSS" : "In-game theme CSS";
  const activeTheme = library[activeThemeTarget]?.[activeId] || null;
  els.themeName.value = activeTheme?.name || (activeId === "default" ? "Default" : activeId);
  els.themeCss.value = activeThemeTarget === "site" ? stored.vwebThemeSiteCss || activeTheme?.css || "" : stored.vwebThemeRuntimeCss || activeTheme?.css || "";
}

async function switchThemeTarget(target) {
  if (target !== "site" && target !== "runtime") return;
  await save("Saved");
  activeThemeTarget = target;
  renderThemeEditor(await storageGet(DEFAULTS));
}

async function applyThemePreset(name) {
  const preset = THEME_PRESETS[name] || THEME_PRESETS.default;
  const css = name === "current"
    ? await loadCurrentDefaultCss(activeThemeTarget)
    : activeThemeTarget === "site" ? preset.site : preset.runtime;
  els.themeCss.value = css || "";
  const id = name === "current" ? "current-default" : name;
  const label = name === "current" ? "Full current CSS" : presetLabel(name);
  await upsertActiveTheme(id, label, els.themeCss.value);
  showToast("Theme preset applied");
}

async function selectSavedTheme(id) {
  const stored = await storageGet(DEFAULTS);
  const library = normalizeThemeLibrary(stored.vwebThemeLibrary);
  const theme = library[activeThemeTarget]?.[id] || library[activeThemeTarget]?.default;
  if (!theme) return;
  const patch = activeThemeTarget === "site"
    ? { vwebThemeSite: id, vwebThemeSiteCss: theme.css }
    : { vwebThemeRuntime: id, vwebThemeRuntimeCss: theme.css };
  await storageSet(patch);
  render(await storageGet(DEFAULTS));
  showToast("Theme selected");
}

async function saveNamedTheme() {
  const rawName = els.themeName.value.trim() || "Custom theme";
  const id = slugThemeName(rawName);
  await upsertActiveTheme(id, rawName, els.themeCss.value);
  showToast("Theme saved");
}

async function deleteNamedTheme() {
  const id = els.themeSelect.value;
  if (!id || BUILT_IN_THEME_IDS.has(id)) {
    showToast("Built-in themes cannot be deleted");
    return;
  }
  const stored = await storageGet(DEFAULTS);
  const library = normalizeThemeLibrary(stored.vwebThemeLibrary);
  delete library[activeThemeTarget][id];
  const patch = activeThemeTarget === "site"
    ? { vwebThemeLibrary: library, vwebThemeSite: "default", vwebThemeSiteCss: library.site.default.css }
    : { vwebThemeLibrary: library, vwebThemeRuntime: "default", vwebThemeRuntimeCss: library.runtime.default.css };
  await storageSet(patch);
  render(await storageGet(DEFAULTS));
  showToast("Theme deleted");
}

async function upsertActiveTheme(id, name, css) {
  const stored = await storageGet(DEFAULTS);
  const library = normalizeThemeLibrary(stored.vwebThemeLibrary);
  library[activeThemeTarget][id] = {
    id,
    name,
    css: String(css || ""),
    updatedAt: Date.now()
  };
  const patch = activeThemeTarget === "site"
    ? { vwebThemeLibrary: library, vwebThemeSite: id, vwebThemeSiteCss: css }
    : { vwebThemeLibrary: library, vwebThemeRuntime: id, vwebThemeRuntimeCss: css };
  await storageSet(patch);
  render(await storageGet(DEFAULTS));
}

function renderThemeSelect(library, activeId) {
  const themes = Object.values(library[activeThemeTarget] || {});
  els.themeSelect.innerHTML = "";
  for (const theme of themes.sort((left, right) => left.name.localeCompare(right.name))) {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.name;
    els.themeSelect.appendChild(option);
  }
  els.themeSelect.value = themes.some((theme) => theme.id === activeId) ? activeId : "default";
}

function insertThemeToken(token) {
  if (!token) return;
  const input = els.themeCss;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = `${input.value.slice(0, start)}${token}${input.value.slice(end)}`;
  input.focus();
  input.setSelectionRange(start + token.length, start + token.length);
  scheduleSave("Token inserted");
}

function scheduleSave(label = "Saved") {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save(label), 180);
}

async function save(label) {
  const stored = await storageGet(DEFAULTS);
  const local = isLocalRelayUrl(stored.hubUrl || HOSTED_NATIVE_RELAY);
  const library = normalizeThemeLibrary(stored.vwebThemeLibrary);
  const activeId = activeThemeTarget === "site" ? stored.vwebThemeSite || "default" : stored.vwebThemeRuntime || "default";
  const currentTheme = library[activeThemeTarget][activeId] || library[activeThemeTarget].default;
  library[activeThemeTarget][currentTheme.id] = {
    ...currentTheme,
    name: els.themeName.value.trim() || currentTheme.name,
    css: els.themeCss.value,
    updatedAt: Date.now()
  };
  const themePatch = activeThemeTarget === "site"
    ? { vwebThemeLibrary: library, vwebThemeSite: currentTheme.id, vwebThemeSiteCss: els.themeCss.value }
    : { vwebThemeLibrary: library, vwebThemeRuntime: currentTheme.id, vwebThemeRuntimeCss: els.themeCss.value };
  const next = {
    hubUrl: local ? normalizeHubUrl(els.hubUrl.value || LOCAL_NATIVE_RELAY) : HOSTED_NATIVE_RELAY,
    licenseApiUrl: HOSTED_LICENSE_API,
    licenseKey: els.licenseKey.value.trim(),
    siteProfileCosmetics: els.siteProfileCosmetics.checked,
    chatNameGradients: els.chatNameGradients.checked,
    leaderboardCosmetics: els.leaderboardCosmetics.checked,
    miniProfileCosmetics: els.miniProfileCosmetics.checked,
    ...themePatch
  };
  await storageSet(next);
  showToast(label);
}

function normalizeHubUrl(value) {
  return String(value || LOCAL_NATIVE_RELAY).trim().replace(/^http:/, "ws:").replace(/^https:/, "wss:");
}

function normalizeThemeLibrary(value) {
  const base = defaultThemeLibrary();
  if (!value || typeof value !== "object") return base;
  for (const target of ["site", "runtime"]) {
    const source = value[target] && typeof value[target] === "object" ? value[target] : {};
    for (const [id, theme] of Object.entries(source)) {
      if (!theme || typeof theme !== "object") continue;
      const safeId = slugThemeName(id);
      const css = String(theme.css || "");
      if (safeId === "default" && !css.trim()) continue;
      base[target][safeId] = {
        id: safeId,
        name: String(theme.name || id || "Theme").trim().slice(0, 64),
        css,
        updatedAt: Number(theme.updatedAt || 0)
      };
    }
  }
  return base;
}

function defaultThemeLibrary() {
  return {
      site: {
        default: { id: "default", name: "Dark", css: SITE_THEME_DARK, updatedAt: 0 },
        light: { id: "light", name: "Light", css: SITE_THEME_LIGHT, updatedAt: 0 },
        glass: { id: "glass", name: "Clean glass", css: SITE_THEME_GLASS, updatedAt: 0 },
        compact: { id: "compact", name: "Compact", css: SITE_THEME_COMPACT, updatedAt: 0 }
      },
      runtime: {
        default: { id: "default", name: "Default", css: RUNTIME_THEME_DEFAULT, updatedAt: 0 },
        dark: { id: "dark", name: "Dark", css: RUNTIME_THEME_DARK, updatedAt: 0 },
        light: { id: "light", name: "Light", css: RUNTIME_THEME_LIGHT, updatedAt: 0 },
        "dark-glass": { id: "dark-glass", name: "Dark clear glass", css: RUNTIME_THEME_DARK_GLASS, updatedAt: 0 },
        "light-glass": { id: "light-glass", name: "Light clear glass", css: RUNTIME_THEME_LIGHT_GLASS, updatedAt: 0 },
        compact: { id: "compact", name: "Compact", css: RUNTIME_THEME_COMPACT, updatedAt: 0 },
        "compact-glass": { id: "compact-glass", name: "Compact clear glass", css: RUNTIME_THEME_COMPACT_GLASS, updatedAt: 0 }
      }
    };
  }

async function loadCurrentDefaultCss(target) {
  const path = target === "site" ? "styles/main.css" : "runtime/page/styles.css";
  try {
    const url = extensionApi.runtime.getURL(path);
    return await fetch(url, { cache: "no-store" }).then((res) => res.ok ? res.text() : "");
  } catch {
    return "";
  }
}

function slugThemeName(value) {
  const slug = String(value || "theme")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "theme";
}

function presetLabel(name) {
  if (name === "default") return "Default";
  if (name === "dark") return "Dark";
  if (name === "light") return "Light";
  if (name === "dark-glass") return "Dark clear glass";
  if (name === "light-glass") return "Light clear glass";
  if (name === "compact") return "Compact";
  if (name === "compact-glass") return "Compact clear glass";
  return "Default";
}

async function ensureConnectionDefaults(stored) {
  const next = {};
  if (!stored.hubUrl) next.hubUrl = HOSTED_NATIVE_RELAY;
  if (!stored.licenseApiUrl) next.licenseApiUrl = HOSTED_LICENSE_API;
  if (Object.keys(next).length) await storageSet(next);
}

async function ensureThemeDefaults() {
  const raw = await storageGet({});
  const patch = {};
  const defaults = defaultThemeLibrary();
  const library = normalizeThemeLibrary(raw.vwebThemeLibrary);
  let libraryChanged = false;
  const oldRuntimeThemeId = raw.vwebThemeRuntime;
  const migratedRuntimeThemeId = oldRuntimeThemeId === "glass"
    ? "dark-glass"
    : oldRuntimeThemeId === "solid"
      ? "dark"
      : oldRuntimeThemeId;
  if (library.runtime.glass) {
    delete library.runtime.glass;
    libraryChanged = true;
  }
  if (library.runtime.solid) {
    delete library.runtime.solid;
    libraryChanged = true;
  }
  for (const target of ["site", "runtime"]) {
    for (const [id, theme] of Object.entries(defaults[target])) {
      if (!library[target][id] || library[target][id].css !== theme.css) {
        library[target][id] = theme;
        libraryChanged = true;
      }
    }
  }
  if (!raw.vwebThemeLibrary || libraryChanged) patch.vwebThemeLibrary = library;
  if (typeof raw.vwebThemeSiteCss !== "string" || (!raw.vwebThemeSiteCss.trim() && (!raw.vwebThemeSite || raw.vwebThemeSite === "default"))) {
    patch.vwebThemeSiteCss = SITE_THEME_DARK;
  }
  if (BUILT_IN_THEME_IDS.has(raw.vwebThemeSite) && defaults.site[raw.vwebThemeSite] && raw.vwebThemeSiteCss !== defaults.site[raw.vwebThemeSite].css) {
    patch.vwebThemeSiteCss = defaults.site[raw.vwebThemeSite].css;
  }
  if (migratedRuntimeThemeId !== oldRuntimeThemeId) {
    patch.vwebThemeRuntime = migratedRuntimeThemeId;
    patch.vwebThemeRuntimeCss = defaults.runtime[migratedRuntimeThemeId]?.css || RUNTIME_THEME_DEFAULT;
  }
  if (typeof raw.vwebThemeRuntimeCss !== "string" || (!raw.vwebThemeRuntimeCss.trim() && (!raw.vwebThemeRuntime || raw.vwebThemeRuntime === "default"))) {
    patch.vwebThemeRuntimeCss = RUNTIME_THEME_DEFAULT;
  }
  if (BUILT_IN_THEME_IDS.has(migratedRuntimeThemeId) && defaults.runtime[migratedRuntimeThemeId] && raw.vwebThemeRuntimeCss !== defaults.runtime[migratedRuntimeThemeId].css) {
    patch.vwebThemeRuntimeCss = defaults.runtime[migratedRuntimeThemeId].css;
  }
  if (!raw.vwebThemeSite) patch.vwebThemeSite = "default";
  if (!raw.vwebThemeRuntime) patch.vwebThemeRuntime = "default";
  if (Object.keys(patch).length) await storageSet(patch);
}

function isLocalRelayUrl(value) {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "ws:" || parsed.protocol === "wss:") &&
      ["127.0.0.1", "localhost", "[::1]", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function storageGet(defaults) {
  return new Promise((resolve) => {
    const result = extensionApi.storage.local.get(defaults, (stored) => resolve(stored || defaults));
    if (result && typeof result.then === "function") result.then((stored) => resolve(stored || defaults));
  });
}

function storageSet(value) {
  return new Promise((resolve) => {
    const result = extensionApi.storage.local.set(value, () => resolve(true));
    if (result && typeof result.then === "function") result.then(() => resolve(true));
  });
}

let toastTimer = 0;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1700);
}

function byId(id) {
  return document.getElementById(id);
}
