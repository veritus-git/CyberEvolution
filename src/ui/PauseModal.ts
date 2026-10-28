import { sound } from '../core/Audio';

export class PauseModal {
  public isOpen: boolean = false;
  private overlayElement: HTMLElement;
  private cardElement: HTMLElement;

  private musicSlider!: HTMLInputElement;
  private musicValText!: HTMLElement;
  private sfxSlider!: HTMLInputElement;
  private sfxValText!: HTMLElement;
  private muteBtn!: HTMLButtonElement;

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
      <div class="pause-menu-header">
        <h2 class="pause-menu-title">PAUZA</h2>
        <div class="pause-menu-subtitle">CyberEvolution: Ścieżka Świadomości</div>
      </div>

      <div class="pause-settings-box">
        <div class="pause-settings-title">USTAWIENIA DŹWIĘKU</div>
        
        <div class="pause-slider-row">
          <div class="pause-slider-label">
            <span>Muzyka (Synthwave)</span>
            <span id="pause-music-val" class="pause-val-badge">5%</span>
          </div>
          <input type="range" id="pause-music-slider" min="0" max="100" value="5" class="pause-range-input" />
        </div>

        <div class="pause-slider-row">
          <div class="pause-slider-label">
            <span>Efekty dźwiękowe (SFX)</span>
            <span id="pause-sfx-val" class="pause-val-badge">45%</span>
          </div>
          <input type="range" id="pause-sfx-slider" min="0" max="100" value="45" class="pause-range-input" />
        </div>

        <div class="pause-mute-row">
          <button id="pause-mute-toggle" class="pause-btn-subtle">
            <span id="pause-mute-icon">🔊</span>
            <span id="pause-mute-text">Dźwięk: Włączony</span>
          </button>
        </div>
      </div>

      <div class="pause-menu-buttons">
        <button class="pause-btn primary" id="pause-resume">▶ Wznów grę</button>
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
    const helpBtn = this.cardElement.querySelector('#pause-help');
    const restartBtn = this.cardElement.querySelector('#pause-restart');
    const lobbyBtn = this.cardElement.querySelector('#pause-lobby');

    this.musicSlider = this.cardElement.querySelector('#pause-music-slider') as HTMLInputElement;
    this.musicValText = this.cardElement.querySelector('#pause-music-val') as HTMLElement;
    this.sfxSlider = this.cardElement.querySelector('#pause-sfx-slider') as HTMLInputElement;
    this.sfxValText = this.cardElement.querySelector('#pause-sfx-val') as HTMLElement;
    this.muteBtn = this.cardElement.querySelector('#pause-mute-toggle') as HTMLButtonElement;

    // Music Volume
    this.musicSlider.addEventListener('input', () => {
      const val = parseInt(this.musicSlider.value, 10);
      this.musicValText.textContent = `${val}%`;
      sound.setMusicVolume(val / 100);
      if (sound.isMuted && val > 0) {
        sound.setMuted(false);
        this.syncAudioUI();
      }
    });

    // SFX Volume
    this.sfxSlider.addEventListener('input', () => {
      const val = parseInt(this.sfxSlider.value, 10);
      this.sfxValText.textContent = `${val}%`;
      sound.setSfxVolume(val / 100);
      if (sound.isMuted && val > 0) {
        sound.setMuted(false);
        this.syncAudioUI();
      }
    });

    // Mute Toggle
    this.muteBtn.addEventListener('click', () => {
      sound.toggleMute();
      this.syncAudioUI();
    });

    resumeBtn?.addEventListener('click', () => {
      this.hide();
      this.onResume?.();
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

    // Close on overlay backdrop click
    this.overlayElement.addEventListener('click', (e) => {
      if (e.target === this.overlayElement) {
        this.hide();
        this.onResume?.();
      }
    });
  }

  public syncAudioUI(): void {
    const musicPct = Math.round(sound.musicVolume * 100);
    const sfxPct = Math.round(sound.sfxVolume * 100);

    if (this.musicSlider) this.musicSlider.value = String(musicPct);
    if (this.musicValText) this.musicValText.textContent = `${musicPct}%`;

    if (this.sfxSlider) this.sfxSlider.value = String(sfxPct);
    if (this.sfxValText) this.sfxValText.textContent = `${sfxPct}%`;

    const iconSpan = this.cardElement.querySelector('#pause-mute-icon');
    const textSpan = this.cardElement.querySelector('#pause-mute-text');

    if (iconSpan && textSpan) {
      if (sound.isMuted) {
        iconSpan.textContent = '🔇';
        textSpan.textContent = 'Dźwięk: Wyciszony';
        this.muteBtn.classList.add('is-muted');
      } else {
        iconSpan.textContent = '🔊';
        textSpan.textContent = 'Dźwięk: Włączony';
        this.muteBtn.classList.remove('is-muted');
      }
    }
  }

  public updateSoundLabel(_isMuted?: boolean): void {
    this.syncAudioUI();
  }

  public show(isFromStartMenu: boolean = false): void {
    this.isOpen = true;
    this.syncAudioUI();

    const resumeBtn = this.cardElement.querySelector('#pause-resume') as HTMLElement;
    const restartBtn = this.cardElement.querySelector('#pause-restart') as HTMLElement;
    const lobbyBtn = this.cardElement.querySelector('#pause-lobby') as HTMLElement;

    if (isFromStartMenu) {
      if (resumeBtn) resumeBtn.textContent = '✓ Zamknij ustawienia';
      if (restartBtn) restartBtn.style.display = 'none';
      if (lobbyBtn) lobbyBtn.style.display = 'none';
    } else {
      if (resumeBtn) resumeBtn.textContent = '▶ Wznów grę';
      if (restartBtn) restartBtn.style.display = '';
      if (lobbyBtn) lobbyBtn.style.display = '';
    }

    this.overlayElement.classList.remove('hidden');
    document.body.classList.remove('cursor-hidden');
  }

  public hide(): void {
    this.isOpen = false;
    this.overlayElement.classList.add('hidden');
    document.body.classList.add('cursor-hidden');
  }
}
