import { sound } from '../core/Audio';

export class PauseModal {
  public isOpen: boolean = false;
  private overlayElement: HTMLElement;
  private cardElement: HTMLElement;
  private soundBtn: HTMLButtonElement | null = null;

  public onResume?: () => void;
  public onRestartLevel?: () => void;
  public onReturnToLobby?: () => void;
  public onOpenHelp?: () => void;

  constructor(container: HTMLElement) {
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'pause-menu-overlay hidden';

    this.cardElement = document.createElement('div');
    this.cardElement.className = 'pause-menu-card';

    this.cardElement.innerHTML = `
      <h2 class="pause-menu-title">PAUZA</h2>
      <div class="pause-menu-subtitle">CyberEvolution: Ścieżka Świadomości</div>

      <div class="pause-menu-buttons">
        <button class="pause-btn" id="pause-resume">▶ Wznów grę</button>
        <button class="pause-btn" id="pause-sound">🔊 Dźwięk: WŁ</button>
        <button class="pause-btn" id="pause-help">❔ Sterowanie i pomoc</button>
        <button class="pause-btn" id="pause-restart">↺ Zrestartuj poziom</button>
        <button class="pause-btn danger" id="pause-lobby">⮌ Powrót do Lobby</button>
      </div>
    `;

    this.overlayElement.appendChild(this.cardElement);
    container.appendChild(this.overlayElement);

    this.setupListeners();
  }

  private setupListeners(): void {
    const resumeBtn = this.cardElement.querySelector('#pause-resume');
    this.soundBtn = this.cardElement.querySelector('#pause-sound') as HTMLButtonElement;
    const helpBtn = this.cardElement.querySelector('#pause-help');
    const restartBtn = this.cardElement.querySelector('#pause-restart');
    const lobbyBtn = this.cardElement.querySelector('#pause-lobby');

    resumeBtn?.addEventListener('click', () => {
      this.hide();
      this.onResume?.();
    });

    this.soundBtn?.addEventListener('click', () => {
      const isMuted = sound.toggleMute();
      this.updateSoundLabel(isMuted);
    });

    helpBtn?.addEventListener('click', () => {
      this.onOpenHelp?.();
    });

    restartBtn?.addEventListener('click', () => {
      this.hide();
      this.onRestartLevel?.();
    });

    lobbyBtn?.addEventListener('click', () => {
      this.hide();
      this.onReturnToLobby?.();
    });
  }

  public updateSoundLabel(isMuted: boolean): void {
    if (this.soundBtn) {
      this.soundBtn.textContent = isMuted ? '🔇 Dźwięk: WYŁ' : '🔊 Dźwięk: WŁ';
    }
  }

  public show(): void {
    this.isOpen = true;
    this.updateSoundLabel(sound.isMuted);
    this.overlayElement.classList.remove('hidden');
  }

  public hide(): void {
    this.isOpen = false;
    this.overlayElement.classList.add('hidden');
  }
}
