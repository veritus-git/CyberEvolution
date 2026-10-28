/**
 * src/core/Device.ts
 * Niezawodny moduł detekcji urządzeń (Mobile vs Desktop, iOS, orientacja, PWA standalone).
 * Chroni wersję desktopową przed fałszywym wykryciem laptopów z ekranami dotykowymi.
 */

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

/**
 * Sprawdza, czy gracz korzysta z urządzenia mobilnego (smartfon, tablet).
 * Wyklucza laptopy i komputery z dotykowym ekranem, które mają precyzyjny wskaźnik (mysz/gładzik).
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  // 1. Sprawdzenie User Agent pod kątem znanych urządzeń mobilnych
  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  // iPad na nowszych iOS zgłasza się jako "Macintosh", ale ma maxTouchPoints > 1
  const isIPadOS = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;

  if (isMobileUA || isIPadOS) {
    return true;
  }

  // 2. Sprawdzenie cech wskaźnika:
  // pointer: coarse oznacza gruby wskaźnik (palec), pointer: fine oznacza mysz.
  const hasCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const hasFinePointer = window.matchMedia?.('(pointer: fine)').matches ?? false;

  // Jeśli ma dotyk i nie ma myszki oraz ekran jest mniejszy niż typowy desktop
  if (hasCoarsePointer && !hasFinePointer && navigator.maxTouchPoints > 0) {
    return true;
  }

  // Smartfon lub mały tablet z dotykiem
  if (navigator.maxTouchPoints > 0 && Math.min(window.innerWidth, window.innerHeight) <= 600) {
    return true;
  }

  return false;
}

/**
 * Sprawdza, czy urządzenie działa pod kontrolą systemu iOS (iPhone, iPad).
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * Sprawdza, czy ekran znajduje się obecnie w orientacji pionowej (portrait).
 */
export function isPortrait(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.screen && window.screen.orientation && window.screen.orientation.type) {
    return window.screen.orientation.type.startsWith('portrait');
  }
  return window.innerHeight > window.innerWidth;
}

/**
 * Sprawdza, czy gra została uruchomiona jako zainstalowana aplikacja PWA na pulpicie.
 */
export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  const isDisplayStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches;
  const isIOSStandalone = window.navigator.standalone === true;
  return Boolean(isDisplayStandalone || isIOSStandalone);
}
