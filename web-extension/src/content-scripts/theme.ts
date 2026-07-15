import { DEFAULT_SITE_THEME_CONFIG, dispatchSiteThemeConfig, normalizeSiteThemeConfig } from "../site/SiteThemeConfig";

export function installCustomSiteTheme(documentRef: Document = document): void {
  if (isPlayRuntimePage(documentRef)) return;

  const extensionApi = (globalThis as typeof globalThis & { chrome?: any; browser?: any }).chrome
    || (globalThis as typeof globalThis & { chrome?: any; browser?: any }).browser;
  const defaults = {
    vwebThemeSiteCss: "",
    vwebThemeSiteConfig: DEFAULT_SITE_THEME_CONFIG,
    siteThemeEnabled: true
  };
  let pendingCss = "";
  let pendingEnabled: unknown = true;
  let pendingConfig = DEFAULT_SITE_THEME_CONFIG;

  const host = () => documentRef.head || documentRef.documentElement;
  const keepLast = (style: HTMLStyleElement) => {
    const target = host();
    if (style.parentElement !== target || target.lastElementChild !== style) target.appendChild(style);
  };

  const apply = (css: unknown, enabled: unknown = true, config: unknown = pendingConfig) => {
    pendingCss = String(css || "");
    pendingEnabled = enabled;
    pendingConfig = normalizeSiteThemeConfig(config);
    dispatchSiteThemeConfig(documentRef, pendingConfig);
    let style = documentRef.getElementById("vweb-custom-site-theme") as HTMLStyleElement | null;
    const text = pendingEnabled === false ? "" : pendingCss;
    if (!text) {
      style?.remove();
      return;
    }
    if (!style) {
      style = documentRef.createElement("style");
      style.id = "vweb-custom-site-theme";
    }
    style.textContent = text;
    keepLast(style);
  };
  const reapplyAfterPageStyles = () => apply(pendingCss, pendingEnabled, pendingConfig);

  const applyStored = (stored: Record<string, unknown>) => {
    apply(stored.vwebThemeSiteCss, stored.siteThemeEnabled, stored.vwebThemeSiteConfig);
  };

  dispatchSiteThemeConfig(documentRef, DEFAULT_SITE_THEME_CONFIG);

  try {
    const result = extensionApi?.storage?.local?.get?.(defaults);
    if (result && typeof result.then === "function") {
      void result.then(applyStored);
    } else if (extensionApi?.storage?.local?.get) {
      extensionApi.storage.local.get(defaults, applyStored);
    }
    extensionApi?.storage?.onChanged?.addListener?.((changes: Record<string, { newValue?: unknown }>, areaName: string) => {
      if (areaName !== "local") return;
      if (!changes.vwebThemeSiteCss && !changes.siteThemeEnabled && !changes.vwebThemeSiteConfig) return;
      const next = extensionApi.storage.local.get(defaults);
      if (next && typeof next.then === "function") void next.then(applyStored);
      else extensionApi.storage.local.get(defaults, applyStored);
    });
    documentRef.addEventListener("DOMContentLoaded", reapplyAfterPageStyles, { once: true });
    globalThis.setTimeout?.(reapplyAfterPageStyles, 0);
    globalThis.setTimeout?.(reapplyAfterPageStyles, 500);
  } catch {
    apply("", true, DEFAULT_SITE_THEME_CONFIG);
  }
}

function isPlayRuntimePage(documentRef: Document): boolean {
  try {
    const url = new URL(documentRef.URL || location.href);
    return url.searchParams.has("Play") || url.searchParams.has("VWEBLaunch");
  } catch {
    return false;
  }
}
