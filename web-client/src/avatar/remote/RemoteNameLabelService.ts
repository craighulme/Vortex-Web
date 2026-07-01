import type { RuntimeSprite, ThreeLike } from "./RemotePlayerTypes";

export class RemoteNameLabelService {
  constructor(
    private readonly THREE: ThreeLike,
    private readonly document: Document
  ) {}

  create(username: string): RuntimeSprite {
    const canvas = this.document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 80;
    const context = canvas.getContext("2d");
    if (context) {
      context.font = "bold 44px system-ui,sans-serif";
      context.textAlign = "center";
      context.strokeStyle = "rgba(0,0,0,0.9)";
      context.lineWidth = 6;
      context.strokeText(username, 256, 58);
      context.fillStyle = "#fff";
      context.fillText(username, 256, 58);
    }
    const texture = new this.THREE.CanvasTexture(canvas);
    const material = new this.THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.02,
      depthTest: true,
      depthWrite: false
    });
    const sprite = new this.THREE.Sprite(material);
    sprite.scale.set(4, 0.625, 1);
    return sprite;
  }

  dispose(sprite: RuntimeSprite): void {
    sprite.parent?.remove?.(sprite);
    sprite.material?.map?.dispose?.();
    sprite.material?.dispose?.();
  }
}
