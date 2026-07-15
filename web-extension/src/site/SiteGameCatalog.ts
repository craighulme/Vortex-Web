export type SiteGameRecord = {
  id: number;
  name: string;
  creator_name?: string;
  thumbnail_version?: string;
};

export type SiteGameStat = { active?: number; visits?: number };
export type SiteGameStats = Record<string, SiteGameStat>;

export type SiteGameCatalog = {
  games: SiteGameRecord[];
  stats: SiteGameStats;
};

let catalogPromise: Promise<SiteGameCatalog> | null = null;

export function loadSiteGameCatalog(fetcher: typeof fetch = fetch): Promise<SiteGameCatalog> {
  if (!catalogPromise) {
    catalogPromise = Promise.all([
      fetcher("/api/games", { credentials: "include", headers: { accept: "application/json" } })
        .then((response) => response.ok ? response.json() as Promise<SiteGameRecord[]> : []),
      fetcher("/api/game-stats", { credentials: "include", headers: { accept: "application/json" } })
        .then((response) => response.ok ? response.json() as Promise<SiteGameStats> : {})
    ]).then(([games, stats]): SiteGameCatalog => ({
      games: Array.isArray(games) ? games : [],
      stats: stats && typeof stats === "object" ? stats as SiteGameStats : {}
    })).catch((): SiteGameCatalog => ({ games: [], stats: {} }));
  }
  return catalogPromise;
}
