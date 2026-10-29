import { PhysicsBody, MovementInput } from '../physics/PhysicsBody';
import { CONFIG } from '../core/Constants';
import { AABB } from '../physics/AABB';
import { Ladder } from '../world/Level';
import { sound } from '../core/Audio';

export interface SkinFrames {
  idle: HTMLImageElement | null;
  idleFrames: HTMLImageElement[];
  run: HTMLImageElement[];
  jump: HTMLImageElement | null;
  jumpFrames: HTMLImageElement[];
  fall: HTMLImageElement | null;
  fallFrames: HTMLImageElement[];
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
  public idleFrameIndex: number = 0;

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

    const runPromises: Promise<HTMLImageElement | null>[] = [];
    for (let i = 1; i <= 8; i++) {
      runPromises.push(loadImage(`${basePath}/r${i}.png`));
    }

    const idlePromises: Promise<HTMLImageElement | null>[] = [];
    for (let i = 1; i <= 4; i++) {
      idlePromises.push(loadImage(`${basePath}/idle${i}.png`));
    }

    const jumpPromises: Promise<HTMLImageElement | null>[] = [
      loadImage(`${basePath}/jump1.png`),
      loadImage(`${basePath}/jump2.png`),
    ];

    const fallPromises: Promise<HTMLImageElement | null>[] = [
      loadImage(`${basePath}/fall1.png`),
      loadImage(`${basePath}/fall2.png`),
    ];

    const climbPromises: Promise<HTMLImageElement | null>[] = [];
    for (let i = 1; i <= 4; i++) {
      climbPromises.push(loadImage(`${basePath}/climb${i}.png`));
    }

    const [idle, jump, fall, loadedClimb, loadedIdle, loadedRun, loadedJump, loadedFall] = await Promise.all([
      loadImage(`${basePath}/idle.png`),
      loadImage(`${basePath}/jump.png`),
      loadImage(`${basePath}/fall.png`),
      Promise.all(climbPromises),
      Promise.all(idlePromises),
      Promise.all(runPromises),
      Promise.all(jumpPromises),
      Promise.all(fallPromises),
    ]);

    const runFrames = loadedRun.filter((f): f is HTMLImageElement => f !== null);
    const climbFrames = loadedClimb.filter((f): f is HTMLImageElement => f !== null);
    const idleFrames = loadedIdle.filter((f): f is HTMLImageElement => f !== null);
    const jumpFrames = loadedJump.filter((f): f is HTMLImageElement => f !== null);
    const fallFrames = loadedFall.filter((f): f is HTMLImageElement => f !== null);

    const finalIdle = idle || (idleFrames.length > 0 ? idleFrames[0] : null);
    const finalIdleFrames = idleFrames.length > 0 ? idleFrames : (finalIdle ? [finalIdle] : []);
    const finalRun = runFrames.length > 0 ? runFrames : (finalIdle ? [finalIdle] : []);
    const finalClimb = climbFrames.length > 0 ? climbFrames : finalRun;
    const finalJump = jump || (jumpFrames.length > 0 ? jumpFrames[0] : finalIdle);
    const finalFall = fall || (fallFrames.length > 0 ? fallFrames[0] : finalJump);

    this.skins.set(id, {
      idle: finalIdle,
      idleFrames: finalIdleFrames,
      run: finalRun,
      jump: finalJump,
      jumpFrames: jumpFrames.length > 0 ? jumpFrames : (finalJump ? [finalJump] : []),
      fall: finalFall,
      fallFrames: fallFrames.length > 0 ? fallFrames : (finalFall ? [finalFall] : []),
      climb: finalClimb,
    });
  }

  public async preloadAllSkins(): Promise<void> {
    await Promise.all([
      this.loadSkin(1),
      this.loadSkin(2),
      this.loadSkin(3),
      this.loadSkin(4),
      this.loadSkin(5),
    ]);
  }

  public setSkin(id: number): void {
    if (id >= 1 && id <= 5) {
      this.skinId = id;
      if (!this.skins.has(id)) {
        this.loadSkin(id);
      }
    }
  }

  private onEvoCompleteCallback?: () => void;

  public evolveUp(onComplete?: () => void): void {
    sound.playEvolution();
    const next = Math.min(5, this.skinId + 1);
    this.evoNextSkin = next;
    this.evoBlinkActive = true;
    this.evoBlinkTimer = 0;
    this.evoSwapped = false;
    this.evoMsgTimer = 2.5;
    this.onEvoCompleteCallback = onComplete;
    this.physics.vx = 0;

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
    // If evolution is ongoing, completely lock player movement and input
    const effectiveInput = this.evoBlinkActive
      ? { moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, interactPressed: false }
      : input;
    if (this.evoBlinkActive) {
      this.physics.vx = 0;
    }

    this.physics.update(dt, effectiveInput, solids, ladders, worldWidth);

    if (this.physics.justJumped) {
      sound.playJump();
      this.physics.justJumped = false;
    }

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
        if (this.onEvoCompleteCallback) {
          const cb = this.onEvoCompleteCallback;
          this.onEvoCompleteCallback = undefined;
          cb();
        }
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

    const isRunning = this.physics.onGround && Math.abs(this.physics.vx) > 30;

    if (this.physics.isClimbing) {
      let currentSkin = this.skins.get(this.skinId);
      if (!currentSkin || !currentSkin.idle) {
        currentSkin = this.skins.get(1);
      }
      const numClimbFrames = currentSkin?.climb?.length || 4;
      // Only advance animation frames when moving vertically on the ladder!
      if (Math.abs(this.physics.vy) > 10) {
        if (this.animTimer >= 0.12) {
          this.climbFrameIndex = (this.climbFrameIndex + 1) % numClimbFrames;
          this.animTimer = 0;
        }
      }
    } else if (isRunning) {
      let currentSkin = this.skins.get(this.skinId);
      if (!currentSkin || !currentSkin.idle) {
        currentSkin = this.skins.get(1);
      }
      const numRunFrames = currentSkin?.run?.length || 2;
      const frameDuration = numRunFrames >= 8 ? 0.085 : 0.20;

      if (this.animTimer >= frameDuration) {
        this.runFrameIndex = (this.runFrameIndex + 1) % numRunFrames;
        this.animTimer = 0;

        // Footstep sound synchronized with foot plants:
        // In 8-frame cycle: Frame 0 (Right foot strike) and Frame 4 (Left foot strike)
        if (numRunFrames >= 8) {
          if (this.runFrameIndex === 0 || this.runFrameIndex === 4) {
            sound.playFootstep();
          }
        } else {
          sound.playFootstep();
        }
      }
    } else if (this.physics.onGround) {
      // Idle state - gentle breathing animation
      let currentSkin = this.skins.get(this.skinId);
      if (!currentSkin || !currentSkin.idle) {
        currentSkin = this.skins.get(1);
      }
      const numIdleFrames = currentSkin?.idleFrames?.length || 0;
      if (numIdleFrames > 1) {
        if (this.animTimer >= 0.24) {
          this.idleFrameIndex = (this.idleFrameIndex + 1) % numIdleFrames;
          this.animTimer = 0;
        }
      } else {
        this.idleFrameIndex = 0;
      }
      this.runFrameIndex = 0;
    } else {
      // In air (jump / fall)
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

    let currentSkin = this.skins.get(this.skinId);
    if (!currentSkin || !currentSkin.idle) {
      currentSkin = this.skins.get(1) || Array.from(this.skins.values())[0];
    }
    let frameToDraw: HTMLImageElement | null = null;

    if (currentSkin) {
      if (this.physics.isClimbing) {
        const climbLen = currentSkin.climb.length;
        frameToDraw = (climbLen > 0 ? currentSkin.climb[this.climbFrameIndex % climbLen] : null) || currentSkin.idle;
      } else if (!this.physics.onGround) {
        // Airborne: Dynamic Jump vs Fall based on vertical velocity
        if (this.physics.vy > 60) {
          // Falling downward
          const fallFrames = currentSkin.fallFrames || [];
          if (fallFrames.length >= 2) {
            frameToDraw = this.physics.vy > 450 ? fallFrames[1] : fallFrames[0];
          } else {
            frameToDraw = currentSkin.fall || currentSkin.jump || currentSkin.idle;
          }
        } else {
          // Rising upward (Jump)
          const jumpFrames = currentSkin.jumpFrames || [];
          if (jumpFrames.length >= 2) {
            // Explosive takeoff launch (vy < -400) vs soaring/apex (-400 <= vy <= 60)
            frameToDraw = this.physics.vy < -400 ? jumpFrames[0] : jumpFrames[1];
          } else {
            frameToDraw = currentSkin.jump || currentSkin.idle;
          }
        }
      } else if (Math.abs(this.physics.vx) > 30) {
        const runLen = currentSkin.run.length;
        frameToDraw = currentSkin.run[this.runFrameIndex % runLen] || currentSkin.idle;
      } else {
        if (currentSkin.idleFrames && currentSkin.idleFrames.length > 0) {
          frameToDraw = currentSkin.idleFrames[this.idleFrameIndex % currentSkin.idleFrames.length] || currentSkin.idle;
        } else {
          frameToDraw = currentSkin.idle;
        }
      }
    }

    if (!frameToDraw || !frameToDraw.complete || frameToDraw.naturalWidth <= 0) {
      const skin1 = this.skins.get(1);
      if (skin1 && skin1.idle && skin1.idle.complete) {
        frameToDraw = skin1.idle;
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

      if (this.physics.facing === 'left' && !this.physics.isClimbing) {
        ctx.translate(playerCenterX, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(frameToDraw, Math.round(-targetW / 2), drawY, targetW, targetH);
      } else {
        ctx.drawImage(frameToDraw, drawX, drawY, targetW, targetH);
      }
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

    // 2. Draw "Evolution UP!" text above player
    if (this.evoMsgTimer > 0) {
      ctx.save();
      const pCenterX = Math.round(this.physics.bounds.centerX - cameraX);
      const floatUp = (2.0 - this.evoMsgTimer) * 18; // gentle float upward
      const textY = Math.round(this.physics.y - cameraY - 24 - floatUp);

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
}
