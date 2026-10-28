/**
 * src/audio/AudioManager.ts
 * Kompleksowy menedżer dźwięku dla gry CyberEvolution.
 * Obsługuje zapętloną ścieżkę dźwiękową, regulację głośności, wyciszanie (mute),
 * zapisywanie preferencji w pamięci trwałej (storage) oraz odblokowanie audio na mobile.
 */

import { gameStorage } from '../storage';

export class AudioManager {
  private static instance: AudioManager | null = null;
  private audio: HTMLAudioElement;
  private isAudioUnlocked: boolean = false;
  private isMuted: boolean = false;
  private volume: number = 0.7; // 0.0 do 1.0

  // UI elementy
  private container: HTMLElement | null = null;
  private btnSound: HTMLButtonElement | null = null;
  private popup: HTMLElement | null = null;
  private slider: HTMLInputElement | null = null;
  private volText: HTMLElement | null = null;
  private isPopupOpen: boolean = false;

  private constructor() {
    const saved = gameStorage.getState().settings || {};
    this.isMuted = saved.soundEnabled === false;
    this.volume = typeof saved.musicVolume === 'number' ? Math.max(0, Math.min(1, saved.musicVolume)) : 0.7;

    this.audio = new Audio('/assets/audio/soundtrack.mp3');
    this.audio.loop = true;
    this.audio.preload = 'auto';
    this.audio.volume = this.isMuted ? 0 : this.volume;

    this.setupUnlockListeners();
    this.createUI();
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private setupUnlockListeners(): void {
    const unlock = () => {
      if (this.isAudioUnlocked) return;
      this.isAudioUnlocked = true;
      if (!this.isMuted) {
        this.audio.play().catch(() => {});
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  public play(): void {
    if (this.isMuted) return;
    this.audio.play().catch(() => {
      // Autoplay zablokowany - odtworzy się po pierwszym kliknięciu gracza
    });
  }

  public pause(): void {
    this.audio.pause();
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.applyAudioSettings();
    return this.isMuted;
  }

  public setVolume(val: number): void {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.volume > 0 && this.isMuted) {
      this.isMuted = false;
    }
    this.applyAudioSettings();
  }

  public getVolume(): number {
    return this.volume;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  private applyAudioSettings(): void {
    const effectiveVol = this.isMuted ? 0 : this.volume;
    this.audio.volume = effectiveVol;

    if (this.isMuted) {
      this.audio.pause();
    } else if (this.audio.paused && this.isAudioUnlocked) {
      this.audio.play().catch(() => {});
    }

    // Zapis do persistent storage
    gameStorage.save({
      settings: {
        soundEnabled: !this.isMuted,
        musicVolume: this.volume,
      },
    });

    this.updateUI();
  }

  private createUI(): void {
    if (typeof document === 'undefined') return;

    this.container = document.createElement('div');
    this.container.id = 'sound-control-wrapper';
    this.container.className = 'sound-control-wrapper hidden';

    this.btnSound = document.createElement('button');
    this.btnSound.id = 'btn-sound-toggle';
    this.btnSound.className = 'sound-btn';
    this.btnSound.setAttribute('aria-label', 'Ustawienia dźwięku');
    this.btnSound.setAttribute('title', 'Dźwięk i głośność');

    this.popup = document.createElement('div');
    this.popup.className = 'sound-popup hidden';
    this.popup.innerHTML = `
      <div class="sound-popup-header">
        <span class="sound-popup-title">DŹWIĘK</span>
        <button class="sound-mute-toggle-btn">${this.isMuted ? 'ODCISZ' : 'WYCISZ'}</button>
      </div>
      <div class="sound-slider-row">
        <span class="sound-icon-min">🔈</span>
        <input type="range" class="sound-volume-slider" min="0" max="100" value="${Math.round(this.volume * 100)}" />
        <span class="sound-icon-max">🔊</span>
      </div>
      <div class="sound-volume-label">${Math.round(this.volume * 100)}%</div>
    `;

    this.container.appendChild(this.btnSound);
    this.container.appendChild(this.popup);
    document.body.appendChild(this.container);

    this.slider = this.popup.querySelector('.sound-volume-slider');
    this.volText = this.popup.querySelector('.sound-volume-label');
    const muteBtn = this.popup.querySelector('.sound-mute-toggle-btn') as HTMLButtonElement | null;

    // Kliknięcie w główny przycisk ikony: otwiera/zamyka popup ustawień
    this.btnSound.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePopup();
    });

    // Mute toggle wewnątrz popupu
    muteBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMute();
      if (muteBtn) {
        muteBtn.textContent = this.isMuted ? 'ODCISZ' : 'WYCISZ';
      }
    });

    // Slider głośności
    this.slider?.addEventListener('input', (e) => {
      e.stopPropagation();
      const val = parseInt((e.target as HTMLInputElement).value, 10) / 100;
      this.setVolume(val);
    });

    // Zamknięcie popupu przy kliknięciu poza nim
    window.addEventListener('click', (e) => {
      if (!this.isPopupOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && !this.container?.contains(target)) {
        this.closePopup();
      }
    });

    this.updateUI();
  }

  public togglePopup(): void {
    if (this.isPopupOpen) {
      this.closePopup();
    } else {
      this.openPopup();
    }
  }

  public openPopup(): void {
    this.isPopupOpen = true;
    this.popup?.classList.remove('hidden');
    this.updateUI();
  }

  public closePopup(): void {
    this.isPopupOpen = false;
    this.popup?.classList.add('hidden');
  }

  public setVisible(visible: boolean): void {
    if (!this.container) return;
    if (visible) {
      this.container.classList.remove('hidden');
    } else {
      this.container.classList.add('hidden');
      this.closePopup();
    }
  }

  private updateUI(): void {
    if (!this.btnSound) return;

    if (this.isMuted || this.volume === 0) {
      this.btnSound.textContent = '🔇';
      this.btnSound.classList.add('muted');
    } else if (this.volume < 0.45) {
      this.btnSound.textContent = '🔉';
      this.btnSound.classList.remove('muted');
    } else {
      this.btnSound.textContent = '🔊';
      this.btnSound.classList.remove('muted');
    }

    if (this.slider) {
      this.slider.value = String(Math.round(this.volume * 100));
    }
    if (this.volText) {
      this.volText.textContent = this.isMuted ? 'WYCISZONY' : `${Math.round(this.volume * 100)}%`;
    }
    const muteBtn = this.popup?.querySelector('.sound-mute-toggle-btn') as HTMLButtonElement | null;
    if (muteBtn) {
      muteBtn.textContent = this.isMuted ? 'ODCISZ' : 'WYCISZ';
      muteBtn.classList.toggle('active-mute', this.isMuted);
    }
  }
}
