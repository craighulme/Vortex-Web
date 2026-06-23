export type RendererHandles = {
  scene?: unknown;
  camera?: unknown;
  renderer?: unknown;
};

export class RendererService {
  private handles: RendererHandles = {};

  attachLegacy(handles: RendererHandles): void {
    this.handles = { ...this.handles, ...handles };
  }

  getHandles(): RendererHandles {
    return { ...this.handles };
  }
}
