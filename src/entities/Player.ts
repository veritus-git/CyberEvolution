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

  // Evolution animation sequence
  public evoBlinkActive: boolean = false;
  public evoBlinkTimer: number = 0;
  public evoNextSkin: number = 1;
  public evoSwapped: boolean = false;
  public evoMsgTimer: number = 0;
  public evoParticles: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    life: number;
    maxLife: number;
    color: string;
  }[] = [];

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

    // Match Python prototype fallback logic:
    // If run frames missing, fallback to idle.
    const runFrames = [r1, r2].filter((f): f is HTMLImageElement => f !== null);
    // If climb frames missing, fallback to run frames.
    const climbFrames = [c1, c2].filter((f): f is HTMLImageElement => f !== null);
    const finalClimb = climbFrames.length > 0 ? climbFrames : (runFrames.length > 0 ? runFrames : (idle ? [idle] : []));
    // If jump frame missing, fallback to idle.
    const finalJump = jump || idle;

    this.skins.set(id, {
      idle,
      run: runFrames.length > 0 ? runFrames : (idle ? [idle] : []),
      jump: finalJump,
      climb: finalClimb,
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

  public evolveUp(): void {
    const next = Math.min(5, this.skinId + 1);
    this.evoNextSkin = next;
    this.evoBlinkActive = true;
    this.evoBlinkTimer = 0;
    this.evoSwapped = false;
    this.evoMsgTimer = 2.0;

    // Initial burst of green energy particles
    this.spawnEvoBurst(35);
  }

  private spawnEvoBurst(count: number): void {
    const px = this.physics.bounds.centerX;
    const py = this.physics.bounds.centerY;
    const greenShades = ['#00ff66', '#39ff14', '#55ff99', '#aaffaa', '#00e575'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 180;
      this.evoParticles.push({
        x: px + (Math.random() - 0.5) * 40,
        y: py + (Math.random() - 0.5) * 60,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60, // float upwards
        size: 3 + Math.random() * 5,
        life: 0.6 + Math.random() * 0.7,
        maxLife: 0.6 + Math.random() * 0.7,
        color: greenShades[Math.floor(Math.random() * greenShades.length)],
      });
    }
  }

  public update(dt: number, input: MovementInput, solids: AABB[], ladders: Ladder[], worldWidth: number): void {
    this.physics.update(dt, input, solids, ladders, worldWidth);

    // Evolution 4-blink sequence (1:1 with Python prototype: 2 blinks old skin, swap skin + Evolution UP, 2 blinks new skin)
    if (this.evoBlinkActive) {
      this.evoBlinkTimer += dt;
      const blinkInterval = 0.17;
      const phase = Math.floor(this.evoBlinkTimer / blinkInterval);

      // Toggle visible / invisible
      this.physics.isVisible = phase % 2 === 0;

      // Swap skin halfway through (after 4 half-blinks = 2 full blinks of old skin)
      if (phase >= 4 && !this.evoSwapped) {
        this.setSkin(this.evoNextSkin);
        this.evoSwapped = true;
        this.spawnEvoBurst(30);
      }

      // Continuous rising energy sparks during evolution
      if (Math.random() < 0.6) {
        const px = this.physics.bounds.centerX + (Math.random() - 0.5) * this.physics.width;
        const py = this.physics.bounds.bottom - Math.random() * 20;
        this.evoParticles.push({
          x: px,
          y: py,
          vx: (Math.random() - 0.5) * 40,
          vy: -120 - Math.random() * 100,
          size: 3 + Math.random() * 4,
          life: 0.5 + Math.random() * 0.5,
          maxLife: 0.5 + Math.random() * 0.5,
          color: '#00ff66',
        });
      }

      // Finish blink after 8 half-blinks (4 complete blinks)
      if (phase >= 8) {
        this.evoBlinkActive = false;
        this.physics.isVisible = true;
      }
    }

    if (this.evoMsgTimer > 0) {
      this.evoMsgTimer = Math.max(0, this.evoMsgTimer - dt);
    }

    // Update particles
    for (let i = this.evoParticles.length - 1; i >= 0; i--) {
      const p = this.evoParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.evoParticles.splice(i, 1);
      }
    }

    // Update animation timers
    this.animTimer += dt;

    if (this.physics.isClimbing || this.physics.climbStepout > 0) {
      if (this.animTimer >= 0.30) {
        this.climbFrameIndex = (this.climbFrameIndex + 1) % 2;
        this.animTimer = 0;
      }
    } else if (this.physics.onGround && Math.abs(this.physics.vx) > 30) {
      if (this.animTimer >= 0.28) {
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
    if (!this.physics.isVisible) return;

    const screenX = this.physics.x - cameraX;
    const screenY = this.physics.y - cameraY;
    const w = this.physics.width;
    const h = this.physics.height;

    const currentSkin = this.skins.get(this.skinId);
    let frameToDraw: HTMLImageElement | null = null;

    if (currentSkin) {
      if (this.physics.isClimbing || this.physics.climbStepout > 0) {
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

    // 1. Draw glowing green energy particles during evolution
    if (this.evoParticles.length > 0) {
      ctx.save();
      for (const p of this.evoParticles) {
        const sx = p.x - cameraX;
        const sy = p.y - cameraY;
        const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.shadowColor = '#00ff66';
        ctx.shadowBlur = 8;
        ctx.fillRect(Math.round(sx - p.size / 2), Math.round(sy - p.size / 2), p.size, p.size);
      }
      ctx.restore();
    }

    // 2. Draw "Evolution UP!" text and green aura above player (1:1 with Python prototype)
    if (this.evoMsgTimer > 0) {
      ctx.save();
      const pCenterX = Math.round(this.physics.bounds.centerX - cameraX);
      const floatUp = (2.0 - this.evoMsgTimer) * 18; // gentle float upward
      const textY = Math.round(this.physics.y - cameraY - 24 - floatUp);

      // Expanding green pulse aura ring
      const auraProgress = (2.0 - this.evoMsgTimer) % 0.8;
      const auraRadius = 35 + auraProgress * 70;
      const auraAlpha = Math.max(0, 1.0 - auraProgress / 0.8) * 0.7;
      ctx.beginPath();
      ctx.arc(pCenterX, Math.round(this.physics.bounds.centerY - cameraY), auraRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 255, 102, ${auraAlpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      // "Evolution UP!" text
      const evoText = 'Evolution UP!';
      ctx.font = "30px 'Jersey 10', 'VT323', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Crisp 1px outline (1:1 with Python blit)
      ctx.fillStyle = '#000000';
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx !== 0 || dy !== 0) {
            ctx.fillText(evoText, pCenterX + dx, textY + dy);
          }
        }
      }

      // Bright neon green text fill with subtle glow
      ctx.fillStyle = '#00ff44';
      ctx.shadowColor = '#00ff66';
      ctx.shadowBlur = 10;
      ctx.fillText(evoText, pCenterX, textY);

      ctx.restore();
    }
  }

  private drawProceduralFallback(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#00e5ff');
    grad.addColorStop(0.5, '#1e88e5');
    grad.addColorStop(1, '#0d47a1');

    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }
}
