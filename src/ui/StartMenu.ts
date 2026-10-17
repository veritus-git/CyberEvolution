export class StartMenu {
  public isOpen: boolean = true;
  public selectedIndex: number = 0;

  private overlayElement: HTMLElement;
  private menuBox: HTMLElement;
  private titleElement: HTMLElement;
  private options: HTMLElement[] = [];
  private onSelectCallback?: (action: 'new_game' | 'continue' | 'exit') => void;

  constructor(container: HTMLElement, hasSave: boolean = false) {
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'start-menu-overlay';

    this.menuBox = document.createElement('div');
    this.menuBox.className = 'start-menu-card';

    this.titleElement = document.createElement('h1');
    this.titleElement.className = 'start-menu-title';
    this.titleElement.textContent = 'CyberEvolution';
    this.menuBox.appendChild(this.titleElement);

    const labels: Array<{ label: string; action: 'new_game' | 'continue' | 'exit' }> = [
      { label: 'Nowa gra', action: 'new_game' },
      { label: hasSave ? 'Kontynuuj' : 'Kontynuuj (brak zapisu)', action: 'continue' },
      { label: 'Informacje o grze', action: 'exit' },
    ];

    const btnContainer = document.createElement('div');
    btnContainer.className = 'start-menu-options';

    labels.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = `start-menu-btn ${idx === 0 ? 'selected' : ''}`;
      btn.textContent = opt.label;
      btn.onmouseenter = () => {
        this.selectedIndex = idx;
        this.updateSelection();
      };
      btn.onclick = (e) => {
        e.stopPropagation();
        this.triggerAction(opt.action);
      };
      this.options.push(btn);
      btnContainer.appendChild(btn);
    });

    this.menuBox.appendChild(btnContainer);
    this.overlayElement.appendChild(this.menuBox);
    container.appendChild(this.overlayElement);

    // Keyboard support
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;

      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
        this.updateSelection();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
        this.updateSelection();
      } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
        e.preventDefault();
        const actions: Array<'new_game' | 'continue' | 'exit'> = ['new_game', 'continue', 'exit'];
        this.triggerAction(actions[this.selectedIndex]);
      }
    });
  }

  public setHasSave(hasSave: boolean): void {
    if (this.options[1]) {
      this.options[1].textContent = hasSave ? 'Kontynuuj' : 'Kontynuuj (brak zapisu)';
    }
  }

  public onSelect(cb: (action: 'new_game' | 'continue' | 'exit') => void): void {
    this.onSelectCallback = cb;
  }

  private updateSelection(): void {
    this.options.forEach((opt, idx) => {
      opt.classList.toggle('selected', idx === this.selectedIndex);
    });
  }

  private triggerAction(action: 'new_game' | 'continue' | 'exit'): void {
    if (this.onSelectCallback) {
      this.onSelectCallback(action);
    }
  }

  public show(): void {
    this.isOpen = true;
    this.overlayElement.classList.remove('hidden');
    this.selectedIndex = 0;
    this.updateSelection();
  }

  public hide(): void {
    this.isOpen = false;
    this.overlayElement.classList.add('hidden');
  }
}
