import { CONFIG } from './Constants';
import { Level } from '../world/Level';
import { MaskParser } from '../world/MaskParser';
import { Player } from '../entities/Player';
import { Camera } from './Camera';
import { InputManager } from './Input';
import { Renderer } from '../graphics/Renderer';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { InteractionDialog, ConversationLine } from '../ui/InteractionDialog';
import { StartMenu } from '../ui/StartMenu';
import { IntroSequence } from '../ui/IntroSequence';
import { Bossfight } from '../world/Bossfight';
import { AABB } from '../physics/AABB';
import { InteractionParser, QuizData } from '../world/InteractionParser';
import { gameStorage, GameSaveData } from '../storage';

export class Engine {
  public canvas: HTMLCanvasElement;
  public renderer: Renderer;
  public input: InputManager;
  public camera: Camera;
  public player: Player;
  public level: Level;
  public dialog: InteractionDialog;
  public startMenu: StartMenu;
  public introSequence: IntroSequence;
  public bossfight: Bossfight;
  public joystick: VirtualJoystick;

  // Screen-space overlay canvas for touch controls
  public overlayCanvas: HTMLCanvasElement;
  private overlayCtx: CanvasRenderingContext2D;

  public isRunning: boolean = false;
  private lastTime: number = 0;

  // FPS tracking
  private fps: number = 60;
  private frameCount: number = 0;
  private fpsTimer: number = 0;

  // Cached active solids
  private cachedSolids: AABB[] = [];
  private solidsNeedRefresh: boolean = true;

  // Quizzes for current world
  private currentQuizzes: Map<number, QuizData> = new Map();

  // Progress state
  public completedWorlds: Set<number> = new Set();
  public pendingSummaryWorld: number | null = null;
  public isTransitioning: boolean = false;
  private activeHint: string | null = null;

  // Arena intro & World intro animation state
  private arenaIntroActive: boolean = false;
  private arenaIntroWn: number | null = null;
  private arenaIntroSkipBossDialog: boolean = false;
  private worldIntroTitle: string | null = null;
  private worldIntroWn: number = 1;
  private worldIntroTimer: number = 0;
  private pendingWorldIntroText: string = '';

  // Lobby vertical drop-in state (1:1 with Python prototype: falls in from top)
  private lobbyDropinActive: boolean = false;
  private lobbyDropinLockTimer: number = 0;
  private pendingLobbyDialog: 'intro' | number | null = null;

  // Screen wipe transition state (1:1 with Python wipe_out_down / wipe_in_down)
  private transitionState: 'wipe_out' | 'wipe_in' | 'none' = 'none';
  private transitionTimer: number = 0;
  private readonly transitionDuration: number = 0.60;
  private pendingWorldSwitch: string | null = null;

  constructor(canvas: HTMLCanvasElement, uiContainer: HTMLElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new InputManager();
    this.camera = new Camera(CONFIG.LOGICAL_WIDTH, CONFIG.PLAY_HEIGHT);
    this.player = new Player(250, 500);
    this.level = new Level('lobby', 'Cybernetyczne Lobby');

    this.dialog = new InteractionDialog(uiContainer);
    this.introSequence = new IntroSequence(uiContainer);
    this.bossfight = new Bossfight();

    const hasSave = gameStorage.hasSave();
    this.startMenu = new StartMenu(uiContainer, hasSave);

    // Overlay canvas for touch controls
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.id = 'overlay-canvas';
    this.overlayCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;';
    uiContainer.appendChild(this.overlayCanvas);
    const octx = this.overlayCanvas.getContext('2d', { alpha: true });
    if (!octx) throw new Error('Could not create overlay 2D context');
    this.overlayCtx = octx;

    this.joystick = new VirtualJoystick(canvas);
    this.input.setVirtualJoystick(this.joystick);

    this.setupWindowResize();
    this.setupStartMenu();

    // Autozapis przy minimalizacji karty / blokadzie telefonu
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && !this.startMenu.isOpen) {
        this.saveGameProgress();
      }
    });
    window.addEventListener('pagehide', () => {
      if (!this.startMenu.isOpen) {
        this.saveGameProgress();
      }
    });

    // Mouse cursor hiding during platforming; only show when UI needs selection
    document.body.classList.add('cursor-hidden');
    window.addEventListener('mousemove', () => {
      if (this.startMenu.isOpen || this.dialog.isChoicesVisible) {
        document.body.classList.remove('cursor-hidden');
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F11' || (!this.startMenu.isOpen && !this.dialog.isChoicesVisible)) {
        document.body.classList.add('cursor-hidden');
      }
    });
  }

  private setupWindowResize(): void {
    const onResize = () => {
      this.overlayCanvas.width = window.innerWidth;
      this.overlayCanvas.height = window.innerHeight;
      this.joystick.updateLayout(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    onResize();
  }

  private setupStartMenu(): void {
    this.startMenu.onSelect(async (action) => {
      if (action === 'new_game') {
        gameStorage.resetSave();
        this.completedWorlds.clear();
        this.player.setSkin(1);
        this.saveGameProgress();
        this.startMenu.hide();
        this.renderer.suppressLetterbox = true;

        this.introSequence.playPreIntro(() => {
          this.loadWorld('lobby', true);
        });
      } else if (action === 'continue') {
        const save = this.loadGameProgress();
        this.startMenu.hide();
        this.renderer.suppressLetterbox = true;
        const targetWorld = save.currentWorld || 'lobby';
        await this.loadWorld(targetWorld, false);
        if (targetWorld !== 'lobby' && typeof save.playerX === 'number' && typeof save.playerY === 'number') {
          this.player.physics.x = save.playerX;
          this.player.physics.y = save.playerY;
        }
      } else if (action === 'exit') {
        alert('CyberEvolution — edukacyjna gra 2D o cyberbezpieczeństwie.\n\nSterowanie:\n• A / D lub strzałki — ruch\n• Spacja / W / ↑ — skok\n• E — interakcja z postaciami i wspinaczka po drabinach\n• 1..5 — zmiana skórki / ewolucji\n• F2 — podgląd hitboxów\n• F11 — pełny ekran');
      }
    });
  }

  public saveGameProgress(): void {
    try {
      const unlocked = { ...(gameStorage.getState().unlockedGates || {}) };
      const currentUnlocked: number[] = [];
      for (const gate of this.level.gates) {
        if (!gate.locked) {
          currentUnlocked.push(gate.id);
        }
      }
      if (currentUnlocked.length > 0) {
        unlocked[this.level.key] = currentUnlocked;
      }

      const activated = { ...(gameStorage.getState().activatedTriggers || {}) };
      const currentActivated: number[] = [];
      for (const trig of this.level.triggers) {
        if (trig.activated) {
          currentActivated.push(trig.id);
        }
      }
      if (currentActivated.length > 0) {
        activated[this.level.key] = currentActivated;
      }

      gameStorage.save({
        currentWorld: this.level.key,
        playerSkin: this.player.skinId,
        playerX: Math.round(this.player.physics.x),
        playerY: Math.round(this.player.physics.y),
        completedWorlds: Array.from(this.completedWorlds),
        unlockedGates: unlocked,
        activatedTriggers: activated,
      });
      this.startMenu.setHasSave(true);
    } catch (e) {
      console.warn('Save game error:', e);
    }
  }

  public loadGameProgress(): GameSaveData {
    const save = gameStorage.getState();
    if (save.playerSkin) {
      this.player.setSkin(save.playerSkin);
    }
    if (Array.isArray(save.completedWorlds)) {
      this.completedWorlds = new Set(save.completedWorlds);
    }
    return save;
  }

  public async init(initialWorld: string = 'lobby'): Promise<void> {
    try {
      await this.player.preloadAllSkins();
    } catch (e) {
      console.warn('Skin preload failed:', e);
    }

    const params = new URLSearchParams(window.location.search);
    if (!params.has('world')) {
      this.startMenu.show();
      this.renderer.suppressLetterbox = true;
      await this.loadWorld('lobby', false);
    } else {
      this.startMenu.hide();
      await this.loadWorld(initialWorld, false);
    }
  }

  /**
   * Seamlessly load and switch worlds (Lobby, World 1..5, World 1..5 Arena)
   */
  public async loadWorld(worldKey: string, isNewGameIntro: boolean = false): Promise<void> {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    // End active bossfight when changing world
    this.bossfight.end();

    try {
      let maskPath = '/assets/worlds/lobby/map_mask.png';
      let bgPath = '/assets/worlds/lobby/bg.png';
      let worldName = 'Cybernetyczne Lobby';
      let defaultSpawnX = 250;
      let currentWn: number | null = null;
      let isArena = false;

      const arenaMatch = worldKey.match(/^(?:world)?([1-5])_arena$/);
      const worldMatch = worldKey.match(/^(?:world)?([1-5])$/);

      if (arenaMatch) {
        // ARENA BOSSFIGHT WORLD
        currentWn = parseInt(arenaMatch[1], 10);
        isArena = true;
        maskPath = `/assets/worlds/${currentWn}/arena/map_mask.png`;
        bgPath = `/assets/worlds/${currentWn}/arena/bg.png`;
        worldName = `Arena ${currentWn}`;
        defaultSpawnX = 250;
        this.renderer.suppressLetterbox = false;
      } else if (worldMatch) {
        // STANDARD WORLD EXPLORATION
        currentWn = parseInt(worldMatch[1], 10);
        maskPath = `/assets/worlds/${currentWn}/map/map_mask.png`;
        bgPath = `/assets/worlds/${currentWn}/map/bg.png`;
        const names: Record<number, string> = {
          1: 'Świat 1: Miasto Iluzji',
          2: 'Świat 2: Krypty Kluczy',
          3: 'Świat 3: Maskarada Luster',
          4: 'Świat 4: Twierdza Kopii',
          5: 'Świat 5: CyberOtchłań',
        };
        worldName = names[currentWn] || `Świat ${currentWn}`;
        defaultSpawnX = 300;
        this.renderer.suppressLetterbox = false;

        // Load quizzes for this world
        try {
          const quizzes = await InteractionParser.loadFromFile(`/assets/worlds/${currentWn}/interactions.txt`);
          this.currentQuizzes.clear();
          for (const q of quizzes) {
            this.currentQuizzes.set(q.id, q);
          }
        } catch {
          this.currentQuizzes.clear();
        }
      } else {
        // LOBBY
        this.currentQuizzes.clear();
        this.renderer.suppressLetterbox = true;
        // After World 4 is cleared, the Sage is gone (testing us in World 5), so Lobby is empty!
        const isLobbyEmpty = this.completedWorlds.has(4) || this.player.skinId >= 5;
        bgPath = isLobbyEmpty
          ? '/assets/worlds/lobby/bg_empty.png'
          : '/assets/worlds/lobby/bg.png';
      }

      console.log(`Loading world "${worldName}" from ${maskPath}...`);
      const [maskImg, bgImg] = await Promise.all([
        MaskParser.loadImage(maskPath),
        MaskParser.loadImage(bgPath).catch(() => null),
      ]);
      const newLevel = MaskParser.parseFromImage(maskImg, worldKey, worldName);
      newLevel.backgroundImage = bgImg;

      // Load animated portal frames
      if (!isArena) {
        await this.loadPortalsForLevel(newLevel, worldKey);
      }

      // Load animated NPCs from npc_mask.png if exploration world
      if (currentWn !== null && !isArena) {
        await this.loadNpcsForLevel(newLevel, currentWn);
      }

      // Safety solid floor if none parsed
      if (newLevel.solids.length === 0) {
        newLevel.solids.push(new AABB(0, 768, Math.max(newLevel.width, 1920), 128));
      }

      // Atomically swap the level and place player with zero flicker!
      this.level = newLevel;

      // Restore unlocked gates and activated triggers from persistent storage
      const savedGates = gameStorage.getState().unlockedGates[worldKey] || [];
      for (const gId of savedGates) {
        newLevel.openGate(gId);
      }
      const savedTrigs = gameStorage.getState().activatedTriggers[worldKey] || [];
      for (const tId of savedTrigs) {
        const trig = newLevel.triggers.find((t) => t.id === tId);
        if (trig) trig.activated = true;
      }

      // Spawn positioning
      if (isArena && currentWn !== null) {
        // Arena entrance intro: compute floor ground level so player's feet are exactly on ground
        this.placePlayerOnGround(defaultSpawnX);
        const groundY = this.player.physics.y;
        this.player.physics.x = -150;
        this.player.physics.y = groundY;
        this.player.physics.vx = 260;
        this.player.physics.vy = 0;
        this.player.physics.facing = 'right';
        this.player.physics.onGround = true;
        this.player.animTimer = 0;
        this.player.runFrameIndex = 0;
        this.arenaIntroActive = true;
        this.arenaIntroWn = currentWn;
      } else if (worldKey === 'lobby') {
        // Always drop in from above on every return to lobby (1:1 with Python prototype)
        this.player.physics.x = CONFIG.LOGICAL_WIDTH / 2 - CONFIG.PLAYER_WIDTH / 2;
        this.player.physics.y = 80;
        this.player.physics.vx = 0;
        this.player.physics.vy = 0;
        this.player.physics.facing = 'left';
        this.player.physics.onGround = false;
        this.lobbyDropinActive = true;
        this.lobbyDropinLockTimer = 0.85;

        if (isNewGameIntro) {
          this.pendingLobbyDialog = 'intro';
        } else if (this.pendingSummaryWorld !== null) {
          this.pendingLobbyDialog = this.pendingSummaryWorld;
          this.pendingSummaryWorld = null;
        } else {
          this.pendingLobbyDialog = null;
        }
      } else {
        this.placePlayerOnGround(defaultSpawnX);
      }

      const effectiveWidth = this.level.getEffectiveWidth();
      this.camera.reset(this.player.physics.bounds.centerX, effectiveWidth);
      this.solidsNeedRefresh = true;

      // Handle Dialogs and Bossfight:
      if (isArena && currentWn !== null) {
        // Pre-initialize and start bossfight immediately so boss is visible as player runs in!
        await this.startBossfight(currentWn, this.arenaIntroSkipBossDialog);
      } else if (worldKey === 'lobby') {
        // Lobby dialog will trigger smoothly upon landing from drop-in!
      } else if (currentWn !== null) {
        this.playWorldIntro(currentWn, worldName);
      }

      if (!isNewGameIntro) {
        this.saveGameProgress();
      }
    } catch (e) {
      console.error(`Failed to load world "${worldKey}":`, e);
    } finally {
      this.isTransitioning = false;
    }
  }

  private async startBossfight(wn: number, skipIntro: boolean = false): Promise<void> {
    const bossSpawn = this.level.bossSpawns[0] || null;
    await this.bossfight.start(
      wn,
      bossSpawn,
      skipIntro,
      () => {
        // VICTORY: Player collected scroll (Worlds 1..4)!
        this.player.physics.vx = 0;

        this.player.evolveUp(() => {
          this.completedWorlds.add(wn);
          this.saveGameProgress();

          setTimeout(() => {
            const arenaFloor = 768;
            const portalH = 380;
            const portalW = 220;
            const centerX = Math.round((CONFIG.LOGICAL_WIDTH - portalW) / 2); // 850px, DEAD CENTER OF ARENA!
            this.level.portals.push({
              id: 'arena_return_portal',
              bounds: new AABB(centerX, arenaFloor - portalH, portalW, portalH),
              targetWorld: 'lobby',
              label: 'POWRÓT DO LOBBY',
            });
            this.loadPortalsForLevel(this.level, 'lobby');
            this.pendingSummaryWorld = wn;
          }, 400);
        });
      },
      () => {
        // DEFEAT: Show Death Menu (1:1 with Python prototype!)
        setTimeout(() => {
          this.dialog.showDeathMenu(
            () => {
              this.retryBossfight(wn);
            },
            () => {
              this.restartWorld(wn);
            }
          );
        }, 400);
      },
      () => {
        // WORLD 5 FINAL VICTORY: Mędrzec outro dialogue + Black Ending Portal!
        this.completedWorlds.add(5);
        this.saveGameProgress();
        setTimeout(() => {
          const outroText =
            this.bossfight.bossData?.outro ||
            'Udało ci się.\nZrozumiałeś, że bezpieczeństwo nie polega na strachu, ale na świadomości.\nKażdy świat był lekcją — o zaufaniu, prywatności, ochronie i odpowiedzialności.\nTeraz to ty jesteś strażnikiem swojego świata.\nCyberEwolucja nie kończy się tu… ona trwa w każdym twoim wyborze.';
          this.dialog.startBossIntro(
            'Mędrzec',
            outroText,
            5,
            () => {
              // Spawn black ending portal in dead center of arena floor
            const arenaFloor = 768;
            const portalH = 380;
            const portalW = 220;
            const centerX = Math.round((CONFIG.LOGICAL_WIDTH - portalW) / 2);
            this.level.portals.push({
              id: 'ending_portal',
              bounds: new AABB(centerX, arenaFloor - portalH, portalW, portalH),
              targetWorld: 'ending',
              label: 'WRÓĆ DO RZECZYWISTOŚCI',
            });
            this.loadPortalsForLevel(this.level, 'world5_arena');
          },
          'Zakończenie'
        );
        }, 600);
      }
    );
  }

  private retryBossfight(wn: number): void {
    this.arenaIntroSkipBossDialog = true;
    this.placePlayerOnGround(250);
    const groundY = this.player.physics.y;
    this.player.physics.x = -150;
    this.player.physics.y = groundY;
    this.player.physics.vx = 260;
    this.player.physics.vy = 0;
    this.player.physics.facing = 'right';
    this.player.physics.onGround = true;
    this.player.animTimer = 0;
    this.player.runFrameIndex = 0;
    this.arenaIntroActive = true;
    this.arenaIntroWn = wn;
    this.startBossfight(wn, true /* skipIntro */);
  }

  private restartWorld(wn: number): void {
    this.arenaIntroSkipBossDialog = false;
    this.completedWorlds.delete(wn);
    this.triggerWorldTransition(`world${wn}`);
  }

  private async loadPortalsForLevel(lvl: Level, worldKey: string): Promise<void> {
    for (const p of lvl.portals) {
      let folder = '/assets/worlds/lobby/portal';
      const tgt = p.targetWorld;

      if (tgt === 'lobby') {
        // Exit portal leading back to Lobby: ALWAYS uses Lobby's dedicated cyan vortex sprite!
        folder = '/assets/worlds/lobby/portal';
      } else if (tgt === 'ending') {
        folder = '/assets/ending/portal';
      } else if (tgt === 'dynamic_world' || worldKey === 'lobby') {
        const maxCompleted = this.completedWorlds.size > 0 ? Math.max(...Array.from(this.completedWorlds)) : 0;
        const targetWn = Math.min(5, Math.max(this.player.skinId, maxCompleted + 1));
        folder = `/assets/worlds/${targetWn}/portal`;
      } else if (tgt.startsWith('world')) {
        const wnStr = tgt.replace('world', '').replace('_arena', '');
        folder = `/assets/worlds/${wnStr}/portal`;
      } else if (worldKey.startsWith('world')) {
        const wnStr = worldKey.replace('world', '').replace('_arena', '');
        folder = `/assets/worlds/${wnStr}/portal`;
      }

      try {
        const [f1, f2] = await Promise.all([
          MaskParser.loadImage(`${folder}/frame1.png`),
          MaskParser.loadImage(`${folder}/frame2.png`),
        ]);
        p.frames = [f1, f2];
        p.frameIndex = 0;
        p.animTimer = 0;
      } catch (err) {
        console.warn(`Failed to load portal frames from ${folder}:`, err);
      }
    }
  }

  private async loadNpcsForLevel(lvl: Level, wn: number): Promise<void> {
    const npcMaskUrl = `/assets/worlds/${wn}/npc/npc_mask.png`;
    try {
      const maskImg = await MaskParser.loadImage(npcMaskUrl);
      const spawns = MaskParser.parseNpcSpawns(maskImg);

      for (const sp of spawns) {
        const npcFolder = `/assets/worlds/${wn}/npc/npc${sp.id}`;
        let frames: [HTMLImageElement, HTMLImageElement] | null = null;
        try {
          const [f1, f2] = await Promise.all([
            MaskParser.loadImage(`${npcFolder}/npc1.png`),
            MaskParser.loadImage(`${npcFolder}/npc2.png`),
          ]);
          frames = [f1, f2];
        } catch {
          // Fallback
        }

        lvl.npcs.push({
          id: sp.id,
          bounds: sp.bounds,
          frames,
          frameIndex: 0,
          animTimer: 0,
        });
      }
    } catch {
      // NPC mask may not exist
    }
  }

  private async playGameIntroDialog(): Promise<void> {
    try {
      const res = await fetch('/assets/game_intro_dialog.txt');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const raw = await res.text();
      const lines = this.parseConversationLines(raw);

      this.dialog.startConversation('Wstęp', lines, this.player.skinId, this.player.physics.y);
    } catch (e) {
      console.warn('Game intro dialog load failed:', e);
    }
  }

  private async playWorldSummaryDialog(wn: number): Promise<void> {
    try {
      const res = await fetch(`/assets/worlds/${wn}/summary.txt`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const raw = await res.text();
      const lines = this.parseConversationLines(raw);

      this.dialog.startConversation(`Podsumowanie: Świat ${wn}`, lines, this.player.skinId, this.player.physics.y, () => {
        if (wn === 5) {
          setTimeout(() => {
            this.introSequence.playEnding(() => {
              this.startMenu.show();
            });
          }, 800);
        }
      });
    } catch (e) {
      console.warn('World summary load failed:', e);
    }
  }

  private async playWorldIntro(wn: number, title: string): Promise<void> {
    try {
      const res = await fetch(`/assets/worlds/${wn}/intro.txt`);
      if (!res.ok) return;
      const raw = await res.text();
      const lines = raw.split('\n');
      let introText = '';
      let worldNameFound = '';
      for (const ln of lines) {
        const trimmed = ln.trim();
        if (trimmed.toUpperCase().startsWith('WORLDNAME:')) {
          worldNameFound = trimmed.replace(/^WORLDNAME:\s*/i, '').trim();
        } else if (trimmed.toUpperCase().startsWith('INTROTEXT:')) {
          introText = trimmed.replace(/^INTROTEXT:\s*/i, '').trim();
        } else if (introText && !trimmed.toUpperCase().startsWith('WORLDNAME:')) {
          introText += '\n' + trimmed;
        }
      }

      if (introText) {
        // 1.5s steady + 0.6s smooth fade out = 2.1s total (1:1 with Python INTRO_TITLE_TIME + INTRO_FADE_TIME)
        // Title displays ONLY the pure world name (e.g. "Miasto Iluzji"), NOT "Świat 1: Miasto Iluzji"!
        this.worldIntroTitle = worldNameFound || title.replace(/^Świat \d+:\s*/, '');
        this.worldIntroTimer = 2.1;
        this.pendingWorldIntroText = introText;
        this.worldIntroWn = wn;
      }
    } catch {
      // Ignore
    }
  }

  private parseConversationLines(raw: string): ConversationLine[] {
    const lines: ConversationLine[] = [];
    const rawLines = raw.split('\n');

    for (const r of rawLines) {
      const trimmed = r.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const m = trimmed.match(/^([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż_]+)\s*:\s*(.*)$/);
      if (m) {
        const spk = m[1].trim().toLowerCase();
        const txt = m[2].trim().replace(/\\n/g, '\n');
        lines.push({
          speaker: spk === 'player' || spk === 'gracz' ? 'player' : 'medrzec',
          text: txt,
        });
      }
    }
    return lines;
  }

  private placePlayerOnGround(spawnX: number): void {
    let bestFloorTop = CONFIG.PLAY_HEIGHT - 100;
    for (const solid of this.level.solids) {
      if (spawnX + CONFIG.PLAYER_WIDTH > solid.left && spawnX < solid.right) {
        if (solid.top < bestFloorTop && solid.top > 100) {
          bestFloorTop = solid.top;
        }
      }
    }
    this.player.physics.x = spawnX;
    this.player.physics.y = bestFloorTop - CONFIG.PLAYER_HEIGHT;
    this.player.physics.vx = 0;
    this.player.physics.vy = 0;
    this.player.physics.onGround = true;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private loop(currentTime: number): void {
    if (!this.isRunning) return;

    const rawDt = Math.min((currentTime - this.lastTime) / 1000, 0.04);
    this.lastTime = currentTime;

    this.frameCount++;
    this.fpsTimer += rawDt;
    if (this.fpsTimer >= 0.5) {
      this.fps = this.frameCount / this.fpsTimer;
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    // Screen wipe transition handling (1:1 with Python wipe_out_down / wipe_in_down)
    if (this.transitionState === 'wipe_out') {
      this.transitionTimer += rawDt;
      if (this.transitionTimer >= this.transitionDuration) {
        this.transitionTimer = this.transitionDuration;
        if (this.pendingWorldSwitch) {
          const target = this.pendingWorldSwitch;
          this.pendingWorldSwitch = null;
          if (target === 'ending') {
            this.transitionState = 'none';
            this.introSequence.playEnding(() => {
              this.startMenu.show();
            });
          } else {
            this.loadWorld(target).then(() => {
              this.transitionState = 'wipe_in';
              this.transitionTimer = 0;
            });
          }
        }
      }
    } else if (this.transitionState === 'wipe_in') {
      this.transitionTimer += rawDt;
      if (this.transitionTimer >= this.transitionDuration) {
        this.transitionState = 'none';
        this.transitionTimer = 0;
      }
    }

    if (this.transitionState !== 'wipe_out') {
      const maxSubstep = 0.010;
      const substeps = Math.max(1, Math.ceil(rawDt / maxSubstep));
      const subDt = rawDt / substeps;

      for (let i = 0; i < substeps; i++) {
        this.updatePhysics(subDt);
      }

      // Bossfight logic update
      this.bossfight.update(rawDt, this.player);

      const effectiveWidth = this.level.getEffectiveWidth();
      this.camera.update(
        this.player.physics.bounds.centerX,
        this.player.physics.bounds.centerY,
        effectiveWidth,
        rawDt
      );
    }

    const introAlpha = this.worldIntroTimer > 0
      ? Math.min(1.0, this.worldIntroTimer / 0.6)
      : 0;

    this.renderer.render(
      this.level,
      this.player,
      this.camera,
      rawDt,
      this.fps,
      this.activeHint,
      this.bossfight,
      this.worldIntroTitle,
      introAlpha,
      this.transitionState,
      this.transitionTimer / this.transitionDuration
    );

    // Overlay touch controls
    this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    if (!this.startMenu.isOpen && !this.dialog.isOpen && !this.introSequence.isActive) {
      this.joystick.renderOverlay(this.overlayCtx);
    }

    requestAnimationFrame((t) => this.loop(t));
  }

  private updatePhysics(dt: number): void {
    if (this.startMenu.isOpen || this.introSequence.isActive) return;

    // 1. World Intro Title Timer (3 seconds centered in yellow #fff0a0)
    if (this.worldIntroTimer > 0) {
      this.worldIntroTimer -= dt;
      const raw = this.input.getMovementInput();
      if (raw.jumpPressed || raw.interactPressed) {
        this.worldIntroTimer = 0;
      }
      if (this.worldIntroTimer <= 0) {
        const title = this.worldIntroTitle || 'Wstęp';
        this.worldIntroTitle = null;
        this.dialog.startWorldIntro(title, this.pendingWorldIntroText, this.worldIntroWn);
      }
      return;
    }

    // 2. Arena Intro run-in animation (calm walk into arena at 260 px/s until x=300)
    if (this.arenaIntroActive) {
      const step = 260 * dt;
      if (this.player.physics.x + step >= 300) {
        this.player.physics.x = 300;
        this.player.physics.vx = 0;
        this.player.physics.facing = 'right';
        this.player.physics.onGround = true;
        this.player.runFrameIndex = 0;
        this.arenaIntroActive = false;
        if (this.arenaIntroWn !== null) {
          if (!this.arenaIntroSkipBossDialog && this.bossfight.bossData?.intro) {
            const bData = this.bossfight.bossData;
            this.dialog.startBossIntro(bData.name, bData.intro, this.arenaIntroWn, () => {
              this.bossfight.finishIntro();
            });
          } else {
            this.bossfight.finishIntro();
          }
        }
      } else {
        this.player.physics.x += step;
        this.player.physics.vx = 260;
        this.player.physics.facing = 'right';
        this.player.physics.onGround = true;
        // Advance player run animation so player actually runs at authentic calm pace
        this.player.animTimer += dt;
        if (this.player.animTimer >= 0.28) {
          this.player.runFrameIndex = (this.player.runFrameIndex + 1) % 2;
          this.player.animTimer = 0;
        }
      }
      return;
    }

    // 3. Update Bossfight
    if (this.bossfight.active) {
      this.bossfight.update(dt, this.player);
    }

    // Debug toggle
    if (this.input.debugToggleTriggered) {
      this.renderer.showDebug = !this.renderer.showDebug;
      this.joystick.forceDebugVisible = this.renderer.showDebug;
      this.input.debugToggleTriggered = false;
    }

    if (this.input.selectedSkin !== null) {
      this.player.setSkin(this.input.selectedSkin);
      if (this.level.key === 'lobby') {
        this.loadPortalsForLevel(this.level, 'lobby');
      }
      this.input.selectedSkin = null;
    }

    // Lobby drop-in landing check (1:1 with Python: player falls in from top, lock input until landing)
    if (this.lobbyDropinActive) {
      if (this.lobbyDropinLockTimer > 0) {
        this.lobbyDropinLockTimer -= dt;
      }
      if (this.player.physics.onGround && this.lobbyDropinLockTimer <= 0) {
        this.lobbyDropinActive = false;
        if (this.pendingLobbyDialog === 'intro') {
          setTimeout(() => this.playGameIntroDialog(), 250);
          this.pendingLobbyDialog = null;
        } else if (typeof this.pendingLobbyDialog === 'number') {
          const wn = this.pendingLobbyDialog;
          this.pendingLobbyDialog = null;
          setTimeout(() => this.playWorldSummaryDialog(wn), 250);
        }
      }
    }

    // When dialog is open OR during active bossfight OR during lobby drop-in OR respawn/evo blinking, controls are locked!
    // (1:1 with Python prototype: cannot move, cannot jump while fighting boss, respawning or evolving)
    const rawInput = this.input.getMovementInput();
    const isControlLocked = this.dialog.isOpen ||
      (this.bossfight.active && !this.bossfight.bossDefeated) ||
      this.lobbyDropinActive ||
      this.player.physics.respawnState === 'blinking' ||
      this.player.evoBlinkActive;
    if (isControlLocked) {
      this.player.physics.vx = 0;
    }
    const movementInput = isControlLocked
      ? { moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, interactPressed: false }
      : rawInput;

    if (this.solidsNeedRefresh) {
      this.cachedSolids = this.level.getActiveSolids();
      this.solidsNeedRefresh = false;
    }

    const effectiveWidth = this.level.getEffectiveWidth();
    this.player.update(dt, movementInput, this.cachedSolids, this.level.ladders, effectiveWidth);
    if (this.player.physics.bounds.right > effectiveWidth) {
      this.player.physics.x = effectiveWidth - this.player.physics.width;
      this.player.physics.vx = 0;
    }

    // Check interaction hints and triggers
    this.checkHintsAndInteractions(rawInput.interactPressed);
  }

  public triggerWorldTransition(targetWorld: string): void {
    if (this.transitionState !== 'none') return;
    this.transitionState = 'wipe_out';
    this.transitionTimer = 0;
    this.pendingWorldSwitch = targetWorld;
  }

  private checkHintsAndInteractions(interactPressed: boolean): void {
    this.activeHint = null;
    const playerBounds = this.player.bounds;
    const isGrounded = this.player.physics.onGround;

    // 1. Ladder hint
    const ladder = this.level.ladders.find((lad) => lad.bounds.intersects(playerBounds));
    if (ladder && !this.player.physics.isClimbing && this.player.physics.climbStepout <= 0 && this.player.physics.ladderHoverTime >= CONFIG.LADDER_INTERACT_DELAY) {
      this.activeHint = 'E: wspinaj się';
    }

    // 2. Arena entrance zones (World -> Bossfight Arena, 1:1 with Python prototype)
    // Automatic on boundary crossing: NO HINT BUBBLE, NO BLACK SCREEN WIPE!
    if (!this.level.key.endsWith('_arena') && this.level.key !== 'lobby') {
      for (const arenaZone of this.level.arenaZones) {
        if (playerBounds.intersects(arenaZone)) {
          // Do NOT set this.activeHint (automatic transition, no prompt needed)
          if (interactPressed || playerBounds.centerX >= arenaZone.centerX) {
            const m = this.level.key.match(/^(?:world)?([1-5])$/);
            const wn = m ? m[1] : '1';
            // Immediate arena load without curtain wipe!
            this.loadWorld(`world${wn}_arena`);
            return;
          }
        }
      }
    }

    // 3. Portal hint & interaction
    for (const portal of this.level.portals) {
      if (playerBounds.intersects(portal.bounds)) {
        const isArena = portal.targetWorld === 'arena';
        const isLobby = portal.targetWorld === 'lobby';
        const isEnding = portal.targetWorld === 'ending';
        this.activeHint = isEnding
          ? 'E: wróć do rzeczywistości'
          : isLobby
          ? 'E: powrót do lobby'
          : isArena
          ? 'E: wejdź do areny'
          : 'E: wejdź do świata';

        if (interactPressed) {
          let target = portal.targetWorld;
          if (target === 'ending') {
            this.triggerWorldTransition('ending');
            return;
          }
          if (target === 'dynamic_world') {
            const maxCompleted = this.completedWorlds.size > 0 ? Math.max(...Array.from(this.completedWorlds)) : 0;
            const targetWn = Math.min(5, Math.max(this.player.skinId, maxCompleted + 1));
            target = `world${targetWn}`;
          } else if (target === 'arena') {
            const m = this.level.key.match(/^(?:world)?([1-5])$/);
            const wn = m ? m[1] : '1';
            target = `world${wn}_arena`;
          }
          this.triggerWorldTransition(target);
          return;
        }
      }
    }

    // 3. NPC / Trigger interaction
    // Must be GROUNDED and FULLY INSIDE trigger bounds (1:1 with Python prototype!)
    for (const trigger of this.level.triggers) {
      if (!trigger.activated && trigger.bounds.contains(playerBounds)) {
        if (isGrounded) {
          this.activeHint = 'E: porozmawiaj';
          if (interactPressed) {
            this.openSecurityQuiz(trigger.id);
            return;
          }
        }
      }
    }
  }

  public openSecurityQuiz(triggerId: number): void {
    const quiz = this.currentQuizzes.get(triggerId);

    if (quiz) {
      this.dialog.startQuiz(
        {
          title: this.level.name || 'Wybór reakcji',
          avatar: quiz.avatar,
          context: quiz.context,
          sageMessage: quiz.sageMessage,
          optionA: quiz.optionA,
          optionB: quiz.optionB,
          correctOption: quiz.correctOption,
          goodFeedback: quiz.goodFeedback,
          badFeedback: quiz.badFeedback,
          onSuccess: () => {
            this.level.openGate(triggerId);
            this.solidsNeedRefresh = true;
            const trig = this.level.triggers.find((t) => t.id === triggerId);
            if (trig) trig.activated = true;
            gameStorage.markGateUnlocked(this.level.key, triggerId);
            gameStorage.markTriggerActivated(this.level.key, triggerId);
            this.saveGameProgress();
          },
        },
        this.player.skinId,
        this.player.physics.y
      );
      return;
    }

    // Fallback quiz
    this.dialog.startQuiz(
      {
        title: this.level.name || 'Wybór reakcji',
        avatar: 'mail',
        context: 'Otrzymujesz pilną wiadomość z prośbą o natychmiastowe kliknięcie linku i potwierdzenie danych logowania pod groźbą zablokowania konta.',
        sageMessage: 'Instytucje i serwisy nigdy nie wywierają sztucznej presji czasu ani nie żądają haseł przez linki.',
        optionA: 'Klikam w link i szybko wpisuję hasło, by nie zablokować konta.',
        optionB: 'Ignoruję link i weryfikuję powiadomienie bezpośrednio na oficjalnej stronie serwisu.',
        correctOption: 'B',
        goodFeedback: 'Znakomity wybór! Rozpoznałeś socjotechnikę i presję czasu. Twoje konto jest bezpieczne.',
        badFeedback: 'To pułapka phishingowa! Przekazanie hasła dałoby oszustom pełny dostęp do Twojego profilu.',
        onSuccess: () => {
          this.level.openGate(triggerId);
          this.solidsNeedRefresh = true;
          const trig = this.level.triggers.find((t) => t.id === triggerId);
          if (trig) trig.activated = true;
          gameStorage.markGateUnlocked(this.level.key, triggerId);
          gameStorage.markTriggerActivated(this.level.key, triggerId);
          this.saveGameProgress();
        },
      },
      this.player.skinId,
      this.player.physics.y
    );
  }
}
