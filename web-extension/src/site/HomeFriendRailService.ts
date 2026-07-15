type FriendRequest = {
  id: number;
  from_user_id?: number;
  from_username?: string;
  to_user_id?: number;
  to_username?: string;
  from_user?: { id?: number; username?: string };
  to_user?: { id?: number; username?: string };
};

type RailTab = "friends" | "incoming" | "outgoing";

export function installHomeFriendRail(documentRef: Document = document, fetcher: typeof fetch = fetch): void {
  if (location.pathname !== "/home") return;
  const start = () => void mount(documentRef, fetcher);
  if (documentRef.readyState === "loading") documentRef.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}

async function mount(documentRef: Document, fetcher: typeof fetch): Promise<void> {
  const header = await waitForElement(documentRef, "[data-vweb-home-friends-header]");
  const carousel = documentRef.querySelector<HTMLElement>("[data-vweb-home-friends]");
  const friendRow = carousel?.querySelector<HTMLElement>(".friends-row");
  if (!header || !carousel || !friendRow || header.dataset.vwebRequests === "1") return;
  header.dataset.vwebRequests = "1";
  friendRow.dataset.vwebRailPane = "friends";
  void hydrateFriendAvatars(carousel, fetcher);

  const tabs = documentRef.createElement("div");
  tabs.className = "vweb-friend-rail-tabs";
  const panels = documentRef.createElement("div");
  panels.className = "vweb-friend-request-panels";
  const incomingPanel = panel(documentRef, "incoming");
  const outgoingPanel = panel(documentRef, "outgoing");
  panels.append(incomingPanel, outgoingPanel);
  carousel.appendChild(panels);

  let incoming: FriendRequest[] = [];
  let outgoing: FriendRequest[] = [];
  let loaded = false;
  let active: RailTab = "friends";

  const buttons = new Map<RailTab, HTMLButtonElement>();
  const addTab = (id: RailTab, label: string) => {
    const button = documentRef.createElement("button");
    button.type = "button";
    button.dataset.tab = id;
    button.textContent = label;
    button.addEventListener("click", () => void select(id));
    buttons.set(id, button);
    tabs.appendChild(button);
  };
  addTab("friends", "Friends");
  addTab("incoming", "Requests");
  addTab("outgoing", "Sent");
  let nativeTitle = documentRef.getElementById("friends-title");
  if (nativeTitle === header) {
    nativeTitle.removeAttribute("id");
    nativeTitle = documentRef.createElement("span");
    nativeTitle.id = "friends-title";
    header.prepend(nativeTitle);
  }
  nativeTitle?.setAttribute("data-vweb-native-friends-title", "1");
  header.appendChild(tabs);

  const updateLabels = () => {
    buttons.get("incoming")!.textContent = incoming.length ? `Requests ${incoming.length}` : "Requests";
    buttons.get("outgoing")!.textContent = outgoing.length ? `Sent ${outgoing.length}` : "Sent";
  };
  const removeRequest = (kind: "incoming" | "outgoing", id: number) => {
    if (kind === "incoming") incoming = incoming.filter((item) => item.id !== id);
    else outgoing = outgoing.filter((item) => item.id !== id);
    updateLabels();
    void render();
  };
  const render = async () => {
    await Promise.all([
      renderRequests(documentRef, incomingPanel, incoming, "incoming", fetcher, (id) => removeRequest("incoming", id)),
      renderRequests(documentRef, outgoingPanel, outgoing, "outgoing", fetcher, (id) => removeRequest("outgoing", id))
    ]);
  };
  const load = async () => {
    if (loaded) return;
    loaded = true;
    try {
      const [incomingResponse, outgoingResponse] = await Promise.all([
        fetcher("/api/friends/requests/incoming", { credentials: "include", headers: { accept: "application/json" } }),
        fetcher("/api/friends/requests/outgoing", { credentials: "include", headers: { accept: "application/json" } })
      ]);
      incoming = incomingResponse.ok ? normalizeRequests(await incomingResponse.json(), "incoming") : [];
      outgoing = outgoingResponse.ok ? normalizeRequests(await outgoingResponse.json(), "outgoing") : [];
      updateLabels();
      await render();
    } catch {
      incomingPanel.textContent = "Requests are temporarily unavailable.";
      outgoingPanel.textContent = "Sent requests are temporarily unavailable.";
    }
  };
  const select = async (tab: RailTab) => {
    active = tab;
    buttons.forEach((button, id) => button.classList.toggle("active", id === active));
    friendRow.hidden = active !== "friends";
    incomingPanel.hidden = active !== "incoming";
    outgoingPanel.hidden = active !== "outgoing";
    if (active !== "friends") await load();
  };
  await select("friends");
  void load();
}

async function renderRequests(
  documentRef: Document,
  target: HTMLElement,
  requests: FriendRequest[],
  kind: "incoming" | "outgoing",
  fetcher: typeof fetch,
  onRemove: (id: number) => void
): Promise<void> {
  target.replaceChildren();
  if (!requests.length) {
    target.textContent = kind === "incoming" ? "No incoming requests." : "No sent requests.";
    return;
  }
  const ids = requests.map((item) => requestUser(item, kind).id).filter(validId) as number[];
  const avatars = await loadAvatars(fetcher, ids);
  for (const request of requests) {
    const requestIdentity = requestUser(request, kind);
    const userId = requestIdentity.id;
    if (!Number.isFinite(userId) || userId <= 0) continue;
    const row = documentRef.createElement("article");
    row.className = "vweb-friend-request-row";
    const link = documentRef.createElement("a");
    link.href = `/users/${userId}/profile`;
    const avatar = documentRef.createElement("img");
    avatar.alt = "";
    avatar.src = avatars[String(userId)] || "/favicon.ico";
    const name = documentRef.createElement("strong");
    name.textContent = requestIdentity.username || `User ${userId}`;
    link.append(avatar, name);
    const actions = documentRef.createElement("div");
    actions.className = "vweb-friend-request-actions";
    if (kind === "incoming") {
      actions.append(
        action(documentRef, "Accept", "primary", async () => fetcher(`/api/friends/accept/${request.id}`, { method: "POST", credentials: "include" })),
        action(documentRef, "Decline", "", async () => fetcher(`/api/friends/reject/${request.id}`, { method: "POST", credentials: "include" }))
      );
    } else {
      actions.append(action(documentRef, "Cancel", "", async () => fetcher(`/api/friends/request/${userId}`, { method: "DELETE", credentials: "include" })));
    }
    actions.addEventListener("vweb:request-removed", () => {
      onRemove(request.id);
    }, { once: true });
    row.append(link, actions);
    target.appendChild(row);
  }
}

function action(documentRef: Document, label: string, variant: string, request: () => Promise<Response>): HTMLButtonElement {
  const button = documentRef.createElement("button");
  button.type = "button";
  button.className = variant;
  button.textContent = label;
  button.addEventListener("click", async () => {
    const container = button.parentElement;
    if (!container) return;
    for (const item of container.querySelectorAll<HTMLButtonElement>("button")) item.disabled = true;
    try {
      const response = await request();
      if (!response.ok) throw new Error(String(response.status));
      container.dispatchEvent(new CustomEvent("vweb:request-removed", { bubbles: false }));
    } catch {
      for (const item of container.querySelectorAll<HTMLButtonElement>("button")) item.disabled = false;
    }
  });
  return button;
}

function panel(documentRef: Document, id: RailTab): HTMLElement {
  const item = documentRef.createElement("div");
  item.className = "vweb-friend-request-panel";
  item.dataset.vwebRailPane = id;
  item.hidden = true;
  item.textContent = "Loading...";
  return item;
}

function normalizeRequests(value: unknown, kind: "incoming" | "outgoing"): FriendRequest[] {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const items = Array.isArray(value)
    ? value
    : record.requests || record[kind] || record.data || [];
  return Array.isArray(items) ? items.filter((item): item is FriendRequest => Boolean(item && typeof item === "object" && Number((item as FriendRequest).id) > 0)) : [];
}

function requestUser(request: FriendRequest, kind: "incoming" | "outgoing"): { id: number; username: string } {
  const nested = kind === "incoming" ? request.from_user : request.to_user;
  return {
    id: Number(kind === "incoming" ? request.from_user_id ?? nested?.id : request.to_user_id ?? nested?.id),
    username: String(kind === "incoming" ? request.from_username ?? nested?.username ?? "" : request.to_username ?? nested?.username ?? "")
  };
}

function validId(value: unknown): boolean {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

async function loadAvatars(fetcher: typeof fetch, ids: number[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  try {
    const response = await fetcher(`/api/users/avatar-pictures?ids=${[...new Set(ids)].join(",")}`, { credentials: "include", headers: { accept: "application/json" } });
    return response.ok ? normalizeAvatars(await response.json()) : {};
  } catch {
    return {};
  }
}

async function hydrateFriendAvatars(carousel: HTMLElement, fetcher: typeof fetch): Promise<void> {
  const cards = Array.from(carousel.querySelectorAll<HTMLAnchorElement>(".friend-card[href*='/users/']"));
  const records = cards.map((card) => ({ card, id: Number(card.href.match(/\/users\/(\d+)/)?.[1]) })).filter((item) => validId(item.id));
  const avatars = await loadAvatars(fetcher, records.map((item) => item.id));
  for (const { card, id } of records) {
    const image = card.querySelector<HTMLImageElement>("img");
    const source = avatars[String(id)];
    if (image && source) image.src = source;
    image?.addEventListener("error", () => { image.src = "/favicon.ico"; }, { once: true });
  }
}

function normalizeAvatars(value: unknown): Record<string, string> {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const nested = source.avatars && typeof source.avatars === "object" ? source.avatars as Record<string, unknown> : source;
  const result: Record<string, string> = {};
  for (const [id, url] of Object.entries(nested)) if (typeof url === "string" && url) result[id] = url;
  return result;
}

function waitForElement(documentRef: Document, selector: string, timeoutMs = 4000): Promise<HTMLElement | null> {
  const existing = documentRef.querySelector<HTMLElement>(selector);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const element = documentRef.querySelector<HTMLElement>(selector);
      if (!element) return;
      observer.disconnect();
      resolve(element);
    });
    observer.observe(documentRef.documentElement, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(documentRef.querySelector<HTMLElement>(selector));
    }, timeoutMs);
  });
}
