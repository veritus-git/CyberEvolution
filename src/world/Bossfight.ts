import { CONFIG } from '../core/Constants';
import { MaskParser } from './MaskParser';
import { Player } from '../entities/Player';
import { AABB } from '../physics/AABB';
import { sound } from '../core/Audio';

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export interface BossQuestion {
  q: string;
  a: string;
  b: string;
  c: string;
  correct: number; // 0 for A, 1 for B, 2 for C
}

export interface BossData {
  name: string;
  intro: string;
  outro?: string;
  questions: BossQuestion[];
}

export class Bossfight {
  public active: boolean = false;
  public worldNumber: number = 1;
  public bossData: BossData | null = null;

  // 1:1 with Python prototype: Player 300 HP, Boss 500 HP (World 1)
  public playerHp: number = 300;
  public playerHpMax: number = 300;
  public bossHp: number = 500;
  public bossHpMax: number = 500;

  public bossSpawnRect: AABB | null = null;
  public bossX: number = 1536;
  public bossY: number = 320;
  public bossW: number = 384;
  public bossH: number = 608;

  public bossFrames: [HTMLImageElement, HTMLImageElement] | null = null;
  public bossFrameIndex: number = 0;
  public bossAnimTimer: number = 0;

  public bossBlinkActive: boolean = false;
  public bossBlinkTimer: number = 0;
  public bossDefeated: boolean = false;

  // Quiz state (1:1 with Python BossQuizRuntime)
  public questionsAll: BossQuestion[] = [];
  public questions: BossQuestion[] = [];
  public cur: BossQuestion | null = null;
  public optTexts: string[] = []; // shuffled ['A','B','C']
  public optPerm: number[] = [0, 1, 2];
  public correctIdxShuffled: number = 0;
  public selection: number = 0;

  public state: 'question' | 'feedback' = 'question';
  public feedbackTimer: number = 0;
  public feedbackTotalTime: number = 0;
  public lastWasCorrect: boolean = true;
  public shakeTimer: number = 0;
  public shakeAmp: number = 6;
  public get screenShakeTimer(): number {
    return this.shakeTimer;
  }

  // Boss reaction & damage effects
  public bossShakeTimer: number = 0;
  public bossDeathTimer: number = 0;
  public deathParticles: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    life: number;
    maxLife: number;
    color: string;
  }[] = [];

  // Input debouncer to strictly prevent enter/skip bleed-through
  public inputCooldownTimer: number = 0;

  // Slide-in animation from above (gentle ease-out glide)
  public animState: 'enter' | 'visible' | 'exit' | 'hidden' = 'hidden';
  public animTimer: number = 0;
  public animDur: number = 1.1;
  public topMarginPx: number = 28;

  // Scroll item drop upon victory
  public scrollActive: boolean = false;
  public scrollX: number = 0;
  public scrollY: number = 0;
  public scrollSize: number = 80;
  public scrollImg: HTMLImageElement | null = null;
  public scrollBobTimer: number = 0;

  private onVictoryCallback?: () => void;
  private onDefeatCallback?: () => void;
  private onWorld5DefeatedCallback?: () => void;

  constructor() {
    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (!this.active || this.bossDefeated || this.isIntroActive) return;
      if (this.animState !== 'visible' || this.inputCooldownTimer > 0) return;
      if (this.state === 'feedback') return;

      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        this.selection = (this.selection - 1 + 3) % 3;
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        this.selection = (this.selection + 1) % 3;
      } else if (e.code === 'Digit1') {
        e.preventDefault();
        this.selection = 0;
      } else if (e.code === 'Digit2') {
        e.preventDefault();
        this.selection = 1;
      } else if (e.code === 'Digit3') {
        e.preventDefault();
        this.selection = 2;
      } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
        e.preventDefault();
        this.confirmSelection();
      }
    });
  }

  public isIntroActive: boolean = false;

  public async start(
    worldNum: number,
    bossSpawn: AABB | null,
    skipIntro: boolean = false,
    onVictory?: () => void,
    onDefeat?: () => void,
    onWorld5Defeated?: () => void
  ): Promise<void> {
    this.worldNumber = worldNum;
    this.onVictoryCallback = onVictory;
    this.onDefeatCallback = onDefeat;
    this.onWorld5DefeatedCallback = onWorld5Defeated;
    this.active = true;
    this.bossDefeated = false;
    this.bossBlinkActive = false;
    this.bossShakeTimer = 0;
    this.bossDeathTimer = 0;
    this.deathParticles = [];
    this.inputCooldownTimer = 0.5;
    this.scrollActive = false;
    this.bossSpawnRect = bossSpawn;
    this.animState = 'hidden';

    // HP map per world number (1:1 with Python _get_boss_hp_static)
    const hpMap: Record<number, number> = { 1: 500, 2: 600, 3: 700, 4: 800, 5: 1000 };
    this.bossHpMax = hpMap[worldNum] || 500;
    this.bossHp = this.bossHpMax;
    this.playerHpMax = 300;
    this.playerHp = 300;

    // Boss dimensions from spawn placeholder (Python: target_h = int(self.boss_spawns[0].h) = 608px)
    if (bossSpawn) {
      this.bossX = bossSpawn.x;
      this.bossY = bossSpawn.y;
      this.bossW = bossSpawn.width;
      this.bossH = bossSpawn.height; // 608px in World 1!
    } else {
      this.bossX = 1536;
      this.bossY = 320;
      this.bossW = 384;
      this.bossH = 608;
    }

    // Load boss images independently of scroll
    try {
      const [b1, b2] = await Promise.all([
        MaskParser.loadImage(`/assets/worlds/${worldNum}/boss/boss1.png`),
        MaskParser.loadImage(`/assets/worlds/${worldNum}/boss/boss2.png`),
      ]);
      this.bossFrames = [b1, b2];
    } catch (e) {
      console.warn(`Boss frames load failed for world ${worldNum}:`, e);
      this.bossFrames = null;
    }

    // Only worlds 1..4 have a scroll (world 5 has no scroll)
    if (worldNum < 5) {
      try {
        this.scrollImg = await MaskParser.loadImage(`/assets/worlds/${worldNum}/arena/zwoj.png`);
      } catch {
        this.scrollImg = null;
      }
    } else {
      this.scrollImg = null;
    }

    // Load boss questions
    await this.loadBossData(worldNum);

    if (skipIntro) {
      this.isIntroActive = false;
      this.animState = 'enter';
      this.animTimer = 0.0;
      this.pickNext();
    } else {
      this.isIntroActive = true;
      this.animState = 'hidden';
    }
  }

  public finishIntro(): void {
    this.isIntroActive = false;
    this.inputCooldownTimer = 0.45; // Strict debounce after closing dialog!
    this.animState = 'enter';
    this.animTimer = 0.0;
    this.pickNext();
  }

  private async loadBossData(wn: number): Promise<void> {
    try {
      const res = await fetch(`/assets/worlds/${wn}/bossfight.txt`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      this.parseBossfightText(text);
    } catch (e) {
      console.warn('Failed to load bossfight text:', e);
      this.questionsAll = [
        {
          q: 'Która reakcja jest najbezpieczniejsza, gdy otrzymasz e-mail z linkiem do „resetu hasła” którego nie zamawiałeś?',
          a: 'Zignorować wiadomość i wejść bezpośrednio na stronę serwisu, by sprawdzić stan konta.',
          b: 'Odpisać do nadawcy, że to nie ja.',
          c: 'Kliknąć i wprowadzić nowe hasło, żeby zabezpieczyć konto.',
          correct: 0,
        },
      ];
      this.questions = [...this.questionsAll];
    }
  }

  private parseBossfightText(raw: string): void {
    const lines = raw.split('\n');
    let name = 'Boss';
    let intro = '';
    let outro = '';
    const questions: BossQuestion[] = [];

    let curQ = '';
    let curA = '';
    let curB = '';
    let curC = '';
    let curCorrect = 0;

    const flushQ = () => {
      if (curQ && curA && curB && curC) {
        questions.push({
          q: curQ,
          a: curA,
          b: curB,
          c: curC,
          correct: curCorrect,
        });
      }
      curQ = '';
      curA = '';
      curB = '';
      curC = '';
      curCorrect = 0;
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      if (line.startsWith('BOSSNAME:')) {
        name = line.replace('BOSSNAME:', '').trim();
      } else if (line.startsWith('INTRO:')) {
        intro = line.replace('INTRO:', '').trim();
      } else if (line.startsWith('OUTRO:')) {
        outro = line.replace('OUTRO:', '').trim().replace(/\\n/g, '\n');
      } else if (line.startsWith('Q:')) {
        flushQ();
        curQ = line.replace('Q:', '').trim();
      } else if (line.startsWith('A:')) {
        curA = line.replace('A:', '').trim();
      } else if (line.startsWith('B:')) {
        curB = line.replace('B:', '').trim();
      } else if (line.startsWith('C:')) {
        curC = line.replace('C:', '').trim();
      } else if (line.toUpperCase().startsWith('CORRECT:')) {
        const letter = line.split(':')[1].trim().toUpperCase();
        curCorrect = letter === 'B' ? 1 : letter === 'C' ? 2 : 0;
      }
    }
    flushQ();

    this.bossData = { name, intro, outro, questions };
    this.questionsAll = [...questions];
    this.questions = shuffleArray([...this.questionsAll]);
  }

  private pickNext(): void {
    if (this.questions.length === 0) {
      this.questions = shuffleArray([...this.questionsAll]);
    }
    this.cur = this.questions.pop() || null;
    if (!this.cur) return;

    // True uniform Fisher-Yates shuffle of options A, B, C!
    const options = [this.cur.a, this.cur.b, this.cur.c];
    const perm = shuffleArray([0, 1, 2]);
    this.optPerm = perm;
    this.optTexts = perm.map((idx) => options[idx]);
    this.correctIdxShuffled = perm.indexOf(this.cur.correct);

    this.selection = 0;
    this.state = 'question';
    this.feedbackTimer = 0.0;
    this.shakeTimer = 0.0;
  }

  private confirmSelection(): void {
    if (this.state === 'feedback') return;

    const good = this.selection === this.correctIdxShuffled;
    this.state = 'feedback';
    this.lastWasCorrect = good;

    const total = good ? 0.45 : 1.0;
    this.feedbackTotalTime = total;
    this.feedbackTimer = total;

    const dmg = 100; // 1:1 with Python dmg = 100
    if (good) {
      sound.playQuizCorrect();
      this.bossHp = Math.max(0, this.bossHp - dmg);
      this.bossShakeTimer = 0.35; // Boss shakes upon taking damage!
      this.bossBlinkActive = true;
      this.bossBlinkTimer = 0.35;
      if (this.bossHp <= 0) {
        this.triggerBossDefeat();
      }
    } else {
      sound.playQuizWrong();
      this.playerHp = Math.max(0, this.playerHp - dmg);
      this.shakeTimer = 0.25; // screen shake on error
      if (this.playerHp <= 0) {
        this.triggerPlayerDefeat();
      }
    }
  }

  public triggerBossDefeat(): void {
    this.bossDefeated = true;
    this.bossBlinkActive = false;
    this.animState = 'hidden';
    // Slower, dramatic death blinking (1.6s total) before bursting into pixel explosion!
    this.bossDeathTimer = 1.6;
    this.bossShakeTimer = 1.6;
    this.scrollActive = false;
  }

  private spawnBossDeathExplosion(): void {
    const cx = this.bossX + this.bossW / 2;
    const cy = this.bossY + this.bossH / 2;
    const colors = ['#00e5ff', '#ff007f', '#ffe600', '#ffffff', '#8a2be2', '#39ff14'];
    for (let i = 0; i < 95; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 140 + Math.random() * 480;
      this.deathParticles.push({
        x: cx + (Math.random() - 0.5) * (this.bossW * 0.7),
        y: cy + (Math.random() - 0.5) * (this.bossH * 0.7),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 90,
        size: 4 + Math.random() * 8,
        life: 0.6 + Math.random() * 0.9,
        maxLife: 0.6 + Math.random() * 0.9,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  public triggerPlayerDefeat(): void {
    this.animState = 'hidden';
    if (this.onDefeatCallback) {
      this.onDefeatCallback();
    }
  }

  public update(dt: number, player: Player): void {
    if (!this.active) return;

    if (this.inputCooldownTimer > 0) {
      this.inputCooldownTimer = Math.max(0, this.inputCooldownTimer - dt);
    }
    if (this.bossShakeTimer > 0) {
      this.bossShakeTimer = Math.max(0, this.bossShakeTimer - dt);
    }

    // Boss frame animation (1.50s rhythm, calm and majestic)
    if (!this.bossDefeated) {
      this.bossAnimTimer += dt;
      if (this.bossAnimTimer >= 1.50) {
        this.bossAnimTimer = 0;
        this.bossFrameIndex = (this.bossFrameIndex + 1) % 2;
      }
    }

    // Boss damage blink timer
    if (this.bossBlinkActive) {
      this.bossBlinkTimer -= dt;
      if (this.bossBlinkTimer <= 0) {
        this.bossBlinkActive = false;
      }
    }

    // Boss defeat sequence: dramatic blinking + trembling -> pixel explosion -> drop scroll (or outro in World 5)
    if (this.bossDefeated && this.bossDeathTimer > 0) {
      this.bossDeathTimer -= dt;
      this.bossShakeTimer = 0.2; // Continuous trembling
      if (this.bossDeathTimer <= 0) {
        this.spawnBossDeathExplosion();
        if (this.worldNumber === 5) {
          this.scrollActive = false;
          if (this.onWorld5DefeatedCallback) {
            this.onWorld5DefeatedCallback();
          }
        } else {
          this.scrollActive = true;
          this.scrollX = this.bossX + this.bossW / 2 - this.scrollSize / 2;
          this.scrollY = this.bossY + this.bossH - this.scrollSize - 20;
          this.scrollBobTimer = 0;
        }
      }
    }

    // Update death explosion particles
    for (let i = this.deathParticles.length - 1; i >= 0; i--) {
      const p = this.deathParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 380 * dt; // gravity
      p.vx *= 0.97;
      p.life -= dt;
      if (p.life <= 0) {
        this.deathParticles.splice(i, 1);
      }
    }

    // Slide animation tick
    if (this.animState === 'enter') {
      this.animTimer += dt;
      if (this.animTimer >= this.animDur) {
        this.animState = 'visible';
      }
    }

    // Feedback timer
    if (this.state === 'feedback') {
      this.feedbackTimer = Math.max(0, this.feedbackTimer - dt);
      if (this.feedbackTimer <= 0) {
        if (this.bossHp > 0 && this.playerHp > 0) {
          this.pickNext();
        }
      }
    }

    // Shake timer
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    }

    // Scroll bobbing and collision check (gentle calm float)
    if (this.scrollActive) {
      this.scrollBobTimer += dt;
      const bob = Math.sin(this.scrollBobTimer * 1.2) * 5;
      const scrollYWithBob = this.scrollY + bob;

      // Check player collected scroll
      const p = player.physics.bounds;
      if (
        p.right >= this.scrollX &&
        p.left <= this.scrollX + this.scrollSize &&
        p.bottom >= scrollYWithBob &&
        p.top <= scrollYWithBob + this.scrollSize
      ) {
        this.scrollActive = false;
        if (this.onVictoryCallback) {
          this.onVictoryCallback();
        }
      }
    }
  }

  /**
   * Render Bossfight:
   * 1. Draw Quiz Card FIRST
   * 2. Draw Boss SECOND (so the Boss sprite overlaps/sits NAD the card!)
   * 3. Draw HP bars THIRD
   * 4. Draw Scroll FOURTH
   * 5. Draw Death Particles
   */
  public render(ctx: CanvasRenderingContext2D, cameraX: number, player: Player): void {
    if (!this.active) return;

    // 1. Draw Boss Quiz Card (Canvas rendered, 1:1 with Python BossQuizRuntime)
    if (!this.bossDefeated && this.animState !== 'hidden') {
      this.drawQuizCard(ctx);
    }

    // 2. Draw Boss (drawn AFTER card, overlapping right edge of card!)
    let isBossVisible = true;
    if (this.bossDefeated) {
      if (this.bossDeathTimer > 0) {
        // Slow dramatic blinking before death explosion: 0.20s per blink
        isBossVisible = Math.floor(this.bossDeathTimer / 0.20) % 2 === 0;
      } else {
        isBossVisible = false; // Vanished after explosion!
      }
    } else if (this.bossBlinkActive) {
      isBossVisible = Math.floor(this.bossBlinkTimer / 0.12) % 2 === 0;
    }

    if (isBossVisible) {
      this.drawBossSprite(ctx, cameraX);
    }

    // 3. Draw Death Explosion Particles
    if (this.deathParticles.length > 0) {
      this.drawDeathParticles(ctx, cameraX);
    }

    // 4. Draw HP Bars above heads (1:1 with Python _draw_hp_bars) - ONLY when not in intro and not defeated!
    if (!this.bossDefeated && !this.isIntroActive) {
      this.drawHpBars(ctx, cameraX, player);
    }

    // 5. Draw Scroll (if dropped)
    if (this.scrollActive) {
      this.drawScrollItem(ctx, cameraX);
    }
  }

  private drawQuizCard(ctx: CanvasRenderingContext2D): void {
    if (!this.cur) return;

    // Geometry matching Python prototype:
    // panel_w = int(LOGICAL_W * 0.82) = 1574
    // panel_h = int(PLAY_H * 0.30) = 276
    // unit_x = (LOGICAL_W - panel_w) // 2 = 173
    // unit_y = PLAY_RECT.top + 28 = 108
    const panelW = Math.round(CONFIG.LOGICAL_WIDTH * 0.82);
    const panelH = Math.round(CONFIG.PLAY_HEIGHT * 0.30);
    const unitX = Math.round((CONFIG.LOGICAL_WIDTH - panelW) / 2);
    const unitY = CONFIG.BAR_HEIGHT + this.topMarginPx;

    const offTotal = -(unitY + panelH);
    let yOff = 0;
    if (this.animState === 'enter') {
      const p = Math.max(0, Math.min(1, this.animTimer / this.animDur));
      // Gentle ease-out cubic: slides down smoothly and delicately decelerates into place
      const easeOut = 1.0 - Math.pow(1.0 - p, 3);
      yOff = Math.round(offTotal * (1.0 - easeOut));
    }

    // Horizontal shake offset on wrong choice
    let offX = 0;
    if (this.shakeTimer > 0) {
      const phase = this.shakeTimer * 40.0;
      offX = Math.round(Math.sin(phase) * this.shakeAmp);
    }

    const cardX = unitX + offX;
    const cardY = unitY + yOff;

    ctx.save();

    // Dark rounded box with light border (1:1 with Python: fill (18,20,26,225), border (190,190,220))
    ctx.fillStyle = 'rgba(18, 20, 26, 0.90)';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, panelW, panelH, 10);
    ctx.fill();

    ctx.strokeStyle = 'rgba(190, 190, 220, 0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Question text (instant, soft warm yellow #fff0a0)
    ctx.font = "26px 'Jersey 10', 'VT323', monospace";
    ctx.fillStyle = '#fff0a0';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const maxTextW = panelW - 40;
    const qLines = this.wrapText(ctx, this.cur.q, maxTextW);
    let curY = cardY + 16;
    for (const ql of qLines) {
      ctx.fillText(ql, cardX + 20, curY);
      curY += 28;
    }
    curY += 6;

    // Choices (shuffled)
    ctx.font = "22px 'Jersey 10', 'VT323', monospace";
    for (let i = 0; i < this.optTexts.length; i++) {
      const isSel = i === this.selection;
      const tag = ['A', 'B', 'C'][i];
      const optStr = `${tag}. ${this.optTexts[i]}`;

      let textColor = '#dcdcdc';
      let bgColor: string | null = null;

      if (this.state === 'feedback') {
        const goodSel = this.selection === this.correctIdxShuffled;
        if (isSel) {
          if (goodSel) {
            textColor = '#1ec83c';
            bgColor = 'rgba(40, 80, 40, 0.45)';
          } else {
            textColor = '#dc3232';
            bgColor = 'rgba(90, 30, 30, 0.45)';
          }
        }
        if (!goodSel && i === this.correctIdxShuffled && !isSel) {
          // Blink orange to reveal correct answer
          const elapsed = Math.max(0, this.feedbackTotalTime - this.feedbackTimer);
          const blinkOn = Math.floor(elapsed * 6.0) % 2 === 0;
          if (blinkOn) {
            textColor = '#ffbe3c';
            bgColor = 'rgba(120, 80, 0, 0.45)';
          }
        }
      } else if (isSel) {
        textColor = '#ffffff';
        bgColor = 'rgba(60, 60, 70, 0.40)';
      }

      const textMetrics = ctx.measureText(optStr);
      if (bgColor) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(cardX + 16, curY - 3, Math.min(panelW - 32, textMetrics.width + 16), 28);
      }

      ctx.fillStyle = textColor;
      ctx.fillText(optStr, cardX + 24, curY);
      curY += 32;
    }

    // Bottom-left mini help instruction
    ctx.font = "16px 'Jersey 10', 'VT323', monospace";
    ctx.fillStyle = '#646464';
    ctx.fillText('Wybór: strzałki ↑/↓ lub 1–3, zatwierdź Enter', cardX + 18, cardY + panelH - 24);

    ctx.restore();
  }

  private drawBossSprite(ctx: CanvasRenderingContext2D, cameraX: number): void {
    if (!this.bossFrames) return;
    const frame = this.bossFrames[this.bossFrameIndex];
    if (!frame || !frame.complete || frame.naturalWidth <= 0) return;

    // Full 608px height from arena mask spawn placeholder!
    const targetH = this.bossH;
    const scale = targetH / frame.naturalHeight;
    const targetW = Math.round(frame.naturalWidth * scale);

    // Apply shake jitter when damaged or dying
    let offX = 0;
    let offY = 0;
    if (this.bossShakeTimer > 0) {
      const amp = this.bossDefeated ? 15 : 10;
      offX = Math.round((Math.random() - 0.5) * 2 * amp);
      offY = Math.round((Math.random() - 0.5) * amp);
    }

    const bx = Math.round(this.bossX - cameraX + this.bossW / 2 - targetW / 2 + offX);
    const by = Math.round(this.bossY + this.bossH - targetH + offY);

    ctx.save();
    // Hit flash effect when damaged
    if (this.bossShakeTimer > 0 && !this.bossDefeated) {
      ctx.filter = 'brightness(1.5) contrast(1.2)';
    }
    ctx.drawImage(frame, bx, by, targetW, targetH);
    ctx.restore();
  }

  private drawDeathParticles(ctx: CanvasRenderingContext2D, cameraX: number): void {
    ctx.save();
    for (const p of this.deathParticles) {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - cameraX), Math.round(p.y), p.size, p.size);
    }
    ctx.restore();
  }

  private drawHpBars(ctx: CanvasRenderingContext2D, cameraX: number, player: Player): void {
    // Geometry 1:1 with Python prototype:
    // base_w = 200, pad = 10, w = 300, h = 21
    const w = 300;
    const h = 21;

    // 1. Player HP Bar (above player head)
    const px = Math.round(player.physics.x - cameraX + player.physics.width / 2 - w / 2);
    const py = Math.round(player.physics.y - 34);
    const pRatio = Math.max(0, Math.min(1, this.playerHp / this.playerHpMax));
    const pFillW = Math.round(w * pRatio);

    // Black border
    ctx.fillStyle = '#000000';
    ctx.fillRect(px - 2, py - 2, w + 4, h + 4);
    // Dark gray background
    ctx.fillStyle = '#3c3c3c';
    ctx.fillRect(px, py, w, h);
    // Green fill
    ctx.fillStyle = '#32c832';
    ctx.fillRect(px, py, pFillW, h);

    // Centered label inside bar
    ctx.font = "18px 'Jersey 10', 'VT323', monospace";
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.playerHp}/${this.playerHpMax}`, px + w / 2, py + h / 2);

    // 2. Boss HP Bar (above boss head)
    const bx = Math.round(this.bossX - cameraX + this.bossW / 2 - w / 2);
    const by = Math.round(this.bossY - 34);
    const bRatio = Math.max(0, Math.min(1, this.bossHp / this.bossHpMax));
    const bFillW = Math.round(w * bRatio);

    // Black border
    ctx.fillStyle = '#000000';
    ctx.fillRect(bx - 2, by - 2, w + 4, h + 4);
    // Dark gray background
    ctx.fillStyle = '#3c3c3c';
    ctx.fillRect(bx, by, w, h);
    // Red fill
    ctx.fillStyle = '#c83232';
    ctx.fillRect(bx, by, bFillW, h);

    // Centered label inside bar
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${this.bossHp}/${this.bossHpMax}`, bx + w / 2, by + h / 2);
  }

  private drawScrollItem(ctx: CanvasRenderingContext2D, cameraX: number): void {
    const bob = Math.sin(this.scrollBobTimer * 1.2) * 5;
    const sx = Math.round(this.scrollX - cameraX);
    const sy = Math.round(this.scrollY + bob);

    if (this.scrollImg && this.scrollImg.complete && this.scrollImg.naturalWidth > 0) {
      ctx.drawImage(this.scrollImg, sx, sy, this.scrollSize, this.scrollSize);
    } else {
      ctx.fillStyle = '#fde047';
      ctx.fillRect(sx, sy, this.scrollSize, this.scrollSize);
    }
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let curLine = '';

    for (const w of words) {
      const test = curLine ? `${curLine} ${w}` : w;
      if (ctx.measureText(test).width > maxW && curLine) {
        lines.push(curLine);
        curLine = w;
      } else {
        curLine = test;
      }
    }
    if (curLine) lines.push(curLine);
    return lines;
  }

  public end(): void {
    this.active = false;
  }
}
