import { readRuntimeDisplaySettings } from "./RuntimeDisplaySettings";
import { matchesKeybind } from "../input/KeybindSettings";

type ChatApi = {
  message(username: string, text: string, isSelf?: boolean, isStaff?: boolean, isOwner?: boolean, isBooster?: boolean, playerId?: number): void;
  system(text: string): void;
  systemPlayer(username: string, text: string, isSelf?: boolean): void;
  systemRed(text: string): void;
  clearPlayerMsg(username?: string): void;
  warn(text: string): void;
  open(): void;
  close(): void;
  activate(): void;
  deactivate(): void;
  isActive(): boolean;
  send(): void;
};

export type ChatIncomingEvent = {
  username: string;
  text: string;
  isSelf: boolean;
  isStaff: boolean;
  isOwner: boolean;
  isBooster: boolean;
  playerId?: number;
};

export type ChatOutgoingDecision =
  | boolean
  | string
  | {
      cancel?: boolean;
      text?: string;
    };

type ChatWindow = Window & {
  Chat?: ChatApi;
  _chatFocused?: boolean;
};

export type ChatOutboundHandlers = {
  handleCommand?: (text: string) => boolean;
  beforeSend?: (text: string) => ChatOutgoingDecision | Promise<ChatOutgoingDecision>;
  onIncoming?: (event: ChatIncomingEvent) => void;
  sendMessage?: (text: string) => void;
};

const NAME_COLORS = ["#60a5fa", "#34d399", "#f87171", "#fbbf24", "#a78bfa", "#fb923c", "#f472b6"];

export class ChatService {
  private apiObject: ChatApi | null = null;
  private mounted = false;
  private isOpen = true;
  private unread = 0;
  private value = "";
  private selectionAnchor = 0;
  private selectionFocus = 0;
  private active = false;
  private warnTimer: number | null = null;
  private outbound: ChatOutboundHandlers = {};

  constructor(
    private readonly document: Document,
    private readonly windowRef: ChatWindow
  ) {}

  mount(): boolean {
    if (this.mounted) return true;
    const chatWindow = this.document.getElementById("chat-window");
    const messagesEl = this.document.getElementById("chat-messages");
    const inputEl = this.document.getElementById("chat-input");
    const sendBtn = this.document.getElementById("chat-send");
    const toggleBtn = this.document.getElementById("chat-toggle-btn");
    const badge = this.document.getElementById("unread-badge");
    if (!chatWindow || !messagesEl || !inputEl || !sendBtn || !toggleBtn || !badge) return false;

    const warnEl = this.document.createElement("div");
    warnEl.className = "chat-warn hidden";
    chatWindow.appendChild(warnEl);

    const renderDisplay = () => {
      const start = this.selectionStart();
      const end = this.selectionEnd();
      if (!this.value && !this.active) {
        inputEl.innerHTML = '<span class="chat-placeholder">Click or press / to chat</span>';
        return;
      }

      if (this.hasSelection()) {
        inputEl.innerHTML = [
          escapeHtml(this.value.slice(0, start)),
          `<span class="chat-sel">${escapeHtml(this.value.slice(start, end))}</span>`,
          escapeHtml(this.value.slice(end))
        ].join("");
        return;
      }

      const pos = this.selectionFocus;
      inputEl.innerHTML = [
        escapeHtml(this.value.slice(0, pos)),
        this.active ? '<span class="chat-caret"></span>' : "",
        escapeHtml(this.value.slice(pos))
      ].join("");
    };

    const scrollBottom = () => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    const append = (html: string) => {
      const atBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 60;
      const tmp = this.document.createElement("div");
      tmp.innerHTML = html;
      const first = tmp.firstChild;
      if (first) messagesEl.appendChild(first);
      if (atBottom) scrollBottom();
      if (!this.isOpen) {
        this.unread = Math.min(this.unread + 1, 99);
        badge.textContent = this.unread >= 99 ? "99+" : String(this.unread);
        badge.classList.remove("hidden");
      }
    };

    const insertText = (text: string) => {
      const start = this.selectionStart();
      const end = this.selectionEnd();
      this.value = this.value.slice(0, start) + text + this.value.slice(end);
      this.selectionAnchor = this.selectionFocus = this.clamp(start + text.length);
      renderDisplay();
    };

    const deleteRange = (start: number, end: number) => {
      this.value = this.value.slice(0, start) + this.value.slice(end);
      this.selectionAnchor = this.selectionFocus = this.clamp(start);
      renderDisplay();
    };

    const activate = () => {
      if (!this.isOpen) open();
      this.active = true;
      this.windowRef._chatFocused = true;
      inputEl.classList.add("chat-active");
      renderDisplay();
    };

    const deactivate = () => {
      this.active = false;
      this.windowRef._chatFocused = false;
      inputEl.classList.remove("chat-active");
      renderDisplay();
    };

    const open = () => {
      this.isOpen = true;
      chatWindow.classList.remove("hidden");
      this.unread = 0;
      badge.classList.add("hidden");
      scrollBottom();
    };

    const close = () => {
      this.isOpen = false;
      chatWindow.classList.add("hidden");
      deactivate();
    };

    const send = () => {
      void sendAsync();
    };

    const sendAsync = async () => {
      let text = this.value.trim();
      if (!text) {
        deactivate();
        return;
      }
      const decision = this.outbound.beforeSend ? await Promise.resolve(this.outbound.beforeSend(text)).catch(() => true) : true;
      const resolved = resolveOutgoingDecision(decision, text);
      if (resolved.cancel) {
        this.value = "";
        this.selectionAnchor = this.selectionFocus = 0;
        deactivate();
        return;
      }
      text = resolved.text;
      if (!text) {
        this.value = "";
        this.selectionAnchor = this.selectionFocus = 0;
        deactivate();
        return;
      }
      if (this.outbound.handleCommand?.(text)) {
        this.value = "";
        this.selectionAnchor = this.selectionFocus = 0;
        deactivate();
        return;
      }
      this.outbound.sendMessage?.(text);
      this.value = "";
      this.selectionAnchor = this.selectionFocus = 0;
      deactivate();
    };

    toggleBtn.addEventListener("click", () => this.isOpen ? close() : open());
    sendBtn.addEventListener("click", send);

    this.document.addEventListener("keydown", (event) => {
      if (this.document.pointerLockElement && !this.active && matchesKeybind(event, "chatToggle")) {
        event.preventDefault();
        this.isOpen ? close() : open();
        return;
      }
      if (this.document.pointerLockElement && !this.active && matchesKeybind(event, "chatFocus")) {
        event.preventDefault();
        activate();
        return;
      }
      if (!this.active) return;
      event.stopPropagation();

      const ctrl = event.ctrlKey || event.metaKey;
      if (event.key === "Enter") {
        event.preventDefault();
        send();
      } else if (event.key === "Escape") {
        event.preventDefault();
        deactivate();
      } else if (ctrl && event.key.toLowerCase() === "a") {
        event.preventDefault();
        this.selectionAnchor = 0;
        this.selectionFocus = this.value.length;
        renderDisplay();
      } else if (ctrl && event.key.toLowerCase() === "c") {
        if (this.hasSelection()) this.windowRef.navigator.clipboard?.writeText(this.value.slice(this.selectionStart(), this.selectionEnd())).catch(() => {});
      } else if (ctrl && event.key.toLowerCase() === "x") {
        event.preventDefault();
        if (this.hasSelection()) {
          this.windowRef.navigator.clipboard?.writeText(this.value.slice(this.selectionStart(), this.selectionEnd())).catch(() => {});
          deleteRange(this.selectionStart(), this.selectionEnd());
        }
      } else if (ctrl && event.key.toLowerCase() === "v") {
        event.preventDefault();
        this.windowRef.navigator.clipboard?.readText()
          .then((text) => insertText(text.replace(/[\n\r]/g, " ").slice(0, 200 - (this.value.length - (this.selectionEnd() - this.selectionStart())))))
          .catch(() => {});
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (event.shiftKey) this.selectionFocus = this.clamp(this.selectionFocus - 1);
        else this.selectionAnchor = this.selectionFocus = this.hasSelection() ? this.selectionStart() : this.clamp(this.selectionFocus - 1);
        renderDisplay();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        if (event.shiftKey) this.selectionFocus = this.clamp(this.selectionFocus + 1);
        else this.selectionAnchor = this.selectionFocus = this.hasSelection() ? this.selectionEnd() : this.clamp(this.selectionFocus + 1);
        renderDisplay();
      } else if (event.key === "Home") {
        event.preventDefault();
        if (event.shiftKey) this.selectionFocus = 0;
        else this.selectionAnchor = this.selectionFocus = 0;
        renderDisplay();
      } else if (event.key === "End") {
        event.preventDefault();
        if (event.shiftKey) this.selectionFocus = this.value.length;
        else this.selectionAnchor = this.selectionFocus = this.value.length;
        renderDisplay();
      } else if (event.key === "Backspace") {
        event.preventDefault();
        if (this.hasSelection()) deleteRange(this.selectionStart(), this.selectionEnd());
        else if (this.selectionFocus > 0) deleteRange(this.selectionFocus - 1, this.selectionFocus);
      } else if (event.key === "Delete") {
        event.preventDefault();
        if (this.hasSelection()) deleteRange(this.selectionStart(), this.selectionEnd());
        else if (this.selectionFocus < this.value.length) deleteRange(this.selectionFocus, this.selectionFocus + 1);
      } else if (!ctrl && event.key.length === 1) {
        event.preventDefault();
        const remaining = 200 - (this.value.length - (this.selectionEnd() - this.selectionStart()));
        if (remaining > 0) insertText(event.key);
      }
    }, true);

    this.apiObject = {
      message: (username, text, isSelf, isStaff, isOwner, _isBooster, playerId) => {
        const incoming: ChatIncomingEvent = {
          username,
          text,
          isSelf: Boolean(isSelf),
          isStaff: Boolean(isStaff),
          isOwner: Boolean(isOwner),
          isBooster: Boolean(_isBooster)
        };
        if (playerId !== undefined) incoming.playerId = playerId;
        try {
          this.outbound.onIncoming?.(incoming);
        } catch {
          // Script hooks are advisory; chat rendering must keep working.
        }
        const safeName = escapeHtml(username);
        const gradient = this.readNameGradient(playerId, !!isSelf, username);
        let nameHtml: string;
        if (gradient) nameHtml = `<span class="msg-name msg-vweb-gradient" style="${nameGradientStyle(gradient)}">${safeName}</span>`;
        else if (isOwner) nameHtml = `<span class="msg-name msg-gradient-owner">${safeName}</span>`;
        else if (isStaff) nameHtml = `<span class="msg-name msg-gradient-staff">${safeName}</span>`;
        else nameHtml = `<span class="msg-name" style="color:${isSelf ? "#fff" : nameColor(username)}">${safeName}</span>`;
        append(`<div class="msg${isSelf ? " msg-self" : ""}">${nameHtml}: <span class="msg-text">${escapeHtml(text)}</span></div>`);
      },
      system: (text) => append(`<div class="msg-system">${escapeHtml(text)}</div>`),
      systemPlayer: (username, text) => append(`<div class="msg-system">${escapeHtml(text).replace(escapeHtml(username), `<b>${escapeHtml(username)}</b>`)}</div>`),
      systemRed: (text) => append(`<div class="msg-system-red">${escapeHtml(text)}</div>`),
      clearPlayerMsg: () => {},
      warn: (text) => {
        warnEl.textContent = text;
        warnEl.classList.remove("hidden");
        if (this.warnTimer !== null) this.windowRef.clearTimeout(this.warnTimer);
        this.warnTimer = this.windowRef.setTimeout(() => warnEl.classList.add("hidden"), 3000);
      },
      open,
      close,
      activate,
      deactivate,
      isActive: () => this.active,
      send
    };

    this.windowRef.Chat = this.apiObject;
    this.mounted = true;
    renderDisplay();
    return true;
  }

  api(): ChatApi | null {
    return this.apiObject;
  }

  configureOutbound(handlers: ChatOutboundHandlers): void {
    const next: ChatOutboundHandlers = {};
    if (handlers.handleCommand) next.handleCommand = handlers.handleCommand;
    if (handlers.beforeSend) next.beforeSend = handlers.beforeSend;
    if (handlers.onIncoming) next.onIncoming = handlers.onIncoming;
    if (handlers.sendMessage) next.sendMessage = handlers.sendMessage;
    this.outbound = next;
  }

  snapshot(): { mounted: boolean; open: boolean; active: boolean; unread: number } {
    return {
      mounted: this.mounted,
      open: this.isOpen,
      active: this.active,
      unread: this.unread
    };
  }

  private selectionStart(): number {
    return Math.min(this.selectionAnchor, this.selectionFocus);
  }

  private selectionEnd(): number {
    return Math.max(this.selectionAnchor, this.selectionFocus);
  }

  private hasSelection(): boolean {
    return this.selectionAnchor !== this.selectionFocus;
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(this.value.length, value));
  }

  private readNameGradient(playerId: unknown, isSelf = false, username?: unknown): [string, string] | null {
    if (!readRuntimeDisplaySettings(this.document).chatNameGradients) return null;
    const runtime = (this.windowRef as any).VortexRuntime;
    const bootIdentity = readBootIdentity(this.document);
    const messageName = String(username || "").trim().toLowerCase();
    const isProbablySelf = isSelf || (!!messageName && messageName === String(bootIdentity.username || "").trim().toLowerCase());
    const id = Number(playerId)
      || (isProbablySelf ? Number(runtime?.community?.getOwnUserId?.() || readBootOwnUserId(this.document) || bootIdentity.id) : 0);
    if (!Number.isFinite(id) || id <= 0) return null;
    const cosmetics = runtime?.community?.getCosmetics?.(id) || readBootCosmetics(this.document, id);
    const gradient = cosmetics?.nameGradient;
    if (!Array.isArray(gradient) || gradient.length < 2) return null;
    const from = normalizeCssColor(gradient[0]);
    const to = normalizeCssColor(gradient[1]);
    return from && to ? [from, to] : null;
  }
}

function resolveOutgoingDecision(decision: ChatOutgoingDecision | undefined, fallbackText: string): { cancel: boolean; text: string } {
  if (decision === false) return { cancel: true, text: fallbackText };
  if (typeof decision === "string") return { cancel: false, text: decision.trim() };
  if (decision && typeof decision === "object") {
    return {
      cancel: decision.cancel === true,
      text: typeof decision.text === "string" ? decision.text.trim() : fallbackText
    };
  }
  return { cancel: false, text: fallbackText };
}

function readBootOwnUserId(documentRef: Document): number | null {
  const meta = documentRef.getElementById("_vortexWebCosmetics") as HTMLMetaElement | null;
  if (!meta?.content) return null;
  try {
    const parsed = JSON.parse(meta.content);
    const id = Number(parsed?.ownUserId);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function readBootIdentity(documentRef: Document): { id: number | null; username: string } {
  const meta = documentRef.getElementById("_vortexBridgeConfig") as HTMLMetaElement | null;
  if (!meta?.content) return { id: null, username: "" };
  try {
    const parsed = JSON.parse(meta.content);
    const identity = parsed?.identity || {};
    const id = Number(identity.id ?? identity.userId ?? identity.user_id);
    return {
      id: Number.isFinite(id) && id > 0 ? id : null,
      username: String(identity.username || identity.name || "")
    };
  } catch {
    return { id: null, username: "" };
  }
}

function readBootCosmetics(documentRef: Document, userId: number): { nameGradient?: unknown } | null {
  const meta = documentRef.getElementById("_vortexWebCosmetics") as HTMLMetaElement | null;
  if (!meta?.content) return null;
  try {
    const parsed = JSON.parse(meta.content);
    return parsed?.records?.[userId] || parsed?.records?.[String(userId)] || null;
  } catch {
    return null;
  }
}

function nameGradientStyle(gradient: [string, string]): string {
  return [
    `--msg-name-gradient-from:${gradient[0]}`,
    `--msg-name-gradient-to:${gradient[1]}`
  ].join(";");
}

function normalizeCssColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(trimmed)) return trimmed;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(trimmed)) return trimmed;
  return null;
}

function nameColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) & 0xffff;
  return NAME_COLORS[hash % NAME_COLORS.length] ?? "#60a5fa";
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
