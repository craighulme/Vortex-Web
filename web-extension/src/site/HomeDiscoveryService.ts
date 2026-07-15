import { loadSiteGameCatalog, type SiteGameRecord as GameRecord, type SiteGameStats as GameStats } from "./SiteGameCatalog";
import { launchGameInBrowser } from "../content-scripts/playInBrowserButton";

type SortMode = "active" | "visits" | "name";

type ExtensionApi = {
  storage?: {
    local?: {
      get?: (defaults?: Record<string, unknown>) => Promise<Record<string, unknown>> | void;
      set?: (values: Record<string, unknown>) => Promise<void> | void;
    };
  };
};

const RECENT_STORAGE_KEY = "vwebRecentGames";
const SORT_STORAGE_KEY = "vwebHomeGameSort";

export function installHomeDiscovery(documentRef: Document = document, fetcher: typeof fetch = fetch): void {
  if (location.pathname !== "/home") return;
  const start = () => void mountHomeDiscovery(documentRef, fetcher);
  if (documentRef.readyState === "loading") documentRef.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}

async function mountHomeDiscovery(documentRef: Document, fetcher: typeof fetch): Promise<void> {
  const page = documentRef.querySelector<HTMLElement>(".page");
  const nativeGrid = documentRef.querySelector<HTMLElement>("#games-grid");
  if (!page || !nativeGrid || documentRef.getElementById("vweb-home-discovery")) return;

  const nativeGamesHeader = nativeGrid.previousElementSibling as HTMLElement | null;
  const friendsTitle = documentRef.getElementById("friends-title");
  const friendsHeader = friendsTitle?.closest<HTMLElement>(".section-header") || null;
  const friendsCarousel = documentRef.getElementById("friends-carousel");
  const separator = page.querySelector<HTMLElement>(".section-sep");
  nativeGrid.dataset.vwebNativeHomeGames = "1";
  nativeGamesHeader?.setAttribute("data-vweb-native-home-games", "1");
  friendsHeader?.setAttribute("data-vweb-home-friends-header", "1");
  friendsCarousel?.setAttribute("data-vweb-home-friends", "1");
  separator?.setAttribute("data-vweb-home-separator", "1");

  const root = documentRef.createElement("div");
  root.id = "vweb-home-discovery";
  root.setAttribute("aria-label", "Game discovery");
  nativeGamesHeader?.insertAdjacentElement("beforebegin", root);

  try {
    const [catalog, preferences] = await Promise.all([
      loadSiteGameCatalog(fetcher),
      storageGet({ [RECENT_STORAGE_KEY]: [], [SORT_STORAGE_KEY]: { mode: "active", descending: true } })
    ]);
    renderDiscovery(documentRef, root, catalog.games, catalog.stats, preferences);
  } catch {
    root.remove();
  }
}

function renderDiscovery(
  documentRef: Document,
  root: HTMLElement,
  games: GameRecord[],
  stats: GameStats,
  preferences: Record<string, unknown>
): void {
  const recentIds = normalizeRecentIds(preferences[RECENT_STORAGE_KEY]);
  const sortPreference = normalizeSort(preferences[SORT_STORAGE_KEY]);
  const byId = new Map(games.map((game) => [game.id, game]));
  const recent = recentIds.map((id) => byId.get(id)).filter(Boolean).slice(0, 6) as GameRecord[];
  const trending = [...games]
    .sort((left, right) => activeFor(stats, right.id) - activeFor(stats, left.id) || visitsFor(stats, right.id) - visitsFor(stats, left.id))
    .slice(0, 3);

  if (recent.length) root.appendChild(buildSection(documentRef, "Continue playing", recent, stats, "compact"));
  root.appendChild(buildSection(documentRef, "Trending now", trending, stats, "feature"));

  const discover = documentRef.createElement("section");
  discover.className = "vweb-home-section vweb-home-discover";
  const header = documentRef.createElement("header");
  header.className = "vweb-home-section-head";
  const title = documentRef.createElement("h2");
  title.textContent = "Discover games";
  const controls = documentRef.createElement("div");
  controls.className = "vweb-home-sort";
  const sort = documentRef.createElement("select");
  sort.setAttribute("aria-label", "Sort games");
  sort.append(
    option(documentRef, "Players online", "active"),
    option(documentRef, "Total visits", "visits"),
    option(documentRef, "Name", "name")
  );
  sort.value = sortPreference.mode;
  const direction = documentRef.createElement("button");
  direction.type = "button";
  direction.className = "vweb-home-sort-direction";
  direction.setAttribute("aria-label", "Reverse sort order");
  const grid = documentRef.createElement("div");
  grid.className = "vweb-home-grid vweb-home-grid-discover";

  let descending = sortPreference.descending;
  const render = () => {
    direction.textContent = descending ? "High to low" : "Low to high";
    const sorted = sortGames(games, stats, sort.value as SortMode, descending);
    grid.replaceChildren(...sorted.map((game) => gameCard(documentRef, game, stats, "discover")));
    void storageSet({ [SORT_STORAGE_KEY]: { mode: sort.value, descending } });
  };
  sort.addEventListener("change", render);
  direction.addEventListener("click", () => {
    descending = !descending;
    render();
  });
  controls.append(sort, direction);
  header.append(title, controls);
  discover.append(header, grid);
  root.appendChild(discover);
  render();

  root.addEventListener("click", (event) => {
    const card = (event.target as Element | null)?.closest<HTMLElement>("[data-vweb-game-id]");
    const gameId = Number(card?.dataset.vwebGameId);
    if (Number.isFinite(gameId) && gameId > 0) void rememberGame(gameId);
  });
}

function buildSection(documentRef: Document, titleText: string, games: GameRecord[], stats: GameStats, variant: "compact" | "feature"): HTMLElement {
  const section = documentRef.createElement("section");
  section.className = `vweb-home-section vweb-home-${variant}`;
  const header = documentRef.createElement("header");
  header.className = "vweb-home-section-head";
  const title = documentRef.createElement("h2");
  title.textContent = titleText;
  header.appendChild(title);
  const grid = documentRef.createElement("div");
  grid.className = `vweb-home-grid vweb-home-grid-${variant}`;
  grid.append(...games.map((game) => gameCard(documentRef, game, stats, variant)));
  section.append(header, grid);
  return section;
}

function gameCard(documentRef: Document, game: GameRecord, stats: GameStats, variant: string): HTMLElement {
  const card = documentRef.createElement("article");
  card.className = `vweb-home-game-card ${variant}`;
  card.dataset.vwebGameId = String(game.id);
  const link = documentRef.createElement("a");
  link.className = "vweb-home-game-link";
  link.href = `/games/${game.id}`;
  link.setAttribute("aria-label", `View ${game.name}`);
  const media = documentRef.createElement("span");
  media.className = "vweb-home-game-media";
  const image = documentRef.createElement("img");
  image.src = thumbnailUrl(game);
  image.alt = "";
  image.loading = "lazy";
  const play = documentRef.createElement("button");
  play.type = "button";
  play.className = "vweb-home-game-play";
  play.textContent = "Play";
  play.setAttribute("aria-label", `Play ${game.name} in Vortex Web`);
  play.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void rememberGame(game.id);
    void launchGameInBrowser(play, game.id, documentRef, window, fetch);
  });
  const players = documentRef.createElement("span");
  players.className = "vweb-home-game-players";
  players.textContent = `${activeFor(stats, game.id)} playing`;
  media.append(image, players);
  const copy = documentRef.createElement("span");
  copy.className = "vweb-home-game-copy";
  const title = documentRef.createElement("strong");
  title.textContent = game.name;
  const creator = documentRef.createElement("small");
  creator.textContent = game.creator_name ? `by ${game.creator_name}` : `${visitsFor(stats, game.id).toLocaleString()} visits`;
  copy.append(title, creator);
  link.append(media, copy);
  card.append(link, play);
  return card;
}

function sortGames(games: GameRecord[], stats: GameStats, mode: SortMode, descending: boolean): GameRecord[] {
  const direction = descending ? -1 : 1;
  return [...games].sort((left, right) => {
    if (mode === "name") return left.name.localeCompare(right.name) * direction;
    const leftValue = mode === "visits" ? visitsFor(stats, left.id) : activeFor(stats, left.id);
    const rightValue = mode === "visits" ? visitsFor(stats, right.id) : activeFor(stats, right.id);
    return (leftValue - rightValue) * direction || left.name.localeCompare(right.name);
  });
}

function activeFor(stats: GameStats, id: number): number {
  return Number(stats[String(id)]?.active || 0);
}

function visitsFor(stats: GameStats, id: number): number {
  return Number(stats[String(id)]?.visits || 0);
}

function thumbnailUrl(game: GameRecord): string {
  return `/assets/thumbnails/${game.id}.png${game.thumbnail_version ? `?v=${encodeURIComponent(game.thumbnail_version)}` : ""}`;
}

function option(documentRef: Document, label: string, value: SortMode): HTMLOptionElement {
  const item = documentRef.createElement("option");
  item.value = value;
  item.textContent = label;
  return item;
}

function normalizeRecentIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map(Number).filter((id) => Number.isFinite(id) && id > 0);
}

function normalizeSort(value: unknown): { mode: SortMode; descending: boolean } {
  const source = value && typeof value === "object" ? value as { mode?: unknown; descending?: unknown } : {};
  const mode: SortMode = source.mode === "visits" || source.mode === "name" ? source.mode : "active";
  return { mode, descending: source.descending !== false };
}

async function rememberGame(gameId: number): Promise<void> {
  const stored = await storageGet({ [RECENT_STORAGE_KEY]: [] });
  const next = [gameId, ...normalizeRecentIds(stored[RECENT_STORAGE_KEY]).filter((id) => id !== gameId)].slice(0, 12);
  await storageSet({ [RECENT_STORAGE_KEY]: next });
}

function extensionApi(): ExtensionApi | undefined {
  return (globalThis as { chrome?: ExtensionApi; browser?: ExtensionApi }).chrome
    || (globalThis as { chrome?: ExtensionApi; browser?: ExtensionApi }).browser;
}

async function storageGet(defaults: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    const result = extensionApi()?.storage?.local?.get?.(defaults);
    if (result && typeof (result as Promise<Record<string, unknown>>).then === "function") {
      return await result as Record<string, unknown>;
    }
  } catch {
    // Defaults keep the home page usable when extension storage is unavailable.
  }
  return defaults;
}

async function storageSet(values: Record<string, unknown>): Promise<void> {
  try {
    await extensionApi()?.storage?.local?.set?.(values);
  } catch {
    // Recent games and sorting are non-critical preferences.
  }
}
