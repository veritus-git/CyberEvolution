export class Camera {
  public x: number = 0;
  public y: number = 0;
  public viewportWidth: number;
  public viewportHeight: number;
  // Responsive smoothing speed (frame-rate independent)
  public smoothSpeed: number = 10.0;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  public reset(targetCenterX: number, worldWidth: number): void {
    const targetX = targetCenterX - this.viewportWidth / 2;
    const maxX = Math.max(0, worldWidth - this.viewportWidth);
    this.x = Math.max(0, Math.min(maxX, targetX));
    this.y = 0;
  }

  public update(targetCenterX: number, _targetCenterY: number, worldWidth: number, dt: number): void {
    const maxX = Math.max(0, worldWidth - this.viewportWidth);
    if (maxX <= 0) {
      // World fits on screen (e.g. 1920px lobby) — camera locked at 0
      this.x = 0;
      this.y = 0;
      return;
    }

    const targetX = targetCenterX - this.viewportWidth / 2;
    const clampedTargetX = Math.max(0, Math.min(maxX, targetX));

    // Frame-rate independent exponential smoothing
    // 1 - exp(-speed * dt) guarantees identical behavior at 60Hz, 144Hz, 180Hz, 240Hz!
    const alpha = 1.0 - Math.exp(-this.smoothSpeed * dt);
    this.x += (clampedTargetX - this.x) * alpha;

    // Strict clamp
    this.x = Math.max(0, Math.min(maxX, this.x));
    this.y = 0;
  }

  // Use floating-point camera X for subpixel-smooth scrolling without rounding jitter
  get snapX(): number {
    return this.x;
  }

  get snapY(): number {
    return this.y;
  }
}
