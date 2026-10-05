export const CONFIG = {
  // Logical resolution (matching original prototype)
  LOGICAL_WIDTH: 1920,
  LOGICAL_HEIGHT: 1080,
  PLAY_HEIGHT: 896,
  BAR_HEIGHT: 92, // (1080 - 896) / 2
  
  // Tile & World Grid
  TILE_SIZE: 32,

  // Player Dimensions (original 105 x 250)
  PLAYER_WIDTH: 105,
  PLAYER_HEIGHT: 250,

  // Physics constants
  MOVE_SPEED: 750.0,
  ACCELERATION: 4000.0,
  FRICTION: 3500.0,
  GRAVITY: 2700.0,
  JUMP_SPEED: 875.0,
  MIN_JUMP_SPEED: 350.0, // For variable jump height
  CLIMB_SPEED: 650.0,

  // Game feel / polish
  COYOTE_TIME: 0.12, // seconds
  JUMP_BUFFER: 0.15, // seconds
  MAX_STEP_UP: 32, // Stair-step tolerance (1 tile)
  GROUND_LOSS_RATIO: 0.25,

  // Colors for collision masks (RGB hex or tuple)
  MASK_COLORS: {
    SOLID: { r: 0, g: 0, b: 0, tol: 25 },             // Black = solid wall/floor
    LADDER: { r: 255, g: 255, b: 0, tol: 35 },        // Yellow = ladder
    PORTAL_LOBBY: { r: 0, g: 0, b: 255, tol: 35 },    // Blue = portal to world
    PORTAL_RETURN: { r: 0, g: 255, b: 255, tol: 35 }, // Cyan = portal back
    GATE_1: { r: 255, g: 0, b: 0, tol: 35 },          // Red gate 1
    GATE_2: { r: 200, g: 0, b: 0, tol: 35 },          // Darker red gate 2
    GATE_3: { r: 150, g: 0, b: 0, tol: 35 },          // Deep red gate 3
    TRIGGER_1: { r: 255, g: 0, b: 255, tol: 35 },     // Magenta trigger
    TRIGGER_2: { r: 255, g: 128, b: 0, tol: 35 },     // Orange trigger
    TRIGGER_3: { r: 128, g: 255, b: 0, tol: 35 },     // Lime trigger
    ARENA: { r: 100, g: 0, b: 200, tol: 35 },         // Purple arena
    BOSS: { r: 100, g: 100, b: 100, tol: 25 },        // Gray boss
  }
} as const;
