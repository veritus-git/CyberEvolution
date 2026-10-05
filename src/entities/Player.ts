import { PhysicsBody, MovementInput } from '../physics/PhysicsBody';
import { CONFIG } from '../core/Constants';
import { AABB } from '../physics/AABB';
import { Ladder } from '../world/Level';

export interface SkinFrames {
  idle: HTMLImageElement | null;
  run: HTMLImageElement[];
  jump: HTMLImageElement | null;
  climb: HTMLImageElement[];
}

export class Player {
  public physics: PhysicsBody;
  public skinId: number = 1;
  public skins: Map<number, SkinFrames> = new Map();

  // Animation state
  public animTimer: number = 0;
  public runFrameIndex: number = 0;
  public climbFrameIndex: number = 0;

  constructor(x: number = 250, y: number = 400) {
    this.physics = new PhysicsBody(x, y, CONFIG.PLAYER_WIDTH, CONFIG.PLAYER_HEIGHT);
  }

  get bounds(): AABB {
    return this.physics.bounds;
  }

  public async loadSkin(id: number): Promise<void> {
    const basePath = `/assets/skins/${id}`;
    const loadImage = (path: string): Promise<HTMLImageElement | null> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = path;
      });
    };

    const [idle, r1, r2, jump, c1, c2] = await Promise.all([
      loadImage(`${basePath}/idle.png`),
      loadImage(`${basePath}/r1.png`),
      loadImage(`${basePath}/r2.png`),
      loadImage(`${basePath}/jump.png`),
      loadImage(`${basePath}/climb1.png`),
      loadImage(`${basePath}/climb2.png`),
    ]);

    const runFrames = [r1, r2].filter((f): f is HTMLImageElement => f !== null);
    const climbFrames = [c1, c2].filter((f): f is HTMLImageElement => f !== null);

    this.skins.set(id, {
      idle,
      run: runFrames,
      jump,
      climb: climbFrames,
    });
  }

  public setSkin(id: number): void {
    if (id >= 1 && id <= 5) {
      this.skinId = id;
      if (!this.skins.has(id)) {
        this.loadSkin(id);
      }
    }
  }

  public update(dt: number, input: MovementInput, solids: AABB[], ladders: Ladder[], worldWidth: number): void {
    this.physics.update(dt, input, solids, ladders, worldWidth);

    // Update animation timers
    this.animTimer += dt;

    if (this.physics.isClimbing) {
      if (Math.abs(this.physics.vy) > 20) {
        if (this.animTimer >= 0.18) {
          this.climbFrameIndex = (this.climbFrameIndex + 1) % 2;
          this.animTimer = 0;
        }
      }
    } else if (this.physics.onGround && Math.abs(this.physics.vx) > 30) {
      if (this.animTimer >= 0.15) {
        this.runFrameIndex = (this.runFrameIndex + 1) % 2;
        this.animTimer = 0;
      }
    } else {
      this.animTimer = 0;
      this.runFrameIndex = 0;
    }
  }

  /**
   * Render the player at its current position, applying flipping if facing left.
   */
  public draw(ctx: CanvasRenderingContext2D, cameraX: number = 0, cameraY: number = 0): void {
    const screenX = Math.round(this.physics.x - cameraX);
    const screenY = Math.round(this.physics.y - cameraY);
    const w = this.physics.width;
    const h = this.physics.height;

    const currentSkin = this.skins.get(this.skinId);
    let frameToDraw: HTMLImageElement | null = null;

    if (currentSkin) {
      if (this.physics.isClimbing) {
        frameToDraw = currentSkin.climb[this.climbFrameIndex] || currentSkin.idle;
      } else if (!this.physics.onGround) {
        frameToDraw = currentSkin.jump || currentSkin.idle;
      } else if (Math.abs(this.physics.vx) > 30) {
        frameToDraw = currentSkin.run[this.runFrameIndex] || currentSkin.idle;
      } else {
        frameToDraw = currentSkin.idle;
      }
    }

    ctx.save();

    if (frameToDraw && frameToDraw.complete && frameToDraw.naturalWidth > 0) {
      // Scale by height to match hitbox height (250px), preserve natural aspect ratio for width
      const targetH = h;
      const naturalW = frameToDraw.naturalWidth;
      const naturalH = frameToDraw.naturalHeight;
      const targetW = Math.round(naturalW * (targetH / naturalH));

      // Horizontally centered on the player hitbox
      const playerCenterX = screenX + w / 2;
      const drawX = Math.round(playerCenterX - targetW / 2);
      const drawY = screenY;

      if (this.physics.facing === 'left') {
        ctx.translate(playerCenterX, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(frameToDraw, Math.round(-targetW / 2), drawY, targetW, targetH);
      } else {
        ctx.drawImage(frameToDraw, drawX, drawY, targetW, targetH);
      }
    } else {
      // Fallback procedural cyberpunk avatar if sprite is still loading
      this.drawProceduralFallback(ctx, screenX, screenY, w, h);
    }

    ctx.restore();
  }

  private drawProceduralFallback(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    // Body gradient
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#00e5ff');
    grad.addColorStop(0.5, '#1e88e5');
    grad.addColorStop(1, '#0d47a1');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x + 10, y + 10, w - 20, h - 20, 16);
    ctx.fill();

    // Neon visor
    ctx.fillStyle = '#00ffcc';
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur = 10;
    const eyeX = this.physics.facing === 'right' ? x + w - 40 : x + 15;
    ctx.fillRect(eyeX, y + 35, 25, 12);
    ctx.shadowBlur = 0;

    // Evo stage badge
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`EVO ${this.skinId}`, x + w / 2, y + h / 2);
  }
}
