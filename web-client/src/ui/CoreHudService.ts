export type CoreHudState = {
  toolbarVisible: boolean;
  debugVisible: boolean;
};

export class CoreHudService {
  private state: CoreHudState = {
    toolbarVisible: true,
    debugVisible: false
  };

  constructor(private readonly document: Document) {}

  setToolbarVisible(visible: boolean): void {
    this.state = { ...this.state, toolbarVisible: visible };
    this.document.dispatchEvent(new CustomEvent("v22-ui-toolbar", { detail: { visible } }));
  }

  setDebugVisible(visible: boolean): void {
    this.state = { ...this.state, debugVisible: visible };
    this.document.dispatchEvent(new CustomEvent("v22-ui-debug", { detail: { visible } }));
  }

  snapshot(): CoreHudState {
    return { ...this.state };
  }
}
