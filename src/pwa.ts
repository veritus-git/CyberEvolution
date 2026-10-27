/**
 * src/pwa.ts
 * Obsługa instalacji PWA, rejestracji Service Workera i modalów instalacyjnych na telefonach.
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
let pwaInitialized = false;

// Rejestracja Service Workera natychmiast, bez czekania na minione zdarzenie load
function registerServiceWorker(): void {
  const isSecure = typeof window !== 'undefined' && (window.isSecureContext || window.location.hostname === 'localhost');
  if ('serviceWorker' in navigator && isSecure) {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('[PWA] Service Worker aktywny w zasięgu:', reg.scope))
      .catch((err) => console.warn('[PWA] Błąd rejestracji SW:', err));
  }
}

if (typeof window !== 'undefined') {
  registerServiceWorker();
  if (document.readyState !== 'complete') {
    window.addEventListener('load', registerServiceWorker);
  }
}

// Przechwycenie zdarzenia instalacji na Chromium (Brave / Chrome / Edge / Android)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: BeforeInstallPromptEvent) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    console.log('[PWA] Przechwycono zdarzenie beforeinstallprompt - aplikacja gotowa do instalacji!');
  });
}

/**
 * Wywołuje proces instalacji PWA:
 * - Na Chromium otwiera natywne okienko "Zainstaluj aplikację"
 * - Na iOS wyświetla ilustrowany modal z instrukcją "Dodaj do ekranu początkowego"
 */
export async function promptPWAInstall(): Promise<'accepted' | 'dismissed' | 'ios' | 'already_installed' | 'manual'> {
  if (isStandaloneApp()) {
    showPwaModal('Aplikacja zainstalowana', 'Gra CyberEvolution jest już uruchomiona jako zainstalowana aplikacja na Twoim urządzeniu.');
    return 'already_installed';
  }

  // 1. Jeśli przeglądarka udostępniła natywny prompt (Android / Chrome / Brave Desktop)
  if (deferredInstallPrompt) {
    try {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      return choice.outcome;
    } catch {
      // Fallback do modala w razie błędu
    }
  }

  // 2. Jeśli to iPhone / iPad (iOS Safari / Brave)
  if (isIOS()) {
    showPwaModal(
      'Instalacja na iPhonie / iPadzie',
      `Aby grać w pełnym ekranie bez pasków przeglądarki:
1. Stuknij ikonę <strong>Udostępnij</strong> ⎋ (lub menu z trzema kropkami <strong>...</strong>).
2. Z listy wybierz <strong>„Dodaj do ekranu początkowego” ⊞</strong>.
3. Kliknij <strong>„Dodaj”</strong> w prawym górnym rogu.

Gra pojawi się na Twoim pulpicie jako natywna aplikacja!`
    );
    return 'ios';
  }

  // 3. Fallback dla przeglądarek desktopowych / innych
  showPwaModal(
    'Zainstaluj aplikację CyberEvolution',
    `Kliknij ikonę <strong>Zainstaluj aplikację 📲</strong> na pasku adresu przeglądarki (po prawej stronie obok paska adresu URL), aby zainstalować grę na swoim komputerze lub telefonie.`
  );
  return 'manual';
}

/**
 * Wyświetla elegancki cyberpunkowy modal z instrukcją instalacji.
 */
export function showPwaModal(title: string, messageHtml: string): void {
  let modal = document.getElementById('pwa-install-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'pwa-install-modal';
    modal.className = 'pwa-modal-overlay';
    modal.innerHTML = `
      <div class="pwa-modal-card">
        <h3 id="pwa-modal-title" class="pwa-modal-title"></h3>
        <div id="pwa-modal-body" class="pwa-modal-body"></div>
        <button id="pwa-modal-close" class="pwa-modal-btn">Rozumiem</button>
      </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#pwa-modal-close');
    closeBtn?.addEventListener('click', () => {
      modal?.classList.add('hidden');
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal?.classList.add('hidden');
    });
  }

  const titleEl = modal.querySelector('#pwa-modal-title');
  const bodyEl = modal.querySelector('#pwa-modal-body');
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = messageHtml;

  modal.classList.remove('hidden');
}

export function initPWA(): void {
  if (pwaInitialized) return;
  pwaInitialized = true;
  registerServiceWorker();
}
