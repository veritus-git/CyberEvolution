/**
 * src/pwa.ts
 * Obsługa instalacji PWA, rejestracji Service Workera i promptów instalacyjnych.
 * Bezpiecznie ignoruje brak HTTPS na HTTP bez błędów w konsoli.
 */

import { isIOS, isStandaloneApp } from './core/Device';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

/**
 * Inicjalizuje Service Workera oraz obsługę przycisku instalacji PWA.
 */
export function initPWA(
  installButton: HTMLElement | null,
  iosHintElement?: HTMLElement | null
): void {
  // 1. Bezpieczna rejestracja Service Workera (wymaga HTTPS lub localhost)
  const isSecure = typeof window !== 'undefined' && (window.isSecureContext || window.location.hostname === 'localhost');
  if ('serviceWorker' in navigator && isSecure) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.log('[PWA] Service Worker zarejestrowany pomyślnie.'))
        .catch((err) => console.warn('[PWA] Błąd rejestracji SW:', err));
    });
  } else {
    console.log('[PWA] Połączenie nie jest bezpiecznym kontekstem HTTPS - rejestracja SW i prompt PWA będą aktywne po wdrożeniu certyfikatu SSL.');
  }

  // Jeśli gra jest już uruchomiona jako aplikacja z pulpitu, ukrywamy elementy instalacji
  if (isStandaloneApp()) {
    installButton?.classList.add('hidden');
    iosHintElement?.classList.add('hidden');
    return;
  }

  // 2. Obsługa iOS (Safari nie wspiera beforeinstallprompt - pokazujemy wskazówkę)
  if (isIOS() && iosHintElement) {
    iosHintElement.classList.remove('hidden');
  }

  // 3. Przechwycenie zdarzenia instalacji na Androidzie / Desktopie
  window.addEventListener('beforeinstallprompt', (e: BeforeInstallPromptEvent) => {
    e.preventDefault();
    deferredInstallPrompt = e;

    if (installButton) {
      installButton.classList.remove('hidden');
    }
  });

  // 4. Obsługa kliknięcia w przycisk "Zainstaluj grę"
  installButton?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;

    await deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log(`[PWA] Wybór gracza: ${outcome}`);

    deferredInstallPrompt = null;
    installButton.classList.add('hidden');
  });

  // 5. Ukrycie przycisku po instalacji
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] Gra CyberEvolution została zainstalowana na urządzeniu!');
    deferredInstallPrompt = null;
    installButton?.classList.add('hidden');
    iosHintElement?.classList.add('hidden');
  });
}
