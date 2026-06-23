export type FootIkConfig = {
  enabled: boolean;
  maxPelvisOffset: number;
  footProbeDistance: number;
  smoothing: number;
};

export class AnimationService {
  private footIk: FootIkConfig = {
    enabled: false,
    maxPelvisOffset: 0.45,
    footProbeDistance: 2.5,
    smoothing: 12
  };

  setFootIk(config: Partial<FootIkConfig>): void {
    this.footIk = { ...this.footIk, ...config };
  }

  getFootIk(): FootIkConfig {
    return { ...this.footIk };
  }
}
