export interface TouchState {
  moveX: number;
  moveY: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  interactPressed: boolean;
}

export class VirtualJoystick {
  private baseRadius = 60;
  private knobRadius = 28;

  // Joystick position (screen pixels)
  private centerX = 0;
  private centerY = 0;
  private knobX = 0;
  private knobY = 0;

  private joystickActive = false;
  private joystickPointerId: number | null = null;

  // Buttons (Jump and Interact)
  private jumpActive = false;
  private jumpPointerId: number | null = null;
  private jumpJustPressed = false;

  private interactActive = false;
  private interactPointerId: number | null = null;
  private interactJustPressed = false;

  // Button positions & sizes
  private jumpBtnX = 0;
  private jumpBtnY = 0;
  private jumpBtnRadius = 45;

  private interactBtnX = 0;
  private interactBtnY = 0;
  private interactBtnRadius = 40;

  // Enable/disable
  public enabled = true;
  public visible = true;

  constructor(private container: HTMLElement) {
    this.setupListeners();
  }

  public updateLayout(screenWidth: number, screenHeight: number): void {
    // Position joystick in bottom-left
    this.centerX = Math.max(90, screenWidth * 0.12);
    this.centerY = screenHeight - Math.max(90, screenHeight * 0.22);
    if (!this.joystickActive) {
      this.knobX = this.centerX;
      this.knobY = this.centerY;
    }

    // Position buttons in bottom-right
    this.jumpBtnX = screenWidth - Math.max(80, screenWidth * 0.1);
    this.jumpBtnY = screenHeight - Math.max(100, screenHeight * 0.22);

    this.interactBtnX = this.jumpBtnX - 95;
    this.interactBtnY = this.jumpBtnY - 35;
  }

  private setupListeners(): void {
    const el = this.container;

    el.addEventListener('pointerdown', (e) => this.onPointerDown(e), { passive: false });
    window.addEventListener('pointermove', (e) => this.onPointerMove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.onPointerUp(e), { passive: false });
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e), { passive: false });
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.enabled) return;
    const rect = this.container.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // Check Jump button
    const distJump = Math.hypot(px - this.jumpBtnX, py - this.jumpBtnY);
    if (distJump <= this.jumpBtnRadius + 15) {
      this.jumpActive = true;
      this.jumpJustPressed = true;
      this.jumpPointerId = e.pointerId;
      e.preventDefault();
      return;
    }

    // Check Interact button
    const distInteract = Math.hypot(px - this.interactBtnX, py - this.interactBtnY);
    if (distInteract <= this.interactBtnRadius + 15) {
      this.interactActive = true;
      this.interactJustPressed = true;
      this.interactPointerId = e.pointerId;
      e.preventDefault();
      return;
    }

    // Left half of screen: start joystick (floating if outside base radius)
    if (px < rect.width * 0.55 && !this.joystickActive) {
      this.joystickActive = true;
      this.joystickPointerId = e.pointerId;

      // Dynamic repositioning if tapped near joystick zone
      if (py > rect.height * 0.4) {
        this.centerX = px;
        this.centerY = py;
      }
      this.updateKnobPosition(px, py);
      e.preventDefault();
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.joystickActive || e.pointerId !== this.joystickPointerId) return;
    const rect = this.container.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    this.updateKnobPosition(px, py);
    e.preventDefault();
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.pointerId === this.joystickPointerId) {
      this.joystickActive = false;
      this.joystickPointerId = null;
      this.knobX = this.centerX;
      this.knobY = this.centerY;
    }
    if (e.pointerId === this.jumpPointerId) {
      this.jumpActive = false;
      this.jumpPointerId = null;
    }
    if (e.pointerId === this.interactPointerId) {
      this.interactActive = false;
      this.interactPointerId = null;
    }
  }

  private updateKnobPosition(px: number, py: number): void {
    const dx = px - this.centerX;
    const dy = py - this.centerY;
    const dist = Math.hypot(dx, dy);

    if (dist <= this.baseRadius) {
      this.knobX = px;
      this.knobY = py;
    } else {
      const angle = Math.atan2(dy, dx);
      this.knobX = this.centerX + Math.cos(angle) * this.baseRadius;
      this.knobY = this.centerY + Math.sin(angle) * this.baseRadius;
    }
  }

  public getTouchState(): TouchState {
    let moveX = 0;
    let moveY = 0;

    if (this.joystickActive) {
      const dx = this.knobX - this.centerX;
      const dy = this.knobY - this.centerY;
      const dist = Math.hypot(dx, dy);

      if (dist > 10) {
        // Deadzone 10px
        const norm = Math.min(1.0, dist / this.baseRadius);
        const angle = Math.atan2(dy, dx);
        moveX = Math.cos(angle) * norm;
        moveY = Math.sin(angle) * norm;
      }
    }

    const state: TouchState = {
      moveX,
      moveY,
      jumpPressed: this.jumpJustPressed,
      jumpHeld: this.jumpActive,
      interactPressed: this.interactJustPressed,
    };

    // Reset single-frame presses
    this.jumpJustPressed = false;
    this.interactJustPressed = false;

    return state;
  }

  /**
   * Render modern semi-transparent glowing controls overlay on canvas.
   */
  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) return;

    ctx.save();

    // 1. Draw Joystick Base
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, this.baseRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.joystickActive ? 'rgba(0, 229, 255, 0.7)' : 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();

    // Joystick Knob
    ctx.beginPath();
    ctx.arc(this.knobX, this.knobY, this.knobRadius, 0, Math.PI * 2);
    const knobGrad = ctx.createRadialGradient(
      this.knobX - 5,
      this.knobY - 5,
      2,
      this.knobX,
      this.knobY,
      this.knobRadius
    );
    knobGrad.addColorStop(0, 'rgba(0, 242, 254, 0.9)');
    knobGrad.addColorStop(1, 'rgba(79, 172, 254, 0.6)');
    ctx.fillStyle = knobGrad;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Draw Jump Button
    ctx.beginPath();
    ctx.arc(this.jumpBtnX, this.jumpBtnY, this.jumpBtnRadius, 0, Math.PI * 2);
    ctx.fillStyle = this.jumpActive ? 'rgba(0, 229, 255, 0.7)' : 'rgba(15, 23, 42, 0.5)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.8)';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SKOK', this.jumpBtnX, this.jumpBtnY);

    // 3. Draw Interact Button
    ctx.beginPath();
    ctx.arc(this.interactBtnX, this.interactBtnY, this.interactBtnRadius, 0, Math.PI * 2);
    ctx.fillStyle = this.interactActive ? 'rgba(255, 171, 0, 0.7)' : 'rgba(15, 23, 42, 0.5)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 171, 0, 0.8)';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AKCJA', this.interactBtnX, this.interactBtnY);

    ctx.restore();
  }
}
