import './style.css';
import { Engine } from './core/Engine';
import { sound } from './core/Audio';
import { isMobileDevice, isPortrait } from './core/Device';
import { toggleGameFullscreen } from './fullscreen';
import { gameStorage } from './storage';
import { initPWA } from './pwa';

function shouldIgnoreError(msg: unknown): boolean {
  if (!msg) return true;
  const s = String(msg).toLowerCase();
  return (
    s.includes('script error') ||
    s.includes('resizeobserver') ||
    s.includes('notsupportederror') ||
    s.includes('notallowederror') ||
    s.includes('fullscreen') ||
    s.includes('orientation') ||
    s.includes('failed') ||
    s.includes('user denied')
  );
}

function showError(msg: string) {
  if (shouldIgnoreError(msg)) return;
  const banner = document.getElementById('error-banner');
  if (banner) {
    banner.textContent = msg;
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 8000);
  }
  console.error(msg);
}

window.addEventListener('error', (e) => {
  if (shouldIgnoreError(e.message || e)) return;
  showError(`Runtime error: ${e.message}`);
});
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason?.message || e.reason;
  if (shouldIgnoreError(reason)) return;
  showError(`Async error: ${reason}`);
});

function setupOrientationWatcher() {
  const overlay = document.getElementById('rotate-device-overlay');
  const check = () => {
    if (!overlay) return;
    if (isMobileDevice() && isPortrait()) {
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  };

  window.addEventListener('resize', check);
  window.addEventListener('orientationchange', check);
  check();
}

async function bootstrap() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const uiContainer = document.getElementById('ui-container') as HTMLElement;
  const mobileTopBar = document.getElementById('mobile-top-bar') as HTMLElement;
  const fullscreenBtn = document.getElementById('btn-fullscreen') as HTMLButtonElement;
  const audioBtn = document.getElementById('btn-audio') as HTMLButtonElement;
  const helpBtn = document.getElementById('btn-help') as HTMLButtonElement;
  const debugBtn = document.getElementById('btn-toggle-debug') as HTMLButtonElement;
  const skinBtn = document.getElementById('btn-cycle-skin') as HTMLButtonElement;
  const worldBtn = document.getElementById('btn-switch-world') as HTMLButtonElement;

  if (!canvas || !uiContainer) {
    throw new Error('Canvas or UI container not found.');
  }

  // Monitorowanie orientacji (blokada widoku pionowego na telefonach)
  setupOrientationWatcher();

  // Zabezpieczenie przed menu kontekstowym i lupą powiększającą na iOS
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  }, { passive: false });

  // Inicjalizacja modułu PWA i Service Workera (zgodna z HTTP i gotowa na HTTPS)
  initPWA();

  // Prośba o ochronę zapisu gry przed czyszczeniem pamięci (Persistent Storage API)
  gameStorage.requestPersistentStorage().catch(() => {});

  // Font loading with short timeout - never block on this
  try {
    await Promise.race([
      document.fonts?.load?.('16px "Jersey 10"') ?? Promise.resolve(),
      document.fonts?.ready ?? Promise.resolve(),
      new Promise((r) => setTimeout(r, 600)),
    ]);
  } catch {
    /* ignore font failures */
  }

  const params = new URLSearchParams(window.location.search);
  const initialWorld = params.get('world') || 'lobby';

  const engine = new Engine(canvas, uiContainer);
  await engine.init(initialWorld);

  // Fullscreen controls
  const toggleFs = async () => {
    await toggleGameFullscreen('landscape');
  };
  fullscreenBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await toggleFs();
  });

  // Skróty klawiszowe F11 i F dla komputerów (desktop)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F11') {
      e.preventDefault();
      toggleFs();
    }
    if (e.code === 'KeyF' && !engine.dialog.isOpen && !engine.startMenu.isOpen && !engine.isPaused && !engine.infoModal.isOpen) {
      toggleFs();
    }
  });

  // Audio mute toggle
  audioBtn?.addEventListener('click', () => {
    const isMuted = sound.toggleMute();
    audioBtn.textContent = isMuted ? '🔇' : '🔊';
    audioBtn.title = isMuted ? 'Włącz dźwięk' : 'Wycisz dźwięk';
    engine.pauseModal.updateSoundLabel(isMuted);
  });

  // Help & Info modal
  helpBtn?.addEventListener('click', () => {
    engine.infoModal.show();
  });

  // World switching (dev button)
  worldBtn?.addEventListener('click', () => {
    const nextKey = engine.level.key === 'lobby' ? 'world1' : 'lobby';
    engine.loadWorld(nextKey);
    if (worldBtn) worldBtn.textContent = nextKey === 'lobby' ? 'Świat: Lobby' : 'Świat: 1';
  });

  // Skin cycling (dev button)
  let currentSkin = engine.player.skinId || 1;
  skinBtn?.addEventListener('click', () => {
    currentSkin = (currentSkin % 5) + 1;
    engine.player.setSkin(currentSkin);
    skinBtn.textContent = `Skin: ${currentSkin}`;
    engine.saveGameProgress();
  });

  // Debug toggle (sync UI with F2 keyboard shortcut)
  const syncDebugUI = () => {
    const isDbg = engine.renderer.showDebug;
    engine.joystick.forceDebugVisible = isDbg;
    if (debugBtn) debugBtn.style.color = isDbg ? '#22c55e' : '#00e5ff';
    if (mobileTopBar) {
      mobileTopBar.classList.toggle('hidden', !isDbg);
    }
  };

  debugBtn?.addEventListener('click', () => {
    engine.renderer.showDebug = !engine.renderer.showDebug;
    syncDebugUI();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'F2') {
      setTimeout(syncDebugUI, 20);
    }
  });

  (window as any).engine = engine;

  // Sync world button label with initial world
  if (worldBtn) worldBtn.textContent = initialWorld === 'lobby' ? 'Świat: Lobby' : `Świat: ${initialWorld}`;

  if (params.has('skin')) {
    const s = parseInt(params.get('skin')!, 10);
    if (s >= 1 && s <= 5) {
      currentSkin = s;
      engine.player.setSkin(s);
      if (skinBtn) skinBtn.textContent = `Skin: ${s}`;
    }
  }
  if (params.get('debug') === '1') {
    engine.renderer.showDebug = true;
    syncDebugUI();
  }
  if (params.has('x')) {
    const targetX = parseFloat(params.get('x')!);
    engine.player.physics.x = targetX;
  }
  if (params.has('quiz')) {
    const qId = parseInt(params.get('quiz')!, 10);
    setTimeout(() => {
      engine.openSecurityQuiz(qId);
    }, 150);
  }

  engine.start();
  console.log('🚀 CyberEvolution: Ścieżka Świadomości uruchomiona!');
}

bootstrap().catch((err) => {
  showError(`Init error: ${err?.message || err}`);
});
