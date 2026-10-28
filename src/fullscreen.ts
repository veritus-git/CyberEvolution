/**
 * src/fullscreen.ts
 * Kompleksowa obsługa Fullscreen API oraz blokady orientacji ekranu (Screen Orientation API).
 * Działa na połączeniach HTTPS oraz HTTP, z obsługą prefiksów WebKit i bezpiecznym fallbackiem na iOS.
 */

import { isIOS } from './core/Device';
import { promptPWAInstall } from './pwa';

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
}

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
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
 * Sprawdza, czy przeglądarka znajduje się obecnie w trybie pełnoekranowym.
 */
export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

/**
 * Włącza pełny ekran i opcjonalnie blokuje orientację ekranu (np. 'landscape').
 * Zgodnie z wymogami przeglądarek MUSI być wywołane wewnątrz bezpośredniej interakcji gracza (click/touch).
 */
export async function requestGameFullscreen(
  lockOrientation: OrientationLockType = 'landscape'
): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  // Na iPhone przeglądarka Safari/Brave nie wspiera requestFullscreen na elementach DOM
  if (isIOS()) {
    try {
      window.scrollTo(0, 1);
    } catch {}
    return true;
  }

  const elem = document.documentElement as FullscreenElement;

  try {
    if (!isFullscreenActive()) {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen({ navigationUI: 'hide' });
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      }
    }

    // Próba programowej blokady orientacji (działa w Fullscreen / PWA na Androidzie)
    if (lockOrientation && window.screen?.orientation && 'lock' in window.screen.orientation) {
      try {
        await (window.screen.orientation as unknown as { lock: (o: OrientationLockType) => Promise<void> }).lock(
          lockOrientation
        );
      } catch {
        // Ignorujemy brak wsparcia
      }
    }

    return true;
  } catch (err) {
    console.warn('[Fullscreen] Informacja:', err);
    return false;
  }
}

/**
 * Wyłącza tryb pełnoekranowy.
 */
export async function exitGameFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  const doc = document as FullscreenDocument;
  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
    }
  } catch (err) {
    console.warn('[Fullscreen] Błąd przy wychodzeniu z pełnego ekranu:', err);
  }
}

/**
 * Przełącza tryb pełnoekranowy (włącz / wyłącz).
 * Na iPhone wyświetla wskazówkę dodania do ekranu początkowego PWA.
 */
export async function toggleGameFullscreen(
  lockOrientation: OrientationLockType = 'landscape'
): Promise<void> {
  if (isIOS()) {
    // Na iOS pełny ekran bez pasków przeglądarki uzyskuje się przez dodanie PWA do pulpitu
    promptPWAInstall().catch(() => {});
    return;
  }

  if (isFullscreenActive()) {
    await exitGameFullscreen();
  } else {
    await requestGameFullscreen(lockOrientation);
  }
}
