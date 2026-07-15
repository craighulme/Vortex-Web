import { autoUpdate, computePosition, flip, offset, shift, size } from "@floating-ui/dom";
import MiniSearch from "minisearch";
import { loadSiteGameCatalog, type SiteGameRecord as GameRecord, type SiteGameStats as GameStats } from "./SiteGameCatalog";

type SearchUser = {
  id: number;
  username: string;
  is_admin?: boolean;
  is_staff?: boolean;
  is_moderator?: boolean;
  is_booster?: boolean;
};

type GameDocument = GameRecord & { creator: string };

const MIN_QUERY_LENGTH = 2;
const USER_DETAIL_TTL_MS = 5 * 60 * 1000;
const userDetailCache = new Map<number, { expiresAt: number; value: Partial<SearchUser> }>();

export function installSiteSearch(documentRef: Document = document, fetcher: typeof fetch = fetch): void {
  if (isPlayPage(documentRef)) return;
  const start = () => {
    const input = documentRef.querySelector<HTMLInputElement>("#search-input");
    const form = documentRef.querySelector<HTMLFormElement>("#search-form");
    if (!input || !form || input.dataset.vwebSearch === "1") return;
    input.dataset.vwebSearch = "1";
    input.placeholder = "Search players, games...";
    mountSearch(documentRef, input, form, fetcher);
  };

  if (documentRef.readyState === "loading") documentRef.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}

function mountSearch(documentRef: Document, input: HTMLInputElement, form: HTMLFormElement, fetcher: typeof fetch): void {
  const shortcut = documentRef.createElement("kbd");
  shortcut.className = "vweb-search-shortcut";
  shortcut.setAttribute("aria-hidden", "true");
  shortcut.textContent = "/";
  form.appendChild(shortcut);

  const panel = documentRef.createElement("div");
  panel.id = "vweb-search-results";
  panel.setAttribute("role", "listbox");
  panel.setAttribute("aria-label", "Search suggestions");
  panel.hidden = true;
  documentRef.body.appendChild(panel);

  let debounceTimer = 0;
  let requestController: AbortController | null = null;
  let activeIndex = -1;
  let cleanupPosition: (() => void) | null = null;
  let gameSearchPromise: Promise<{ index: MiniSearch<GameDocument>; records: Map<number, GameDocument>; stats: GameStats }> | null = null;

  const close = () => {
    panel.hidden = true;
    activeIndex = -1;
    input.removeAttribute("aria-activedescendant");
    cleanupPosition?.();
    cleanupPosition = null;
  };

  const position = () => {
    if (cleanupPosition) return;
    cleanupPosition = autoUpdate(input, panel, () => {
      void computePosition(input, panel, {
        placement: "bottom-start",
        strategy: "fixed",
        middleware: [
          offset(8),
          flip({ padding: 12 }),
          shift({ padding: 12 }),
          size({
            padding: 12,
            apply({ rects, availableHeight, elements }) {
              Object.assign(elements.floating.style, {
                width: `${Math.max(rects.reference.width, 420)}px`,
                maxWidth: "calc(100vw - 24px)",
                maxHeight: `${Math.min(availableHeight, 520)}px`
              });
            }
          })
        ]
      }).then(({ x, y }) => Object.assign(panel.style, { left: `${x}px`, top: `${y}px` }));
    });
  };

  const open = () => {
    panel.hidden = false;
    position();
  };

  const getOptions = () => Array.from(panel.querySelectorAll<HTMLAnchorElement>("a[role='option']"));
  const setActive = (index: number) => {
    const options = getOptions();
    if (!options.length) return;
    activeIndex = (index + options.length) % options.length;
    options.forEach((option, optionIndex) => option.classList.toggle("active", optionIndex === activeIndex));
    const active = options[activeIndex];
    if (active) {
      input.setAttribute("aria-activedescendant", active.id);
      active.scrollIntoView({ block: "nearest" });
    }
  };

  const run = async () => {
    const query = input.value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      close();
      panel.replaceChildren();
      return;
    }

    requestController?.abort();
    requestController = new AbortController();
    renderStatus(documentRef, panel, "Searching...");
    open();

    try {
      gameSearchPromise ||= loadGameSearch(fetcher);
      const [users, games] = await Promise.all([
        fetcher(`/api/users/search?q=${encodeURIComponent(query)}`, {
          credentials: "include",
          signal: requestController.signal,
          headers: { accept: "application/json" }
        }).then((response) => response.ok ? response.json() as Promise<SearchUser[]> : []),
        gameSearchPromise
      ]);

      const gameMatches = games.index.search(query, {
        prefix: true,
        fuzzy: query.length >= 4 ? 0.25 : false,
        boost: { name: 3, creator: 1 }
      }).slice(0, 5).map((result) => games.records.get(Number(result.id))).filter(Boolean) as GameDocument[];
      const userMatches = await enrichUsers(fetcher, Array.isArray(users) ? users.slice(0, 7) : []);
      await renderResults(documentRef, panel, query, userMatches, gameMatches, games.stats, fetcher);
      activeIndex = -1;
      open();
    } catch (error) {
      if ((error as Error).name !== "AbortError") renderStatus(documentRef, panel, "Search is temporarily unavailable.");
    }
  };

  input.setAttribute("autocomplete", "off");
  input.setAttribute("aria-controls", panel.id);
  input.setAttribute("aria-autocomplete", "list");
  input.addEventListener("input", () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => void run(), 140);
  });
  input.addEventListener("focus", () => {
    if (panel.childElementCount && input.value.trim().length >= MIN_QUERY_LENGTH) open();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (panel.hidden) void run();
      else setActive(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      const target = getOptions()[activeIndex];
      if (target) {
        event.preventDefault();
        target.click();
      }
    } else if (event.key === "Escape") {
      close();
    }
  });
  form.addEventListener("submit", () => close());
  documentRef.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    event.preventDefault();
    input.focus();
    input.select();
  });
  documentRef.addEventListener("pointerdown", (event) => {
    const target = event.target as Node | null;
    if (target && target !== input && !panel.contains(target)) close();
  });
}

async function loadGameSearch(fetcher: typeof fetch): Promise<{ index: MiniSearch<GameDocument>; records: Map<number, GameDocument>; stats: GameStats }> {
  const { games, stats } = await loadSiteGameCatalog(fetcher);
  const documents = games.map((game) => ({ ...game, creator: String(game.creator_name || "") }));
  const index = new MiniSearch<GameDocument>({
    fields: ["name", "creator"],
    storeFields: ["id", "name", "creator", "thumbnail_version"]
  });
  index.addAll(documents);
  return { index, records: new Map(documents.map((game) => [game.id, game])), stats };
}

async function renderResults(
  documentRef: Document,
  panel: HTMLElement,
  query: string,
  users: SearchUser[],
  games: GameDocument[],
  stats: GameStats,
  fetcher: typeof fetch
): Promise<void> {
  panel.replaceChildren();
  const avatarMap = await fetchAvatars(fetcher, users.map((user) => user.id));
  if (users.length) {
    panel.appendChild(sectionLabel(documentRef, "Players"));
    for (const user of users) {
      const link = resultLink(documentRef, `/users/${user.id}/profile`, `vweb-search-user-${user.id}`);
      const avatar = documentRef.createElement("img");
      avatar.className = "vweb-search-avatar";
      avatar.alt = "";
      avatar.src = avatarMap[String(user.id)] || "/favicon.ico";
      const copy = documentRef.createElement("span");
      copy.className = "vweb-search-copy";
      const name = documentRef.createElement("strong");
      name.textContent = user.username;
      copy.append(name, searchBadge(documentRef, user));
      link.append(avatar, copy);
      panel.appendChild(link);
    }
  }

  if (games.length) {
    panel.appendChild(sectionLabel(documentRef, "Games"));
    for (const game of games) {
      const link = resultLink(documentRef, `/games/${game.id}`, `vweb-search-game-${game.id}`);
      const image = documentRef.createElement("img");
      image.className = "vweb-search-game-thumb";
      image.alt = "";
      image.src = thumbnailUrl(game);
      const copy = documentRef.createElement("span");
      copy.className = "vweb-search-copy";
      const name = documentRef.createElement("strong");
      name.textContent = game.name;
      const meta = documentRef.createElement("small");
      meta.textContent = `${stats[String(game.id)]?.active ?? 0} playing${game.creator ? ` - ${game.creator}` : ""}`;
      copy.append(name, meta);
      link.append(image, copy);
      panel.appendChild(link);
    }
  }

  if (!users.length && !games.length) renderStatus(documentRef, panel, `No matches for "${query}".`);
  const all = documentRef.createElement("a");
  all.className = "vweb-search-all";
  all.href = `/search?q=${encodeURIComponent(query)}`;
  all.textContent = "See all player results";
  panel.appendChild(all);
}

function resultLink(documentRef: Document, href: string, id: string): HTMLAnchorElement {
  const link = documentRef.createElement("a");
  link.id = id;
  link.href = href;
  link.className = "vweb-search-result";
  link.setAttribute("role", "option");
  return link;
}

function sectionLabel(documentRef: Document, label: string): HTMLElement {
  const heading = documentRef.createElement("div");
  heading.className = "vweb-search-section-label";
  heading.textContent = label;
  return heading;
}

function searchBadge(documentRef: Document, user: SearchUser): HTMLElement {
  const badge = documentRef.createElement("span");
  badge.className = "vweb-search-badges";
  if (user.is_admin) badge.appendChild(namedBadge(documentRef, "Admin", "admin"));
  else if (user.is_staff) badge.appendChild(namedBadge(documentRef, "Staff", "staff"));
  else if (user.is_moderator) badge.appendChild(namedBadge(documentRef, "Moderator", "moderator"));
  else if (user.is_booster) badge.appendChild(namedBadge(documentRef, "Booster", "booster"));
  return badge;
}

async function enrichUsers(fetcher: typeof fetch, users: SearchUser[]): Promise<SearchUser[]> {
  return Promise.all(users.map(async (user) => ({ ...user, ...await loadUserDetail(fetcher, user.id) })));
}

async function loadUserDetail(fetcher: typeof fetch, id: number): Promise<Partial<SearchUser>> {
  const cached = userDetailCache.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  let value: Partial<SearchUser> = {};
  try {
    const response = await fetcher(`/api/users/${id}`, { credentials: "include", headers: { accept: "application/json" } });
    if (response.ok) value = normalizeUserDetail(await response.json());
  } catch {
    // Search remains usable when user metadata is unavailable.
  }
  userDetailCache.set(id, { expiresAt: Date.now() + USER_DETAIL_TTL_MS, value });
  return value;
}

function normalizeUserDetail(value: unknown): Partial<SearchUser> {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const role = String(record.role || record.account_role || "").toLowerCase();
  return {
    is_admin: Boolean(record.is_admin || record.admin || role === "admin"),
    is_staff: Boolean(record.is_staff || record.staff || role === "staff"),
    is_moderator: Boolean(record.is_moderator || record.moderator || record.is_mod || role === "moderator" || role === "mod"),
    is_booster: Boolean(record.is_booster || record.booster)
  };
}

function namedBadge(documentRef: Document, label: string, kind: string): HTMLElement {
  const badge = documentRef.createElement("span");
  badge.className = `vweb-search-badge ${kind}`;
  badge.textContent = label;
  return badge;
}

async function fetchAvatars(fetcher: typeof fetch, ids: number[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  try {
    const response = await fetcher(`/api/users/avatar-pictures?ids=${ids.join(",")}`, {
      credentials: "include",
      headers: { accept: "application/json" }
    });
    return response.ok ? await response.json() as Record<string, string> : {};
  } catch {
    return {};
  }
}

function renderStatus(documentRef: Document, panel: HTMLElement, message: string): void {
  const status = documentRef.createElement("div");
  status.className = "vweb-search-status";
  status.textContent = message;
  panel.replaceChildren(status);
}

function thumbnailUrl(game: Pick<GameRecord, "id" | "thumbnail_version">): string {
  return `/assets/thumbnails/${game.id}.png${game.thumbnail_version ? `?v=${encodeURIComponent(game.thumbnail_version)}` : ""}`;
}

function isPlayPage(documentRef: Document): boolean {
  try {
    const url = new URL(documentRef.URL || location.href);
    return url.searchParams.has("Play") || url.searchParams.has("VWEBLaunch");
  } catch {
    return false;
  }
}
