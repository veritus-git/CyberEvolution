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

  // Physics constants (1:1 matching Python original)
  MOVE_SPEED: 750.0,
  GRAVITY: 2700.0,
  JUMP_SPEED: 875.0,
  CLIMB_SPEED: 700.0,
  CLIMB_STEPOUT_TIME: 0.65,
  LADDER_INTERACT_DELAY: 0.05,

  // Game feel / timers (matching original)
  COYOTE_TIME: 0.10, // seconds
  MAX_STEP_UP: 32, // Stair-step tolerance (1 tile = 32px)
  GROUND_LOSS_RATIO: 0.25,
  SUPPORT_TOLERANCE: 8,
  SUPPORT_INSET: 6,
  VOID_MARGIN: 60,
  RESPAWN_DELAY_S: 0.38,
  BLINKS_TOTAL: 5,
  BLINK_INTERVAL_S: 0.17,

  // Colors for collision masks (RGB hex or tuple)
  MASK_COLORS: {
    SOLID: { r: 0, g: 0, b: 0, tol: 25 },             // Black = solid wall/floor
    LADDER: { r: 255, g: 255, b: 0, tol: 32 },        // Yellow = ladder
    PORTAL_LOBBY: { r: 0, g: 0, b: 255, tol: 32 },    // Blue = portal to world
    PORTAL_RETURN: { r: 0, g: 255, b: 255, tol: 32 }, // Cyan = portal back
    GATE_1: { r: 255, g: 0, b: 0, tol: 32 },          // Red gate 1
    GATE_2: { r: 200, g: 0, b: 0, tol: 32 },          // Darker red gate 2
    GATE_3: { r: 150, g: 0, b: 0, tol: 32 },          // Deep red gate 3
    TRIGGER_1: { r: 255, g: 0, b: 255, tol: 32 },     // Magenta trigger
    TRIGGER_2: { r: 255, g: 128, b: 0, tol: 32 },     // Orange trigger
    TRIGGER_3: { r: 128, g: 255, b: 0, tol: 32 },     // Lime trigger
    ARENA: { r: 100, g: 0, b: 200, tol: 32 },         // Purple arena
    BOSS: { r: 100, g: 100, b: 100, tol: 0 },         // Gray boss
    NPC1: { r: 100, g: 0, b: 0 },                      // NPC 1
    NPC2: { r: 0, g: 100, b: 0 },                      // NPC 2
    NPC3: { r: 0, g: 0, b: 100 },                      // NPC 3
  }
} as const;

