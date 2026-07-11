export type ScriptUiElementInput = {
  id?: unknown;
  x?: unknown;
  y?: unknown;
  w?: unknown;
  h?: unknown;
  text?: unknown;
  url?: unknown;
  color?: unknown;
  background?: unknown;
  size?: unknown;
  opacity?: unknown;
  align?: unknown;
};

export type ScriptUiElementInfo = {
  id: string;
  layer: string;
  kind: "text" | "rect" | "image" | "button";
};

type ElementKind = ScriptUiElementInfo["kind"];

export class ScriptUiService {
  private root: HTMLElement | null = null;
  private readonly layers = new Map<string, HTMLElement>();

  constructor(
    private readonly documentRef: Document,
    private readonly windowRef: Window
  ) {}

  layer(name: unknown): { name: string; count: number } {
    const layer = this.ensureLayer(name);
    return { name: layer.dataset.vwebScriptLayer || "hud", count: layer.childElementCount };
  }

  clear(layerName?: unknown): number {
    if (layerName === undefined || layerName === null || String(layerName).trim() === "") {
      let count = 0;
      for (const layer of this.layers.values()) {
        count += layer.childElementCount;
        layer.textContent = "";
      }
      return count;
    }
    const layer = this.ensureLayer(layerName);
    const count = layer.childElementCount;
    layer.textContent = "";
    return count;
  }

  text(layerName: unknown, input: ScriptUiElementInput): ScriptUiElementInfo {
    const element = this.upsert(layerName, "text", input);
    element.textContent = String(input.text ?? "");
    this.applyCommonStyle(element, input);
    element.style.background = "transparent";
    return this.describe(layerName, "text", element);
  }

  rect(layerName: unknown, input: ScriptUiElementInput): ScriptUiElementInfo {
    const element = this.upsert(layerName, "rect", input);
    element.textContent = "";
    this.applyCommonStyle(element, input);
    element.style.background = sanitizeCssColor(input.background ?? input.color, "rgba(15, 23, 42, 0.72)");
    return this.describe(layerName, "rect", element);
  }

  image(layerName: unknown, input: ScriptUiElementInput): ScriptUiElementInfo {
    const element = this.upsert(layerName, "image", input);
    element.textContent = "";
    this.applyCommonStyle(element, input);
    const url = resolveUiUrl(input.url, this.windowRef.location.href);
    element.style.backgroundImage = `url("${url.replace(/"/g, "%22")}")`;
    element.style.backgroundSize = "contain";
    element.style.backgroundRepeat = "no-repeat";
    element.style.backgroundPosition = "center";
    return this.describe(layerName, "image", element);
  }

  button(layerName: unknown, input: ScriptUiElementInput): ScriptUiElementInfo {
    const element = this.upsert(layerName, "button", input);
    element.textContent = String(input.text ?? "Button");
    this.applyCommonStyle(element, input);
    element.classList.add("vw-script-ui-button");
    element.style.pointerEvents = "auto";
    return this.describe(layerName, "button", element);
  }

  snapshot(): { layers: Array<{ name: string; count: number }> } {
    return {
      layers: [...this.layers.values()].map((layer) => ({
        name: layer.dataset.vwebScriptLayer || "hud",
        count: layer.childElementCount
      }))
    };
  }

  private upsert(layerName: unknown, kind: ElementKind, input: ScriptUiElementInput): HTMLElement {
    const layer = this.ensureLayer(layerName);
    const id = sanitizeId(input.id || `${kind}-${layer.childElementCount + 1}`);
    let element = layer.querySelector<HTMLElement>(`[data-vweb-script-id="${cssEscape(id)}"]`);
    if (!element) {
      element = this.documentRef.createElement("div");
      element.dataset.vwebScriptId = id;
      layer.appendChild(element);
    }
    element.className = `vw-script-ui-element vw-script-ui-${kind}`;
    element.dataset.vwebScriptKind = kind;
    return element;
  }

  private applyCommonStyle(element: HTMLElement, input: ScriptUiElementInput): void {
    element.style.left = `${readNumber(input.x, 0)}px`;
    element.style.top = `${readNumber(input.y, 0)}px`;
    element.style.width = `${readNumber(input.w, input.text === undefined ? 120 : 240, 1, 4096)}px`;
    element.style.minHeight = `${readNumber(input.h, input.text === undefined ? 32 : 24, 1, 4096)}px`;
    element.style.color = sanitizeCssColor(input.color, "#f8fafc");
    element.style.fontSize = `${readNumber(input.size, 18, 6, 128)}px`;
    element.style.opacity = String(readNumber(input.opacity, 1, 0, 1));
    element.style.textAlign = sanitizeAlign(input.align);
  }

  private describe(layerName: unknown, kind: ElementKind, element: HTMLElement): ScriptUiElementInfo {
    return {
      id: element.dataset.vwebScriptId || "",
      layer: sanitizeId(layerName || "hud"),
      kind
    };
  }

  private ensureLayer(value: unknown): HTMLElement {
    const name = sanitizeId(value || "hud");
    let layer = this.layers.get(name);
    if (layer) return layer;
    const root = this.ensureRoot();
    layer = this.documentRef.createElement("div");
    layer.className = "vw-script-ui-layer";
    layer.dataset.vwebScriptLayer = name;
    root.appendChild(layer);
    this.layers.set(name, layer);
    return layer;
  }

  private ensureRoot(): HTMLElement {
    if (this.root && this.root.isConnected) return this.root;
    const existing = this.documentRef.getElementById("vw-script-ui-root") as HTMLElement | null;
    if (existing) {
      this.root = existing;
      return existing;
    }
    const root = this.documentRef.createElement("div");
    root.id = "vw-script-ui-root";
    this.documentRef.body.appendChild(root);
    this.root = root;
    return root;
  }
}

function readNumber(value: unknown, fallback: number, min = -100000, max = 100000): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sanitizeId(value: unknown): string {
  const cleaned = String(value || "hud").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 48) || "hud";
}

function sanitizeAlign(value: unknown): string {
  const align = String(value || "left").toLowerCase();
  return align === "center" || align === "right" ? align : "left";
}

function sanitizeCssColor(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(text)) return text;
  if (/^rgba?\([\d\s.,%]+\)$/i.test(text)) return text;
  return fallback;
}

function resolveUiUrl(value: unknown, baseUrl: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const url = new URL(raw, baseUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:" && url.protocol !== "chrome-extension:") return "";
  if (url.protocol === "http:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return "";
  return url.href;
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}
