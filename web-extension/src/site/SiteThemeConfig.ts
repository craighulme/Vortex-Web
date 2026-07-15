export const SITE_NAV_ITEMS = [
  "catalog",
  "ugc",
  "download",
  "discord",
  "profile",
  "settings",
  "signout"
] as const;

export type SiteNavItem = typeof SITE_NAV_ITEMS[number];
export type SiteLayout = "modern" | "classic";

export type SiteThemeConfig = {
  layout: SiteLayout;
  navOrder: SiteNavItem[];
  navHidden: SiteNavItem[];
};

export const DEFAULT_SITE_THEME_CONFIG: SiteThemeConfig = {
  layout: "modern",
  navOrder: [...SITE_NAV_ITEMS],
  navHidden: []
};

export const CLASSIC_SITE_THEME_CONFIG: SiteThemeConfig = {
  layout: "classic",
  navOrder: ["catalog", "ugc", "download", "discord", "profile", "settings", "signout"],
  navHidden: []
};

export function normalizeSiteThemeConfig(value: unknown): SiteThemeConfig {
  const source = value && typeof value === "object" ? value as Partial<SiteThemeConfig> : {};
  const layout: SiteLayout = source.layout === "classic" ? "classic" : "modern";
  const requestedOrder = Array.isArray(source.navOrder) ? source.navOrder : [];
  const requestedHidden = Array.isArray(source.navHidden) ? source.navHidden : [];
  const valid = new Set<SiteNavItem>(SITE_NAV_ITEMS);
  const order = requestedOrder.filter((item): item is SiteNavItem => valid.has(item as SiteNavItem));
  const hidden = requestedHidden.filter((item): item is SiteNavItem => valid.has(item as SiteNavItem));

  for (const item of SITE_NAV_ITEMS) {
    if (!order.includes(item)) order.push(item);
  }

  return {
    layout,
    navOrder: order,
    navHidden: [...new Set(hidden)]
  };
}

export function dispatchSiteThemeConfig(documentRef: Document, config: SiteThemeConfig): void {
  documentRef.documentElement.dataset.vwebSiteLayout = config.layout;
  documentRef.dispatchEvent(new CustomEvent<SiteThemeConfig>("vweb:site-theme-config", { detail: config }));
}
