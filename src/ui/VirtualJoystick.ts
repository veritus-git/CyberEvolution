/**
 * src/ui/VirtualJoystick.ts
 * Mobile-Native dotykowy D-Pad i przyciski akcji (Skok / Interakcja E)
 * z obsługą multi-touch, haptic feedback i czystym mapowaniem cyfrowym pod 2D platforming.
 */

import { isMobileDevice } from '../core/Device';

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
  private btnUp: HTMLElement | null = null;
  private btnDown: HTMLElement | null = null;
  private btnJump: HTMLElement | null = null;
  private btnInteract: HTMLElement | null = null;

  // Cyfrowy stan kierunków
  private leftHeld = false;
  private rightHeld = false;
  private upHeld = false;
  private downHeld = false;

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
      <div class="touch-dpad">
        <button class="touch-btn touch-btn-up" data-dir="up" aria-label="Góra / Drabina">▲</button>
        <div class="touch-dpad-row">
          <button class="touch-btn touch-btn-left" data-dir="left" aria-label="W lewo">◀</button>
          <div class="touch-dpad-center"></div>
          <button class="touch-btn touch-btn-right" data-dir="right" aria-label="W prawo">▶</button>
        </div>
        <button class="touch-btn touch-btn-down" data-dir="down" aria-label="W dół / Drabina">▼</button>
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
    this.btnUp = this.container.querySelector('.touch-btn-up');
    this.btnDown = this.container.querySelector('.touch-btn-down');
    this.btnJump = this.container.querySelector('.touch-btn-jump');
    this.btnInteract = this.container.querySelector('.touch-btn-interact');

    this.bindDirection(this.btnLeft, 'left');
    this.bindDirection(this.btnRight, 'right');
    this.bindDirection(this.btnUp, 'up');
    this.bindDirection(this.btnDown, 'down');

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

  private bindDirection(el: HTMLElement | null, dir: 'left' | 'right' | 'up' | 'down'): void {
    if (!el) return;

    const onStart = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try { el.setPointerCapture(e.pointerId); } catch {}
      el.classList.add('active');
      this.triggerHaptic();

      if (dir === 'left') this.leftHeld = true;
      if (dir === 'right') this.rightHeld = true;
      if (dir === 'up') this.upHeld = true;
      if (dir === 'down') this.downHeld = true;
    };

    const onEnd = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try { el.releasePointerCapture(e.pointerId); } catch {}
      el.classList.remove('active');

      if (dir === 'left') this.leftHeld = false;
      if (dir === 'right') this.rightHeld = false;
      if (dir === 'up') this.upHeld = false;
      if (dir === 'down') this.downHeld = false;
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
    this.upHeld = false;
    this.downHeld = false;
    this.jumpHeld = false;
    this.jumpJustPressed = false;
    this.interactJustPressed = false;

    this.btnLeft?.classList.remove('active');
    this.btnRight?.classList.remove('active');
    this.btnUp?.classList.remove('active');
    this.btnDown?.classList.remove('active');
    this.btnJump?.classList.remove('active');
    this.btnInteract?.classList.remove('active');
  }

  public updateLayout(_screenWidth: number, _screenHeight: number): void {
    // Układ jest w 100% responsywny w CSS dzięki env(safe-area-inset-*)
  }

  public renderOverlay(_overlayCtx: CanvasRenderingContext2D): void {
    // Przyciski są renderowane natywnie w DOM, overlayCtx nie wymaga rysowania
  }

  public getTouchState(): TouchState {
    let moveX = 0;
    if (this.leftHeld) moveX -= 1;
    if (this.rightHeld) moveX += 1;

    let moveY = 0;
    if (this.upHeld) moveY -= 1;
    if (this.downHeld) moveY += 1;

    const state: TouchState = {
      moveX,
      moveY,
      jumpPressed: this.jumpJustPressed,
      jumpHeld: this.jumpHeld,
      interactPressed: this.interactJustPressed,
    };

    this.jumpJustPressed = false;
    this.interactJustPressed = false;
    return state;
  }
}
