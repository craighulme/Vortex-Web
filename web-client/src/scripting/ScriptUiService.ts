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
  border?: unknown;
  radius?: unknown;
  padding?: unknown;
  size?: unknown;
  weight?: unknown;
  font?: unknown;
  opacity?: unknown;
  align?: unknown;
  fill?: unknown;
  z?: unknown;
  shadow?: unknown;
  title?: unknown;
  value?: unknown;
  max?: unknown;
  values?: unknown;
  points?: unknown;
  min?: unknown;
  labels?: unknown;
  x2?: unknown;
  y2?: unknown;
  r?: unknown;
  width?: unknown;
  pointerEvents?: unknown;
  draggable?: unknown;
  onClick?: unknown;
  onMouseEnter?: unknown;
  onMouseLeave?: unknown;
  onHover?: unknown;
  onDrag?: unknown;
  tooltip?: unknown;
  cursor?: unknown;
  visible?: unknown;
  transition?: unknown;
};

export type ScriptUiElementInfo = {
  id: string;
  layer: string;
  kind: "text" | "rect" | "image" | "button" | "panel" | "line" | "circle" | "progress" | "chart";
};

type ElementKind = ScriptUiElementInfo["kind"];

type ElementRecord = {
  layer: string;
  kind: ElementKind;
  input: ScriptUiElementInput;
};

type LineBatchPath = {
  path: SVGPathElement;
  commands: string[];
};

type LineBatch = {
  svg: SVGSVGElement;
  paths: Map<string, LineBatchPath>;
};

type DragState = {
  pointerId: number;
  element: HTMLElement;
  startClientX: number;
  startClientY: number;
  startLeft: number;
  startTop: number;
  layerName: unknown;
  onDrag: ((event: Record<string, unknown>) => unknown) | null;
};

export class ScriptUiService {
  private root: HTMLElement | null = null;
  private readonly layers = new Map<string, HTMLElement>();
  private readonly records = new Map<string, ElementRecord>();
  private readonly lineBatches = new Map<string, LineBatch>();
  private dragState: DragState | null = null;
  private dragEventsAttached = false;

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
      this.records.clear();
      this.lineBatches.clear();
      return count;
    }
    const layer = this.ensureLayer(layerName);
    const count = layer.childElementCount;
    layer.textContent = "";
    const layerId = sanitizeId(layerName || "hud");
    this.lineBatches.delete(layerId);
    for (const key of [...this.records.keys()]) {
      if (key.startsWith(`${layerId}:`)) this.records.delete(key);
    }
    return count;
  }

  viewport(): { width: number; height: number; scale: number } {
    const visual = this.windowRef.visualViewport;
    return {
      width: Math.round(visual?.width || this.windowRef.innerWidth || this.documentRef.documentElement.clientWidth || 0),
      height: Math.round(visual?.height || this.windowRef.innerHeight || this.documentRef.documentElement.clientHeight || 0),
      scale: Number(visual?.scale || 1)
    };
  }

  measureText(text: unknown, options: { size?: unknown; weight?: unknown; font?: unknown } = {}): { width: number; height: number } {
    const value = String(text ?? "");
    const size = readNumber(options.size, 18, 6, 128);
    const font = `${sanitizeFontWeight(options.weight)} ${size}px ${sanitizeFont(options.font)}`;
    const canvas = this.documentRef.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return { width: Math.ceil(value.length * size * 0.55), height: Math.ceil(size * 1.25) };
    context.font = font;
    const metrics = context.measureText(value);
    const height = Math.ceil((metrics.actualBoundingBoxAscent || size * 0.8) + (metrics.actualBoundingBoxDescent || size * 0.25));
    return { width: Math.ceil(metrics.width), height: Math.max(1, height) };
  }

  text(layerName: unknown, input: ScriptUiElementInput): ScriptUiElementInfo {
    const element = this.upsert(layerName, "text", input);
    element.textContent = String(input.text ?? "");
    this.applyCommonStyle(element, input);
    element.style.background = "transparent";
    this.applyInteraction(element, layerName, input);
    return this.describe(layerName, "text", element);
  }

  rect(layerName: unknown, input: ScriptUiElementInput): ScriptUiElementInfo {
    const element = this.upsert(layerName, "rect", input);
    element.textContent = "";
    this.applyCommonStyle(element, input);
    element.style.background = sanitizeCssColor(input.background ?? input.color, "rgba(15, 23, 42, 0.72)");
    this.applyInteraction(element, layerName, input);
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
    this.applyInteraction(element, layerName, input);
    return this.describe(layerName, "image", element);
  }

  button(layerName: unknown, input: ScriptUiElementInput): ScriptUiElementInfo {
    const element = this.upsert(layerName, "button", input);
    element.textContent = String(input.text ?? "Button");
    this.applyCommonStyle(element, input);
    element.classList.add("vw-script-ui-button");
    this.applyInteraction(element, layerName, input, true);
    return this.describe(layerName, "button", element);
  }

  panel(layerName: unknown, input: ScriptUiElementInput): ScriptUiElementInfo {
    const element = this.upsert(layerName, "panel", input);
    this.applyCommonStyle(element, input);
    element.style.background = sanitizeCssColor(input.background, "rgba(8, 16, 28, 0.94)");
    element.style.border = sanitizeBorder(input.border, "1px solid rgba(186, 230, 253, 0.22)");
    element.style.borderRadius = `${readNumber(input.radius, 12, 0, 256)}px`;
    element.style.padding = `${readNumber(input.padding, 12, 0, 256)}px`;
    element.innerHTML = "";
    const title = String(input.title ?? "").trim();
    const text = String(input.text ?? "").trim();
    if (title) {
      const titleEl = this.documentRef.createElement("div");
      titleEl.className = "vw-script-ui-panel-title";
      titleEl.textContent = title;
      element.appendChild(titleEl);
    }
    if (text) {
      const textEl = this.documentRef.createElement("div");
      textEl.className = "vw-script-ui-panel-text";
      textEl.textContent = text;
      element.appendChild(textEl);
    }
    this.applyInteraction(element, layerName, input);
    return this.describe(layerName, "panel", element);
  }

  line(layerName: unknown, input: ScriptUiElementInput): ScriptUiElementInfo {
    if (isImmediateSurfaceLine(layerName, input)) {
      return this.surfaceLine(layerName, input);
    }
    const element = this.upsert(layerName, "line", input);
    const x = readNumber(input.x, 0);
    const y = readNumber(input.y, 0);
    const x2 = readNumber(input.x2, x + readNumber(input.w, 100));
    const y2 = readNumber(input.y2, y);
    const length = Math.max(1, Math.hypot(x2 - x, y2 - y));
    const angle = Math.atan2(y2 - y, x2 - x) * 180 / Math.PI;
    element.textContent = "";
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.width = `${length}px`;
    element.style.height = `${readNumber(input.width, readNumber(input.h, 2, 1, 64), 1, 64)}px`;
    element.style.minHeight = "0";
    element.style.background = sanitizeCssColor(input.color, "#f8fafc");
    element.style.opacity = String(readNumber(input.opacity, 1, 0, 1));
    element.style.transform = `rotate(${angle}deg)`;
    element.style.transformOrigin = "0 50%";
    element.style.borderRadius = `${readNumber(input.radius, 999, 0, 999)}px`;
    element.style.zIndex = String(Math.round(readNumber(input.z, 0, -1000, 1000)));
    this.applyInteraction(element, layerName, input);
    return this.describe(layerName, "line", element);
  }

  private surfaceLine(layerName: unknown, input: ScriptUiElementInput): ScriptUiElementInfo {
    const layer = this.ensureLayer(layerName);
    const layerId = layer.dataset.vwebScriptLayer || sanitizeId(layerName || "surface");
    const id = sanitizeId(input.id || `line-${Date.now()}`);
    const x = readNumber(input.x, 0);
    const y = readNumber(input.y, 0);
    const x2 = readNumber(input.x2, x + readNumber(input.w, 100));
    const y2 = readNumber(input.y2, y);
    const color = sanitizeCssColor(input.color, "#f8fafc");
    const width = readNumber(input.width, readNumber(input.h, 1, 0.5, 64), 0.5, 64);
    const opacity = readNumber(input.opacity, 1, 0, 1);
    const key = `${color}|${round(width)}|${round(opacity)}`;
    const batch = this.ensureLineBatch(layer, layerId);
    const entry = this.ensureLineBatchPath(batch, key, color, width, opacity);
    entry.commands.push(`M${round(x)} ${round(y)}L${round(x2)} ${round(y2)}`);
    entry.path.setAttribute("d", entry.commands.join(""));
    this.records.set(recordKey(layerId, id), { layer: layerId, kind: "line", input: { ...input, id } });
    return { id, layer: layerId, kind: "line" };
  }

  private ensureLineBatch(layer: HTMLElement, layerId: string): LineBatch {
    const existing = this.lineBatches.get(layerId);
    if (existing && existing.svg.isConnected) return existing;
    const svg = this.documentRef.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("vw-script-ui-line-batch");
    svg.dataset.vwebScriptId = "__surface_line_batch";
    svg.dataset.vwebScriptKind = "line";
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    layer.appendChild(svg);
    const batch = { svg, paths: new Map<string, LineBatchPath>() };
    this.lineBatches.set(layerId, batch);
    return batch;
  }

  private ensureLineBatchPath(batch: LineBatch, key: string, color: string, width: number, opacity: number): LineBatchPath {
    let entry = batch.paths.get(key);
    if (entry) return entry;
    const path = this.documentRef.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", String(round(width)));
    path.setAttribute("stroke-opacity", String(round(opacity)));
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("vector-effect", "non-scaling-stroke");
    batch.svg.appendChild(path);
    entry = { path, commands: [] };
    batch.paths.set(key, entry);
    return entry;
  }

  circle(layerName: unknown, input: ScriptUiElementInput): ScriptUiElementInfo {
    const element = this.upsert(layerName, "circle", input);
    const r = readNumber(input.r, Math.min(readNumber(input.w, 48), readNumber(input.h, 48)) / 2, 1, 4096);
    const x = readNumber(input.x, 0);
    const y = readNumber(input.y, 0);
    element.textContent = "";
    element.style.left = `${x - r}px`;
    element.style.top = `${y - r}px`;
    element.style.width = `${r * 2}px`;
    element.style.height = `${r * 2}px`;
    element.style.minHeight = "0";
    element.style.borderRadius = "9999px";
    element.style.opacity = String(readNumber(input.opacity, 1, 0, 1));
    const color = sanitizeCssColor(input.color, "#f8fafc");
    const filled = input.fill === true || input.fill === undefined;
    element.style.background = filled ? color : "transparent";
    element.style.border = sanitizeBorder(input.border, `${readNumber(input.width, 2, 1, 64)}px solid ${color}`);
    element.style.zIndex = String(Math.round(readNumber(input.z, 0, -1000, 1000)));
    this.applyInteraction(element, layerName, input);
    return this.describe(layerName, "circle", element);
  }

  progress(layerName: unknown, input: ScriptUiElementInput): ScriptUiElementInfo {
    const element = this.upsert(layerName, "progress", input);
    this.applyCommonStyle(element, input);
    element.style.background = sanitizeCssColor(input.background, "rgba(15, 23, 42, 0.72)");
    element.style.border = sanitizeBorder(input.border, "1px solid rgba(226, 232, 240, 0.18)");
    element.style.borderRadius = `${readNumber(input.radius, 999, 0, 999)}px`;
    element.style.overflow = "hidden";
    element.style.padding = "0";
    const value = readNumber(input.value, 0);
    const max = Math.max(0.0001, readNumber(input.max, 100, 0.0001));
    const pct = Math.max(0, Math.min(1, value / max));
    element.innerHTML = "";
    const fill = this.documentRef.createElement("div");
    fill.className = "vw-script-ui-progress-fill";
    fill.style.width = `${pct * 100}%`;
    fill.style.background = sanitizeCssColor(input.color, "#22c55e");
    element.appendChild(fill);
    const label = String(input.text ?? "").trim();
    if (label) {
      const text = this.documentRef.createElement("span");
      text.className = "vw-script-ui-progress-text";
      text.textContent = label;
      element.appendChild(text);
    }
    this.applyInteraction(element, layerName, input);
    return this.describe(layerName, "progress", element);
  }

  chart(layerName: unknown, input: ScriptUiElementInput): ScriptUiElementInfo {
    const element = this.upsert(layerName, "chart", input);
    this.applyCommonStyle(element, input);
    element.style.background = sanitizeCssColor(input.background, "rgba(8, 16, 28, 0.64)");
    element.style.border = sanitizeBorder(input.border, "1px solid rgba(186, 230, 253, 0.18)");
    element.style.borderRadius = `${readNumber(input.radius, 10, 0, 256)}px`;
    element.style.padding = "0";
    element.style.overflow = "hidden";
    const width = Math.max(24, readNumber(input.w, 240, 24, 4096));
    const height = Math.max(24, readNumber(input.h, 96, 24, 4096));
    const values = readNumberArray(input.values).slice(-256);
    const min = input.min === undefined ? Math.min(...values, 0) : readNumber(input.min, 0);
    const max = input.max === undefined ? Math.max(...values, 1) : readNumber(input.max, 1);
    const color = sanitizeCssColor(input.color, "#38bdf8");
    const fill = sanitizeCssColor(input.fill, "rgba(56, 189, 248, 0.18)");
    const title = String(input.title ?? "").trim();
    element.innerHTML = renderChartSvg({ width, height, values, min, max, color, fill, title });
    this.applyInteraction(element, layerName, input);
    return this.describe(layerName, "chart", element);
  }

  polyline(layerName: unknown, input: ScriptUiElementInput): ScriptUiElementInfo {
    const layer = this.ensureLayer(layerName);
    const layerId = layer.dataset.vwebScriptLayer || sanitizeId(layerName || "surface");
    const id = sanitizeId(input.id || `polyline-${Date.now()}`);
    const points = readPointArray(input.points);
    if (points.length < 2) {
      this.records.set(recordKey(layerId, id), { layer: layerId, kind: "line", input: { ...input, id } });
      return { id, layer: layerId, kind: "line" };
    }

    const color = sanitizeCssColor(input.color, "#f8fafc");
    const width = readNumber(input.width, readNumber(input.h, 1, 0.5, 64), 0.5, 64);
    const opacity = readNumber(input.opacity, 1, 0, 1);
    const batch = this.ensureLineBatch(layer, layerId);
    const key = `${color}|${round(width)}|${round(opacity)}`;
    const entry = this.ensureLineBatchPath(batch, key, color, width, opacity);
    const commands: string[] = [];
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1]!;
      const to = points[index]!;
      commands.push(`M${round(from.x)} ${round(from.y)}L${round(to.x)} ${round(to.y)}`);
    }
    if (input.fill === true && points.length > 2) {
      const first = points[0]!;
      const last = points[points.length - 1]!;
      commands.push(`M${round(last.x)} ${round(last.y)}L${round(first.x)} ${round(first.y)}`);
    }
    entry.commands.push(commands.join(""));
    entry.path.setAttribute("d", entry.commands.join(""));
    this.records.set(recordKey(layerId, id), { layer: layerId, kind: "line", input: { ...input, id } });
    return { id, layer: layerId, kind: "line" };
  }

  update(layerName: unknown, id: unknown, input: ScriptUiElementInput): ScriptUiElementInfo | null {
    const element = this.findElement(layerName, id);
    if (!element) return null;
    const kind = readElementKind(element);
    const layerId = sanitizeId(layerName || "hud");
    const elementId = element.dataset.vwebScriptId || sanitizeId(id);
    const previous = this.records.get(recordKey(layerId, elementId))?.input || {};
    const next = { ...previous, ...input, id: elementId };
    switch (kind) {
      case "rect": return this.rect(layerName, next);
      case "image": return this.image(layerName, next);
      case "button": return this.button(layerName, next);
      case "panel": return this.panel(layerName, next);
      case "line": return this.line(layerName, next);
      case "circle": return this.circle(layerName, next);
      case "progress": return this.progress(layerName, next);
      case "chart": return this.chart(layerName, next);
      case "text":
      default:
        return this.text(layerName, next);
    }
  }

  remove(layerName: unknown, id: unknown): boolean {
    const element = this.findElement(layerName, id);
    if (!element) return false;
    this.records.delete(recordKey(sanitizeId(layerName || "hud"), element.dataset.vwebScriptId || sanitizeId(id)));
    element.remove();
    return true;
  }

  private applyInteraction(element: HTMLElement, layerName: unknown, input: ScriptUiElementInput, forcePointer = false): void {
    const callback = typeof input.onClick === "function" ? input.onClick : null;
    const onMouseEnter = typeof input.onMouseEnter === "function" ? input.onMouseEnter : null;
    const onMouseLeave = typeof input.onMouseLeave === "function" ? input.onMouseLeave : null;
    const onHover = typeof input.onHover === "function" ? input.onHover : null;
    const onDrag = typeof input.onDrag === "function" ? input.onDrag as (event: Record<string, unknown>) => unknown : null;
    const draggable = input.draggable === true;
    element.classList.toggle("vw-script-ui-draggable", draggable);
    element.style.pointerEvents = callback || onMouseEnter || onMouseLeave || onHover || onDrag || forcePointer || draggable || input.pointerEvents === true ? "auto" : "none";
    element.onclick = callback
      ? (event) => {
          event.stopPropagation();
          void Promise.resolve(callback(pointerEventInfo(element, layerName, event))).catch(() => {});
        }
      : null;
    element.onmouseenter = onMouseEnter
      ? (event) => {
          void Promise.resolve(onMouseEnter(pointerEventInfo(element, layerName, event))).catch(() => {});
        }
      : null;
    element.onmouseleave = onMouseLeave
      ? (event) => {
          void Promise.resolve(onMouseLeave(pointerEventInfo(element, layerName, event))).catch(() => {});
        }
      : null;
    element.onmousemove = onHover
      ? (event) => {
          void Promise.resolve(onHover(pointerEventInfo(element, layerName, event))).catch(() => {});
        }
      : null;
    element.onpointerdown = draggable
      ? (event) => {
          if (event.button !== 0) return;
          const left = Number.parseFloat(element.style.left || "0") || 0;
          const top = Number.parseFloat(element.style.top || "0") || 0;
          this.dragState = {
            pointerId: event.pointerId,
            element,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startLeft: left,
            startTop: top,
            layerName,
            onDrag
          };
          element.setPointerCapture?.(event.pointerId);
          event.preventDefault();
          event.stopPropagation();
        }
      : null;
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
    const layerId = layer.dataset.vwebScriptLayer || sanitizeId(layerName || "hud");
    this.records.set(recordKey(layerId, id), { layer: layerId, kind, input: { ...input, id } });
    return element;
  }

  private findElement(layerName: unknown, id: unknown): HTMLElement | null {
    const layer = this.layers.get(sanitizeId(layerName || "hud"));
    if (!layer) return null;
    return layer.querySelector<HTMLElement>(`[data-vweb-script-id="${cssEscape(sanitizeId(id))}"]`);
  }

  private applyCommonStyle(element: HTMLElement, input: ScriptUiElementInput): void {
    element.style.left = `${readNumber(input.x, 0)}px`;
    element.style.top = `${readNumber(input.y, 0)}px`;
    element.style.width = `${readNumber(input.w, input.text === undefined ? 120 : 240, 1, 4096)}px`;
    element.style.minHeight = `${readNumber(input.h, input.text === undefined ? 32 : 24, 1, 4096)}px`;
    element.style.color = sanitizeCssColor(input.color, "#f8fafc");
    element.style.fontSize = `${readNumber(input.size, 18, 6, 128)}px`;
    element.style.fontWeight = sanitizeFontWeight(input.weight);
    element.style.fontFamily = sanitizeFont(input.font);
    element.style.opacity = String(readNumber(input.opacity, 1, 0, 1));
    element.style.textAlign = sanitizeAlign(input.align);
    element.style.border = sanitizeBorder(input.border);
    element.style.borderRadius = `${readNumber(input.radius, 0, 0, 256)}px`;
    element.style.padding = `${readNumber(input.padding, 0, 0, 256)}px`;
    element.style.zIndex = String(Math.round(readNumber(input.z, 0, -1000, 1000)));
    element.style.textShadow = input.shadow === true ? "0 2px 6px rgba(0,0,0,0.75)" : "none";
    element.style.display = input.visible === false ? "none" : "block";
    element.style.cursor = sanitizeCursor(input.cursor);
    element.style.transition = sanitizeTransition(input.transition);
    const tooltip = String(input.tooltip ?? "").trim();
    if (tooltip) {
      element.dataset.vwebScriptTooltip = tooltip.slice(0, 240);
      element.title = tooltip.slice(0, 240);
    } else {
      delete element.dataset.vwebScriptTooltip;
      element.removeAttribute("title");
    }
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
      this.attachDragEvents();
      return existing;
    }
    const root = this.documentRef.createElement("div");
    root.id = "vw-script-ui-root";
    this.documentRef.body.appendChild(root);
    this.root = root;
    this.attachDragEvents();
    return root;
  }

  private attachDragEvents(): void {
    if (this.dragEventsAttached) return;
    this.dragEventsAttached = true;
    const move = (event: PointerEvent) => {
      const state = this.dragState;
      if (!state || state.pointerId !== event.pointerId) return;
      const viewport = this.viewport();
      const width = state.element.offsetWidth || 0;
      const height = state.element.offsetHeight || 0;
      const nextLeft = state.startLeft + event.clientX - state.startClientX;
      const nextTop = state.startTop + event.clientY - state.startClientY;
      const clampedLeft = Math.max(0, Math.min(viewport.width - width, nextLeft));
      const clampedTop = Math.max(0, Math.min(viewport.height - height, nextTop));
      state.element.style.left = `${clampedLeft}px`;
      state.element.style.top = `${clampedTop}px`;
      this.recordElementPosition(state.element, clampedLeft, clampedTop);
      if (state.onDrag) {
        const info = pointerEventInfo(state.element, state.layerName, event);
        void Promise.resolve(state.onDrag({
          ...info,
          elementX: clampedLeft,
          elementY: clampedTop,
          deltaX: event.clientX - state.startClientX,
          deltaY: event.clientY - state.startClientY
        })).catch(() => {});
      }
      event.preventDefault();
    };
    const end = (event: PointerEvent) => {
      if (!this.dragState || this.dragState.pointerId !== event.pointerId) return;
      this.dragState.element.releasePointerCapture?.(event.pointerId);
      this.dragState = null;
    };
    this.documentRef.addEventListener("pointermove", move, true);
    this.documentRef.addEventListener("pointerup", end, true);
    this.documentRef.addEventListener("pointercancel", end, true);
  }

  private recordElementPosition(element: HTMLElement, x: number, y: number): void {
    const id = element.dataset.vwebScriptId;
    const layer = element.parentElement?.dataset.vwebScriptLayer;
    if (!id || !layer) return;
    const key = recordKey(layer, id);
    const record = this.records.get(key);
    if (!record) return;
    record.input = { ...record.input, x, y };
    this.records.set(key, record);
  }
}

function readElementKind(element: HTMLElement): ElementKind {
  const kind = element.dataset.vwebScriptKind;
  if (kind === "text" || kind === "rect" || kind === "image" || kind === "button" || kind === "panel" || kind === "line" || kind === "circle" || kind === "progress" || kind === "chart") {
    return kind;
  }
  return "text";
}

function isImmediateSurfaceLine(layerName: unknown, input: ScriptUiElementInput): boolean {
  if (sanitizeId(layerName || "hud") !== "surface") return false;
  return String(input.id || "").startsWith("__surface_line_");
}

function readNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function readPointArray(value: unknown): Array<{ x: number; y: number }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const x = readNumber(record.x ?? (Array.isArray(item) ? record[0] : record[1]), Number.NaN);
      const y = readNumber(record.y ?? (Array.isArray(item) ? record[1] : record[2]), Number.NaN);
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
    })
    .filter((item): item is { x: number; y: number } => Boolean(item));
}

function renderChartSvg(options: { width: number; height: number; values: number[]; min: number; max: number; color: string; fill: string; title: string }): string {
  const { width, height, values, color, fill, title } = options;
  const min = Number.isFinite(options.min) ? options.min : 0;
  const max = Number.isFinite(options.max) && options.max !== min ? options.max : min + 1;
  const pad = 12;
  const chartTop = title ? 28 : pad;
  const chartBottom = height - pad;
  const chartHeight = Math.max(1, chartBottom - chartTop);
  const chartWidth = Math.max(1, width - pad * 2);
  const points = values.length
    ? values.map((value, index) => {
        const x = pad + (values.length === 1 ? chartWidth : index / (values.length - 1) * chartWidth);
        const y = chartBottom - ((value - min) / (max - min)) * chartHeight;
        return `${round(x)},${round(Math.max(chartTop, Math.min(chartBottom, y)))}`;
      })
    : [`${pad},${chartBottom}`, `${width - pad},${chartBottom}`];
  const area = `${pad},${chartBottom} ${points.join(" ")} ${width - pad},${chartBottom}`;
  const safeTitle = escapeSvg(title);
  return [
    `<svg class="vw-script-ui-chart-svg" width="${round(width)}" height="${round(height)}" viewBox="0 0 ${round(width)} ${round(height)}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`,
    `<rect width="100%" height="100%" rx="10" fill="transparent"/>`,
    safeTitle ? `<text x="${pad}" y="18" fill="currentColor" font-size="12" font-weight="800">${safeTitle}</text>` : "",
    `<polyline points="${area}" fill="${escapeSvg(fill)}" stroke="none"/>`,
    `<polyline points="${points.join(" ")}" fill="none" stroke="${escapeSvg(color)}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    `</svg>`
  ].join("");
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function escapeSvg(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function sanitizeFontWeight(value: unknown): string {
  const weight = Number(value);
  if (Number.isFinite(weight)) return String(Math.min(900, Math.max(100, Math.round(weight / 100) * 100)));
  const text = String(value || "700").toLowerCase();
  return text === "normal" || text === "bold" ? text : "700";
}

function sanitizeFont(value: unknown): string {
  const text = String(value || "").trim();
  if (!text) return "Inter, ui-sans-serif, system-ui, sans-serif";
  if (!/^[a-z0-9 ,'"_-]{1,120}$/i.test(text)) return "Inter, ui-sans-serif, system-ui, sans-serif";
  return text;
}

function sanitizeBorder(value: unknown, fallback = "0"): string {
  const text = String(value || "").trim();
  if (!text) return fallback;
  if (text === "0") return "0";
  if (/^[\d.]+px\s+(solid|dashed|dotted)\s+(#[0-9a-f]{3}([0-9a-f]{3})?|rgba?\([\d\s.,%]+\))$/i.test(text)) return text;
  return fallback;
}

function sanitizeCursor(value: unknown): string {
  const text = String(value || "").trim().toLowerCase();
  return /^(default|pointer|crosshair|grab|grabbing|move|text|help|none)$/.test(text) ? text : "";
}

function sanitizeTransition(value: unknown): string {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^[a-z0-9 ,().%-]+$/i.test(text) && text.length <= 160) return text;
  return "";
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
  if (url.protocol !== "https:" && url.protocol !== "http:" && url.protocol !== "chrome-extension:" && url.protocol !== "blob:") return "";
  if (url.protocol === "http:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return "";
  return url.href;
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}

function pointerButtonName(button: number): string {
  if (button === 1) return "middle";
  if (button === 2) return "right";
  return "left";
}

function pointerEventInfo(element: HTMLElement, layerName: unknown, event: MouseEvent): Record<string, unknown> {
  const rect = element.getBoundingClientRect();
  return {
    id: element.dataset.vwebScriptId || "",
    layer: sanitizeId(layerName || "hud"),
    x: event.clientX,
    y: event.clientY,
    localX: event.clientX - rect.left,
    localY: event.clientY - rect.top,
    button: pointerButtonName(event.button),
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey
  };
}

function recordKey(layer: string, id: string): string {
  return `${layer}:${id}`;
}
