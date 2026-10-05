import { CONFIG } from '../core/Constants';
import { Level } from '../world/Level';
import { Player } from '../entities/Player';
import { Camera } from '../core/Camera';

export class Renderer {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  public scale: number = 1;
  public offsetX: number = 0;
  public offsetY: number = 0;

  public showDebug: boolean = false;
  private pulseTimer: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not create 2D context for game renderer');
    this.ctx = context;
  }

  /**
   * Resize canvas to fit screen while maintaining aspect ratio and sharp High-DPI pixels
   */
  public resize(windowWidth: number, windowHeight: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2 for performance on high-density screens
    this.canvas.width = Math.round(windowWidth * dpr);
    this.canvas.height = Math.round(windowHeight * dpr);

    this.canvas.style.width = `${windowWidth}px`;
    this.canvas.style.height = `${windowHeight}px`;

    // Compute uniform scale to fit logical 1920x1080 inside window
    const scaleX = (windowWidth * dpr) / CONFIG.LOGICAL_WIDTH;
    const scaleY = (windowHeight * dpr) / CONFIG.LOGICAL_HEIGHT;
    this.scale = Math.min(scaleX, scaleY);

    this.offsetX = Math.round(((windowWidth * dpr) - CONFIG.LOGICAL_WIDTH * this.scale) / 2);
    this.offsetY = Math.round(((windowHeight * dpr) - CONFIG.LOGICAL_HEIGHT * this.scale) / 2);

    // Disable image smoothing for crisp pixel-art
    this.ctx.imageSmoothingEnabled = false;
  }

  public render(level: Level, player: Player, camera: Camera, dt: number, fps: number): void {
    this.pulseTimer += dt * 3;
    const ctx = this.ctx;

    // Clear whole screen with dark cyberpunk background
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    // Apply logical scaling and centering
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // Clip to logical frame 1920x1080
    ctx.beginPath();
    ctx.rect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);
    ctx.clip();

    // 1. Render Play Area Background & Offset (bars at top and bottom)
    const playAreaY = CONFIG.BAR_HEIGHT;
    ctx.save();
    ctx.translate(0, playAreaY);

    // Background image if available
    if (level.backgroundImage && level.backgroundImage.complete) {
      // Draw background with camera offset
      ctx.drawImage(
        level.backgroundImage,
        -camera.snapX,
        0,
        level.width,
        CONFIG.PLAY_HEIGHT
      );
    } else {
      // Procedural cyberpunk grid background if image not loaded yet
      this.drawProceduralBackground(ctx, level.width, camera.snapX);
    }

    // 2. Render Ladders
    for (const ladder of level.ladders) {
      this.drawLadder(ctx, ladder.bounds, camera.snapX);
    }

    // 3. Render Portals
    for (const portal of level.portals) {
      this.drawPortal(ctx, portal.bounds, camera.snapX, portal.label || 'PORTAL');
    }

    // 4. Render Gates
    for (const gate of level.gates) {
      this.drawGate(ctx, gate.bounds, gate.locked, camera.snapX);
    }

    // 5. Render Triggers
    for (const trig of level.triggers) {
      this.drawTrigger(ctx, trig.bounds, camera.snapX, trig.activated);
    }

    // 6. Render Player
    player.draw(ctx, camera.snapX, 0);

    // 7. Render Debug Overlays (Hitboxes, colliders, coords)
    if (this.showDebug) {
      this.renderDebug(ctx, level, player, camera);
    }

    ctx.restore(); // Restore playAreaY

    // 8. Top and Bottom Cinematic Bars
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.BAR_HEIGHT);
    ctx.fillRect(0, CONFIG.LOGICAL_HEIGHT - CONFIG.BAR_HEIGHT, CONFIG.LOGICAL_WIDTH, CONFIG.BAR_HEIGHT);

    // Top Bar HUD: World Title & Evo Stage
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 24px "Pixel Emulator", monospace, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`CYBER EVOLUTION — ${level.name.toUpperCase()}`, 40, CONFIG.BAR_HEIGHT / 2);

    ctx.fillStyle = '#a0aec0';
    ctx.font = '18px monospace, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`ETAP ROZWOJU: ${player.skinId}/5  |  FPS: ${Math.round(fps)}`, CONFIG.LOGICAL_WIDTH - 40, CONFIG.BAR_HEIGHT / 2);

    // Bottom Bar HUD: Instructions
    ctx.fillStyle = '#718096';
    ctx.font = '16px monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('A/D lub Joystick: Ruch  |  SPACJA/SKOK: Skok  |  E/AKCJA: Drabina/Portal  |  1..5: Skiny  |  F2: Hitboxy', CONFIG.LOGICAL_WIDTH / 2, CONFIG.LOGICAL_HEIGHT - CONFIG.BAR_HEIGHT / 2);

    ctx.restore(); // Restore logical scale
  }

  private drawLadder(ctx: CanvasRenderingContext2D, bounds: { x: number; y: number; width: number; height: number }, camX: number): void {
    const rx = Math.round(bounds.x - camX);
    const ry = Math.round(bounds.y);
    const rw = bounds.width;
    const rh = bounds.height;

    ctx.save();
    // Rails
    ctx.fillStyle = '#ffd600';
    ctx.fillRect(rx + 4, ry, 6, rh);
    ctx.fillRect(rx + rw - 10, ry, 6, rh);

    // Rungs every 24px
    ctx.fillStyle = '#ffe082';
    for (let y = ry + 8; y < ry + rh; y += 24) {
      ctx.fillRect(rx + 6, y, rw - 12, 4);
    }
    ctx.restore();
  }

  private drawPortal(ctx: CanvasRenderingContext2D, bounds: { x: number; y: number; width: number; height: number }, camX: number, label: string): void {
    const rx = Math.round(bounds.x - camX);
    const ry = Math.round(bounds.y);
    const rw = bounds.width;
    const rh = bounds.height;

    ctx.save();
    const glow = Math.sin(this.pulseTimer) * 0.25 + 0.75;
    ctx.fillStyle = `rgba(0, 229, 255, ${0.25 * glow})`;
    ctx.fillRect(rx, ry, rw, rh);

    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(0, 229, 255, ${glow})`;
    ctx.strokeRect(rx, ry, rw, rh);

    // Pulse core
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, rx + rw / 2, ry - 14);
    ctx.restore();
  }

  private drawGate(ctx: CanvasRenderingContext2D, bounds: { x: number; y: number; width: number; height: number }, locked: boolean, camX: number): void {
    const rx = Math.round(bounds.x - camX);
    const ry = Math.round(bounds.y);
    const rw = bounds.width;
    const rh = bounds.height;

    ctx.save();
    if (locked) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.strokeRect(rx, ry, rw, rh);
      // Hazard diagonal lines
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.beginPath();
      for (let y = ry; y < ry + rh; y += 20) {
        ctx.moveTo(rx, y);
        ctx.lineTo(rx + rw, y + rw);
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = '#22c55e';
      ctx.strokeRect(rx, ry, rw, rh);
    }
    ctx.restore();
  }

  private drawTrigger(ctx: CanvasRenderingContext2D, bounds: { x: number; y: number; width: number; height: number }, camX: number, activated: boolean): void {
    const rx = Math.round(bounds.x - camX);
    const ry = Math.round(bounds.y);
    const rw = bounds.width;
    const rh = bounds.height;

    ctx.save();
    const glow = Math.sin(this.pulseTimer * 1.5) * 0.2 + 0.4;
    ctx.fillStyle = activated ? 'rgba(168, 85, 247, 0.1)' : `rgba(168, 85, 247, ${glow})`;
    ctx.fillRect(rx, ry, rw, rh);

    ctx.strokeStyle = activated ? 'rgba(168, 85, 247, 0.4)' : '#c084fc';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, rw, rh);

    // Glowing question mark beacon
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('?', rx + rw / 2, ry + rh / 2 + 8);
    ctx.restore();
  }

  private drawProceduralBackground(ctx: CanvasRenderingContext2D, worldWidth: number, camX: number): void {
    // Deep neon gradient
    const grad = ctx.createLinearGradient(0, 0, 0, CONFIG.PLAY_HEIGHT);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(-camX, 0, worldWidth, CONFIG.PLAY_HEIGHT);

    // Grid lines
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
    ctx.lineWidth = 1;
    for (let x = -camX % 64; x < CONFIG.LOGICAL_WIDTH; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CONFIG.PLAY_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < CONFIG.PLAY_HEIGHT; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CONFIG.LOGICAL_WIDTH, y);
      ctx.stroke();
    }
  }

  private renderDebug(ctx: CanvasRenderingContext2D, level: Level, player: Player, camera: Camera): void {
    ctx.save();
    // 1. Draw all solid collider bounds
    ctx.strokeStyle = '#22c55e'; // Green
    ctx.lineWidth = 2;
    for (const solid of level.getActiveSolids()) {
      ctx.strokeRect(
        Math.round(solid.x - camera.snapX),
        Math.round(solid.y),
        solid.width,
        solid.height
      );
    }

    // 2. Draw Player Hitbox
    ctx.strokeStyle = '#ef4444'; // Red
    ctx.lineWidth = 3;
    ctx.strokeRect(
      Math.round(player.physics.x - camera.snapX),
      Math.round(player.physics.y),
      player.physics.width,
      player.physics.height
    );

    // 3. Coordinate & State Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(20, 20, 360, 160);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 20, 360, 160);

    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`PLAYER POS: (${Math.round(player.physics.x)}, ${Math.round(player.physics.y)})`, 35, 45);
    ctx.fillText(`VELOCITY:   VX=${Math.round(player.physics.vx)} VY=${Math.round(player.physics.vy)}`, 35, 70);
    ctx.fillText(`STATE:      GROUNDED=${player.physics.onGround} CLIMB=${player.physics.isClimbing}`, 35, 95);
    ctx.fillText(`COLLIDERS:  ${level.getActiveSolids().length} AABB merged rects`, 35, 120);
    ctx.fillText(`CAMERA X:   ${camera.snapX}px`, 35, 145);

    ctx.restore();
  }
}
