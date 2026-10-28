/**
 * CyberEvolution Web Audio Synthwave & SFX Engine
 * Procedural retro synthwave music and arcade sound effects without external audio dependencies.
 */

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  isMuted: boolean;
}

const SETTINGS_KEY = 'cyberevo_audio_settings_v4';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  public isMuted: boolean = false;
  public masterVolume: number = 0.7;
  public musicVolume: number = 0.10;
  public sfxVolume: number = 0.45;

  private isMusicPlaying: boolean = false;
  private musicTimer: number | null = null;
  private stepIndex: number = 0;
  private lastFootstepTime: number = 0;
  private footstepStep: number = 0;
  private lastBlipTime: number = 0;

  // Synthwave Chord Progression in A Minor (Am, F, C, G)
  private readonly chords = [
    { bass: 110, arp: [220, 261.63, 329.63, 440, 329.63, 261.63] }, // A2 / Am
    { bass: 87.31, arp: [174.61, 220, 261.63, 349.23, 261.63, 220] }, // F2 / F
    { bass: 130.81, arp: [261.63, 329.63, 392, 523.25, 392, 329.63] }, // C3 / C
    { bass: 98, arp: [196, 246.94, 293.66, 392, 293.66, 246.94] }, // G2 / G
  ];

  constructor() {
    this.loadSettings();

    // Audio context will be resumed/created upon first user gesture
    const startAudioOnInteraction = () => {
      this.initContext();
      window.removeEventListener('pointerdown', startAudioOnInteraction);
      window.removeEventListener('keydown', startAudioOnInteraction);
      window.removeEventListener('touchstart', startAudioOnInteraction);
    };
    window.addEventListener('pointerdown', startAudioOnInteraction, { once: true });
    window.addEventListener('keydown', startAudioOnInteraction, { once: true });
    window.addEventListener('touchstart', startAudioOnInteraction, { once: true });
  }

  private loadSettings(): void {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s: AudioSettings = JSON.parse(raw);
        if (typeof s.masterVolume === 'number') this.masterVolume = Math.max(0, Math.min(1, s.masterVolume));
        if (typeof s.musicVolume === 'number') this.musicVolume = Math.max(0, Math.min(1, s.musicVolume));
        if (typeof s.sfxVolume === 'number') this.sfxVolume = Math.max(0, Math.min(1, s.sfxVolume));
        if (typeof s.isMuted === 'boolean') this.isMuted = s.isMuted;
      }
    } catch {
      /* ignore storage errors */
    }
  }

  private saveSettings(): void {
    try {
      const s: AudioSettings = {
        masterVolume: this.masterVolume,
        musicVolume: this.musicVolume,
        sfxVolume: this.sfxVolume,
        isMuted: this.isMuted,
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {
      /* ignore storage errors */
    }
  }

  public initContext(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      if (!this.isMusicPlaying && !this.isMuted) {
        this.startMusic();
      }
    } catch (e) {
      console.warn('Web Audio could not be initialized:', e);
    }
  }

  public setMasterVolume(val: number): void {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
    this.saveSettings();
  }

  public setMusicVolume(val: number): void {
    this.musicVolume = Math.max(0, Math.min(1, val));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    }
    this.saveSettings();
  }

  public setSfxVolume(val: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
    this.saveSettings();
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      const targetGain = this.isMuted ? 0 : this.masterVolume;
      this.masterGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);
    }
    if (!this.isMuted && !this.isMusicPlaying) {
      this.startMusic();
    }
    this.saveSettings();
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public startMusic(): void {
    this.initContext();
    if (this.isMusicPlaying || !this.ctx) return;
    this.isMusicPlaying = true;
    this.stepIndex = 0;

    const tempo = 118; // BPM
    const stepDuration = 60 / tempo / 2; // 16th note rhythm (~0.127s)

    const scheduleNext = () => {
      if (!this.isMusicPlaying) return;
      this.playSynthStep(stepDuration);
      this.musicTimer = window.setTimeout(scheduleNext, stepDuration * 1000);
    };

    scheduleNext();
  }

  public stopMusic(): void {
    this.isMusicPlaying = false;
    if (this.musicTimer !== null) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private playSynthStep(stepDuration: number): void {
    if (!this.ctx || !this.musicGain || this.isMuted || this.musicVolume <= 0) return;

    const chordIdx = Math.floor(this.stepIndex / 16) % this.chords.length;
    const chord = this.chords[chordIdx];
    const subStep = this.stepIndex % 16;
    const now = this.ctx.currentTime;

    // 1. Synthwave Bass Pulse (on eighth notes) - subtle warm background
    if (subStep % 2 === 0) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(chord.bass, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + stepDuration * 1.8);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + stepDuration * 1.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(now);
      osc.stop(now + stepDuration * 1.8);
    }

    // 2. Arpeggiator Melody - soft ambient synth
    const arpNotes = chord.arp;
    const noteFreq = arpNotes[subStep % arpNotes.length];

    if (noteFreq) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(noteFreq, now);

      gain.gain.setValueAtTime(0.012, now);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + stepDuration * 0.9);

      osc.connect(gain);
      gain.connect(this.musicGain);

      osc.start(now);
      osc.stop(now + stepDuration * 0.95);
    }

    // 3. Cyber Kick & Snare Percussion - gentle rhythmic pulse
    if (subStep === 0 || subStep === 8) {
      // Gentle Synth Kick
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.10);

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.11);

      osc.connect(gain);
      gain.connect(this.musicGain);

      osc.start(now);
      osc.stop(now + 0.12);
    } else if (subStep === 4 || subStep === 12) {
      // Gentle Synth Snare
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.07);

      gain.gain.setValueAtTime(0.025, now);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.08);

      osc.connect(gain);
      gain.connect(this.musicGain);

      osc.start(now);
      osc.stop(now + 0.09);
    }

    this.stepIndex++;
  }

  // ==================== SOUND EFFECTS (SFX) ====================

  public playJump(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.12);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.14);
  }

  /**
   * Soft, gentle footstep tap (warm low-passed sine wave with alternating left/right foot cadence)
   */
  public playFootstep(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    const now = performance.now();
    if (now - this.lastFootstepTime < 180) return;
    this.lastFootstepTime = now;

    const audioNow = this.ctx.currentTime;
    this.footstepStep = (this.footstepStep + 1) % 2;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Mellow sine wave with soft lowpass so it's warm and never harsh on the ears
    osc.type = 'sine';
    const isLeft = this.footstepStep === 0;
    const baseFreq = isLeft ? 138 : 126;
    const endFreq = isLeft ? 60 : 54;

    osc.frequency.setValueAtTime(baseFreq + (Math.random() * 6 - 3), audioNow);
    osc.frequency.exponentialRampToValueAtTime(endFreq, audioNow + 0.042);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(240, audioNow);

    // Very gentle volume - soft, pleasant, organic foot tap
    gain.gain.setValueAtTime(0.12, audioNow);
    gain.gain.exponentialRampToValueAtTime(0.0005, audioNow + 0.045);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(audioNow);
    osc.stop(audioNow + 0.048);
  }

  public playDialogBlip(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    const now = performance.now();
    if (now - this.lastBlipTime < 45) return;
    this.lastBlipTime = now;

    const audioNow = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Subtle chirpy frequency with micro-randomness for retro gibberish dialogue
    const freq = 520 + Math.random() * 120;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, audioNow);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.8, audioNow + 0.035);

    gain.gain.setValueAtTime(0.05, audioNow);
    gain.gain.exponentialRampToValueAtTime(0.001, audioNow + 0.035);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(audioNow);
    osc.stop(audioNow + 0.038);
  }

  public playBossExplosion(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    const now = this.ctx.currentTime;

    // 1. Low frequency booming sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.85);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(60, now + 0.85);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.88);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.9);

    // 2. High noise burst crackle
    const noiseBuffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.5), this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(800, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(150, now + 0.45);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    noise.start(now);
    noise.stop(now + 0.5);
  }

  public playGateUnlock(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    const now = this.ctx.currentTime;

    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.18, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.28);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.3);
    });
  }

  public playQuizCorrect(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    const now = this.ctx.currentTime;

    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(0.18, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.28);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.3);
    });
  }

  public playQuizWrong(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.26);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.29);
  }

  public playEvolution(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    const now = this.ctx.currentTime;

    const notes = [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.14, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.36);
    });
  }

  public playPortal(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted || this.sfxVolume <= 0) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.45);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.45);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.46);
  }
}

export const sound = new AudioManager();
