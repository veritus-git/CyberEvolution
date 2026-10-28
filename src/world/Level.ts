import { AABB } from '../physics/AABB';
import { CONFIG } from '../core/Constants';

export interface Portal {
  id: string;
  bounds: AABB;
  targetWorld: string;
  label?: string;
  frames?: [HTMLImageElement, HTMLImageElement] | null;
  frameIndex?: number;
  animTimer?: number;
  alpha?: number;
}

export interface Ladder {
  bounds: AABB;
}

export interface TriggerZone {
  id: number;
  bounds: AABB;
  interactionId: number;
  label?: string;
  activated: boolean;
}

export interface Gate {
  id: number;
  bounds: AABB;
  locked: boolean;
}

export interface NPCSpawn {
  id: number; // 1, 2, or 3
  bounds: AABB;
  frames: [HTMLImageElement, HTMLImageElement] | null;
  frameIndex: number;
  animTimer: number;
}

export class Level {
  public key: string;
  public name: string;
  public width: number;
  public height: number;
  public spawnX: number;
  public spawnY: number;

  public solids: AABB[] = [];
  public ladders: Ladder[] = [];
  public portals: Portal[] = [];
  public triggers: TriggerZone[] = [];
  public gates: Gate[] = [];
  public npcs: NPCSpawn[] = [];
  public arenaZones: AABB[] = [];
  public bossSpawns: AABB[] = [];

  public backgroundUrl: string | null = null;
  public backgroundImage: HTMLImageElement | null = null;
  public scrollImage: HTMLImageElement | null = null;
  public scrollActive: boolean = false;
  public scrollRect: AABB | null = null;

  constructor(
    key: string = 'lobby',
    name: string = 'Lobby',
    width: number = CONFIG.LOGICAL_WIDTH,
    height: number = CONFIG.PLAY_HEIGHT,
    spawnX: number = 250,
    spawnY: number = 600
  ) {
    this.key = key;
    this.name = name;
    this.width = width;
    this.height = height;
    this.spawnX = spawnX;
    this.spawnY = spawnY;
  }

  public getActiveSolids(): AABB[] {
    const list = [...this.solids];
    for (const gate of this.gates) {
      if (gate.locked) {
        list.push(gate.bounds);
      }
    }
    return list;
  }

  public openGate(id: number): void {
    for (const gate of this.gates) {
      if (gate.id === id) {
        gate.locked = false;
      }
    }
  }

  public lockGate(id: number): void {
    for (const gate of this.gates) {
      if (gate.id === id) {
        gate.locked = true;
      }
    }
  }

  /**
   * Effective world boundary (1:1 with Python recompute_world_clip).
   * Clamps the player and camera so the camera never reveals past locked gates.
   */
  public getEffectiveWidth(): number {
    let effective = this.width;
    for (const gate of this.gates) {
      if (gate.locked && gate.bounds.left < effective) {
        effective = gate.bounds.left;
      }
    }
    return effective;
  }

  public updateAnimations(dt: number): void {
    // Portals 2-frame animation tick (0.80s rhythm, 1:1 with Python prototype)
    for (const p of this.portals) {
      p.animTimer = (p.animTimer || 0) + dt;
      if (p.animTimer >= 0.80) {
        p.animTimer = 0;
        p.frameIndex = p.frameIndex === 1 ? 0 : 1;
      }
      if (p.alpha !== undefined && p.alpha < 1) {
        p.alpha = Math.min(1, p.alpha + dt * 1.25);
      }
    }

    // NPC 2-frame animation tick (0.80s rhythm, 1:1 with Python prototype)
    for (const npc of this.npcs) {
      npc.animTimer = (npc.animTimer || 0) + dt;
      if (npc.animTimer >= 0.80) {
        npc.animTimer = 0;
        npc.frameIndex = npc.frameIndex === 1 ? 0 : 1;
      }
    }
  }
}
