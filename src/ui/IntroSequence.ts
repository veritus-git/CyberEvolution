import { sound } from '../core/Audio';

const DEFAULT_PRE_INTRO = `Witaj w CyberEvolution.

Przed Tobą podróż przez światy świadomości cyfrowej.
Ucz się, sprawdzaj fakty i nie klikaj bezmyślnie.
Twoje decyzje zadecydują o ewolucji!`;

const DEFAULT_ENDING_STORY = `Nagle otwierasz oczy z głośnym wdechem.
Siedzisz na łóżku w swoim pokoju, a wokół panuje kojąca cisza.
W dłoni czujesz ciepło smartfona.
---
Na ekranie nadal wisi to samo wideo ze zmanipulowaną miniaturą twojej twarzy:
„PATRZCIE CO ON ODVALIŁ! 😂 Zgłoś usunięcie tutaj: [link]”
---
Kciuk zawisa nad ekranem, ale... ręka już ci się nie trzęsie.
Wstyd i panika zniknęły bez śladu.
Patrzysz chłodnym okiem: nienaturalne rozmycie wokół ust zdradza deepfake AI,
a konto powstało wczoraj i służy wyłącznie do wyłudzania danych.
---
Zamiast w histerii klikać w podejrzany link:
Robisz zrzut ekranu, zgłaszasz platformie zmanipulowaną treść i blokujesz profil.
Wiesz, że prawda i prawo stoją po twojej stronie.
---
Nauki Mędrca nie poszły na marne.
Odkładasz telefon na szafkę nocną i spokojnie gasisz lampkę.
Twoja CyberEwolucja dobiegła końca - myślisz krytycznie i potrafisz obronić się w necie.
---
KONIEC`;

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

  private cachedPreIntroText: string = DEFAULT_PRE_INTRO;
  private cachedEndingText: string = DEFAULT_ENDING_STORY;

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

    // Preload intro and ending story files in background so they are ready synchronously
    this.preloadStories();

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

  public async preloadStories(): Promise<void> {
    try {
      const resIntro = await fetch(`/assets/game_intro.txt?t=${Date.now()}`);
      if (resIntro.ok) {
        this.cachedPreIntroText = await resIntro.text();
      }
    } catch {}

    try {
      const resEnding = await fetch(`/assets/ending/ending_story.txt?t=${Date.now()}`);
      if (resEnding.ok) {
        this.cachedEndingText = await resEnding.text();
      }
    } catch {}
  }

  public playPreIntro(onFinished: () => void): void {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    this.sequenceType = 'preIntro';
    this.onFinishedCallback = onFinished;
    this.isActive = true;
    this.textElement.textContent = '';
    this.hintElement.textContent = '';
    this.overlayElement.classList.remove('hidden');

    const normalized = this.cachedPreIntroText.replace(/\\n/g, '\n');
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

  public playEnding(onFinished: () => void): void {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    this.sequenceType = 'ending';
    this.onFinishedCallback = onFinished;
    this.isActive = true;
    this.textElement.textContent = '';
    this.hintElement.textContent = '';
    this.overlayElement.classList.remove('hidden');

    const normalized = this.cachedEndingText.replace(/\\n/g, '\n');
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

  public hide(): void {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    this.isActive = false;
    this.overlayElement.classList.add('hidden');
    this.textElement.textContent = '';
    this.hintElement.textContent = '';
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
    if (this.onFinishedCallback) {
      const cb = this.onFinishedCallback;
      this.onFinishedCallback = undefined;
      cb();
    } else {
      this.hide();
    }
  }
}
