# CyberEvolution - Nowy Silnik Gry 2D (Web & Multiplatform)

Nowoczesny, modularny silnik platformowy 2D napisany od zera w **TypeScript** z wykorzystaniem **HTML5 Canvas (akceleracja GPU)**, przygotowany pod przeglądarki (PC, smartfony, tablety) oraz kompilację do natywnej binarki (np. przez **Tauri**).

---

## 🎮 Uruchamianie

Silnik działa w oparciu o Vite z błyskawicznym przeładowywaniem na żywo (HMR):

```bash
# Instalacja zależności (jeśli jeszcze nie zainstalowano)
npm install

# Uruchomienie lokalnego serwera deweloperskiego
npm run dev

# Kompilacja produkcyjna (bundle ~30 KB)
npm run build
```

Serwer dostępny jest pod adresem `http://localhost:5173/` (lub w sieci lokalnej na telefonie/tablecie).

---

## 🕹️ Sterowanie

| Akcja | Klawiatura (PC) | Ekran dotykowy (Telefon / Tablet) | Gamepad |
| :--- | :--- | :--- | :--- |
| **Ruch poziomy** | `A` / `D` lub `←` / `→` | Półprzezroczysty wirtualny joystick (lewa strona) | Lewa gałka analogowa / D-Pad |
| **Skok** | `SPACJA` lub `W` / `↑` | Przycisk ekranowy **[SKOK]** (prawa strona) | Przycisk `A` |
| **Interakcja / Drabina** | `E` | Przycisk ekranowy **[AKCJA]** | Przycisk `X` lub `B` |
| **Zmiana skórek (Ewolucja)** | Klawisze `1` .. `5` | Przycisk w prawym górnym rogu **[Skin: X]** | - |
| **Podgląd Hitboxów (Debug)** | `F2` | Przycisk w prawym górnym rogu **[F2: Hitboxy]** | - |

---

## 🏗️ Architektura Silnika (100% z poziomu kodu)

Struktura katalogów w `src/`:

```
src/
├── core/
│   ├── Constants.ts       # Stałe fizyki, rozdzielczość (1920x1080 / PLAY_H=896), kolory masek
│   ├── Engine.ts          # Główna pętla gry z deterministycznym taktowaniem (fixed timestep 60Hz)
│   ├── Camera.ts          # Płynna kamera śledząca z pixel-snappingiem (brak rozmyć krawędzi)
│   └── Input.ts           # Zunifikowane sterowanie (klawiatura + dotyk + gamepad)
├── physics/
│   ├── AABB.ts            # Bounding boxy, kolizje osiowe, separacja osi X/Y
│   └── PhysicsBody.ts     # Fizyka platformowa: coyote time, jump buffer, variable jump, stair-step
├── world/
│   ├── Level.ts           # Struktura poziomu: platformy, drabiny, portale, bramy, triggery
│   └── MaskParser.ts      # Zaawansowany parser masek PNG z redukcją błędu 1px i scalaniem AABB
├── entities/
│   └── Player.ts          # Postać gracza, maszyna stanów, animacje skórek 1..5, obracanie sprite'a
├── graphics/
│   └── Renderer.ts        # Renderowanie nearest-neighbor, obsługa High-DPI/Retina, wizualizacja hitboxów
├── ui/
│   ├── VirtualJoystick.ts # Dynamiczny, półprzezroczysty joystick mobilny + przyciski dotykowe
│   └── InteractionDialog.ts # Okna dialogowe z quizami (bezpieczeństwo w sieci) i odblokowywaniem bram
├── main.ts                # Punkt wejścia aplikacji
└── style.css              # Cyberpunkowy interfejs, responsywny canvas, font pikselowy
```

---

## 🎨 Jak projektować mapy za pomocą masek PNG (Bezbłędny Level Design)

W starym kodzie pomyłka o 1 piksel psuła kafelek, ponieważ kod badał tylko jeden punkt w środku kafelka.  
Nowy silnik w [`MaskParser.ts`](file:///mnt/dump/CyberEvolution/src/world/MaskParser.ts) rozwiązuje ten problem na dwa sposoby:

### Sposób 1: Nowa metoda pikselowa (1 piksel = 1 cały kafelek) - **REKOMENDOWANA**
- W programie graficznym (Aseprite, Photoshop, GIMP, Paint) tworzysz mały obrazek o rozmiarze np. **60 x 28 pikseli**.
- Każdy postawiony piksel to dokładnie jeden kafelek (32x32px) w grze!
- **Zaleta**: Nierealne jest pomylenie się o ułamek kafelka. Zawsze masz 100% precyzję, a plik maski waży kilka kilobajtów.

### Sposób 2: Metoda obszarowa (pełna rozdzielczość np. 1920x896)
- Jeśli wolisz rysować na dużym płótnie (np. 1920x896):
- Nowy parser bada **obszar kafelka** (próbkowanie wielopunktowe + głosowanie większościowe). Nawet jeśli ręka Ci drgnie o 1-2 piksele na krawędzi, kafelek zostanie zakwalifikowany poprawnie.

### Legenda kolorów w masce:
| Kolor RGB | Szesnastkowo (HEX) | Funkcja w grze |
| :--- | :--- | :--- |
| `RGB(0, 0, 0)` | `#000000` (Czarny) | **Solidny blok** (ziemia, ściany, platformy) |
| `RGB(255, 255, 0)` | `#FFFF00` (Żółty) | **Drabina** (umożliwia wspinaczkę w górę/dół) |
| `RGB(0, 0, 255)` | `#0000FF` (Niebieski) | **Portal** (przenosi do świata docelowego) |
| `RGB(0, 255, 255)` | `#00FFFF` (Cyjan) | **Portal powrotny** (do Lobby) |
| `RGB(255, 0, 0)` | `#FF0000` (Czerwony) | **Brama #1** (blokada otwierana po quizie) |
| `RGB(255, 0, 255)` | `#FF00FF` (Magenta) | **Trigger #1** (strefa dialogowa / quiz) |
| `Przezroczysty / Biały` | Dowolny inny | **Pusta przestrzeń** (powietrze) |

---

## ⚡ Optymalizacja AABB (Greedy Meshing)
Nasz parser automatycznie łączy przylegające kafelki tego samego typu w duże prostokąty AABB. Zamiast testować kolizję z setkami kafelków 32x32, silnik sprawdza zaledwie kilka prostokątów, gwarantując **stałe 60-120 FPS** nawet na starszych smartfonach.
