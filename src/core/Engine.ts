import { CONFIG } from './Constants';
import { Level } from '../world/Level';
import { MaskParser } from '../world/MaskParser';
import { Player } from '../entities/Player';
import { Camera } from './Camera';
import { InputManager } from './Input';
import { Renderer } from '../graphics/Renderer';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { InteractionDialog } from '../ui/InteractionDialog';
import { AABB } from '../physics/AABB';

export class Engine {
  public canvas: HTMLCanvasElement;
  public renderer: Renderer;
  public input: InputManager;
  public camera: Camera;
  public player: Player;
  public level: Level;
  public dialog: InteractionDialog;
  public joystick: VirtualJoystick;

  private isRunning: boolean = false;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly fixedDt: number = 1 / 60; // 60Hz deterministic physics tick

  private fps: number = 60;
  private frameCount: number = 0;
  private fpsTimer: number = 0;

  constructor(canvas: HTMLCanvasElement, uiContainer: HTMLElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new InputManager();
    this.camera = new Camera(CONFIG.LOGICAL_WIDTH, CONFIG.PLAY_HEIGHT);
    this.player = new Player(250, 500);
    this.level = new Level('default', 'Lobby Cybernetyczne');
    this.dialog = new InteractionDialog(uiContainer);
    this.joystick = new VirtualJoystick(uiContainer);
    this.input.setVirtualJoystick(this.joystick);

    this.setupWindowResize();
  }

  private setupWindowResize(): void {
    const onResize = () => {
      this.renderer.resize(window.innerWidth, window.innerHeight);
      this.joystick.updateLayout(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    onResize();
  }

  /**
   * Initialize the game: load player skins, masks, and backgrounds
   */
  public async init(): Promise<void> {
    // 1. Preload skin 1
    await this.player.loadSkin(1);

    // 2. Try to load level mask from assets/worlds/lobby/map_mask.png
    try {
      const maskImg = await MaskParser.loadImage('/assets/worlds/lobby/map_mask.png');
      this.level = MaskParser.parseFromImage(maskImg, 'lobby', 'Lobby Cybernetyczne');

      // Try load background
      try {
        const bgImg = await MaskParser.loadImage('/assets/worlds/lobby/bg.png');
        this.level.backgroundImage = bgImg;
      } catch {
        console.warn('Lobby bg image not found, using procedural grid.');
      }
    } catch (e) {
      console.warn('Could not parse mask image, building fallback test level:', e);
      this.buildFallbackLevel();
    }

    // Set player spawn
    this.player.physics.x = this.level.spawnX || 250;
    this.player.physics.y = this.level.spawnY || 500;
  }

  /**
   * Procedural level with platforms, ladders, gates, and triggers if mask is missing
   */
  private buildFallbackLevel(): void {
    const lvl = new Level('lobby', 'Lobby Cybernetyczne', 3840, CONFIG.PLAY_HEIGHT, 200, 600);

    // Solid ground
    lvl.solids.push(new AABB(0, 800, 3840, 96));

    // Stepped platforms (testing stair-stepping and jumping)
    lvl.solids.push(new AABB(500, 768, 160, 32)); // 32px step
    lvl.solids.push(new AABB(660, 736, 160, 32)); // another 32px step
    lvl.solids.push(new AABB(1000, 600, 300, 32)); // high platform
    lvl.solids.push(new AABB(1400, 480, 260, 32)); // higher platform

    // Ladder leading to high platform
    lvl.ladders.push({
      bounds: new AABB(1080, 600, 48, 200),
    });

    // Gate blocking next section
    lvl.gates.push({
      id: 1,
      bounds: new AABB(1900, 600, 48, 200),
      locked: true,
    });

    // Trigger zone before the gate
    lvl.triggers.push({
      id: 1,
      bounds: new AABB(1650, 700, 100, 100),
      interactionId: 1,
      label: 'Zagadka Bezpieczeństwa',
      activated: false,
    });

    // Portal at the end
    lvl.portals.push({
      id: 'portal_world1',
      bounds: new AABB(2400, 672, 80, 128),
      targetWorld: 'world1',
      label: 'PORTAL DO ŚWIATA 1',
    });

    this.level = lvl;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private loop(currentTime: number): void {
    if (!this.isRunning) return;

    const frameTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap delta to avoid spiral of death
    this.lastTime = currentTime;

    // FPS calculation
    this.frameCount++;
    this.fpsTimer += frameTime;
    if (this.fpsTimer >= 0.5) {
      this.fps = this.frameCount / this.fpsTimer;
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    // Fixed timestep accumulator
    this.accumulator += frameTime;
    while (this.accumulator >= this.fixedDt) {
      this.fixedUpdate(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    // Render pass
    this.camera.update(
      this.player.physics.bounds.centerX,
      this.player.physics.bounds.centerY,
      this.level.width,
      frameTime
    );

    this.renderer.render(this.level, this.player, this.camera, frameTime, this.fps);

    // Render virtual joystick on canvas
    this.joystick.render(this.renderer.ctx);

    requestAnimationFrame((t) => this.loop(t));
  }

  private fixedUpdate(dt: number): void {
    // Check hotkeys
    if (this.input.debugToggleTriggered) {
      this.renderer.showDebug = !this.renderer.showDebug;
      this.input.debugToggleTriggered = false;
    }

    if (this.input.selectedSkin !== null) {
      this.player.setSkin(this.input.selectedSkin);
      this.input.selectedSkin = null;
    }

    // Pause player movement if a dialog modal is open
    if (this.dialog.isOpen) {
      return;
    }

    const movementInput = this.input.getMovementInput();
    const activeSolids = this.level.getActiveSolids();

    // Update Player
    this.player.update(dt, movementInput, activeSolids, this.level.ladders, this.level.width);

    // Check interaction with triggers
    if (movementInput.interactPressed) {
      this.handleInteractions();
    }
  }

  private handleInteractions(): void {
    const playerBounds = this.player.bounds;

    // Check Triggers
    for (const trigger of this.level.triggers) {
      if (playerBounds.intersects(trigger.bounds)) {
        this.openSecurityQuiz(trigger.id);
        return;
      }
    }

    // Check Portals
    for (const portal of this.level.portals) {
      if (playerBounds.intersects(portal.bounds)) {
        // Flash / Teleport effect
        this.player.physics.x = 300;
        this.player.physics.y = 500;
        this.player.physics.vx = 0;
        this.player.physics.vy = 0;
        alert(`Aktywowano portal: ${portal.label || portal.targetWorld}! W pełnej grze przenosi do kolejnego świata.`);
        return;
      }
    }
  }

  private openSecurityQuiz(triggerId: number): void {
    if (triggerId === 1) {
      this.dialog.show({
        title: 'STREFA BEZPIECZEŃSTWA: PHISHING',
        context: "Kurier wysłał SMS: 'Brakuje 3,50 zł do doręczenia paczki. Kliknij link w wiadomości.'",
        sageMessage: 'Prawdziwe firmy nigdy nie żądają dopłat przez niesprawdzone linki w SMS!',
        optionA: 'Klikam link i natychmiast płacę.',
        optionB: 'Wchodzę ręcznie na oficjalną stronę firmy kurierskiej lub sprawdzam w aplikacji.',
        correctOption: 'B',
        goodFeedback: 'Znakomity wybór! Nigdy nie otwieraj podejrzanych linków z SMS.',
        badFeedback: 'Niebezpieczeństwo! Fałszywy link prowadzi do kradzieży danych logowania.',
        onSuccess: () => {
          this.level.openGate(1);
          const trig = this.level.triggers.find((t) => t.id === triggerId);
          if (trig) trig.activated = true;
        },
      });
    } else {
      this.dialog.show({
        title: 'STREFA BEZPIECZEŃSTWA: HASŁA',
        context: 'Tworzysz nowe konto w kluczowym serwisie internetowym.',
        sageMessage: 'Dobre hasło to podstawa Twojej cyfrowej tożsamości.',
        optionA: 'Używam tego samego łatwego hasła co wszędzie (np. 123456).',
        optionB: 'Tworzę unikalne, długie hasło i włączam weryfikację dwuetapową (2FA).',
        correctOption: 'B',
        goodFeedback: 'Brawo! 2FA i unikalne hasło to najlepsza obrona.',
        badFeedback: 'To ogromne ryzyko – wyciek z jednego serwisu narazi wszystkie Twoje konta.',
        onSuccess: () => {
          this.level.openGate(triggerId);
        },
      });
    }
  }
}
