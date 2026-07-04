type VortexWebUgcStudioApi = {
  camera: () => unknown;
  copyCamera: () => Promise<unknown>;
};

export {};

declare global {
  interface Window {
    VortexWebUgcStudio?: VortexWebUgcStudioApi;
  }
}

if (!window.VortexWebUgcStudio) {
  window.VortexWebUgcStudio = {
    camera() {
      try {
        return JSON.parse(document.documentElement.dataset.vwebUgcCamera || "null");
      } catch {
        return null;
      }
    },
    async copyCamera() {
      const camera = this.camera();
      try {
        await navigator.clipboard?.writeText(JSON.stringify(camera, null, 2));
      } catch {
        // Console helper only; returning the camera is enough if clipboard is denied.
      }
      return camera;
    }
  };
}
