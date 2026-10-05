import { AABB } from './AABB';
import { CONFIG } from '../core/Constants';
import { Ladder } from '../world/Level';

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
  public isClimbing: boolean = false;
  public currentLadder: Ladder | null = null;
  public facing: 'left' | 'right' = 'right';

  // Game feel timers
  private coyoteTimer: number = 0;
  private jumpBufferTimer: number = 0;

  constructor(x: number, y: number, width: number = CONFIG.PLAYER_WIDTH, height: number = CONFIG.PLAYER_HEIGHT) {
    this.bounds = new AABB(x, y, width, height);
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
   * Main update tick for physics and collision response
   */
  public update(dt: number, input: MovementInput, solids: AABB[], ladders: Ladder[], worldWidth: number): void {
    // 1. Check ladder overlap
    const touchingLadder = ladders.find((lad) => lad.bounds.intersects(this.bounds)) || null;

    if (!touchingLadder) {
      this.isClimbing = false;
      this.currentLadder = null;
    } else {
      this.currentLadder = touchingLadder;
      // Start climbing if touching ladder and pressing up/down or interact
      if (!this.isClimbing && (Math.abs(input.moveY) > 0.3 || input.interactPressed)) {
        this.isClimbing = true;
        this.vy = 0;
      }
    }

    // 2. Handle Climbing State
    if (this.isClimbing) {
      this.handleClimbing(dt, input, touchingLadder);
      // Clamp to world
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

    // Jump buffering
    if (input.jumpPressed) {
      this.jumpBufferTimer = CONFIG.JUMP_BUFFER;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    // Horizontal acceleration & friction
    const targetVx = input.moveX * CONFIG.MOVE_SPEED;
    if (Math.abs(input.moveX) > 0.05) {
      // Accelerating
      const accel = CONFIG.ACCELERATION * dt;
      if (this.vx < targetVx) {
        this.vx = Math.min(targetVx, this.vx + accel);
      } else if (this.vx > targetVx) {
        this.vx = Math.max(targetVx, this.vx - accel);
      }
      this.facing = input.moveX > 0 ? 'right' : 'left';
    } else {
      // Decelerating / friction
      const friction = CONFIG.FRICTION * dt;
      if (this.vx > 0) {
        this.vx = Math.max(0, this.vx - friction);
      } else if (this.vx < 0) {
        this.vx = Math.min(0, this.vx + friction);
      }
    }

    // Jump execution (coyote + buffer)
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.vy = -CONFIG.JUMP_SPEED;
      this.onGround = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
    }

    // Variable jump height: release early to jump lower
    if (!input.jumpHeld && this.vy < -CONFIG.MIN_JUMP_SPEED) {
      this.vy = -CONFIG.MIN_JUMP_SPEED;
    }

    // Apply gravity
    this.vy += CONFIG.GRAVITY * dt;

    // 4. Resolve Horizontal Movement with Stair-stepping
    this.moveHorizontal(this.vx * dt, solids);

    // 5. Resolve Vertical Movement
    this.moveVertical(this.vy * dt, solids);

    // Clamp inside world borders
    this.clampToWorld(worldWidth);
  }

  private handleClimbing(dt: number, input: MovementInput, ladder: Ladder | null): void {
    // Horizontal on ladder
    this.vx = input.moveX * (CONFIG.MOVE_SPEED * 0.5);
    this.x += this.vx * dt;

    // Vertical climb
    this.vy = input.moveY * CONFIG.CLIMB_SPEED;
    this.y += this.vy * dt;

    // Jump off ladder
    if (input.jumpPressed) {
      this.isClimbing = false;
      this.vy = -CONFIG.JUMP_SPEED * 0.85;
      if (Math.abs(input.moveX) > 0.1) {
        this.vx = (input.moveX > 0 ? 1 : -1) * CONFIG.MOVE_SPEED;
      }
    }

    // Check if climbed off the ladder bounds
    if (ladder) {
      if (this.bounds.bottom < ladder.bounds.top || this.bounds.top > ladder.bounds.bottom) {
        this.isClimbing = false;
      }
    }
  }

  private moveHorizontal(dx: number, solids: AABB[]): void {
    if (dx === 0) return;

    const oldY = this.bounds.y;
    this.bounds.x += dx;

    for (const solid of solids) {
      if (this.bounds.intersects(solid)) {
        // Check for stair step-up if grounded
        if (this.onGround && dx !== 0) {
          const stepHeight = this.bounds.bottom - solid.top;
          if (stepHeight > 0 && stepHeight <= CONFIG.MAX_STEP_UP) {
            // Test if lifting player clears the solid
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
              // Successfully stepped up onto obstacle!
              continue;
            } else {
              // Revert test Y
              this.bounds.y = originalY;
            }
          }
        }

        // Standard horizontal wall collision resolution
        if (dx > 0) {
          this.bounds.right = solid.left;
        } else if (dx < 0) {
          this.bounds.left = solid.right;
        }
        this.vx = 0;
      }
    }

    // Safety restore if stair didn't happen
    if (this.onGround && Math.abs(this.bounds.y - oldY) > CONFIG.MAX_STEP_UP) {
      this.bounds.y = oldY;
    }
  }

  private moveVertical(dy: number, solids: AABB[]): void {
    this.bounds.y += dy;
    this.onGround = false;

    for (const solid of solids) {
      if (this.bounds.intersects(solid)) {
        if (dy > 0) {
          // Landing on floor
          this.bounds.bottom = solid.top;
          this.vy = 0;
          this.onGround = true;
        } else if (dy < 0) {
          // Head hit ceiling
          this.bounds.top = solid.bottom;
          this.vy = 0;
        }
      }
    }
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
    // Void fall safety
    if (this.bounds.top > CONFIG.PLAY_HEIGHT + 200) {
      // Respawn at origin
      this.bounds.x = 250;
      this.bounds.y = 200;
      this.vy = 0;
    }
  }
}
