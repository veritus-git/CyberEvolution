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
  | 'ARENA'
  | 'BOSS';
export class MaskParser {
  private static imageCache: Map<string, HTMLImageElement> = new Map();

  /**
   * Helper to load an HTMLImageElement asynchronously with generous timeout and in-memory caching.
   */
  public static async loadImage(url: string): Promise<HTMLImageElement> {
    const cached = this.imageCache.get(url);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      return cached;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const timer = setTimeout(() => {
        reject(new Error(`Timeout loading image: ${url}`));
      }, 20000);
      img.onload = () => {
        clearTimeout(timer);
        MaskParser.imageCache.set(url, img);
        resolve(img);
      };
      img.onerror = () => {
        clearTimeout(timer);
        reject(new Error(`Failed to load image from: ${url}`));
      };
      img.src = url;
    });
  }

  /**
   * Classify RGB color into a TileType matching Python prototype constants
   */
  public static classifyColor(r: number, g: number, b: number, a: number): TileType {
    if (a < 50) return 'EMPTY';

    // Black = Solid
    if (r < 40 && g < 40 && b < 40) return 'SOLID';

    // Yellow = Ladder (255, 255, 0)
    if (Math.abs(r - 255) <= 35 && Math.abs(g - 255) <= 35 && b < 60) return 'LADDER';

    // Portals
    // Blue = Portal Lobby (0, 0, 255)
    if (r < 50 && g < 50 && Math.abs(b - 255) <= 35) return 'PORTAL_LOBBY';
    // Cyan = Portal Return (0, 255, 255)
    if (r < 50 && Math.abs(g - 255) <= 35 && Math.abs(b - 255) <= 35) return 'PORTAL_RETURN';

    // Triggers (Phishing / security interactions)
    // Trigger 1 = Magenta (255, 0, 255)
    if (Math.abs(r - 255) <= 35 && g < 60 && Math.abs(b - 255) <= 35) return 'TRIGGER_1';
    // Trigger 2 = Orange (255, 128, 0)
    if (Math.abs(r - 255) <= 35 && Math.abs(g - 128) <= 45 && b < 60) return 'TRIGGER_2';
    // Trigger 3 = Lime (128, 255, 0)
    if (Math.abs(r - 128) <= 45 && Math.abs(g - 255) <= 35 && b < 60) return 'TRIGGER_3';

    // Gates
    // Gate 1 = Bright Red (255, 0, 0)
    if (r >= 210 && g < 50 && b < 50) return 'GATE_1';
    // Gate 2 = Dark Red (200, 0, 0)
    if (r >= 160 && r < 210 && g < 50 && b < 50) return 'GATE_2';
    // Gate 3 = Deep Red (150, 0, 0)
    if (r >= 100 && r < 160 && g < 50 && b < 50) return 'GATE_3';

    // Arena = Deep Purple (100, 0, 200)
    if (Math.abs(r - 100) <= 35 && g < 50 && Math.abs(b - 200) <= 35) return 'ARENA';

    // Boss = Gray (100, 100, 100)
    if (Math.abs(r - 100) <= 20 && Math.abs(g - 100) <= 20 && Math.abs(b - 100) <= 20) return 'BOSS';

    return 'EMPTY';
  }

  /**
   * Parse a mask image into a Level instance.
   */
  public static parseFromImage(
    img: HTMLImageElement,
    levelKey: string = 'custom',
    levelName: string = 'Custom World'
  ): Level {
    const rawW = img.naturalWidth || img.width;
    const rawH = img.naturalHeight || img.height;

    const targetPlayH = CONFIG.PLAY_HEIGHT;
    const tileSize = CONFIG.TILE_SIZE;

    // Scale to match PLAY_HEIGHT
    const scale = targetPlayH / rawH;
    const worldW = Math.round(rawW * scale);
    const canvas = document.createElement('canvas');
    canvas.width = worldW;
    canvas.height = targetPlayH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not get canvas 2D context');

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, worldW, targetPlayH);

    const gridCols = Math.floor(worldW / tileSize);
    const gridRows = Math.floor(targetPlayH / tileSize);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // 2D grid of TileTypes
    const grid: TileType[][] = Array.from({ length: gridRows }, () =>
      Array.from({ length: gridCols }, () => 'EMPTY')
    );

    for (let gy = 0; gy < gridRows; gy++) {
      for (let gx = 0; gx < gridCols; gx++) {
        // Sample center of each 32x32 tile matching Python prototype
        const cx = Math.floor(gx * tileSize + tileSize / 2);
        const cy = Math.floor(gy * tileSize + tileSize / 2);
        if (cx >= canvas.width || cy >= canvas.height) continue;

        const idx = (cy * canvas.width + cx) * 4;
        grid[gy][gx] = this.classifyColor(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
      }
    }

    const level = new Level(levelKey, levelName, worldW, targetPlayH, 200, targetPlayH - 300);

    // Ladders: vertical merge per column (1:1 with Python logic)
    for (let gx = 0; gx < gridCols; gx++) {
      let gy = 0;
      while (gy < gridRows) {
        if (grid[gy][gx] === 'LADDER') {
          const start = gy;
          while (gy + 1 < gridRows && grid[gy + 1][gx] === 'LADDER') {
            gy++;
          }
          const end = gy;
          level.ladders.push({
            bounds: new AABB(gx * tileSize, start * tileSize, tileSize, (end - start + 1) * tileSize),
          });
        }
        gy++;
      }
    }

    // Merge other regions
    const visited: boolean[][] = Array.from({ length: gridRows }, () =>
      Array.from({ length: gridCols }, () => false)
    );

    for (let gy = 0; gy < gridRows; gy++) {
      for (let gx = 0; gx < gridCols; gx++) {
        const type = grid[gy][gx];
        if (type === 'EMPTY' || type === 'LADDER' || visited[gy][gx]) continue;

        let width = 1;
        while (gx + width < gridCols && !visited[gy][gx + width] && grid[gy][gx + width] === type) {
          width++;
        }

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

        for (let y = gy; y < gy + height; y++) {
          for (let x = gx; x < gx + width; x++) {
            visited[y][x] = true;
          }
        }

        const rect = new AABB(gx * tileSize, gy * tileSize, width * tileSize, height * tileSize);

        switch (type) {
          case 'SOLID':
            level.solids.push(rect);
            break;
          case 'ARENA':
            level.arenaZones.push(rect);
            break;
          case 'BOSS':
            level.bossSpawns.push(rect);
            break;
          case 'PORTAL_LOBBY':
            level.portals.push({
              id: `portal_${gx}_${gy}`,
              bounds: rect,
              targetWorld: 'dynamic_world',
              label: 'PORTAL ŚWIATA',
            });
            break;
          case 'PORTAL_RETURN':
            level.portals.push({
              id: `portal_ret_${gx}_${gy}`,
              bounds: rect,
              targetWorld: 'lobby',
              label: 'POWRÓT DO LOBBY',
            });
            break;
          case 'TRIGGER_1':
            level.triggers.push({ id: 1, bounds: rect, interactionId: 1, label: 'E: porozmawiaj', activated: false });
            break;
          case 'TRIGGER_2':
            level.triggers.push({ id: 2, bounds: rect, interactionId: 2, label: 'E: porozmawiaj', activated: false });
            break;
          case 'TRIGGER_3':
            level.triggers.push({ id: 3, bounds: rect, interactionId: 3, label: 'E: porozmawiaj', activated: false });
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

  /**
   * Parse NPC spawns from npc_mask.png (merges contiguous tiles into a single bounding box)
   */
  public static parseNpcSpawns(img: HTMLImageElement): { id: number; bounds: AABB }[] {
    const rawW = img.naturalWidth || img.width;
    const rawH = img.naturalHeight || img.height;
    const targetPlayH = CONFIG.PLAY_HEIGHT;
    const tileSize = CONFIG.TILE_SIZE;
    const scale = targetPlayH / rawH;
    const worldW = Math.round(rawW * scale);

    const canvas = document.createElement('canvas');
    canvas.width = worldW;
    canvas.height = targetPlayH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, worldW, targetPlayH);

    const gridCols = Math.floor(worldW / tileSize);
    const gridRows = Math.floor(targetPlayH / tileSize);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    const g1: boolean[][] = Array.from({ length: gridRows }, () => Array(gridCols).fill(false));
    const g2: boolean[][] = Array.from({ length: gridRows }, () => Array(gridCols).fill(false));
    const g3: boolean[][] = Array.from({ length: gridRows }, () => Array(gridCols).fill(false));

    for (let gy = 0; gy < gridRows; gy++) {
      for (let gx = 0; gx < gridCols; gx++) {
        const cx = Math.floor(gx * tileSize + tileSize / 2);
        const cy = Math.floor(gy * tileSize + tileSize / 2);
        const idx = (cy * canvas.width + cx) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        if (a < 50) continue;

        if (Math.abs(r - 100) <= 30 && g < 40 && b < 40) g1[gy][gx] = true; // NPC 1 (100, 0, 0)
        else if (r < 40 && Math.abs(g - 100) <= 30 && b < 40) g2[gy][gx] = true; // NPC 2 (0, 100, 0)
        else if (r < 40 && g < 40 && Math.abs(b - 100) <= 30) g3[gy][gx] = true; // NPC 3 (0, 0, 100)
      }
    }

    const mergeGrid = (grid: boolean[][], id: number): { id: number; bounds: AABB }[] => {
      const visited: boolean[][] = Array.from({ length: gridRows }, () => Array(gridCols).fill(false));
      const result: { id: number; bounds: AABB }[] = [];

      for (let y = 0; y < gridRows; y++) {
        for (let x = 0; x < gridCols; x++) {
          if (!grid[y][x] || visited[y][x]) continue;

          const stack: [number, number][] = [[x, y]];
          visited[y][x] = true;
          let minX = x;
          let maxX = x;
          let minY = y;
          let maxY = y;

          while (stack.length > 0) {
            const [curX, curY] = stack.pop()!;
            if (curX < minX) minX = curX;
            if (curX > maxX) maxX = curX;
            if (curY < minY) minY = curY;
            if (curY > maxY) maxY = curY;

            const neighbors: [number, number][] = [
              [curX - 1, curY],
              [curX + 1, curY],
              [curX, curY - 1],
              [curX, curY + 1],
            ];

            for (const [nx, ny] of neighbors) {
              if (nx >= 0 && nx < gridCols && ny >= 0 && ny < gridRows && !visited[ny][nx] && grid[ny][nx]) {
                visited[ny][nx] = true;
                stack.push([nx, ny]);
              }
            }
          }

          const w = (maxX - minX + 1) * tileSize;
          const h = (maxY - minY + 1) * tileSize;
          result.push({
            id,
            bounds: new AABB(minX * tileSize, minY * tileSize, w, h),
          });
        }
      }
      return result;
    };

    return [...mergeGrid(g1, 1), ...mergeGrid(g2, 2), ...mergeGrid(g3, 3)];
  }
}
