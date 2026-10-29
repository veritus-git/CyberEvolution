/**
 * src/fullscreen.ts
 * Kompleksowa i niezawodna obsługa Fullscreen API oraz blokady orientacji ekranu.
 * Obsługuje telefony z Androidem (Chrome, Brave, Samsung Internet, Firefox, Opera),
 * iPadOS oraz komputery PC (Windows, macOS, Linux).
 * Na iPhone (gdzie Apple z założenia blokuje Element.requestFullscreen) bezpiecznie
 * wyświetla instrukcję dodania do ekranu początkowego (PWA), która jako jedyna na iOS
 * umożliwia uruchomienie gry bez interfejsu Safari.
 */

import { isIOS } from './core/Device';
import { promptPWAInstall } from './pwa';

interface FullscreenElementWithPrefixes extends HTMLElement {
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
  webkitRequestFullScreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

interface FullscreenDocumentWithPrefixes extends Document {
  webkitFullscreenElement?: Element | null;
  webkitCurrentFullScreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
  webkitCancelFullScreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
  webkitFullscreenEnabled?: boolean;
  mozFullScreenEnabled?: boolean;
  msFullscreenEnabled?: boolean;
}

export type OrientationLockType =
  | 'any'
  | 'natural'
  | 'landscape'
  | 'portrait'
  | 'portrait-primary'
  | 'portrait-secondary'
  | 'landscape-primary'
  | 'landscape-secondary';

/**
 * Sprawdza, czy przeglądarka wspiera jakiekolwiek API pełnoekranowe na elementach DOM.
 */
export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocumentWithPrefixes;
  const el = document.documentElement as FullscreenElementWithPrefixes;
  return Boolean(
    doc.fullscreenEnabled ||
    doc.webkitFullscreenEnabled ||
    doc.mozFullScreenEnabled ||
    doc.msFullscreenEnabled ||
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.webkitRequestFullScreen ||
    el.mozRequestFullScreen ||
    el.msRequestFullscreen
  );
}

/**
 * Sprawdza, czy gra znajduje się obecnie w trybie pełnoekranowym.
 */
export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocumentWithPrefixes;
  return Boolean(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.webkitCurrentFullScreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}

/**
 * Włącza pełny ekran na jednym z elementów docelowych z wielopoziomową kaskadą fallbacków.
 * Zoptymalizowany dla urządzeń mobilnych (Android Chrome, Brave, Samsung Internet itp.).
 */
export async function requestGameFullscreen(
  lockOrientation: OrientationLockType = 'landscape'
): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  // Jeśli już jest aktywny fullscreen, upewnij się co do orientacji i zwróć true
  if (isFullscreenActive()) {
    tryLockOrientation(lockOrientation);
    return true;
  }

  // Lista elementów, na których można zażądać pełnego ekranu
  const targets: (HTMLElement | null)[] = [
    document.documentElement,
    document.body,
    document.getElementById('app'),
    document.getElementById('game-canvas'),
  ];

  let success = false;

  for (const target of targets) {
    if (!target) continue;
    const elem = target as FullscreenElementWithPrefixes;

    // 1. Standardowe requestFullscreen z { navigationUI: 'hide' }
    if (typeof elem.requestFullscreen === 'function') {
      try {
        await elem.requestFullscreen({ navigationUI: 'hide' });
        success = true;
        break;
      } catch {
        // Fallback bez navigationUI (niektóre mobilne przeglądarki rzucają TypeError)
        try {
          await elem.requestFullscreen();
          success = true;
          break;
        } catch {
          // Następny wariant
        }
      }
    }

    // 2. WebKit z małą literą (Safari / iPadOS / Android WebKit)
    if (typeof elem.webkitRequestFullscreen === 'function') {
      try {
        await elem.webkitRequestFullscreen();
        success = true;
        break;
      } catch {}
    }

    // 3. WebKit ze starszą wielką literą 'S'
    if (typeof elem.webkitRequestFullScreen === 'function') {
      try {
        await elem.webkitRequestFullScreen();
        success = true;
        break;
      } catch {}
    }

    // 4. Firefox (mozRequestFullScreen)
    if (typeof elem.mozRequestFullScreen === 'function') {
      try {
        await elem.mozRequestFullScreen();
        success = true;
        break;
      } catch {}
    }

    // 5. Microsoft Edge legacy / IE (msRequestFullscreen)
    if (typeof elem.msRequestFullscreen === 'function') {
      try {
        await elem.msRequestFullscreen();
        success = true;
        break;
      } catch {}
    }
  }

  if (success) {
    // Próba blokady orientacji ekranu
    tryLockOrientation(lockOrientation);
  } else {
    // Na urządzeniach bez obsługi Fullscreen API (np. iPhone Safari) próbujemy zwinąć pasek adresu
    try {
      window.scrollTo(0, 1);
    } catch {}
  }

  return success;
}

/**
 * Bezpieczna próba zablokowania orientacji ekranu na 'landscape'.
 */
function tryLockOrientation(orientation: OrientationLockType): void {
  try {
    if (window.screen?.orientation && typeof (window.screen.orientation as unknown as { lock: (o: OrientationLockType) => Promise<void> }).lock === 'function') {
      (window.screen.orientation as unknown as { lock: (o: OrientationLockType) => Promise<void> }).lock(orientation).catch(() => {});
    }
  } catch {}
}

/**
 * Wyłącza tryb pełnoekranowy ze wszystkimi prefiksami dostawców.
 */
export async function exitGameFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  const doc = document as FullscreenDocumentWithPrefixes;

  try {
    if (typeof doc.exitFullscreen === 'function') {
      await doc.exitFullscreen();
    } else if (typeof doc.webkitExitFullscreen === 'function') {
      await doc.webkitExitFullscreen();
    } else if (typeof doc.webkitCancelFullScreen === 'function') {
      await doc.webkitCancelFullScreen();
    } else if (typeof doc.mozCancelFullScreen === 'function') {
      await doc.mozCancelFullScreen();
    } else if (typeof doc.msExitFullscreen === 'function') {
      await doc.msExitFullscreen();
    }
  } catch (err) {
    console.warn('[Fullscreen] Błąd przy opuszczaniu pełnego ekranu:', err);
  }

  // Odblokowanie orientacji ekranu
  try {
    if (window.screen?.orientation && typeof (window.screen.orientation as unknown as { unlock: () => void }).unlock === 'function') {
      (window.screen.orientation as unknown as { unlock: () => void }).unlock();
    }
  } catch {}
}

/**
 * Przełącza tryb pełnoekranowy (włącz / wyłącz).
 * - Na Androidzie i PC: natychmiastowo aktywuje lub deaktywuje tryb pełnoekranowy w przeglądarce.
 * - Na iOS (iPhone): jeśli przeglądarka nie wspiera Fullscreen API, wyświetla instrukcję PWA.
 */
export async function toggleGameFullscreen(
  lockOrientation: OrientationLockType = 'landscape'
): Promise<void> {
  if (isFullscreenActive()) {
    await exitGameFullscreen();
    return;
  }

  const success = await requestGameFullscreen(lockOrientation);

  // Jeśli wejście w pełny ekran się nie powiodło (np. iPhone Safari blokujący DOM fullscreen)
  if (!success && isIOS()) {
    promptPWAInstall().catch(() => {});
  }
}
