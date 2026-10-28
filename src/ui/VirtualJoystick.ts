/**
 * src/ui/VirtualJoystick.ts
 * Mobile-Native dotykowy D-Pad (wyłącznie Lewo / Prawo) i przyciski akcji (Skok / Interakcja E)
 * z obsługą multi-touch, haptic feedback, podświetlaniem przycisku akcji oraz dynamicznym ukrywaniem.
 */

import { isMobileDevice } from '../core/Device';
import { sound } from '../core/Audio';

export interface TouchState {
  moveX: number;
  moveY: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  interactPressed: boolean;
}

export class VirtualJoystick {
  public isTouchDevice: boolean = false;
  public forceDebugVisible: boolean = false;

  private container: HTMLElement | null = null;
  private btnLeft: HTMLElement | null = null;
  private btnRight: HTMLElement | null = null;
  private btnJump: HTMLElement | null = null;
  private btnInteract: HTMLElement | null = null;

  // Cyfrowy stan kierunków (tylko poziomo)
  private leftHeld = false;
  private rightHeld = false;

  // Akcje
  private jumpHeld = false;
  private jumpJustPressed = false;
  private interactJustPressed = false;

  constructor(_listenTarget?: HTMLElement) {
    this.isTouchDevice = isMobileDevice();
    this.createControls();
  }

  get isInteractive(): boolean {
    return this.isTouchDevice || this.forceDebugVisible;
  }

  private createControls(): void {
    if (typeof document === 'undefined') return;

    // Usuwamy ewentualny stary kontener
    const existing = document.getElementById('touch-controls');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'touch-controls';
    this.container.className = `touch-controls ${this.isInteractive ? '' : 'hidden'}`;

    this.container.innerHTML = `
      <div class="touch-dpad touch-horizontal-only">
        <button class="touch-btn touch-btn-left" data-dir="left" aria-label="W lewo">◀</button>
        <button class="touch-btn touch-btn-right" data-dir="right" aria-label="W prawo">▶</button>
      </div>

      <div class="touch-actions">
        <button class="touch-action-btn touch-btn-interact" data-action="interact" aria-label="Interakcja E">
          <span class="touch-btn-key">E</span>
          <span class="touch-btn-sub">AKCJA</span>
        </button>
        <button class="touch-action-btn touch-btn-jump" data-action="jump" aria-label="Skok">
          <span class="touch-btn-icon">▲</span>
          <span class="touch-btn-label">SKOK</span>
        </button>
      </div>
    `;

    document.body.appendChild(this.container);

    this.btnLeft = this.container.querySelector('.touch-btn-left');
    this.btnRight = this.container.querySelector('.touch-btn-right');
    this.btnJump = this.container.querySelector('.touch-btn-jump');
    this.btnInteract = this.container.querySelector('.touch-btn-interact');

    this.bindDirection(this.btnLeft, 'left');
    this.bindDirection(this.btnRight, 'right');

    this.bindAction(this.btnJump, 'jump');
    this.bindAction(this.btnInteract, 'interact');
  }

  private triggerHaptic(): void {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch {}
  }

  private bindDirection(el: HTMLElement | null, dir: 'left' | 'right'): void {
    if (!el) return;

    const onStart = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      sound.unlock();
      try { el.setPointerCapture(e.pointerId); } catch {}
      el.classList.add('active');
      this.triggerHaptic();

      if (dir === 'left') this.leftHeld = true;
      if (dir === 'right') this.rightHeld = true;
    };

    const onEnd = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try { el.releasePointerCapture(e.pointerId); } catch {}
      el.classList.remove('active');

      if (dir === 'left') this.leftHeld = false;
      if (dir === 'right') this.rightHeld = false;
    };

    el.addEventListener('pointerdown', onStart);
    el.addEventListener('pointerup', onEnd);
    el.addEventListener('pointercancel', onEnd);
    el.addEventListener('pointerleave', onEnd);
  }

  private bindAction(el: HTMLElement | null, action: 'jump' | 'interact'): void {
    if (!el) return;

    const onStart = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      sound.unlock();
      try { el.setPointerCapture(e.pointerId); } catch {}
      el.classList.add('active');
      this.triggerHaptic();

      if (action === 'jump') {
        this.jumpHeld = true;
        this.jumpJustPressed = true;
      } else if (action === 'interact') {
        this.interactJustPressed = true;
      }
    };

    const onEnd = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try { el.releasePointerCapture(e.pointerId); } catch {}
      el.classList.remove('active');

      if (action === 'jump') {
        this.jumpHeld = false;
      }
    };

    el.addEventListener('pointerdown', onStart);
    el.addEventListener('pointerup', onEnd);
    el.addEventListener('pointercancel', onEnd);
    el.addEventListener('pointerleave', onEnd);
  }

  public setInteractAvailable(available: boolean): void {
    if (!this.btnInteract) return;
    this.btnInteract.classList.toggle('active-hint', available);
  }

  public setVisible(visible: boolean): void {
    if (!this.container) return;
    if (visible && this.isInteractive) {
      this.container.classList.remove('hidden');
    } else {
      this.container.classList.add('hidden');
      this.resetState();
    }
  }

  public resetState(): void {
    this.leftHeld = false;
    this.rightHeld = false;
    this.jumpHeld = false;
    this.jumpJustPressed = false;
    this.interactJustPressed = false;

    this.btnLeft?.classList.remove('active');
    this.btnRight?.classList.remove('active');
    this.btnJump?.classList.remove('active');
    this.btnInteract?.classList.remove('active');
  }

  public updateLayout(_screenWidth: number, _screenHeight: number): void {
    // Układ jest w 100% responsywny w CSS dzięki env(safe-area-inset-*)
  }

  public renderOverlay(_overlayCtx: CanvasRenderingContext2D): void {
    // Przyciski są renderowane natywnie w DOM
  }

  public getTouchState(): TouchState {
    let moveX = 0;
    if (this.leftHeld) moveX -= 1;
    if (this.rightHeld) moveX += 1;

    const state: TouchState = {
      moveX,
      moveY: 0,
      jumpPressed: this.jumpJustPressed,
      jumpHeld: this.jumpHeld,
      interactPressed: this.interactJustPressed,
    };

    this.jumpJustPressed = false;
    this.interactJustPressed = false;
    return state;
  }
}
