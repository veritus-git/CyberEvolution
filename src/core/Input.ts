import { MovementInput } from '../physics/PhysicsBody';
import { VirtualJoystick } from '../ui/VirtualJoystick';

export class InputManager {
  private keysDown: Set<string> = new Set();
  private keysJustPressed: Set<string> = new Set();

  public virtualJoystick: VirtualJoystick | null = null;
  public debugToggleTriggered: boolean = false;
  public selectedSkin: number | null = null;

  constructor() {
    this.setupKeyboardListeners();
  }

  public setVirtualJoystick(joystick: VirtualJoystick): void {
    this.virtualJoystick = joystick;
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (e) => {
      // Prevent browser default scrolling on space / arrow keys
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      if (!this.keysDown.has(e.code)) {
        this.keysJustPressed.add(e.code);
      }
      this.keysDown.add(e.code);

      // Handle hotkeys
      if (e.code === 'F2') {
        this.debugToggleTriggered = true;
      }
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(e.code)) {
        this.selectedSkin = parseInt(e.code.replace('Digit', ''), 10);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });
  }

  /**
   * Sample gamepad inputs if available
   */
  private sampleGamepad(): { moveX: number; moveY: number; jump: boolean; interact: boolean } {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0];
    if (!gp) return { moveX: 0, moveY: 0, jump: false, interact: false };

    let moveX = gp.axes[0] || 0;
    let moveY = gp.axes[1] || 0;
    // Deadzone
    if (Math.abs(moveX) < 0.15) moveX = 0;
    if (Math.abs(moveY) < 0.15) moveY = 0;

    // D-Pad buttons (standard mapping: 12=Up, 13=Down, 14=Left, 15=Right)
    if (gp.buttons[14]?.pressed) moveX = -1;
    if (gp.buttons[15]?.pressed) moveX = 1;
    if (gp.buttons[12]?.pressed) moveY = -1;
    if (gp.buttons[13]?.pressed) moveY = 1;

    // Button A (0) = Jump, Button X/B (2/1) = Interact
    const jump = !!gp.buttons[0]?.pressed;
    const interact = !!gp.buttons[1]?.pressed || !!gp.buttons[2]?.pressed;

    return { moveX, moveY, jump, interact };
  }

  /**
   * Aggregate keyboard, touch joystick, and gamepad inputs into a clean MovementInput object
   */
  public getMovementInput(): MovementInput {
    // 1. Keyboard
    let kbMoveX = 0;
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) kbMoveX -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) kbMoveX += 1;

    let kbMoveY = 0;
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) kbMoveY -= 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) kbMoveY += 1;

    const kbJumpHeld =
      this.keysDown.has('Space') || this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp');
    const kbJumpPressed =
      this.keysJustPressed.has('Space') ||
      this.keysJustPressed.has('KeyW') ||
      this.keysJustPressed.has('ArrowUp');

    const kbInteractPressed = this.keysJustPressed.has('KeyE');

    // 2. Touch Joystick
    const touch = this.virtualJoystick
      ? this.virtualJoystick.getTouchState()
      : { moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, interactPressed: false };

    // 3. Gamepad
    const gp = this.sampleGamepad();

    // Aggregate with clamp
    const moveX = Math.max(-1, Math.min(1, kbMoveX + touch.moveX + gp.moveX));
    const moveY = Math.max(-1, Math.min(1, kbMoveY + touch.moveY + gp.moveY));

    const jumpPressed = kbJumpPressed || touch.jumpPressed || gp.jump;
    const jumpHeld = kbJumpHeld || touch.jumpHeld || gp.jump;
    const interactPressed = kbInteractPressed || touch.interactPressed || gp.interact;

    // Flush single-frame keys
    this.keysJustPressed.clear();

    return {
      moveX,
      moveY,
      jumpPressed,
      jumpHeld,
      interactPressed,
    };
  }
}
