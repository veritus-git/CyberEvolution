import { CONFIG } from '../core/Constants';
import { MaskParser } from './MaskParser';
import { Player } from '../entities/Player';
import { AABB } from '../physics/AABB';

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

  // Slide-in animation from above (gentle ease-out glide)
  public animState: 'enter' | 'visible' | 'exit' | 'hidden' = 'enter';
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

  constructor() {
    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (!this.active || this.bossDefeated) return;
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
    onVictory: () => void,
    onDefeat: () => void
  ): Promise<void> {
    this.worldNumber = worldNum;
    this.onVictoryCallback = onVictory;
    this.onDefeatCallback = onDefeat;
    this.active = true;
    this.bossDefeated = false;
    this.bossBlinkActive = false;
    this.scrollActive = false;
    this.bossSpawnRect = bossSpawn;

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

    // Load boss images
    try {
      const [b1, b2, scroll] = await Promise.all([
        MaskParser.loadImage(`/assets/worlds/${worldNum}/boss/boss1.png`),
        MaskParser.loadImage(`/assets/worlds/${worldNum}/boss/boss2.png`),
        MaskParser.loadImage(`/assets/worlds/${worldNum}/arena/zwoj.png`),
      ]);
      this.bossFrames = [b1, b2];
      this.scrollImg = scroll;
    } catch {
      this.bossFrames = null;
    }

    // Load boss questions
    await this.loadBossData(worldNum);

    // If boss has intro text, start in intro phase (HP bars and quiz card hidden until player dismisses dialog)
    if (this.bossData && this.bossData.intro) {
      this.isIntroActive = true;
      this.animState = 'hidden';
    } else {
      this.isIntroActive = false;
      this.animState = 'enter';
      this.animTimer = 0.0;
      this.pickNext();
    }
  }

  public finishIntro(): void {
    this.isIntroActive = false;
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

    this.bossData = { name, intro, questions };
    this.questionsAll = [...questions];
    this.questions = [...this.questionsAll].sort(() => Math.random() - 0.5);
  }

  private pickNext(): void {
    if (this.questions.length === 0) {
      this.questions = [...this.questionsAll].sort(() => Math.random() - 0.5);
    }
    this.cur = this.questions.pop() || null;
    if (!this.cur) return;

    // Shuffle options (1:1 with Python BossQuizRuntime)
    const options = [this.cur.a, this.cur.b, this.cur.c];
    const perm = [0, 1, 2].sort(() => Math.random() - 0.5);
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
      this.bossHp = Math.max(0, this.bossHp - dmg);
      this.bossBlinkActive = true;
      this.bossBlinkTimer = 0.35;
      if (this.bossHp <= 0) {
        this.triggerBossDefeat();
      }
    } else {
      this.playerHp = Math.max(0, this.playerHp - dmg);
      this.shakeTimer = 0.25; // horizontal screen shake on mistake
      if (this.playerHp <= 0) {
        this.triggerPlayerDefeat();
      }
    }
  }

  private triggerBossDefeat(): void {
    this.bossDefeated = true;
    this.bossBlinkActive = true;
    // 1:1 with Python: BLINKS_TOTAL * BLINK_INTERVAL_S = 5 * 0.17 = 0.85s
    this.bossBlinkTimer = 5 * 0.17;
    // Scroll does NOT spawn yet — it drops only after blinking ends!
    this.scrollActive = false;
  }

  private triggerPlayerDefeat(): void {
    this.animState = 'hidden';
    if (this.onDefeatCallback) {
      this.onDefeatCallback();
    }
  }

  public update(dt: number, player: Player): void {
    if (!this.active) return;

    // Boss frame animation (1.50s rhythm, calm and majestic)
    if (!this.bossDefeated) {
      this.bossAnimTimer += dt;
      if (this.bossAnimTimer >= 1.50) {
        this.bossAnimTimer = 0;
        this.bossFrameIndex = (this.bossFrameIndex + 1) % 2;
      }
    }

    // Boss damage & defeat blink timer
    if (this.bossBlinkActive) {
      this.bossBlinkTimer -= dt;
      if (this.bossBlinkTimer <= 0) {
        this.bossBlinkActive = false;
        if (this.bossDefeated && !this.scrollActive) {
          // Boss completely vanishes and drops the scroll onto the arena floor!
          this.scrollActive = true;
          this.scrollX = this.bossX + this.bossW / 2 - this.scrollSize / 2;
          this.scrollY = this.bossY + this.bossH - this.scrollSize - 20;
          this.scrollBobTimer = 0;
        }
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
   */
  public render(ctx: CanvasRenderingContext2D, cameraX: number, player: Player): void {
    if (!this.active) return;

    // 1. Draw Boss Quiz Card (Canvas rendered, 1:1 with Python BossQuizRuntime)
    if (!this.bossDefeated && this.animState !== 'hidden') {
      this.drawQuizCard(ctx);
    }

    // 2. Draw Boss (drawn AFTER card, overlapping right edge of card!)
    const isBossVisible = !this.bossDefeated || (this.bossBlinkActive && Math.floor(this.bossBlinkTimer / 0.17) % 2 === 0);
    if (isBossVisible) {
      this.drawBossSprite(ctx, cameraX);
    }

    // 3. Draw HP Bars above heads (1:1 with Python _draw_hp_bars) - ONLY when not in intro!
    if (!this.bossDefeated && !this.isIntroActive) {
      this.drawHpBars(ctx, cameraX, player);
    }

    // 4. Draw Scroll (if dropped)
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

    const bx = Math.round(this.bossX - cameraX + this.bossW / 2 - targetW / 2);
    const by = Math.round(this.bossY + this.bossH - targetH);

    ctx.save();
    // 1:1 with Python: no high-saturation CSS filter, clean sprite draw
    ctx.drawImage(frame, bx, by, targetW, targetH);
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
