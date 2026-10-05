import { Engine } from './core/Engine';

async function bootstrap() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const uiContainer = document.getElementById('ui-container') as HTMLElement;
  const debugBtn = document.getElementById('btn-toggle-debug') as HTMLButtonElement;
  const skinBtn = document.getElementById('btn-cycle-skin') as HTMLButtonElement;

  if (!canvas || !uiContainer) {
    throw new Error('Canvas or UI container element not found in DOM.');
  }

  // Pre-load font to prevent text layout shifting
  try {
    await document.fonts.load('16px "Pixel Emulator"');
  } catch (err) {
    console.warn('Pixel font loading fallback:', err);
  }

  const engine = new Engine(canvas, uiContainer);
  await engine.init();

  // Mobile button listeners
  let currentSkin = 1;
  skinBtn?.addEventListener('click', () => {
    currentSkin = (currentSkin % 5) + 1;
    engine.player.setSkin(currentSkin);
    skinBtn.textContent = `Skin: ${currentSkin}`;
  });

  debugBtn?.addEventListener('click', () => {
    engine.renderer.showDebug = !engine.renderer.showDebug;
    debugBtn.style.color = engine.renderer.showDebug ? '#22c55e' : '#00e5ff';
  });

  engine.start();
  console.log('🚀 CyberEvolution engine running!');
}

bootstrap().catch((err) => {
  console.error('Fatal engine bootstrap error:', err);
});
