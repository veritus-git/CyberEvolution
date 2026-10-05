import { AABB } from '../physics/AABB';
import { CONFIG } from '../core/Constants';
import { Level } from './Level';

export type TileType =
  | 'EMPTY'
  | 'SOLID'
  | 'LADDER'
  | 'PORTAL_LOBBY'
  | 'PORTAL_RETURN'
  | 'TRIGGER_1'
  | 'TRIGGER_2'
  | 'TRIGGER_3'
  | 'GATE_1'
  | 'GATE_2'
  | 'GATE_3'
  | 'ARENA';

export class MaskParser {
  /**
   * Helper to load an HTMLImageElement asynchronously.
   */
  public static async loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(new Error(`Failed to load image from: ${url} (${err})`));
      img.src = url;
    });
  }

  /**
   * Classify RGB color into a TileType using tolerant color distance.
   */
  public static classifyColor(r: number, g: number, b: number, a: number): TileType {
    if (a < 50) return 'EMPTY';

    // Black / very dark = Solid
    if (r < 40 && g < 40 && b < 40) return 'SOLID';

    // Yellow = Ladder (high R, high G, low B)
    if (r > 180 && g > 180 && b < 80) return 'LADDER';

    // Portal Lobby = Blue (low R, low G, high B)
    if (r < 80 && g < 100 && b > 180) return 'PORTAL_LOBBY';

    // Portal Return = Cyan (low R, high G, high B)
    if (r < 80 && g > 180 && b > 180) return 'PORTAL_RETURN';

    // Trigger 1 = Magenta (high R, low G, high B)
    if (r > 180 && g < 80 && b > 180) return 'TRIGGER_1';

    // Trigger 2 = Orange (high R, mid G, low B)
    if (r > 180 && g >= 80 && g <= 160 && b < 60) return 'TRIGGER_2';

    // Trigger 3 = Lime / Light Green (mid R, high G, low B)
    if (r >= 80 && r <= 160 && g > 180 && b < 80) return 'TRIGGER_3';

    // Gates = Red shades
    if (r > 210 && g < 60 && b < 60) return 'GATE_1';
    if (r >= 160 && r <= 210 && g < 60 && b < 60) return 'GATE_2';
    if (r >= 100 && r < 160 && g < 60 && b < 60) return 'GATE_3';

    // Arena = Deep Purple
    if (r >= 70 && r <= 130 && g < 40 && b >= 150) return 'ARENA';

    return 'EMPTY';
  }

  /**
   * Parse a mask image into a Level instance.
   * Auto-detects whether the image is 1px=1tile or pixel-art full resolution (32x32 tiles).
   */
  public static parseFromImage(
    img: HTMLImageElement,
    levelKey: string = 'custom',
    levelName: string = 'Custom World'
  ): Level {
    const rawW = img.naturalWidth || img.width;
    const rawH = img.naturalHeight || img.height;

    // Detect mode: if height is <= 64px, treat as 1px = 1 tile!
    // Otherwise standard 32px grid scaled to PLAY_HEIGHT (896px).
    const isPixelMap = rawH <= 64;
    const targetPlayH = CONFIG.PLAY_HEIGHT;
    const tileSize = CONFIG.TILE_SIZE;

    // Target world dimensions
    let worldW: number;
    let worldH = targetPlayH;
    let gridCols: number;
    let gridRows: number;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not get canvas 2D context');

    if (isPixelMap) {
      gridCols = rawW;
      gridRows = rawH;
      worldW = gridCols * tileSize;
      worldH = gridRows * tileSize;
      canvas.width = rawW;
      canvas.height = rawH;
      ctx.drawImage(img, 0, 0);
    } else {
      // Scale to match PLAY_HEIGHT
      const scale = targetPlayH / rawH;
      worldW = Math.round(rawW * scale);
      canvas.width = worldW;
      canvas.height = targetPlayH;
      ctx.imageSmoothingEnabled = false; // Preserve crisp pixel boundaries
      ctx.drawImage(img, 0, 0, worldW, targetPlayH);

      gridCols = Math.floor(worldW / tileSize);
      gridRows = Math.floor(targetPlayH / tileSize);
    }

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // 2D grid of TileTypes
    const grid: TileType[][] = Array.from({ length: gridRows }, () =>
      Array.from({ length: gridCols }, () => 'EMPTY')
    );

    for (let gy = 0; gy < gridRows; gy++) {
      for (let gx = 0; gx < gridCols; gx++) {
        if (isPixelMap) {
          const idx = (gy * rawW + gx) * 4;
          grid[gy][gx] = this.classifyColor(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
        } else {
          // Robust area sampling: 5 sample points (center + 4 offsets) to prevent single-pixel errors!
          const cx = Math.floor(gx * tileSize + tileSize / 2);
          const cy = Math.floor(gy * tileSize + tileSize / 2);
          const offsets = [
            [0, 0],
            [-8, 0],
            [8, 0],
            [0, -8],
            [0, 8],
          ];

          const votes: Record<TileType, number> = {
            EMPTY: 0,
            SOLID: 0,
            LADDER: 0,
            PORTAL_LOBBY: 0,
            PORTAL_RETURN: 0,
            TRIGGER_1: 0,
            TRIGGER_2: 0,
            TRIGGER_3: 0,
            GATE_1: 0,
            GATE_2: 0,
            GATE_3: 0,
            ARENA: 0,
          };

          for (const [ox, oy] of offsets) {
            const sx = Math.max(0, Math.min(canvas.width - 1, cx + ox));
            const sy = Math.max(0, Math.min(canvas.height - 1, cy + oy));
            const idx = (sy * canvas.width + sx) * 4;
            const t = this.classifyColor(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
            votes[t] = (votes[t] || 0) + 1;
          }

          // Majority vote
          let bestType: TileType = 'EMPTY';
          let maxVotes = 0;
          for (const typeKey of Object.keys(votes) as TileType[]) {
            if (votes[typeKey] > maxVotes) {
              maxVotes = votes[typeKey];
              bestType = typeKey;
            }
          }
          grid[gy][gx] = bestType;
        }
      }
    }

    // Now merge adjacent tiles into optimized AABB rectangles
    const level = new Level(levelKey, levelName, worldW, worldH, 200, worldH - 300);

    // Greedy horizontal & vertical mesh merger
    const visited: boolean[][] = Array.from({ length: gridRows }, () =>
      Array.from({ length: gridCols }, () => false)
    );

    for (let gy = 0; gy < gridRows; gy++) {
      for (let gx = 0; gx < gridCols; gx++) {
        if (visited[gy][gx]) continue;
        const type = grid[gy][gx];
        if (type === 'EMPTY') continue;

        // Measure width of contiguous horizontal run of the same type
        let width = 1;
        while (gx + width < gridCols && !visited[gy][gx + width] && grid[gy][gx + width] === type) {
          width++;
        }

        // Measure height that can expand identically downwards
        let height = 1;
        let canExpand = true;
        while (gy + height < gridRows && canExpand) {
          for (let x = gx; x < gx + width; x++) {
            if (visited[gy + height][x] || grid[gy + height][x] !== type) {
              canExpand = false;
              break;
            }
          }
          if (canExpand) height++;
        }

        // Mark region as visited
        for (let y = gy; y < gy + height; y++) {
          for (let x = gx; x < gx + width; x++) {
            visited[y][x] = true;
          }
        }

        const rect = new AABB(gx * tileSize, gy * tileSize, width * tileSize, height * tileSize);

        switch (type) {
          case 'SOLID':
          case 'ARENA':
            level.solids.push(rect);
            break;
          case 'LADDER':
            level.ladders.push({ bounds: rect });
            break;
          case 'PORTAL_LOBBY':
            level.portals.push({
              id: `portal_${gx}_${gy}`,
              bounds: rect,
              targetWorld: 'world1',
              label: 'Portal do Świata 1',
            });
            break;
          case 'PORTAL_RETURN':
            level.portals.push({
              id: `portal_${gx}_${gy}`,
              bounds: rect,
              targetWorld: 'lobby',
              label: 'Powrót do Lobby',
            });
            break;
          case 'TRIGGER_1':
            level.triggers.push({
              id: 1,
              bounds: rect,
              interactionId: 1,
              label: 'Wskazówka Bezpieczeństwa #1',
              activated: false,
            });
            break;
          case 'TRIGGER_2':
            level.triggers.push({
              id: 2,
              bounds: rect,
              interactionId: 2,
              label: 'Wskazówka Bezpieczeństwa #2',
              activated: false,
            });
            break;
          case 'TRIGGER_3':
            level.triggers.push({
              id: 3,
              bounds: rect,
              interactionId: 3,
              label: 'Wskazówka Bezpieczeństwa #3',
              activated: false,
            });
            break;
          case 'GATE_1':
            level.gates.push({ id: 1, bounds: rect, locked: true });
            break;
          case 'GATE_2':
            level.gates.push({ id: 2, bounds: rect, locked: true });
            break;
          case 'GATE_3':
            level.gates.push({ id: 3, bounds: rect, locked: true });
            break;
        }
      }
    }

    return level;
  }
}
