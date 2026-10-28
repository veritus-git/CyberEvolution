/**
 * CyberEvolution Game Information & Controls Modal
 * Modern cyberpunk dialog with lore, worlds guide, evolution stages, and controls.
 */

export class GameInfoModal {
  public isOpen: boolean = false;
  private overlayElement: HTMLElement;
  private modalBox: HTMLElement;
  private onCloseCallback?: () => void;

  constructor(container: HTMLElement) {
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'game-info-overlay hidden';

    this.modalBox = document.createElement('div');
    this.modalBox.className = 'game-info-card';

    this.modalBox.innerHTML = `
      <div class="game-info-header">
        <div class="game-info-badge">CYBEREVOLUTION: ŚCIEŻKA ŚWIADOMOŚCI</div>
        <button class="game-info-close" id="btn-close-info" title="Zamknij (ESC)">&times;</button>
      </div>

      <div class="game-info-tabs">
        <button class="info-tab-btn active" data-tab="tab-lore">Fabuła i Cel</button>
        <button class="info-tab-btn" data-tab="tab-worlds">Światy & Bossowie</button>
        <button class="info-tab-btn" data-tab="tab-evolution">CyberEwolucja</button>
        <button class="info-tab-btn" data-tab="tab-controls">Sterowanie</button>
        <button class="info-tab-btn" data-tab="tab-about">O Projekcie</button>
      </div>

      <div class="game-info-content">
        <!-- Tab 1: Lore -->
        <div class="info-tab-pane active" id="tab-lore">
          <h2 class="info-title">Zręcznościowy parkour w głąb internetowego szaleństwa</h2>
          <p class="info-p">
            Jest <strong>02:30 w nocy</strong>. Bezmyślnie scrollujesz rolki w łóżku. Nagle trafiasz na viralowe nagranie — ktoś użył sztucznej inteligencji, wkleił Twoją twarz w kompromitujący <strong>deepfake</strong>, a pod filmem wylewa się fala hejtu od znajomych ze szkoły.
          </p>
          <p class="info-p">
            Zanim zdążysz pomyśleć, w panice klikasz migający link: <em>„Usuń to natychmiast!”</em>. <strong>Błąd.</strong> Zamiast pomocy, zostajesz wciągnięty w samo serce cyfrowego labiryntu.
          </p>
          <p class="info-p highlight">
            Aby powrócić do rzeczywistości, musisz przejść przez pięć kręgów cyfrowej manipulacji, pokonać podstępnych bossów w debatach na argumenty i wykuć w sobie niezłomną odporność na dezinformację!
          </p>
        </div>

        <!-- Tab 2: Worlds -->
        <div class="info-tab-pane" id="tab-worlds">
          <h2 class="info-title">Pięć poziomów prawdy</h2>
          <div class="worlds-grid">
            <div class="world-card">
              <div class="world-num">ŚWIAT 1</div>
              <div class="world-name">Miasto Iluzji</div>
              <div class="world-desc">Królestwo clickbaitów, fake newsów i tanich emocji.</div>
              <div class="world-boss">Boss: <strong>Monolit Algorytmu</strong></div>
            </div>
            <div class="world-card">
              <div class="world-num">ŚWIAT 2</div>
              <div class="world-name">Krypty Kluczy</div>
              <div class="world-desc">Mroczne podziemia phishingu, fałszywych quizów i kradzieży tożsamości.</div>
              <div class="world-boss">Boss: <strong>Pożeracz Kluczy</strong></div>
            </div>
            <div class="world-card">
              <div class="world-num">ŚWIAT 3</div>
              <div class="world-name">Maskarada Luster</div>
              <div class="world-desc">Kraina influencerów, nierealnych filtrów i ukrytych reklam.</div>
              <div class="world-boss">Boss: <strong>Królowa Luster</strong></div>
            </div>
            <div class="world-card">
              <div class="world-num">ŚWIAT 4</div>
              <div class="world-name">Twierdza Kopii</div>
              <div class="world-desc">Bastion internetowych baniek, sztucznej presji czasu i hejtu.</div>
              <div class="world-boss">Boss: <strong>Chronos Paniki</strong></div>
            </div>
            <div class="world-card highlight-card">
              <div class="world-num">ŚWIAT 5</div>
              <div class="world-name">Sanktuarium Rozumu</div>
              <div class="world-desc">Ostateczna próba samodzielności myślenia i wolności od fałszywych autorytetów.</div>
              <div class="world-boss">Finałowy Boss: <strong>Mędrzec Rozumu</strong></div>
            </div>
          </div>
        </div>

        <!-- Tab 3: Evolution -->
        <div class="info-tab-pane" id="tab-evolution">
          <h2 class="info-title">5 Stadiów CyberEwolucji Bohatera</h2>
          <p class="info-p">
            W miarę jak zdobywasz wiedzę i odpierasz manipulację, Twój bohater przechodzi transformację — z przestraszonego dzieciaka w bluzie staje się pewnym siebie cyfrowym czempionem:
          </p>
          <div class="evo-list">
            <div class="evo-item"><span class="evo-badge">Stadium 1</span> <strong>Zagubiony Uczeń</strong> — Przerażony deepfake'iem, działający pod wpływem impulsu.</div>
            <div class="evo-item"><span class="evo-badge">Stadium 2</span> <strong>Zimna Krew</strong> — Opanowuje pierwszy odruch paniki i odracza emocjonalną reakcję.</div>
            <div class="evo-item"><span class="evo-badge">Stadium 3</span> <strong>Cyfrowy Analityk</strong> — Sprawdza źródła, rozpoznaje phishing, chroni hasła i stosuje 2FA.</div>
            <div class="evo-item"><span class="evo-badge">Stadium 4</span> <strong>Tarcza Asertywności</strong> — Odporny na presję rówieśniczą, hejt i manipulacje influencerów.</div>
            <div class="evo-item"><span class="evo-badge">Stadium 5</span> <strong>Strażnik Rozumu</strong> — Mistrz krytycznego myślenia, gotowy obronić siebie i innych w sieci.</div>
          </div>
        </div>

        <!-- Tab 4: Controls -->
        <div class="info-tab-pane" id="tab-controls">
          <h2 class="info-title">Sterowanie w grze</h2>
          <table class="info-table">
            <thead>
              <tr>
                <th>Akcja</th>
                <th>Klawiatura (PC)</th>
                <th>Smartfon / Tablet</th>
                <th>Gamepad</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Ruch lewo / prawo</strong></td>
                <td><code>A</code> / <code>D</code> lub <code>&larr;</code> / <code>&rarr;</code></td>
                <td>Wirtualny joystick (lewa strona)</td>
                <td>Lewa gałka / D-Pad</td>
              </tr>
              <tr>
                <td><strong>Skok</strong></td>
                <td><code>SPACJA</code> lub <code>W</code> / <code>&uarr;</code></td>
                <td>Przycisk <strong>[SKOK]</strong></td>
                <td>Przycisk <code>A</code></td>
              </tr>
              <tr>
                <td><strong>Interakcja / Drabina</strong></td>
                <td><code>E</code></td>
                <td>Przycisk <strong>[AKCJA]</strong></td>
                <td>Przycisk <code>X</code> lub <code>B</code></td>
              </tr>
              <tr>
                <td><strong>Pełny ekran</strong></td>
                <td><code>F11</code> lub <code>F</code></td>
                <td>Przycisk <strong>[⛶]</strong> na górnym pasku</td>
                <td>—</td>
              </tr>
              <tr>
                <td><strong>Pauza / Menu / Pomoc</strong></td>
                <td><code>ESC</code></td>
                <td>Przycisk <strong>[❔]</strong> na górnym pasku</td>
                <td>Start / Select</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Tab 5: About -->
        <div class="info-tab-pane" id="tab-about">
          <h2 class="info-title">Garść konkretów dla Jury i Graczy</h2>
          <div class="about-grid">
            <div class="about-item">
              <strong>Kategoria:</strong> Manipulacja w mediach społecznościowych (emocje, virale, quizy wyłudzające dane, boty, influencerzy).
            </div>
            <div class="about-item">
              <strong>Grupa docelowa:</strong> Młodzież 14–19 lat (czas rozgrywki 25–30 minut, ~5 min na świat).
            </div>
            <div class="about-item">
              <strong>Czego uczy gra:</strong> Odraczania emocjonalnej reakcji, sprawdzania źródeł, higieny haseł i logowania 2FA, asertywności wobec presji rówieśniczej oraz rozpoznawania kryptoreklamy (#reklama/UOKiK).
            </div>
            <div class="about-item">
              <strong>Technologia:</strong> Czysty silnik 2D w TypeScript & Canvas GPU, Web Audio synthwave, zero zewnętrznych frameworków, działa od razu na PC i smartfonach.
            </div>
            <div class="about-item">
              <strong>Autorzy:</strong> ZSO Oława (zespół Veritus)
            </div>
            <div class="about-item">
              <strong>Gra online:</strong> <a href="https://cyberevolution.zsolawa.edu.pl/" target="_blank" rel="noopener">cyberevolution.zsolawa.edu.pl</a>
            </div>
          </div>
        </div>
      </div>

      <div class="game-info-footer">
        <button class="game-info-btn-confirm" id="btn-confirm-info">Powrót do gry</button>
      </div>
    `;

    this.overlayElement.appendChild(this.modalBox);
    container.appendChild(this.overlayElement);

    this.setupListeners();
  }

  private setupListeners(): void {
    // Close button
    const closeBtn = this.modalBox.querySelector('#btn-close-info');
    const confirmBtn = this.modalBox.querySelector('#btn-confirm-info');
    closeBtn?.addEventListener('click', () => this.hide());
    confirmBtn?.addEventListener('click', () => this.hide());

    // Click outside modal
    this.overlayElement.addEventListener('click', (e) => {
      if (e.target === this.overlayElement) {
        this.hide();
      }
    });

    // Tab switching
    const tabBtns = this.modalBox.querySelectorAll<HTMLButtonElement>('.info-tab-btn');
    const tabPanes = this.modalBox.querySelectorAll<HTMLElement>('.info-tab-pane');

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');
        tabBtns.forEach((b) => b.classList.remove('active'));
        tabPanes.forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        if (targetId) {
          this.modalBox.querySelector(`#${targetId}`)?.classList.add('active');
        }
      });
    });

    // ESC key closes
    window.addEventListener('keydown', (e) => {
      if (this.isOpen && (e.code === 'Escape' || e.code === 'KeyE')) {
        e.preventDefault();
        this.hide();
      }
    });
  }

  public show(tabName?: string, onClose?: () => void): void {
    this.isOpen = true;
    this.onCloseCallback = onClose;
    this.overlayElement.classList.remove('hidden');

    if (tabName) {
      const btn = this.modalBox.querySelector<HTMLButtonElement>(`[data-tab="${tabName}"]`);
      btn?.click();
    }
  }

  public hide(): void {
    this.isOpen = false;
    this.overlayElement.classList.add('hidden');
    if (this.onCloseCallback) {
      this.onCloseCallback();
      this.onCloseCallback = undefined;
    }
  }
}
