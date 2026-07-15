import { DEFAULT_SITE_THEME_CONFIG, normalizeSiteThemeConfig, type SiteNavItem, type SiteThemeConfig } from "./SiteThemeConfig";

type ExtensionApi = {
  storage?: {
    local?: { get?: (defaults?: Record<string, unknown>) => Promise<Record<string, unknown>> | void };
  };
};

const NAV_SELECTORS: Record<SiteNavItem, string> = {
  catalog: 'a[href="/catalog"]',
  ugc: "#vweb-ugc-nav",
  download: 'a[href="/download"]',
  discord: 'a[href*="discord.gg"]',
  profile: "#vweb-user-menu",
  settings: 'a[href="/settings"]',
  signout: "#logout-btn"
};

export function installSiteChrome(documentRef: Document = document): void {
  if (isPlayPage(documentRef)) return;
  documentRef.documentElement.dataset.vwebSitePage = sitePage(documentRef);
  let config = DEFAULT_SITE_THEME_CONFIG;
  let scheduled = false;

  const apply = () => {
    scheduled = false;
    const actions = documentRef.querySelector<HTMLElement>(".navbar-actions");
    if (!actions) return;
    installUserMenu(documentRef, actions);
    const primary = installNavLayout(documentRef, actions);
    const elements = new Map<SiteNavItem, HTMLElement>();

    for (const [id, selector] of Object.entries(NAV_SELECTORS) as [SiteNavItem, string][]) {
      const element = actions.querySelector<HTMLElement>(selector) || documentRef.querySelector<HTMLElement>(selector);
      if (!element) continue;
      element.dataset.vwebNavItem = id;
      element.toggleAttribute("data-vweb-nav-hidden", config.navHidden.includes(id));
      elements.set(id, element);
    }

    const catalog = elements.get("catalog");
    const ugcMain = elements.get("ugc")?.querySelector<HTMLElement>(".vweb-ugc-nav-main");
    if (catalog && ugcMain) {
      for (const className of catalog.classList) {
        if (!ugcMain.classList.contains(className)) ugcMain.classList.add(className);
      }
    }

    const primaryItems = new Set<SiteNavItem>(["catalog", "ugc", "download", "discord"]);
    const desiredElements = config.navOrder
      .filter((id) => primaryItems.has(id))
      .map((id) => elements.get(id))
      .filter((element): element is HTMLElement => Boolean(element));
    const currentElements = Array.from(primary.children);
    const orderChanged = desiredElements.length !== currentElements.length
      || desiredElements.some((element, index) => currentElements[index] !== element);
    if (orderChanged) {
      primary.replaceChildren(...desiredElements);
    }
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(apply);
  };

  documentRef.addEventListener("vweb:site-theme-config", (event) => {
    config = normalizeSiteThemeConfig((event as CustomEvent<SiteThemeConfig>).detail);
    schedule();
  });

  readStoredConfig().then((stored) => {
    config = stored;
    schedule();
  });

  const start = () => {
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(documentRef.body || documentRef.documentElement, { childList: true, subtree: true });
  };

  if (documentRef.readyState === "loading") documentRef.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}

function installNavLayout(documentRef: Document, actions: HTMLElement): HTMLElement {
  let primary = actions.querySelector<HTMLElement>(".vweb-nav-primary");
  if (!primary) {
    primary = documentRef.createElement("div");
    primary.className = "vweb-nav-primary";
    actions.prepend(primary);
  }
  const search = documentRef.querySelector<HTMLElement>(".navbar-search");
  const userMenu = actions.querySelector<HTMLElement>("#vweb-user-menu");
  if (search && search.parentElement !== actions) actions.insertBefore(search, userMenu || null);
  return primary;
}

function installUserMenu(documentRef: Document, actions: HTMLElement): void {
  if (documentRef.getElementById("vweb-user-menu")) return;
  const profile = documentRef.getElementById("my-profile-btn");
  const settings = actions.querySelector<HTMLElement>('a[href="/settings"]');
  const signout = documentRef.getElementById("logout-btn");
  if (!profile || !settings || !signout) return;

  const menu = documentRef.createElement("div");
  menu.id = "vweb-user-menu";
  menu.className = "vweb-user-menu";
  const trigger = documentRef.createElement("button");
  trigger.type = "button";
  trigger.className = "vweb-user-menu-trigger";
  trigger.setAttribute("aria-label", "Open account menu");
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  const avatar = documentRef.createElement("img");
  avatar.className = "vweb-user-menu-avatar";
  avatar.alt = "";
  avatar.src = "/favicon.ico";
  const chevron = documentRef.createElement("span");
  chevron.className = "vweb-user-menu-chevron";
  chevron.textContent = "";
  chevron.setAttribute("aria-hidden", "true");
  trigger.append(avatar, chevron);

  const popup = documentRef.createElement("div");
  popup.className = "vweb-user-menu-popup";
  popup.setAttribute("role", "menu");
  popup.hidden = true;
  profile.removeAttribute("data-vweb-nav-item");
  profile.classList.add("vweb-user-menu-item");
  settings.classList.add("vweb-user-menu-item");
  signout.classList.add("vweb-user-menu-item", "danger");
  popup.append(profile, settings, signout);
  menu.append(trigger, popup);
  actions.appendChild(menu);

  const setOpen = (open: boolean) => {
    popup.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("open", open);
  };
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(popup.hidden);
  });
  documentRef.addEventListener("pointerdown", (event) => {
    if (!menu.contains(event.target as Node)) setOpen(false);
  });
  documentRef.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  void hydrateUserMenu(documentRef, avatar, trigger);
}

async function hydrateUserMenu(documentRef: Document, avatar: HTMLImageElement, trigger: HTMLButtonElement): Promise<void> {
  try {
    const response = await fetch("/me", { credentials: "include", headers: { accept: "application/json" } });
    if (!response.ok) return;
    const me = await response.json() as { id?: unknown; username?: unknown };
    const id = Number(me.id);
    if (!Number.isFinite(id) || id <= 0) return;
    trigger.title = String(me.username || "Account");
    const avatars = await fetch(`/api/users/avatar-pictures?ids=${id}`, {
      credentials: "include",
      headers: { accept: "application/json" }
    });
    if (!avatars.ok) return;
    const records = await avatars.json() as Record<string, string>;
    const avatarUrl = records[String(id)];
    if (avatarUrl) avatar.src = avatarUrl;
  } catch {
    // The account menu remains usable with its fallback icon.
  }
}

function sitePage(documentRef: Document): string {
  const path = new URL(documentRef.URL || location.href).pathname;
  if (path === "/home") return "home";
  if (/^\/games\/\d+\/?$/.test(path)) return "game";
  if (/^\/users\/\d+\/profile\/?$/.test(path)) return "profile";
  if (path === "/settings") return "settings";
  if (path === "/social") return "social";
  if (path.startsWith("/vweb/ugc/")) return "ugc";
  return "other";
}

async function readStoredConfig(): Promise<SiteThemeConfig> {
  const extensionApi = ((globalThis as { chrome?: ExtensionApi; browser?: ExtensionApi }).chrome
    || (globalThis as { chrome?: ExtensionApi; browser?: ExtensionApi }).browser);
  try {
    const result = extensionApi?.storage?.local?.get?.({ vwebThemeSiteConfig: DEFAULT_SITE_THEME_CONFIG });
    if (result && typeof (result as Promise<Record<string, unknown>>).then === "function") {
      const stored = await result as Record<string, unknown>;
      return normalizeSiteThemeConfig(stored.vwebThemeSiteConfig);
    }
  } catch {
    // The theme service will dispatch the active config when storage becomes available.
  }
  return DEFAULT_SITE_THEME_CONFIG;
}

function isPlayPage(documentRef: Document): boolean {
  try {
    const url = new URL(documentRef.URL || location.href);
    return url.searchParams.has("Play") || url.searchParams.has("VWEBLaunch");
  } catch {
    return false;
  }
}
