/**
 * src/storage.ts
 * Kompleksowy moduł trwałego zapisu stanu gry (Persistent Storage).
 * Zapewnia zapisywanie postępu (świat, checkpoint, ewolucja, otwarte bramki),
 * bezpieczną obsługę błędów, migrację starych zapisów oraz wsparcie dla navigator.storage.persist().
 */

export interface GameSaveData {
  version: number;
  currentWorld: string;
  playerSkin: number;
  playerX?: number;
  playerY?: number;
  completedWorlds: number[];
  unlockedGates: Record<string, number[]>;
  activatedTriggers: Record<string, number[]>;
  hasSeenIntro: boolean;
  lastSavedAt: number;
  settings?: {
    soundEnabled?: boolean;
    musicVolume?: number;
  };
}

const STORAGE_KEY = 'cyberevo_save';

const DEFAULT_SAVE_DATA: GameSaveData = {
  version: 1,
  currentWorld: 'lobby',
  playerSkin: 1,
  completedWorlds: [],
  unlockedGates: {},
  activatedTriggers: {},
  hasSeenIntro: false,
  lastSavedAt: Date.now(),
  settings: {
    soundEnabled: true,
    musicVolume: 0.8,
  },
};

export class GameStorageManager {
  private currentState: GameSaveData;

  constructor() {
    this.currentState = this.load();
  }

  /**
   * Sprawdza, czy w pamięci lokalnej istnieje ważny zapis gry.
   */
  public hasSave(): boolean {
    try {
      return Boolean(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      return false;
    }
  }

  /**
   * Prosi przeglądarkę o przyznanie uprawnień "Persistent Storage",
   * aby system mobilny nie usunął zapisu przy automatycznym czyszczeniu cache.
   * Działa wyłącznie w bezpiecznym kontekście (HTTPS lub localhost).
   */
  public async requestPersistentStorage(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.isSecureContext) {
      return false;
    }

    if (!navigator.storage || !navigator.storage.persist) {
      return false;
    }

    try {
      const isAlreadyPersisted = await navigator.storage.persisted();
      if (isAlreadyPersisted) {
        console.log('[Storage] Pamięć trwała (Persistent Storage) jest już aktywna.');
        return true;
      }

      const granted = await navigator.storage.persist();
      console.log(`[Storage] Przyznano pamięć trwałą: ${granted}`);
      return granted;
    } catch (err) {
      console.warn('[Storage] Błąd podczas proszenia o pamięć trwałą:', err);
      return false;
    }
  }

  /**
   * Wczytuje zapis z localStorage. Obsługuje migrację starych formatów i zwraca bezpieczny stan.
   */
  public load(): GameSaveData {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.currentState = structuredClone(DEFAULT_SAVE_DATA);
        return this.currentState;
      }

      const parsed = JSON.parse(raw);

      // Obsługa migracji starego formatu { evo: number, completed: number[] }
      const skin = typeof parsed.playerSkin === 'number'
        ? parsed.playerSkin
        : (typeof parsed.evo === 'number' ? parsed.evo : DEFAULT_SAVE_DATA.playerSkin);

      const completed = Array.isArray(parsed.completedWorlds)
        ? parsed.completedWorlds
        : (Array.isArray(parsed.completed) ? parsed.completed : []);

      const currentWorld = typeof parsed.currentWorld === 'string' && parsed.currentWorld.length > 0
        ? parsed.currentWorld
        : DEFAULT_SAVE_DATA.currentWorld;

      this.currentState = {
        version: parsed.version || 1,
        currentWorld,
        playerSkin: skin,
        playerX: typeof parsed.playerX === 'number' ? parsed.playerX : undefined,
        playerY: typeof parsed.playerY === 'number' ? parsed.playerY : undefined,
        completedWorlds: completed,
        unlockedGates: parsed.unlockedGates && typeof parsed.unlockedGates === 'object' ? parsed.unlockedGates : {},
        activatedTriggers: parsed.activatedTriggers && typeof parsed.activatedTriggers === 'object' ? parsed.activatedTriggers : {},
        hasSeenIntro: Boolean(parsed.hasSeenIntro),
        lastSavedAt: typeof parsed.lastSavedAt === 'number' ? parsed.lastSavedAt : Date.now(),
        settings: {
          ...DEFAULT_SAVE_DATA.settings,
          ...(parsed.settings || {}),
        },
      };

      return this.currentState;
    } catch (err) {
      console.error('[Storage] Błąd wczytywania zapisu gry, powrót do stanu domyślnego:', err);
      this.currentState = structuredClone(DEFAULT_SAVE_DATA);
      return this.currentState;
    }
  }

  /**
   * Zapisuje stan gry lub jego część do localStorage.
   */
  public save(partialUpdate?: Partial<GameSaveData>): boolean {
    try {
      if (partialUpdate) {
        this.currentState = {
          ...this.currentState,
          ...partialUpdate,
          lastSavedAt: Date.now(),
        };
      } else {
        this.currentState.lastSavedAt = Date.now();
      }

      const serialized = JSON.stringify(this.currentState);
      window.localStorage.setItem(STORAGE_KEY, serialized);
      return true;
    } catch (err) {
      console.error('[Storage] Błąd zapisu do localStorage (brak miejsca lub tryb prywatny):', err);
      return false;
    }
  }

  /**
   * Zwraca aktualny stan zapisu z pamięci RAM.
   */
  public getState(): GameSaveData {
    return this.currentState;
  }

  /**
   * Aktualizuje stan otwartych bramek dla danego świata.
   */
  public markGateUnlocked(worldKey: string, gateId: number): void {
    const list = this.currentState.unlockedGates[worldKey] || [];
    if (!list.includes(gateId)) {
      list.push(gateId);
      this.currentState.unlockedGates[worldKey] = list;
      this.save();
    }
  }

  /**
   * Aktualizuje stan aktywowanych triggerów/quizów dla danego świata.
   */
  public markTriggerActivated(worldKey: string, triggerId: number): void {
    const list = this.currentState.activatedTriggers[worldKey] || [];
    if (!list.includes(triggerId)) {
      list.push(triggerId);
      this.currentState.activatedTriggers[worldKey] = list;
      this.save();
    }
  }

  /**
   * Całkowity reset postępów gracza (Nowa gra).
   */
  public resetSave(): GameSaveData {
    this.currentState = structuredClone(DEFAULT_SAVE_DATA);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignorujemy błędy
    }
    return this.currentState;
  }
}

export const gameStorage = new GameStorageManager();
