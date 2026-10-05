export class Camera {
  public x: number = 0;
  public y: number = 0;
  public viewportWidth: number;
  public viewportHeight: number;
  public lerpSpeed: number = 6.0;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  public update(targetCenterX: number, _targetCenterY: number, worldWidth: number, dt: number): void {
    // Target camera position to keep target in center horizontally
    const targetX = targetCenterX - this.viewportWidth / 2;
    
    // Smooth horizontal lerp
    this.x += (targetX - this.x) * Math.min(1.0, this.lerpSpeed * dt);

    // Clamp camera within world bounds
    const maxX = Math.max(0, worldWidth - this.viewportWidth);
    this.x = Math.max(0, Math.min(maxX, this.x));

    // Vertical camera: can be fixed to 0 if height matches PLAY_HEIGHT
    this.y = 0;
  }

  get snapX(): number {
    return Math.round(this.x);
  }

  get snapY(): number {
    return Math.round(this.y);
  }
}
