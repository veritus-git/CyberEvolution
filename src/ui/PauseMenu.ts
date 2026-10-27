/**
 * src/ui/PauseMenu.ts
 * Menu pauzy 1:1 z oryginalną wersją Pygame (CyberEvolution.py):
 * - Panel 520x220, tło rgb(20,22,28), obramowanie 2px rgb(70,72,84), border-radius 16px
 * - Tytuł "PAUZA" rgb(220,220,255)
 * - Opcje: "Kontynuuj", "Wyjdź z gry"
 * - Zaznaczona opcja: tło rgb(70,70,90), zaokrąglenie 10px, tekst biały (255,255,255)
 */

export class PauseMenu {
  public isOpen: boolean = false;
  public selectedIndex: number = 0;

  private overlayElement: HTMLElement;
  private panelElement: HTMLElement;
  private titleElement: HTMLElement;
  private options: HTMLElement[] = [];
  private onResumeCallback?: () => void;
  private onExitCallback?: () => void;

  constructor(container: HTMLElement) {
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'pause-menu-overlay hidden';

    this.panelElement = document.createElement('div');
    this.panelElement.className = 'pause-menu-panel';

    this.titleElement = document.createElement('h2');
    this.titleElement.className = 'pause-menu-title';
    this.titleElement.textContent = 'PAUZA';
    this.panelElement.appendChild(this.titleElement);

    const labels = ['Kontynuuj', 'Wyjdź z gry'];
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'pause-menu-options';

    labels.forEach((label, idx) => {
      const btn = document.createElement('div');
      btn.className = `pause-menu-option ${idx === 0 ? 'selected' : ''}`;
      btn.textContent = label;
      btn.onmouseenter = () => {
        this.selectedIndex = idx;
        this.updateSelection();
      };
      btn.onclick = (e) => {
        e.stopPropagation();
        this.confirm(idx);
      };
      this.options.push(btn);
      optionsContainer.appendChild(btn);
    });

    this.panelElement.appendChild(optionsContainer);
    this.overlayElement.appendChild(this.panelElement);
    container.appendChild(this.overlayElement);

    // Keyboard support
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;

      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'ArrowLeft' || e.code === 'Digit1') {
        e.preventDefault();
        e.stopPropagation();
        this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
        this.updateSelection();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowRight' || e.code === 'Digit2') {
        e.preventDefault();
        e.stopPropagation();
        this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
        this.updateSelection();
      } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
        e.preventDefault();
        e.stopPropagation();
        this.confirm(this.selectedIndex);
      }
    });
  }

  public show(): void {
    this.isOpen = true;
    this.selectedIndex = 0;
    this.updateSelection();
    this.overlayElement.classList.remove('hidden');
    document.body.classList.remove('cursor-hidden');
  }

  public hide(): void {
    this.isOpen = false;
    this.overlayElement.classList.add('hidden');
    document.body.classList.add('cursor-hidden');
  }

  private updateSelection(): void {
    this.options.forEach((opt, idx) => {
      opt.classList.toggle('selected', idx === this.selectedIndex);
    });
  }

  private confirm(index: number): void {
    if (index === 0) {
      this.hide();
      this.onResumeCallback?.();
    } else {
      this.hide();
      this.onExitCallback?.();
    }
  }

  public onResume(cb: () => void): void {
    this.onResumeCallback = cb;
  }

  public onExit(cb: () => void): void {
    this.onExitCallback = cb;
  }
}
