export function installCustomSiteTheme(documentRef: Document = document): void {
  if (isPlayRuntimePage(documentRef)) return;

  const extensionApi = (globalThis as typeof globalThis & { chrome?: any; browser?: any }).chrome
    || (globalThis as typeof globalThis & { chrome?: any; browser?: any }).browser;
  const defaults = { vwebThemeSiteCss: "", siteThemeEnabled: true };
  let pendingCss = "";
  let pendingEnabled: unknown = true;
  let enforcing = false;

  const host = () => documentRef.head || documentRef.documentElement;
  const keepLast = (style: HTMLStyleElement) => {
    const target = host();
    if (style.parentElement !== target || target.lastElementChild !== style) target.appendChild(style);
  };

  const apply = (css: unknown, enabled: unknown = true) => {
    pendingCss = String(css || "");
    pendingEnabled = enabled;
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
  const reapplyAfterPageStyles = () => apply(pendingCss, pendingEnabled);

  try {
    const result = extensionApi?.storage?.local?.get?.(defaults);
    if (result && typeof result.then === "function") {
      void result.then((stored: Record<string, unknown>) => apply(stored.vwebThemeSiteCss, stored.siteThemeEnabled));
    } else if (extensionApi?.storage?.local?.get) {
      extensionApi.storage.local.get(defaults, (stored: Record<string, unknown>) => apply(stored.vwebThemeSiteCss, stored.siteThemeEnabled));
    }
    extensionApi?.storage?.onChanged?.addListener?.((changes: Record<string, { newValue?: unknown }>, areaName: string) => {
      if (areaName !== "local") return;
      if (!changes.vwebThemeSiteCss && !changes.siteThemeEnabled) return;
      const css = changes.vwebThemeSiteCss?.newValue;
      if (typeof css === "undefined") {
        const next = extensionApi.storage.local.get(defaults);
        if (next && typeof next.then === "function") void next.then((stored: Record<string, unknown>) => apply(stored.vwebThemeSiteCss, stored.siteThemeEnabled));
        else extensionApi.storage.local.get(defaults, (stored: Record<string, unknown>) => apply(stored.vwebThemeSiteCss, stored.siteThemeEnabled));
      } else {
        apply(css, changes.siteThemeEnabled?.newValue ?? true);
      }
    });
    documentRef.addEventListener("DOMContentLoaded", reapplyAfterPageStyles, { once: true });
    globalThis.setTimeout?.(reapplyAfterPageStyles, 0);
    globalThis.setTimeout?.(reapplyAfterPageStyles, 500);
    if (typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver(() => {
        if (enforcing) return;
        enforcing = true;
        globalThis.setTimeout?.(() => {
          enforcing = false;
          reapplyAfterPageStyles();
        }, 0);
      });
      observer.observe(documentRef.documentElement, { childList: true, subtree: true });
    }
  } catch {
    apply("");
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
