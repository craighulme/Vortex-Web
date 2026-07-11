import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import "monaco-editor/esm/vs/editor/contrib/bracketMatching/browser/bracketMatching.js";
import "monaco-editor/esm/vs/editor/contrib/colorPicker/browser/colorPickerContribution.js";
import "monaco-editor/esm/vs/editor/contrib/find/browser/findController.js";
import "monaco-editor/esm/vs/editor/contrib/folding/browser/folding.js";
import "monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution.js";
import "monaco-editor/esm/vs/editor/contrib/snippet/browser/snippetController2.js";
import "monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js";
import { TokenizationRegistry } from "monaco-editor/esm/vs/editor/common/languages.js";
import { TokenMetadata } from "monaco-editor/esm/vs/editor/common/encodedTokenAttributes.js";
import editorWorkerUrl from "monaco-editor/esm/vs/editor/editor.worker?url";
import "monaco-editor/min/vs/editor/editor.main.css";
import { keybindLabel, matchesKeybindCode } from "../input/KeybindSettings";
import { LUA_API_REFERENCE, type LuaApiEntry } from "./LuaApiReference";
import type { ScriptRuntime } from "./ScriptRuntime";
import { ScriptWorkspaceService, type WorkspaceLuaScript } from "./ScriptWorkspaceService";

type LocalScriptSummary = { id: string; name: string; source: string };
type PackagedLuaScript = LocalScriptSummary & {
  packaged: true;
  path: string;
};
type ExplorerScript = WorkspaceLuaScript | LocalScriptSummary | PackagedLuaScript;

type ScriptExplorerOptions = {
  documentRef: Document;
  windowRef: Window;
  scripting: ScriptRuntime;
};

let monacoRegistered = false;
const runtimeScriptUrl = getRuntimeScriptUrl();
const PACKAGED_LUA_SCRIPTS: Array<{ path: string; name: string }> = [
  { path: "welcome.lua", name: "Welcome" }
];

export class ScriptExplorerService {
  private root: HTMLElement | null = null;
  private list: HTMLElement | null = null;
  private nameInput: HTMLInputElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private editorHost: HTMLElement | null = null;
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private output: HTMLElement | null = null;
  private workspaceStatus: HTMLElement | null = null;
  private readonly workspace: ScriptWorkspaceService;
  private workspaceScripts: WorkspaceLuaScript[] = [];
  private packagedScripts: PackagedLuaScript[] = [];
  private selectedId = "";
  private lastLoadedSource = "";
  private consoleCollapsed = false;
  private sidebarCollapsed = false;
  private editorFocused = false;

  constructor(private readonly options: ScriptExplorerOptions) {
    this.workspace = new ScriptWorkspaceService(options.windowRef, new URL(".", runtimeScriptUrl).href);
  }

  mount(): this {
    if (this.root) return this;
    registerLuaEditor();
    this.build();
    this.sync();
    void this.restoreWorkspace();
    void this.loadPackagedScripts();
    this.workspace.startPolling(() => {
      void this.refreshWorkspace({ preserveDirtyEditor: true });
    });
    this.options.documentRef.addEventListener("vortex-input-keydown", this.onRuntimeKeyDown as EventListener);
    this.options.windowRef.addEventListener("keydown", this.onWindowKeyDown, true);
    return this;
  }

  open(): void {
    this.root?.removeAttribute("hidden");
    if (this.options.scripting.canUseLua()) this.options.scripting.setEnabled(true);
    this.sync();
    this.layoutEditor();
    this.options.documentRef.exitPointerLock?.();
    if (this.options.scripting.canUseLua()) this.editor?.focus();
  }

  close(): void {
    this.root?.setAttribute("hidden", "true");
  }

  toggle(): void {
    if (!this.root || this.root.hidden) this.open();
    else this.close();
  }

  snapshot(): { mounted: boolean; open: boolean; selectedId: string } {
    return {
      mounted: Boolean(this.root),
      open: Boolean(this.root && !this.root.hidden),
      selectedId: this.selectedId
    };
  }

  editorDiagnostics(): Record<string, unknown> {
    const model = this.editor?.getModel();
    const spans = [...(this.editorHost?.querySelectorAll<HTMLElement>(".view-line span") || [])].slice(0, 20);
    return {
      mounted: Boolean(this.editor),
      language: model ? model.getLanguageId() : null,
      themeStyleInstalled: Boolean(this.options.documentRef.getElementById("vweb-lua-monaco-token-fallback")),
      tokenClasses: spans.map((span) => ({
        text: span.textContent,
        className: span.className,
        color: this.options.windowRef.getComputedStyle(span).color,
        fontStyle: this.options.windowRef.getComputedStyle(span).fontStyle,
        fontWeight: this.options.windowRef.getComputedStyle(span).fontWeight
      }))
    };
  }

  assetUrl(path: unknown): string | null {
    return this.workspace.assetUrl(path);
  }

  private build(): void {
    const doc = this.options.documentRef;
    const root = doc.createElement("section");
    root.className = "vw-script-explorer";
    root.hidden = true;
    root.innerHTML = `
      <div class="vw-script-shell" role="dialog" aria-modal="true" aria-label="Lua Editor">
        <header class="vw-script-header">
          <div>
            <h2>Lua Editor</h2>
            <p>Write, run, and debug local Vortex Web scripts.</p>
          </div>
          <div class="vw-script-actions">
            <button type="button" data-action="save">Save</button>
            <button type="button" data-action="run">Run Once</button>
            <button type="button" data-action="start" class="primary">Start</button>
            <button type="button" data-action="stop">Stop</button>
            <button type="button" data-action="stop-all">Stop All</button>
            <button type="button" data-action="toggle-sidebar">Hide Sidebar</button>
            <button type="button" data-action="toggle-editor">Focus Editor</button>
            <button type="button" data-action="toggle-console">Hide Console</button>
            <button type="button" data-action="close">Close</button>
          </div>
        </header>
        <aside class="vw-script-sidebar">
          <div class="vw-script-sidebar-head">
            <strong>Scripts</strong>
            <button type="button" data-action="new">New</button>
          </div>
          <div class="vw-script-workspace">
            <button type="button" data-action="open-folder">Open Folder</button>
            <button type="button" data-action="refresh-folder">Refresh</button>
            <span data-workspace-status></span>
          </div>
          <input class="vw-script-search" type="search" placeholder="Search scripts..." data-script-search>
          <div class="vw-script-list"></div>
        </aside>
        <main class="vw-script-main">
          <div class="vw-script-editor-head">
            <input type="text" data-script-name maxlength="80" aria-label="Script name">
            <div class="vw-script-hint">Ctrl+Space autocomplete - Ctrl+S save - Ctrl+Enter run - Toggle: ${keybindLabel("F2")}</div>
          </div>
          <div class="vw-script-editor" data-script-editor></div>
          <div class="vw-script-toolbar">
            <button type="button" data-action="delete">Delete Script</button>
            <button type="button" data-action="clear-log" class="icon" title="Clear console" aria-label="Clear console">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 12H7.7L7 9Zm3 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z"/></svg>
            </button>
          </div>
          <pre class="vw-script-output"></pre>
        </main>
      </div>
    `;
    doc.body.appendChild(root);
    this.root = root;
    this.list = root.querySelector(".vw-script-list");
    this.nameInput = root.querySelector("[data-script-name]");
    this.searchInput = root.querySelector("[data-script-search]");
    this.editorHost = root.querySelector("[data-script-editor]");
    this.output = root.querySelector(".vw-script-output");
    this.workspaceStatus = root.querySelector("[data-workspace-status]");
    this.mountEditor("");
    (this.options.windowRef as Window & { VortexLuaEditor?: unknown }).VortexLuaEditor = {
      diagnostics: () => this.editorDiagnostics(),
      focus: () => this.editor?.focus()
    };
    root.addEventListener("click", this.onClick);
    this.searchInput?.addEventListener("input", () => this.renderScriptList());
    this.syncLayoutState();
  }

  private sync(): void {
    const scripts = this.allScripts();
    if (!this.selectedId || !scripts.some((script) => script.id === this.selectedId)) {
      this.selectedId = scripts[0]?.id || "";
    }
    const available = this.options.scripting.canUseLua();
    this.editorHost?.classList.toggle("disabled", !available);
    this.nameInput?.toggleAttribute("disabled", !available);
    this.editor?.updateOptions({ readOnly: !available });
    this.renderScriptList();
    const selected = scripts.find((script) => script.id === this.selectedId);
    if (selected) {
      if (this.nameInput) this.nameInput.value = selected.name;
      this.setEditorSource(selected.source);
      this.lastLoadedSource = selected.source;
    }
    this.syncWorkspaceStatus();
    this.syncOutput();
    this.layoutEditor();
  }

  private syncOutput(): void {
    if (!this.output) return;
    const snapshot = this.options.scripting.snapshot();
    if (!snapshot.available) {
      this.output.textContent = "Lua Editor is locked on this license. Ask for the lua feature to run local scripts.";
      return;
    }
    const lines = snapshot.log.slice(-120).map((entry) => {
      const time = new Date(entry.at).toLocaleTimeString();
      return `[${time}] ${entry.level.toUpperCase()} ${entry.message}`;
    });
    const header = snapshot.sessions.length ? `Active sessions: ${snapshot.sessions.map((session) => session.name).join(", ")}\n` : "";
    this.output.textContent = `${header}${lines.join("\n")}` || "No output yet.";
  }

  private async saveSelected(): Promise<void> {
    if (!this.options.scripting.canUseLua()) {
      this.syncOutput();
      return;
    }
    const name = this.nameInput?.value || "Untitled";
    const source = this.editorSource();
    if (this.isPackagedScript(this.selectedId)) {
      const saved = this.options.scripting.saveLocalScript({ name: `${name} Copy`, source });
      this.selectedId = saved.id;
      this.lastLoadedSource = saved.source;
      this.sync();
      return;
    }
    if (this.isWorkspaceScript(this.selectedId)) {
      const script = this.workspaceScripts.find((item) => item.id === this.selectedId);
      if (!script) return;
      const saved = await this.workspace.writeScript(script.path, source);
      if (saved) {
        this.workspaceScripts = this.workspace.listScripts();
        this.selectedId = saved.id;
        this.lastLoadedSource = saved.source;
      }
      this.sync();
      return;
    }
    const saved = this.options.scripting.saveLocalScript({ id: this.selectedId, name, source });
    this.selectedId = saved.id;
    this.lastLoadedSource = saved.source;
    this.sync();
  }

  private async runSelected(): Promise<void> {
    let selected = this.selectedScript();
    if (!selected || !this.isSourceBackedScript(selected)) {
      await this.saveSelected();
      selected = this.selectedScript();
    }
    try {
      if (selected && this.isSourceBackedScript(selected)) {
        await this.options.scripting.runLocalScript(selected.id, this.editorSource(), this.nameInput?.value || selected.name);
      }
      else await this.options.scripting.runLocalScript(this.selectedId);
    } catch {
      // ScriptRuntime already records the error in its output log.
    }
    this.syncOutput();
  }

  private async startSelected(): Promise<void> {
    let selected = this.selectedScript();
    if (!selected || !this.isSourceBackedScript(selected)) {
      await this.saveSelected();
      selected = this.selectedScript();
    }
    try {
      if (selected && this.isSourceBackedScript(selected)) {
        await this.options.scripting.startLocalScript(selected.id, this.editorSource(), this.nameInput?.value || selected.name);
      }
      else await this.options.scripting.startLocalScript(this.selectedId);
    } catch {
      // ScriptRuntime already records the error in its output log.
    }
    this.syncOutput();
  }

  private async stopSelected(): Promise<void> {
    if (!this.selectedId) return;
    const selected = this.selectedScript();
    const candidates = [this.selectedId, this.nameInput?.value, selected?.name]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    for (const candidate of candidates) {
      if (await this.options.scripting.stopLocalScript(candidate)) break;
      const active = this.options.scripting.snapshot().sessions;
      const onlyActiveId = active.length === 1 ? active[0]?.id : "";
      if (onlyActiveId && await this.options.scripting.stopLocalScript(onlyActiveId)) break;
    }
    this.syncOutput();
  }

  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    const scriptButton = target?.closest<HTMLButtonElement>("[data-script-id]");
    if (scriptButton?.dataset.scriptId) {
      this.selectedId = scriptButton.dataset.scriptId;
      this.sync();
      return;
    }
    const action = target?.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "close") this.close();
    if (!this.options.scripting.canUseLua()) {
      this.syncOutput();
      return;
    }
    if (action === "open-folder") void this.openWorkspace();
    if (action === "refresh-folder") void this.refreshWorkspace();
    if (action === "new") {
      const next = this.options.scripting.saveLocalScript({
        name: `Script ${this.options.scripting.listLocalScripts().length + 1}`,
        source: "print('new script')"
      });
      this.selectedId = next.id;
      this.sync();
    }
    if (action === "save") void this.saveSelected();
    if (action === "run") void this.runSelected();
    if (action === "start") void this.startSelected();
    if (action === "stop") void this.stopSelected();
    if (action === "stop-all") void this.options.scripting.stopLocalScript().then(() => this.syncOutput());
    if (action === "clear-log") {
      this.options.scripting.clearLog();
      this.syncOutput();
    }
    if (action === "toggle-console") {
      this.consoleCollapsed = !this.consoleCollapsed;
      this.syncLayoutState();
    }
    if (action === "toggle-sidebar") {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      this.syncLayoutState();
    }
    if (action === "toggle-editor") {
      this.editorFocused = !this.editorFocused;
      if (this.editorFocused) this.consoleCollapsed = true;
      this.syncLayoutState();
      this.editor?.focus();
    }
    if (action === "delete" && this.selectedId) {
      if (this.isWorkspaceScript(this.selectedId) || this.isPackagedScript(this.selectedId)) {
        this.syncOutput();
        return;
      }
      void this.options.scripting.stopLocalScript(this.selectedId);
      this.options.scripting.deleteLocalScript(this.selectedId);
      this.selectedId = "";
      this.sync();
    }
  };

  private readonly onRuntimeKeyDown = (event: CustomEvent<{ code: string }>): void => {
    if (matchesKeybindCode(event.detail?.code || "", "scriptExplorer", this.options.windowRef.localStorage)) {
      this.toggle();
    }
  };

  private readonly onWindowKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    if (matchesKeybindCode(event.code || event.key || "", "scriptExplorer", this.options.windowRef.localStorage)) {
      event.preventDefault();
      this.toggle();
    }
  };

  private mountEditor(source: string): void {
    if (!this.editorHost || this.editor) return;
    this.editor = monaco.editor.create(this.editorHost, {
      value: source,
      language: LUA_LANGUAGE_ID,
      theme: LUA_THEME_ID,
      automaticLayout: true,
      bracketPairColorization: { enabled: true },
      colorDecorators: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      fontFamily: "Consolas, 'SFMono-Regular', ui-monospace, monospace",
      fontLigatures: false,
      fontSize: 14,
      formatOnPaste: false,
      glyphMargin: false,
      lineHeight: 22,
      lineNumbers: "on",
      minimap: { enabled: true, side: "right", size: "fit", renderCharacters: false },
      padding: { top: 12, bottom: 12 },
      quickSuggestions: { comments: false, other: true, strings: true },
      quickSuggestionsDelay: 40,
      roundedSelection: true,
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      "semanticHighlighting.enabled": false,
      suggest: {
        showWords: false,
        snippetsPreventQuickSuggestions: false,
        preview: true,
        selectionMode: "always"
      },
      suggestOnTriggerCharacters: true,
      tabSize: 2,
      wordWrap: "on"
    });
    const model = this.editor.getModel();
    if (model) monaco.editor.setModelLanguage(model, LUA_LANGUAGE_ID);
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void this.saveSelected());
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => void this.runSelected());
    this.editor.addCommand(monaco.KeyCode.F5, () => void this.startSelected());
  }

  private setEditorSource(source: string): void {
    if (!this.editor) {
      this.mountEditor(source);
      return;
    }
    const model = this.editor.getModel();
    if (!model || model.getValue() === source) return;
    model.setValue(source);
    monaco.editor.setModelLanguage(model, LUA_LANGUAGE_ID);
  }

  private editorSource(): string {
    return this.editor?.getValue() || "";
  }

  private renderScriptList(): void {
    if (!this.list) return;
    const query = String(this.searchInput?.value || "").trim().toLowerCase();
    const scripts = this.allScripts()
      .filter((script) => !query || script.name.toLowerCase().includes(query) || script.id.toLowerCase().includes(query));
    this.list.innerHTML = "";
    for (const script of scripts) {
      const button = this.options.documentRef.createElement("button");
      button.type = "button";
      button.dataset.scriptId = script.id;
      button.className = script.id === this.selectedId ? "active" : "";
      const badge = this.isWorkspaceScript(script.id) ? "folder" : this.isPackagedScript(script.id) ? "example" : "";
      button.innerHTML = `<strong></strong>${badge ? `<span>${badge}</span>` : ""}`;
      const title = button.querySelector("strong");
      if (title) title.textContent = script.name;
      this.list.appendChild(button);
    }
    if (!scripts.length) {
      const empty = this.options.documentRef.createElement("div");
      empty.className = "vw-script-empty";
      empty.textContent = "No scripts found.";
      this.list.appendChild(empty);
    }
  }

  private syncLayoutState(): void {
    this.root?.classList.toggle("console-collapsed", this.consoleCollapsed);
    this.root?.classList.toggle("sidebar-collapsed", this.sidebarCollapsed);
    this.root?.classList.toggle("editor-focused", this.editorFocused);
    const consoleButton = this.root?.querySelector<HTMLElement>("[data-action='toggle-console']");
    if (consoleButton) consoleButton.textContent = this.consoleCollapsed ? "Show Console" : "Hide Console";
    const sidebarButton = this.root?.querySelector<HTMLElement>("[data-action='toggle-sidebar']");
    if (sidebarButton) sidebarButton.textContent = this.sidebarCollapsed ? "Show Sidebar" : "Hide Sidebar";
    const editorButton = this.root?.querySelector<HTMLElement>("[data-action='toggle-editor']");
    if (editorButton) editorButton.textContent = this.editorFocused ? "Show Panels" : "Focus Editor";
    this.layoutEditor();
  }

  private layoutEditor(): void {
    this.options.windowRef.requestAnimationFrame(() => this.editor?.layout());
  }

  private allScripts(): ExplorerScript[] {
    return [...this.workspaceScripts, ...this.options.scripting.listLocalScripts(), ...this.packagedScripts];
  }

  private selectedScript(): ExplorerScript | null {
    return this.allScripts().find((script) => script.id === this.selectedId) || null;
  }

  private isWorkspaceScript(id: string): boolean {
    return id.startsWith("workspace:");
  }

  private isPackagedScript(id: string): boolean {
    return id.startsWith("packaged:");
  }

  private isSourceBackedScript(script: ExplorerScript): script is WorkspaceLuaScript | PackagedLuaScript {
    return this.isWorkspaceScript(script.id) || this.isPackagedScript(script.id);
  }

  private async loadPackagedScripts(): Promise<void> {
    const baseUrl = new URL(".", runtimeScriptUrl).href;
    const scripts = await Promise.all(PACKAGED_LUA_SCRIPTS.map(async (entry): Promise<PackagedLuaScript | null> => {
      try {
        const response = await fetch(new URL(`lua/scripts/${entry.path}`, baseUrl).href, { cache: "no-cache" });
        if (!response.ok) return null;
        return {
          id: `packaged:${entry.path}`,
          name: entry.name,
          path: entry.path,
          packaged: true,
          source: await response.text()
        };
      } catch {
        return null;
      }
    }));
    this.packagedScripts = scripts.filter(Boolean) as PackagedLuaScript[];
    this.sync();
  }

  private async restoreWorkspace(): Promise<void> {
    if (await this.workspace.restore()) {
      this.workspaceScripts = this.workspace.listScripts();
      this.sync();
    } else {
      this.syncWorkspaceStatus();
    }
  }

  private async openWorkspace(): Promise<void> {
    if (await this.workspace.chooseDirectory()) {
      this.workspaceScripts = this.workspace.listScripts();
      this.sync();
    }
  }

  private async refreshWorkspace(options: { preserveDirtyEditor?: boolean } = {}): Promise<void> {
    const selectedBefore = this.selectedId;
    const editorDirty = this.editorSource() !== this.lastLoadedSource;
    await this.workspace.refresh();
    this.workspaceScripts = this.workspace.listScripts();
    const selected = this.workspaceScripts.find((script) => script.id === selectedBefore);
    if (selected && options.preserveDirtyEditor && editorDirty) {
      this.renderScriptList();
      this.syncWorkspaceStatus();
      this.syncOutput();
      return;
    }
    this.sync();
  }

  private syncWorkspaceStatus(): void {
    if (!this.workspaceStatus) return;
    const status = this.workspace.status();
    if (!status.supported) {
      this.workspaceStatus.textContent = "Folder sync unavailable.";
      return;
    }
    if (!status.mounted) {
      this.workspaceStatus.textContent = "No folder mounted.";
      return;
    }
    this.workspaceStatus.textContent = `${status.name || "workspace"} · ${status.scripts} scripts · ${status.assets} assets`;
  }
}

const LUA_LANGUAGE_ID = "vweb-lua";
const LUA_THEME_ID = "vweb-lua-dark";

function registerLuaEditor(): void {
  const globalRef = globalThis as typeof globalThis & {
    MonacoEnvironment?: { getWorker(_: string | undefined, label: string): Worker };
  };
  globalRef.MonacoEnvironment = {
    getWorker: () => new Worker(resolveRuntimeAssetUrl(editorWorkerUrl), { type: "module" })
  };

  if (monacoRegistered) return;
  monacoRegistered = true;

  monaco.languages.register({ id: LUA_LANGUAGE_ID, aliases: ["Vortex Lua", "Lua"] });
  monaco.languages.setLanguageConfiguration(LUA_LANGUAGE_ID, {
    comments: { lineComment: "--", blockComment: ["--[[", "]]"] },
    brackets: [["{", "}"], ["[", "]"], ["(", ")"]],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "\"", close: "\"" },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "\"", close: "\"" },
      { open: "'", close: "'" }
    ]
  });
  monaco.languages.setMonarchTokensProvider(LUA_LANGUAGE_ID, luaMonarchLanguage);
  monaco.languages.registerCompletionItemProvider(LUA_LANGUAGE_ID, {
    triggerCharacters: [".", ":", "\"", "'"],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
      return {
        suggestions: LUA_API_REFERENCE.map((completion) => {
          const item: monaco.languages.CompletionItem = {
            label: completion.name,
            kind: completionKind(completion),
            detail: `${completion.signature} - ${completion.summary}`,
            insertText: completion.snippet || completion.name,
            insertTextRules: completion.snippet?.includes("\n")
              ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
              : monaco.languages.CompletionItemInsertTextRule.None,
            range
          };
          return item;
        })
      };
    }
  });
  monaco.languages.registerColorProvider(LUA_LANGUAGE_ID, {
    provideDocumentColors(model) {
      const colors: monaco.languages.IColorInformation[] = [];
      const text = model.getValue();
      const pattern = /#[0-9a-fA-F]{6}\b/g;
      for (const match of text.matchAll(pattern)) {
        if (match.index === undefined) continue;
        const value = match[0];
        const start = model.getPositionAt(match.index);
        const end = model.getPositionAt(match.index + value.length);
        colors.push({
          color: hexToMonacoColor(value),
          range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column)
        });
      }
      return colors;
    },
    provideColorPresentations(_model, colorInfo) {
      return [{ label: monacoColorToHex(colorInfo.color) }];
    }
  });
  monaco.editor.defineTheme(LUA_THEME_ID, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "7dd3fc", fontStyle: "bold" },
      { token: "keyword.control", foreground: "c4b5fd", fontStyle: "bold" },
      { token: "keyword.lifecycle", foreground: "f0abfc", fontStyle: "bold" },
      { token: "function", foreground: "93c5fd" },
      { token: "function.vweb", foreground: "67e8f9", fontStyle: "bold" },
      { token: "identifier.vweb", foreground: "38bdf8", fontStyle: "bold" },
      { token: "string", foreground: "86efac" },
      { token: "number", foreground: "fdba74" },
      { token: "comment", foreground: "7892a6", fontStyle: "italic" },
      { token: "operator", foreground: "cbd5e1" },
      { token: "delimiter", foreground: "94a3b8" }
    ],
    colors: {
      "editor.background": "#06101a",
      "editor.foreground": "#e5f3ff",
      "editorLineNumber.foreground": "#5f7488",
      "editorLineNumber.activeForeground": "#c8e5ff",
      "editorCursor.foreground": "#93c5fd",
      "editor.selectionBackground": "#2563eb66",
      "editor.inactiveSelectionBackground": "#1e3a5f77",
      "editor.lineHighlightBackground": "#60a5fa14",
      "editorGutter.background": "#081522",
      "editorSuggestWidget.background": "#0c1826",
      "editorSuggestWidget.border": "#29445f",
      "editorSuggestWidget.foreground": "#e5f3ff",
      "editorSuggestWidget.highlightForeground": "#7dd3fc",
      "editorSuggestWidget.selectedBackground": "#1d4ed866",
      "editorWidget.background": "#0c1826",
      "input.background": "#0c1826",
      "focusBorder": "#60a5fa"
    }
  });
  monaco.editor.setTheme(LUA_THEME_ID);
  installLuaTokenFallbackStyles();
}

const luaMonarchLanguage: monaco.languages.IMonarchLanguage = {
  defaultToken: "",
  tokenPostfix: ".lua",
  keywords: [
    "and", "break", "do", "else", "elseif", "end", "false", "for", "function", "if",
    "in", "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while"
  ],
  control: ["if", "then", "else", "elseif", "for", "while", "repeat", "until", "return", "break", "do", "end"],
  lifecycle: ["onStart", "onUpdate", "onDestroy", "onInput", "onClick", "onPlayerJoin", "onPlayerLeave"],
  tokenizer: {
    root: [
      [/\b(vweb)(?=\.)/, "identifier.vweb"],
      [/\b(onStart|onUpdate|onDestroy|onInput|onClick|onPlayerJoin|onPlayerLeave)\b/, "keyword.lifecycle"],
      [/[a-zA-Z_]\w*(?=\s*[({])/, {
        cases: {
          "@keywords": "keyword",
          "@default": "function"
        }
      }],
      [/[a-zA-Z_]\w*/, {
        cases: {
          "@control": "keyword.control",
          "@keywords": "keyword",
          "@default": "identifier"
        }
      }],
      [/#[0-9a-fA-F]{6}\b/, "string.hexcolor"],
      [/0[xX][0-9a-fA-F]+/, "number.hex"],
      [/\d+\.\d+([eE][\-+]?\d+)?/, "number.float"],
      [/\d+/, "number"],
      [/--\[\[/, "comment", "@comment"],
      [/--.*$/, "comment"],
      [/"([^"\\]|\\.)*$/, "string.invalid"],
      [/'([^'\\]|\\.)*$/, "string.invalid"],
      [/"/, "string", "@stringDouble"],
      [/'/, "string", "@stringSingle"],
      [/[{}()[\]]/, "@brackets"],
      [/[;,.]/, "delimiter"],
      [/[+\-*/%^#=<>~]/, "operator"]
    ],
    comment: [
      [/[^\]]+/, "comment"],
      [/\]\]/, "comment", "@pop"],
      [/./, "comment"]
    ],
    stringDouble: [
      [/[^\\"]+/, "string"],
      [/\\./, "string.escape"],
      [/"/, "string", "@pop"]
    ],
    stringSingle: [
      [/[^\\']+/, "string"],
      [/\\./, "string.escape"],
      [/'/, "string", "@pop"]
    ]
  }
};

function completionKind(entry: LuaApiEntry): monaco.languages.CompletionItemKind {
  if (entry.kind === "method") return monaco.languages.CompletionItemKind.Method;
  if (entry.kind === "event") return monaco.languages.CompletionItemKind.Event;
  if (entry.kind === "lifecycle") return monaco.languages.CompletionItemKind.Event;
  return monaco.languages.CompletionItemKind.Function;
}

function hexToMonacoColor(hex: string): monaco.languages.IColor {
  const value = hex.replace("#", "");
  return {
    red: parseInt(value.slice(0, 2), 16) / 255,
    green: parseInt(value.slice(2, 4), 16) / 255,
    blue: parseInt(value.slice(4, 6), 16) / 255,
    alpha: 1
  };
}

function monacoColorToHex(color: monaco.languages.IColor): string {
  const toHex = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, "0");
  return `#${toHex(color.red)}${toHex(color.green)}${toHex(color.blue)}`;
}

function getRuntimeScriptUrl(): string {
  const script = document.currentScript;
  if (script instanceof HTMLScriptElement && script.src) return script.src;
  return document.baseURI;
}

function resolveRuntimeAssetUrl(path: string): string {
  return new URL(path, runtimeScriptUrl).href;
}

function installLuaTokenFallbackStyles(): void {
  if (typeof document === "undefined") return;
  const styleId = "vweb-lua-monaco-token-fallback";
  document.getElementById(styleId)?.remove();

  const support = TokenizationRegistry.get(LUA_LANGUAGE_ID) as {
    getInitialState?: () => unknown;
    tokenizeEncoded?: (line: string, hasEol: boolean, state: unknown) => { tokens: Uint32Array; endState: unknown };
  } | null;
  if (!support?.getInitialState || !support.tokenizeEncoded) return;

  const colorMap = TokenizationRegistry.getColorMap?.() || [];
  const classColors = new Map<string, string>();
  const samples = [
    "local hud = vweb.ui.layer('hud')",
    "function onUpdate(dt)",
    "  if hit.hit then return true else return false end",
    "  local color = '#22c55e'",
    "  vweb.draw.progress({ id = 'hp', value = 80, max = 100 })",
    "  -- comment",
    "end"
  ];
  let state = support.getInitialState();
  for (const line of samples) {
    const result = support.tokenizeEncoded(line, true, state);
    state = result.endState;
    for (let i = 1; i < result.tokens.length; i += 2) {
      const metadata = result.tokens[i] || 0;
      const className = TokenMetadata.getClassNameFromMetadata(metadata).split(/\s+/)[0];
      const foreground = TokenMetadata.getForeground(metadata);
      const color = colorMap[foreground];
      if (className && color && color !== "#000000") classColors.set(className, color);
    }
  }
  if (!classColors.size) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = [...classColors]
    .map(([className, color]) => `.vw-script-editor .monaco-editor .${className}{color:${color}!important;}`)
    .join("\n");
  document.head.appendChild(style);
}
