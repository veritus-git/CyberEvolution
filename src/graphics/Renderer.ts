import { CONFIG } from '../core/Constants';
import { Level } from '../world/Level';
import { Player } from '../entities/Player';
import { Camera } from '../core/Camera';
import { Bossfight } from '../world/Bossfight';

export class Renderer {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  public showDebug: boolean = false;
  public suppressLetterbox: boolean = false;
  private animTimer: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.canvas.width = CONFIG.LOGICAL_WIDTH;
    this.canvas.height = CONFIG.LOGICAL_HEIGHT;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not create 2D context');
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;
  }

  public render(
    level: Level,
    player: Player,
    camera: Camera,
    dt: number,
    fps: number,
    activeHint: string | null = null,
    bossfight?: Bossfight | null,
    worldIntroTitle: string | null = null,
    worldIntroAlpha: number = 1.0,
    transitionState: 'wipe_out' | 'wipe_in' | 'none' = 'none',
    transitionProgress: number = 0
  ): void {
    this.animTimer += dt;
    level.updateAnimations(dt);

    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    if ('imageSmoothingQuality' in ctx) {
      (ctx as unknown as { imageSmoothingQuality: string }).imageSmoothingQuality = 'low';
    }

    // Clear frame
    ctx.fillStyle = '#080a0e';
    ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);

    // Play area
    const playAreaY = CONFIG.BAR_HEIGHT;
    ctx.save();
    ctx.translate(0, playAreaY);

    // Screen shake when taking damage in bossfight
    if (bossfight && bossfight.screenShakeTimer > 0) {
      const amp = 6;
      const ox = (Math.random() - 0.5) * amp * 2;
      const oy = (Math.random() - 0.5) * amp * 2;
      ctx.translate(ox, oy);
    }

    // Clip to play bounds
    ctx.beginPath();
    ctx.rect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.PLAY_HEIGHT);
    ctx.clip();

    const camX = camera.snapX;
    const camLeft = camX;
    const camRight = camLeft + CONFIG.LOGICAL_WIDTH;

    // 1. Draw World Background (scaled to height, preserving natural aspect ratio)
    if (level.backgroundImage && level.backgroundImage.complete && level.backgroundImage.naturalWidth > 0) {
      const bg = level.backgroundImage;
      const naturalH = bg.naturalHeight || bg.height;
      const naturalW = bg.naturalWidth || bg.width;
      const scale = CONFIG.PLAY_HEIGHT / naturalH;
      const drawW = Math.round(naturalW * scale);

      ctx.drawImage(bg, -camX, 0, drawW, CONFIG.PLAY_HEIGHT);
    } else {
      this.drawProceduralBackground(ctx, camX);
    }

    // 2. Draw NPCs (Single sprite per spawn, scaled by height, aspect ratio preserved, centered)
    for (const npc of level.npcs) {
      if (npc.bounds.right >= camLeft && npc.bounds.left <= camRight) {
        this.drawNPC(ctx, npc, camX);
      }
    }

    // 3. Draw Portals (Scaled by height, aspect ratio preserved, centered)
    for (const portal of level.portals) {
      if (portal.bounds.right >= camLeft && portal.bounds.left <= camRight) {
        this.drawPortal(ctx, portal, camX);
      }
    }

    // 4. Draw Scroll (if active in arena)
    if (level.scrollActive && level.scrollRect) {
      this.drawScroll(ctx, level, camX);
    }

    // 5. Draw Player
    player.draw(ctx, camX, 0);

    // 6. Draw Bossfight entities (Boss, HP bars, Arena scroll)
    if (bossfight && bossfight.active) {
      bossfight.render(ctx, camX, player);
    }

    // 7. Draw Interaction Hint Bubble over player's head (e.g. "E: wspinaj się", "E: wejdź", "E: porozmawiaj")
    if (activeHint && player.physics.isVisible) {
      this.drawPlayerHint(ctx, player, camX, activeHint);
    }

    // 8. Debug overlays (Hitboxes, Triggers, Ladders, Gates) - F2 ONLY!
    if (this.showDebug) {
      this.renderDebug(ctx, level, player, camera, fps);
    }

    ctx.restore();

    // 9. Letterboxing bars
    if (!this.suppressLetterbox) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.BAR_HEIGHT);
      ctx.fillRect(0, CONFIG.LOGICAL_HEIGHT - CONFIG.BAR_HEIGHT, CONFIG.LOGICAL_WIDTH, CONFIG.BAR_HEIGHT);
    }

    // 10. World Intro Title Card (1.5s steady + 0.6s smooth fade out, 1:1 with Python)
    if (worldIntroTitle && worldIntroAlpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(7, 9, 14, ${0.85 * worldIntroAlpha})`;
      ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);

      ctx.globalAlpha = Math.max(0, Math.min(1, worldIntroAlpha));

      // Massive cinematic title spanning across screen (1:1 with user requirement)
      let titleFontSize = 130;
      ctx.font = `${titleFontSize}px 'Jersey 10', 'VT323', monospace`;
      const measuredW = ctx.measureText(worldIntroTitle).width;
      const maxW = CONFIG.LOGICAL_WIDTH * 0.90;
      if (measuredW > maxW) {
        titleFontSize = Math.floor(titleFontSize * (maxW / measuredW));
        ctx.font = `${titleFontSize}px 'Jersey 10', 'VT323', monospace`;
      }

      ctx.fillStyle = '#fff0a0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(worldIntroTitle, CONFIG.LOGICAL_WIDTH / 2, CONFIG.LOGICAL_HEIGHT / 2);
      ctx.restore();
    }

    // 11. Screen Wipe Transition (snappy smooth curtain)
    if (transitionState !== 'none' && transitionProgress > 0) {
      const rawP = Math.max(0, Math.min(1, transitionProgress));
      const p = rawP * rawP * (3 - 2 * rawP);
      const head = Math.round(p * CONFIG.LOGICAL_HEIGHT);
      ctx.save();
      if (transitionState === 'wipe_out') {
        // Curtain wipes DOWN from 0 to head
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, head);
        if (head < CONFIG.LOGICAL_HEIGHT) {
          const grad = ctx.createLinearGradient(0, head, 0, Math.min(CONFIG.LOGICAL_HEIGHT, head + 50));
          grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, head, CONFIG.LOGICAL_WIDTH, 50);
        }
      } else if (transitionState === 'wipe_in') {
        // Curtain reveals from top down: remaining black from head to bottom
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, head, CONFIG.LOGICAL_WIDTH, Math.max(0, CONFIG.LOGICAL_HEIGHT - head));
        if (head > 0) {
          const grad = ctx.createLinearGradient(0, Math.max(0, head - 50), 0, head);
          grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 1)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, Math.max(0, head - 50), CONFIG.LOGICAL_WIDTH, 50);
        }
      }
      ctx.restore();
    }
  }

  private drawNPC(ctx: CanvasRenderingContext2D, npc: any, camX: number): void {
    const rx = npc.bounds.x - camX;
    const ry = npc.bounds.y;
    const rw = npc.bounds.width;
    const rh = npc.bounds.height;

    if (npc.frames && npc.frames.length > 0) {
      const frame = npc.frames[npc.frameIndex || 0];
      if (frame && frame.complete && frame.naturalWidth > 0) {
        // Height equals hitbox height, width maintains natural aspect ratio!
        const targetH = rh;
        const scale = targetH / frame.naturalHeight;
        const targetW = Math.round(frame.naturalWidth * scale);
        const drawX = Math.round(rx + rw / 2 - targetW / 2);
        const drawY = Math.round(ry + rh - targetH);
        ctx.drawImage(frame, drawX, drawY, targetW, targetH);
        return;
      }
    }
  }

  private drawPortal(ctx: CanvasRenderingContext2D, portal: any, camX: number): void {
    const rx = portal.bounds.x - camX;
    const ry = portal.bounds.y;
    const rw = portal.bounds.width;
    const rh = portal.bounds.height;

    if (portal.frames && portal.frames.length > 0) {
      const frame = portal.frames[portal.frameIndex || 0];
      if (frame && frame.complete && frame.naturalWidth > 0) {
        ctx.save();
        if (portal.alpha !== undefined) {
          ctx.globalAlpha = Math.max(0, Math.min(1, portal.alpha));
        }
        // Portals stand tall (at least 350px tall, upright and towering, never squashed or lying flat!)
        const targetH = Math.max(rh, 350);
        const scale = targetH / frame.naturalHeight;
        const targetW = Math.round(frame.naturalWidth * scale);
        const drawX = Math.round(rx + rw / 2 - targetW / 2);
        const drawY = Math.round(ry + rh - targetH);
        ctx.drawImage(frame, drawX, drawY, targetW, targetH);
        ctx.restore();
      }
    }
  }

  private drawPlayerHint(ctx: CanvasRenderingContext2D, player: Player, camX: number, text: string): void {
    const px = Math.round(player.physics.x - camX + player.physics.width / 2);
    const py = Math.round(player.physics.y - 14);

    ctx.save();
    ctx.font = "24px 'Jersey 10', 'VT323', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Thin 1.5px outline for crisp retro legibility (NO fake bold, NO thick chunky stroke)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 2;
    ctx.strokeText(text, px, py);

    // Pure white text, NO background (1:1 with Python prototype line 3171/3174)
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, px, py);
    ctx.restore();
  }

  private drawScroll(ctx: CanvasRenderingContext2D, level: Level, camX: number): void {
    if (!level.scrollRect) return;
    const bob = Math.sin(this.animTimer * 1.2) * 5;
    const rx = level.scrollRect.x - camX;
    const ry = level.scrollRect.y + bob;
    const rw = level.scrollRect.width;
    const rh = level.scrollRect.height;

    if (level.scrollImage && level.scrollImage.complete && level.scrollImage.naturalWidth > 0) {
      ctx.drawImage(level.scrollImage, rx, ry, rw, rh);
    } else {
      ctx.fillStyle = '#fde047';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, rw, rh);
    }
  }

  private drawProceduralBackground(ctx: CanvasRenderingContext2D, camX: number): void {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.PLAY_HEIGHT);
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
    ctx.lineWidth = 1;
    const ox = -(camX % 64);
    for (let x = ox; x < CONFIG.LOGICAL_WIDTH; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CONFIG.PLAY_HEIGHT); ctx.stroke();
    }
    for (let y = 0; y < CONFIG.PLAY_HEIGHT; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CONFIG.LOGICAL_WIDTH, y); ctx.stroke();
    }
  }

  private renderDebug(ctx: CanvasRenderingContext2D, level: Level, player: Player, camera: Camera, fps: number): void {
    const camLeft = camera.snapX;
    const camRight = camLeft + CONFIG.LOGICAL_WIDTH;

    // Solid colliders (Green)
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    for (const solid of level.getActiveSolids()) {
      if (solid.right >= camLeft && solid.left <= camRight) {
        ctx.strokeRect((solid.x - camLeft) | 0, solid.y | 0, solid.width, solid.height);
      }
    }

    // Ladders (Yellow)
    ctx.strokeStyle = '#ffd600';
    ctx.lineWidth = 2;
    for (const lad of level.ladders) {
      if (lad.bounds.right >= camLeft && lad.bounds.left <= camRight) {
        ctx.strokeRect((lad.bounds.x - camLeft) | 0, lad.bounds.y | 0, lad.bounds.width, lad.bounds.height);
      }
    }

    // Gates (F2 Debug ONLY!)
    for (const gate of level.gates) {
      if (gate.bounds.right >= camLeft && gate.bounds.left <= camRight) {
        ctx.strokeStyle = gate.locked ? '#ef4444' : '#22c55e';
        ctx.lineWidth = 2;
        ctx.strokeRect((gate.bounds.x - camLeft) | 0, gate.bounds.y | 0, gate.bounds.width, gate.bounds.height);
      }
    }

    // Triggers (Magenta)
    ctx.strokeStyle = '#d946ef';
    ctx.lineWidth = 2;
    for (const trig of level.triggers) {
      if (trig.bounds.right >= camLeft && trig.bounds.left <= camRight) {
        ctx.strokeRect((trig.bounds.x - camLeft) | 0, trig.bounds.y | 0, trig.bounds.width, trig.bounds.height);
      }
    }

    // Player Hitbox (Red)
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.strokeRect(
      (player.physics.x - camLeft) | 0,
      player.physics.y | 0,
      player.physics.width,
      player.physics.height
    );

    // Debug Info Panel
    ctx.fillStyle = 'rgba(7, 9, 14, 0.9)';
    ctx.fillRect(20, 20, 480, 220);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(20, 20, 480, 220);

    ctx.fillStyle = '#00e5ff';
    ctx.font = "18px 'Jersey 10', 'VT323', monospace";
    ctx.textAlign = 'left';
    ctx.fillText(`DEBUG [F2]  |  FPS: ${Math.round(fps)}`, 35, 45);

    ctx.fillStyle = '#ffffff';
    ctx.font = "16px 'Jersey 10', 'VT323', monospace";
    ctx.fillText(`POZYCJA:   X=${Math.round(player.physics.x)} Y=${Math.round(player.physics.y)}  |  KIERUNEK: ${player.physics.facing.toUpperCase()}`, 35, 72);
    ctx.fillText(`PRĘDKOŚĆ:  VX=${Math.round(player.physics.vx)} VY=${Math.round(player.physics.vy)}`, 35, 96);
    ctx.fillText(`STAN:      ZIEMIA=${player.physics.onGround}  DRABINA=${player.physics.isClimbing}`, 35, 120);
    ctx.fillText(`SKÓRKA:    EWOLUCJA ${player.skinId}/5  |  ŚCIANY: ${level.getActiveSolids().length}`, 35, 144);
    ctx.fillText(`ŚWIAT:     ${level.key} (${level.width}x${level.height})`, 35, 168);

    ctx.fillStyle = '#94a3b8';
    ctx.font = "15px 'Jersey 10', 'VT323', monospace";
    ctx.fillText(`A/D:Ruch  SPACJA:Skok  E:Interakcja/Drabina  1..5:Skin  F11:Pełny ekran`, 35, 196);
    ctx.fillText(`Bramy i hitboxy widoczne tylko w trybie debug F2`, 35, 218);
  }
}
