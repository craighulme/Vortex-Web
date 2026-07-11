import { keybindLabel, matchesKeybindCode } from "../input/KeybindSettings";
import type { ScriptRuntime } from "./ScriptRuntime";

type ScriptExplorerOptions = {
  documentRef: Document;
  windowRef: Window;
  scripting: ScriptRuntime;
};

export class ScriptExplorerService {
  private root: HTMLElement | null = null;
  private list: HTMLElement | null = null;
  private nameInput: HTMLInputElement | null = null;
  private editor: HTMLTextAreaElement | null = null;
  private output: HTMLElement | null = null;
  private enabledInput: HTMLInputElement | null = null;
  private selectedId = "";

  constructor(private readonly options: ScriptExplorerOptions) {}

  mount(): this {
    if (this.root) return this;
    this.build();
    this.sync();
    this.options.documentRef.addEventListener("vortex-input-keydown", this.onRuntimeKeyDown as EventListener);
    this.options.windowRef.addEventListener("keydown", this.onWindowKeyDown, true);
    return this;
  }

  open(): void {
    this.root?.removeAttribute("hidden");
    this.sync();
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

  private build(): void {
    const doc = this.options.documentRef;
    const root = doc.createElement("section");
    root.className = "vw-script-explorer";
    root.hidden = true;
    root.innerHTML = `
      <div class="vw-script-shell" role="dialog" aria-modal="true" aria-label="Lua Explorer">
        <header class="vw-script-header">
          <div>
            <h2>Lua Explorer</h2>
            <p>Local scripts run only in your web client.</p>
          </div>
          <div class="vw-script-actions">
            <label class="vw-script-toggle"><input type="checkbox" data-lua-enabled> Enable Lua</label>
            <button type="button" data-action="close">Close</button>
          </div>
        </header>
        <aside class="vw-script-sidebar">
          <div class="vw-script-sidebar-head">
            <strong>Scripts</strong>
            <button type="button" data-action="new">New</button>
          </div>
          <div class="vw-script-list"></div>
        </aside>
        <main class="vw-script-main">
          <label class="vw-script-name">
            <span>Name</span>
            <input type="text" data-script-name maxlength="80">
          </label>
          <textarea data-script-editor spellcheck="false"></textarea>
          <div class="vw-script-toolbar">
            <button type="button" data-action="save">Save</button>
            <button type="button" data-action="run">Run Once</button>
            <button type="button" data-action="start" class="primary">Start</button>
            <button type="button" data-action="stop">Stop</button>
            <button type="button" data-action="stop-all">Stop All</button>
            <button type="button" data-action="delete">Delete</button>
            <span>Toggle: ${keybindLabel("F2")}</span>
          </div>
          <pre class="vw-script-output"></pre>
        </main>
      </div>
    `;
    doc.body.appendChild(root);
    this.root = root;
    this.list = root.querySelector(".vw-script-list");
    this.nameInput = root.querySelector("[data-script-name]");
    this.editor = root.querySelector("[data-script-editor]");
    this.output = root.querySelector(".vw-script-output");
    this.enabledInput = root.querySelector("[data-lua-enabled]");
    root.addEventListener("click", this.onClick);
    this.enabledInput?.addEventListener("change", () => {
      this.options.scripting.setEnabled(Boolean(this.enabledInput?.checked));
      this.syncOutput();
    });
  }

  private sync(): void {
    const scripts = this.options.scripting.listLocalScripts();
    if (!this.selectedId || !scripts.some((script) => script.id === this.selectedId)) {
      this.selectedId = scripts[0]?.id || "";
    }
    const available = this.options.scripting.canUseLua();
    if (this.enabledInput) {
      this.enabledInput.checked = this.options.scripting.isEnabled();
      this.enabledInput.disabled = !available;
    }
    this.editor?.toggleAttribute("disabled", !available);
    this.nameInput?.toggleAttribute("disabled", !available);
    if (this.list) {
      this.list.innerHTML = "";
      for (const script of scripts) {
        const button = this.options.documentRef.createElement("button");
        button.type = "button";
        button.dataset.scriptId = script.id;
        button.className = script.id === this.selectedId ? "active" : "";
        button.textContent = script.name;
        this.list.appendChild(button);
      }
    }
    const selected = scripts.find((script) => script.id === this.selectedId);
    if (selected) {
      if (this.nameInput) this.nameInput.value = selected.name;
      if (this.editor) this.editor.value = selected.source;
    }
    this.syncOutput();
  }

  private syncOutput(): void {
    if (!this.output) return;
    const snapshot = this.options.scripting.snapshot();
    if (!snapshot.available) {
      this.output.textContent = "Lua tools are locked on this license. Ask for the lua feature to run local scripts.";
      return;
    }
    const lines = snapshot.log.slice(-80).map((entry) => {
      const time = new Date(entry.at).toLocaleTimeString();
      return `[${time}] ${entry.level.toUpperCase()} ${entry.message}`;
    });
    const header = snapshot.sessions.length ? `Active sessions: ${snapshot.sessions.join(", ")}\n` : "";
    this.output.textContent = `${header}${lines.join("\n")}` || (snapshot.enabled ? "No output yet." : "Lua tools are disabled.");
  }

  private saveSelected(): void {
    if (!this.options.scripting.canUseLua()) {
      this.syncOutput();
      return;
    }
    const name = this.nameInput?.value || "Untitled";
    const source = this.editor?.value || "";
    const saved = this.options.scripting.saveLocalScript({ id: this.selectedId, name, source });
    this.selectedId = saved.id;
    this.sync();
  }

  private async runSelected(): Promise<void> {
    this.saveSelected();
    try {
      await this.options.scripting.runLocalScript(this.selectedId);
    } catch {
      // ScriptRuntime already records the error in its output log.
    }
    this.syncOutput();
  }

  private async startSelected(): Promise<void> {
    this.saveSelected();
    try {
      await this.options.scripting.startLocalScript(this.selectedId);
    } catch {
      // ScriptRuntime already records the error in its output log.
    }
    this.syncOutput();
  }

  private async stopSelected(): Promise<void> {
    if (!this.selectedId) return;
    await this.options.scripting.stopLocalScript(this.selectedId);
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
    if (action === "new") {
      const next = this.options.scripting.saveLocalScript({
        name: `Script ${this.options.scripting.listLocalScripts().length + 1}`,
        source: "print('new script')"
      });
      this.selectedId = next.id;
      this.sync();
    }
    if (action === "save") this.saveSelected();
    if (action === "run") void this.runSelected();
    if (action === "start") void this.startSelected();
    if (action === "stop") void this.stopSelected();
    if (action === "stop-all") void this.options.scripting.stopLocalScript().then(() => this.syncOutput());
    if (action === "delete" && this.selectedId) {
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
}
