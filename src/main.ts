import { Engine } from './core/Engine';

function showError(msg: string) {
  const banner = document.getElementById('error-banner');
  if (banner) {
    banner.textContent = msg;
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 8000);
  }
  console.error(msg);
}

window.addEventListener('error', (e) => {
  showError(`Runtime error: ${e.message}`);
});
window.addEventListener('unhandledrejection', (e) => {
  showError(`Async error: ${e.reason}`);
});

function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    el.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
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
    throw new Error('Canvas or UI container not found.');
  }

  // Show top bar on touch devices, hidden on PC until F2
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (isTouch) {
    mobileTopBar?.classList.remove('hidden');
  }

  // Font loading with short timeout — never block on this
  try {
    await Promise.race([
      document.fonts?.load?.('16px "Jersey 10"') ?? Promise.resolve(),
      document.fonts?.ready ?? Promise.resolve(),
      new Promise(r => setTimeout(r, 600)),
    ]);
  } catch { /* ignore font failures */ }

  const params = new URLSearchParams(window.location.search);
  const initialWorld = params.get('world') || 'lobby';

  const engine = new Engine(canvas, uiContainer);
  await engine.init(initialWorld);

  // Fullscreen
  fullscreenBtn?.addEventListener('click', toggleFullscreen);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F11') { e.preventDefault(); toggleFullscreen(); }
    if (e.code === 'KeyF' && !engine.dialog.isOpen) { toggleFullscreen(); }
  });

  // World switching
  const worldBtn = document.getElementById('btn-switch-world') as HTMLButtonElement;
  worldBtn?.addEventListener('click', () => {
    const nextKey = engine.level.key === 'lobby' ? 'world1' : 'lobby';
    engine.loadWorld(nextKey);
    if (worldBtn) worldBtn.textContent = nextKey === 'lobby' ? 'Świat: Lobby' : 'Świat: 1';
  });

  // Skin cycling
  let currentSkin = 1;
  skinBtn?.addEventListener('click', () => {
    currentSkin = (currentSkin % 5) + 1;
    engine.player.setSkin(currentSkin);
    skinBtn.textContent = `Skin: ${currentSkin}`;
  });

  // Debug toggle (sync UI with F2 keyboard shortcut)
  const syncDebugUI = () => {
    const isDbg = engine.renderer.showDebug;
    engine.joystick.forceDebugVisible = isDbg;
    if (debugBtn) debugBtn.style.color = isDbg ? '#22c55e' : '#00e5ff';
    if (!isTouch && mobileTopBar) {
      mobileTopBar.classList.toggle('hidden', !isDbg);
    }
  };

  debugBtn?.addEventListener('click', () => {
    engine.renderer.showDebug = !engine.renderer.showDebug;
    syncDebugUI();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'F2') setTimeout(syncDebugUI, 20);
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
  console.log('🚀 CyberEvolution engine running!');
}

bootstrap().catch((err) => {
  showError(`Init error: ${err?.message || err}`);
});
