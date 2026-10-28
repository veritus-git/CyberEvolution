import { sound } from '../core/Audio';

export class IntroSequence {
  public isActive: boolean = false;

  private overlayElement: HTMLElement;
  private contentBox: HTMLElement;
  private textElement: HTMLElement;
  private hintElement: HTMLElement;

  private pages: string[] = [];
  private currentPageIndex: number = 0;
  private fullText: string = '';
  private currentChars: number = 0;
  private isDone: boolean = false;
  private speed: number = 42; // characters per second (matching Python 40 cps)
  private animFrame: number | null = null;
  private lastTime: number = 0;
  private lastAdvanceTime: number = 0;
  private sequenceType: 'preIntro' | 'ending' = 'preIntro';
  private onFinishedCallback?: () => void;

  constructor(container: HTMLElement) {
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'intro-overlay hidden';

    this.contentBox = document.createElement('div');
    this.contentBox.className = 'intro-content-box';

    this.textElement = document.createElement('div');
    this.textElement.className = 'intro-text';

    this.hintElement = document.createElement('div');
    this.hintElement.className = 'intro-hint';

    this.contentBox.appendChild(this.textElement);
    this.contentBox.appendChild(this.hintElement);
    this.overlayElement.appendChild(this.contentBox);
    container.appendChild(this.overlayElement);

    // Click / touch to advance
    this.overlayElement.addEventListener('click', (e) => {
      if (!this.isActive) return;
      e.stopPropagation();
      this.advance();
    });

    window.addEventListener('keydown', (e) => {
      if (!this.isActive) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
        e.preventDefault();
        e.stopPropagation();
        this.advance();
      }
    });
  }

  public async playPreIntro(onFinished: () => void): Promise<void> {
    this.sequenceType = 'preIntro';
    this.onFinishedCallback = onFinished;
    this.isActive = true;
    this.overlayElement.classList.remove('hidden');

    let text = 'Witaj w CyberEvolution.\n\nPrzed Tobą podróż przez światy świadomości cyfrowej.\nUcz się, sprawdzaj fakty i nie klikaj bezmyślnie.\nTwoje decyzje zadecydują o ewolucji!';
    try {
      const res = await fetch(`/assets/game_intro.txt?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        text = await res.text();
      }
    } catch {
      // Use fallback
    }

    // Split text into slides separated by '---' (1:1 with Python prototype _split_pages)
    const normalized = text.replace(/\\n/g, '\n');
    this.pages = normalized
      .split(/\n?\s*---+\s*\n?/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (this.pages.length === 0) {
      this.pages = [normalized.trim()];
    }

    this.currentPageIndex = 0;
    this.showPage(0);
  }

  public async playEnding(onFinished: () => void): Promise<void> {
    this.sequenceType = 'ending';
    this.onFinishedCallback = onFinished;
    this.isActive = true;
    this.overlayElement.classList.remove('hidden');

    let text =
      'Nagle ocknąłęś się jak ze snu, siedząc przed komputerem\nJasna strona poczty na ekranie oświetla Ci twarz\n---\nTwój kursor znajduje sie na podejrzanym linku, ale...\nZamiast w niego kliknąć, przenosisz mail do kosza\n---\nNauki Mędrca czegoś cię naczyły\nIdź w świat z tą świadomością w głowie\n---\nKONIEC';

    try {
      const res = await fetch(`/assets/ending/ending_story.txt?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        text = await res.text();
      }
    } catch {
      // Use fallback
    }

    const normalized = text.replace(/\\n/g, '\n');
    this.pages = normalized
      .split(/\n?\s*---+\s*\n?/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (this.pages.length === 0) {
      this.pages = [normalized.trim()];
    }

    this.currentPageIndex = 0;
    this.showPage(0);
  }

  private showPage(index: number): void {
    this.fullText = this.pages[index] || '';
    this.currentChars = 0;
    this.isDone = false;
    this.hintElement.textContent = '';
    this.lastTime = performance.now();
    this.lastAdvanceTime = performance.now();

    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    const tick = (now: number) => {
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;

      const prevCount = Math.floor(this.currentChars);
      this.currentChars += this.speed * dt;
      const nextCount = Math.min(Math.floor(this.currentChars), this.fullText.length);

      if (nextCount > prevCount) {
        const char = this.fullText[nextCount - 1];
        if (char && char.trim().length > 0) {
          sound.playDialogBlip();
        }
      }

      if (this.currentChars >= this.fullText.length) {
        this.currentChars = this.fullText.length;
        this.textElement.textContent = this.fullText;
        this.isDone = true;
        this.updateHint();
      } else {
        this.textElement.textContent = this.fullText.substring(0, nextCount);
        this.animFrame = requestAnimationFrame(tick);
      }
    };
    this.animFrame = requestAnimationFrame(tick);
  }

  private updateHint(): void {
    const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
    const isLast = this.currentPageIndex >= this.pages.length - 1;
    if (this.sequenceType === 'ending') {
      if (isTouch) {
        this.hintElement.textContent = isLast
          ? 'Dotknij ekranu, aby powrócić do menu głównego'
          : 'Dotknij ekranu, aby przejść dalej';
      } else {
        this.hintElement.textContent = isLast
          ? 'Kliknij Enter, aby powrócić do menu głównego'
          : 'Kliknij Enter aby przejść dalej';
      }
    } else {
      if (isTouch) {
        this.hintElement.textContent = isLast
          ? 'Dotknij ekranu, aby rozpocząć'
          : 'Dotknij ekranu, aby przejść dalej';
      } else {
        this.hintElement.textContent = isLast
          ? 'Kliknij dowolny klawisz, aby rozpocząć'
          : 'Kliknij Enter aby przejść dalej';
      }
    }
  }

  private advance(): void {
    const now = performance.now();
    if (now - this.lastAdvanceTime < 240) return;

    if (!this.isDone) {
      // 1st click: Instant finish of current slide typewriter (show full text)
      if (this.animFrame) cancelAnimationFrame(this.animFrame);
      this.currentChars = this.fullText.length;
      this.textElement.textContent = this.fullText;
      this.isDone = true;
      this.updateHint();
      this.lastAdvanceTime = now;
      return;
    }

    // 2nd click: advance to next slide
    this.lastAdvanceTime = now;
    this.currentPageIndex++;
    if (this.currentPageIndex < this.pages.length) {
      this.showPage(this.currentPageIndex);
      return;
    }

    // Completed all slides
    this.isActive = false;
    this.overlayElement.classList.add('hidden');
    if (this.onFinishedCallback) {
      const cb = this.onFinishedCallback;
      this.onFinishedCallback = undefined;
      // Slight delay to prevent immediate keydown bleed-through to Start Menu buttons
      setTimeout(() => {
        cb();
      }, 150);
    }
  }
}
