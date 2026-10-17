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
    this.overlayElement.addEventListener('click', () => {
      if (!this.isActive) return;
      this.advance();
    });

    window.addEventListener('keydown', (e) => {
      if (!this.isActive) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
        e.preventDefault();
        this.advance();
      }
    });
  }

  public async playPreIntro(onFinished: () => void): Promise<void> {
    this.onFinishedCallback = onFinished;
    this.isActive = true;
    this.overlayElement.classList.remove('hidden');

    let text = 'Witaj w CyberEvolution.\n\nPrzed Tobą podróż przez światy świadomości cyfrowej.\nUcz się, sprawdzaj fakty i nie klikaj bezmyślnie.\nTwoje decyzje zadecydują o ewolucji!';
    try {
      const res = await fetch('/assets/game_intro.txt');
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

  public playEnding(onFinished: () => void): void {
    this.onFinishedCallback = onFinished;
    this.isActive = true;
    this.overlayElement.classList.remove('hidden');

    const endingText =
      'GRATULACJE!\n\nPokonałeś wszystkie zagrożenia czyhające w CyberOtchłani.\nTwoja cyfrowa ewolucja dobiegła końca.\n\nBądź bezpieczny w sieci — weryfikuj linki, stosuj silne hasła i dbaj o swoją prywatność!';
    this.pages = [endingText];
    this.currentPageIndex = 0;
    this.showPage(0);
  }

  private showPage(index: number): void {
    this.fullText = this.pages[index] || '';
    this.currentChars = 0;
    this.isDone = false;
    this.hintElement.textContent = '';
    this.lastTime = performance.now();

    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    const tick = (now: number) => {
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;

      this.currentChars += this.speed * dt;
      if (this.currentChars >= this.fullText.length) {
        this.currentChars = this.fullText.length;
        this.textElement.textContent = this.fullText;
        this.isDone = true;
        this.updateHint();
      } else {
        this.textElement.textContent = this.fullText.substring(0, Math.floor(this.currentChars));
        this.animFrame = requestAnimationFrame(tick);
      }
    };
    this.animFrame = requestAnimationFrame(tick);
  }

  private updateHint(): void {
    const isLast = this.currentPageIndex >= this.pages.length - 1;
    this.hintElement.textContent = isLast
      ? 'Kliknij dowolny klawisz, aby rozpocząć'
      : 'Kliknij Enter aby przejść dalej';
  }

  private advance(): void {
    if (!this.isDone) {
      // Instant finish of current slide typewriter
      if (this.animFrame) cancelAnimationFrame(this.animFrame);
      this.currentChars = this.fullText.length;
      this.textElement.textContent = this.fullText;
      this.isDone = true;
      this.updateHint();
      return;
    }

    // Go to next slide
    this.currentPageIndex++;
    if (this.currentPageIndex < this.pages.length) {
      this.showPage(this.currentPageIndex);
      return;
    }

    // Completed all slides
    this.isActive = false;
    this.overlayElement.classList.add('hidden');
    if (this.onFinishedCallback) {
      this.onFinishedCallback();
    }
  }
}
