import { AABB } from './AABB';
import { CONFIG } from '../core/Constants';
import { Ladder } from '../world/Level';
import { sound } from '../core/Audio';

export interface MovementInput {
  moveX: number; // -1 to 1 (analog or digital)
  moveY: number; // -1 (up) to 1 (down)
  jumpPressed: boolean;
  jumpHeld: boolean;
  interactPressed: boolean;
}

export class PhysicsBody {
  public bounds: AABB;
  public vx: number = 0;
  public vy: number = 0;

  public onGround: boolean = false;
  public justJumped: boolean = false;
  public isClimbing: boolean = false;
  public climbStepout: number = 0;
  public climbTargetY: number = 0;
  public climbSideDir: number = 1;
  public climbRect: AABB | null = null;
  public ladderHoverTime: number = 0;
  public currentLadder: Ladder | null = null;
  public facing: 'left' | 'right' = 'right';

  // Game feel timers
  private coyoteTimer: number = 0;

  // Safe respawn tracking
  public lastSafePos: { x: number; y: number } = { x: 250, y: 500 };
  public lastSafeFullPos: { x: number; y: number } | null = null;
  public respawnState: 'normal' | 'falling' | 'blinking' = 'normal';
  public respawnTimer: number = 0;
  public isVisible: boolean = true;

  constructor(x: number, y: number, width: number = CONFIG.PLAYER_WIDTH, height: number = CONFIG.PLAYER_HEIGHT) {
    this.bounds = new AABB(x, y, width, height);
    this.lastSafePos = { x, y };
  }

  get x(): number {
    return this.bounds.x;
  }
  set x(val: number) {
    this.bounds.x = val;
  }

  get y(): number {
    return this.bounds.y;
  }
  set y(val: number) {
    this.bounds.y = val;
  }

  get width(): number {
    return this.bounds.width;
  }
  get height(): number {
    return this.bounds.height;
  }

  /**
   * Main update tick for physics and collision response (1:1 with Python prototype)
   */
  public update(dt: number, input: MovementInput, solids: AABB[], ladders: Ladder[], worldWidth: number): void {
    // 0. Handle Respawn sequence
    if (this.respawnState === 'falling') {
      this.respawnTimer += dt;
      if (this.respawnTimer >= CONFIG.RESPAWN_DELAY_S) {
        const target = this.lastSafeFullPos || this.lastSafePos;
        this.x = target.x;
        this.y = target.y;
        this.vx = 0;
        this.vy = 0;
        this.onGround = true;
        this.respawnState = 'blinking';
        this.respawnTimer = 0;
      }
      return;
    }

    if (this.respawnState === 'blinking') {
      this.respawnTimer += dt;
      this.isVisible = Math.floor(this.respawnTimer / CONFIG.BLINK_INTERVAL_S) % 2 === 0;
      this.vx = 0;
      if (this.respawnTimer >= CONFIG.BLINKS_TOTAL * CONFIG.BLINK_INTERVAL_S) {
        this.respawnState = 'normal';
        this.respawnTimer = 0;
        this.isVisible = true;
      }
      // Strictly freeze all movement & jumping during blinking (1:1 with Python prototype)
      input = { moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, interactPressed: false };
    }

    // 1. Ladder proximity check
    const touchingLadder = ladders.find((lad) => lad.bounds.intersects(this.bounds)) || null;

    if (touchingLadder && this.respawnState === 'normal') {
      this.currentLadder = touchingLadder;
      this.ladderHoverTime += dt;

      // Start climbing if hovering on ladder and pressed interact (E / tap action)
      if (!this.isClimbing && this.climbStepout <= 0 && input.interactPressed && this.ladderHoverTime >= CONFIG.LADDER_INTERACT_DELAY) {
        this.climbRect = touchingLadder.bounds;
        this.climbTargetY = this.climbRect.top - this.height;
        this.climbSideDir = (this.bounds.centerX < this.climbRect.centerX) ? 1 : -1;
        this.facing = this.climbSideDir > 0 ? 'right' : 'left';
        this.isClimbing = true;
        this.climbStepout = 0;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
      }
    } else {
      this.currentLadder = null;
      this.ladderHoverTime = 0;
    }

    // 2. Handle Climbing State (1:1 with Python logic)
    if (this.isClimbing || this.climbStepout > 0) {
      this.handleClimbing(dt, solids);
      this.clampToWorld(worldWidth);
      return;
    }

    // 3. Normal Platformer Physics
    // Ground and coyote tracking
    if (this.onGround) {
      this.coyoteTimer = CONFIG.COYOTE_TIME;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    // Instant digital movement response (no ice sliding)
    if (Math.abs(input.moveX) > 0.05) {
      this.vx = (input.moveX > 0 ? 1 : -1) * CONFIG.MOVE_SPEED;
      this.facing = input.moveX > 0 ? 'right' : 'left';
    } else {
      this.vx = 0;
    }

    // Jump execution: works on instant press OR held jump when touching ground
    if ((input.jumpPressed || input.jumpHeld) && (this.onGround || this.coyoteTimer > 0)) {
      this.vy = -CONFIG.JUMP_SPEED;
      this.onGround = false;
      this.coyoteTimer = 0;
      this.justJumped = true;
    }

    // Apply gravity
    this.vy += CONFIG.GRAVITY * dt;

    // Filter nearby solids
    const pLeft = this.bounds.left - 250;
    const pRight = this.bounds.right + 250;
    const nearbySolids = solids.filter((s) => s.left <= pRight && s.right >= pLeft);

    // 4. Resolve Horizontal Movement with Stair-stepping
    this.moveHorizontal(this.vx * dt, nearbySolids);

    // 5. Resolve Vertical Movement
    this.moveVertical(this.vy * dt, nearbySolids);

    // 6. Ground support verification & edge drop
    if (this.onGround) {
      const supportRatio = this.calculateGroundSupportRatio(nearbySolids);
      if (supportRatio < CONFIG.GROUND_LOSS_RATIO) {
        this.onGround = false;
      } else {
        this.lastSafePos = { x: this.x, y: this.y };
        if (supportRatio >= 0.95) {
          this.lastSafeFullPos = { x: this.x, y: this.y };
        }
      }
    }

    // 7. Void drop check
    const voidLine = CONFIG.PLAY_HEIGHT + CONFIG.VOID_MARGIN;
    if (this.y > voidLine && this.respawnState === 'normal') {
      sound.playAbyssFall();
      this.respawnState = 'falling';
      this.respawnTimer = 0;
      this.isVisible = false;
      this.isClimbing = false;
      this.climbStepout = 0;
    }

    // Clamp inside world borders
    this.clampToWorld(worldWidth);
  }

  /**
   * 1:1 Ladder Climbing and automatic top step-out onto platform
   */
  private handleClimbing(dt: number, solids: AABB[]): void {
    if (this.climbStepout > 0) {
      // Step-out phase: walk horizontally onto upper floor
      const walkOutSpeed = CONFIG.MOVE_SPEED * 0.6;
      const dtStep = Math.min(dt, this.climbStepout);
      this.moveHorizontal(this.climbSideDir * walkOutSpeed * dtStep, solids);
      this.moveVertical(180.0 * dtStep, solids); // slight downward push to detect ground
      this.climbStepout -= dtStep;

      if (this.climbStepout <= 0) {
        this.isClimbing = false;
        this.vy = 0;
        this.onGround = true;
      }
    } else {
      // Ascending ladder vertically
      const step = CONFIG.CLIMB_SPEED * dt;
      this.y = Math.max(this.climbTargetY, this.y - step);
      this.vx = 0;
      this.vy = 0;
      this.onGround = false;

      // Stick to ladder side
      if (this.climbRect) {
        if (this.climbSideDir > 0) {
          this.x = Math.max(this.x, this.climbRect.right - this.width);
        } else {
          this.x = Math.min(this.x, this.climbRect.left);
        }
      }

      // Check reached ladder top
      if (this.y <= this.climbTargetY + 0.5 && this.climbStepout <= 0) {
        this.y = this.climbTargetY;
        this.climbStepout = CONFIG.CLIMB_STEPOUT_TIME;
      }
    }
  }

  public moveHorizontal(dx: number, solids: AABB[]): void {
    if (dx === 0) return;

    this.bounds.x += dx;

    for (const solid of solids) {
      if (this.bounds.intersects(solid)) {
        // Stair step-up check if grounded (up to 32px tile height)
        if (this.onGround && dx !== 0) {
          const stepHeight = this.bounds.bottom - solid.top;
          if (stepHeight > 0 && stepHeight <= CONFIG.MAX_STEP_UP) {
            const testY = solid.top - this.bounds.height;
            const originalY = this.bounds.y;
            this.bounds.y = testY;

            let cleared = true;
            for (const other of solids) {
              if (other !== solid && this.bounds.intersects(other)) {
                cleared = false;
                break;
              }
            }

            if (cleared) {
              continue; // Successfully stepped up!
            } else {
              this.bounds.y = originalY;
            }
          }
        }

        // Standard wall collision
        if (dx > 0) {
          this.bounds.right = solid.left;
        } else if (dx < 0) {
          this.bounds.left = solid.right;
        }
        this.vx = 0;
      }
    }
  }

  public moveVertical(dy: number, solids: AABB[]): void {
    this.bounds.y += dy;
    this.onGround = false;

    for (const solid of solids) {
      if (this.bounds.intersects(solid)) {
        if (dy > 0) {
          this.bounds.bottom = solid.top;
          this.vy = 0;
          this.onGround = true;
        } else if (dy < 0) {
          this.bounds.top = solid.bottom;
          this.vy = 0;
        }
      }
    }
  }

  private calculateGroundSupportRatio(solids: AABB[]): number {
    const inset = CONFIG.SUPPORT_INSET;
    const footLeft = this.bounds.left + inset;
    const footRight = this.bounds.right - inset;
    const footWidth = Math.max(1, footRight - footLeft);
    const footBottom = this.bounds.bottom + CONFIG.SUPPORT_TOLERANCE;

    let supported = 0;
    for (const s of solids) {
      if (s.top <= footBottom && s.top >= this.bounds.bottom - 2) {
        const overlapL = Math.max(footLeft, s.left);
        const overlapR = Math.min(footRight, s.right);
        if (overlapR > overlapL) {
          supported += (overlapR - overlapL);
        }
      }
    }
    return Math.min(1.0, supported / footWidth);
  }

  private clampToWorld(worldWidth: number): void {
    if (this.bounds.left < 0) {
      this.bounds.left = 0;
      this.vx = 0;
    }
    if (this.bounds.right > worldWidth) {
      this.bounds.right = worldWidth;
      this.vx = 0;
    }
  }
}
