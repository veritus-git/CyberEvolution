import { AABB } from '../physics/AABB';
import { CONFIG } from '../core/Constants';

export interface Portal {
  id: string;
  bounds: AABB;
  targetWorld: string;
  label?: string;
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
  public backgroundUrl: string | null = null;
  public backgroundImage: HTMLImageElement | null = null;

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
    const gate = this.gates.find((g) => g.id === id);
    if (gate) {
      gate.locked = false;
    }
  }

  public lockGate(id: number): void {
    const gate = this.gates.find((g) => g.id === id);
    if (gate) {
      gate.locked = true;
    }
  }
}
