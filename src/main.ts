import { Engine } from './core/Engine';

function showError(msg: string) {
  const banner = document.getElementById('error-banner');
  if (banner) {
    banner.textContent = msg;
    banner.classList.remove('hidden');
  }
  console.error(msg);
}

window.addEventListener('error', (e) => {
  showError(`Błąd runtime: ${e.message} (${e.filename}:${e.lineno})`);
});

window.addEventListener('unhandledrejection', (e) => {
  showError(`Błąd asynchroniczny: ${e.reason}`);
});

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}

async function bootstrap() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const uiContainer = document.getElementById('ui-container') as HTMLElement;
  const mobileTopBar = document.getElementById('mobile-top-bar') as HTMLElement;
  const fullscreenBtn = document.getElementById('btn-fullscreen') as HTMLButtonElement;
  const debugBtn = document.getElementById('btn-toggle-debug') as HTMLButtonElement;
  const skinBtn = document.getElementById('btn-cycle-skin') as HTMLButtonElement;

  if (!canvas || !uiContainer) {
    throw new Error('Canvas or UI container element not found in DOM.');
  }

  // Detect touch device
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouch) {
    mobileTopBar?.classList.remove('hidden');
  } else {
    mobileTopBar?.classList.add('hidden'); // Clean PC experience
  }

  // Pre-load font with safety timeout so mobile never hangs
  const fontPromise = document.fonts ? document.fonts.load('16px "Pixel Emulator"') : Promise.resolve();
  const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 800));
  await Promise.race([fontPromise, timeoutPromise]);

  const engine = new Engine(canvas, uiContainer);
  await engine.init();

  // Fullscreen controls
  fullscreenBtn?.addEventListener('click', () => {
    toggleFullscreen();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'F11' || (e.code === 'KeyF' && !engine.dialog.isOpen)) {
      e.preventDefault();
      toggleFullscreen();
    }
  });

  // Cycle skin button
  let currentSkin = 1;
  skinBtn?.addEventListener('click', () => {
    currentSkin = (currentSkin % 5) + 1;
    engine.player.setSkin(currentSkin);
    skinBtn.textContent = `Skin: ${currentSkin}`;
  });

  // Toggle debug button
  const updateDebugUI = () => {
    const isDbg = engine.renderer.showDebug;
    engine.joystick.forceDebugVisible = isDbg;
    if (debugBtn) {
      debugBtn.style.color = isDbg ? '#22c55e' : '#00e5ff';
    }
    if (!isTouch && mobileTopBar) {
      // On PC: show top bar and virtual joystick only when F2 debug is enabled!
      if (isDbg) {
        mobileTopBar.classList.remove('hidden');
      } else {
        mobileTopBar.classList.add('hidden');
      }
    }
  };

  debugBtn?.addEventListener('click', () => {
    engine.renderer.showDebug = !engine.renderer.showDebug;
    updateDebugUI();
  });

  // Keyboard F2 sync
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F2') {
      setTimeout(() => updateDebugUI(), 10);
    }
  });

  engine.start();
  console.log('🚀 CyberEvolution engine running!');
}

bootstrap().catch((err) => {
  showError(`Błąd inicjalizacji: ${err.message || err}`);
});
