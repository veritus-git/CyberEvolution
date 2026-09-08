"""CyberEvolution — refactor pass 1 (formatting & hygiene only).
- Preserves gameplay and behavior 1:1
- No logic changes; only whitespace cleanup and section headers kept intact
- Ready as clean baseline for future functional refactors
"""
# (NOTE: PixelFont cache untouched)\n# === CyberEvolution — CEv5.0.py ===
# Clean, structured single-file build preserving gameplay & behavior from last checkpoint.
# See section headers for quick navigation; each block is compact and commented.
# This file is intentionally self-contained for easy portability to a new engine.
#
# Gameplay parity: portals, ladders (E), climb step-out, respawn blink, gates/arena, dialogs (typewriter + paging),
# world intros, dynamic lobby portal by evo level, skin switching (1..5), debug overlay.
#
# Controls:
#   A/D or ←/→ — ruch,  SPACE/W/↑ — skok,  E — portal/wspinaczka,  1..5 — skiny,  F2 — debug,  F11 — fullscreen,  B — dev-jump
#
# -----------------------------
# 0) Imports & setup
# -----------------------------

# =============================================================================
# LAYOUT & EXT MARKERS (READ FIRST)
# -----------------------------------------------------------------------------
# Gameplay 1:1 — tylko struktura pod bezpieczne modyfikacje.
# =============================================================================
import os, sys, math, random, re
from collections import defaultdict
from dataclasses import dataclass
import pygame

# ---- Per-world interactions loading ----
def parse_world_scripts(wn: int):
    base = os.path.join("assets","worlds",str(wn))
    candidates = [
        os.path.join(base, "interactions_updated.txt"),
        os.path.join(base, "interactions.txt"),
        os.path.join(base, f"world{wn}_interactions.txt"),
    ]
    path = None
    for p in candidates:
        if os.path.exists(p):
            path = p
            break
    if not path:
        return default_interaction_scripts()
    try:
        raw=open(path,"r",encoding="utf-8").read()
        blocks=[b.strip() for b in re.split(r'^\s*---\s*$',raw,flags=re.MULTILINE) if b.strip()]
        scripts=[]
        for b in blocks:
            d={}
            for ln in b.splitlines():
                if not ln.strip() or ln.strip().startswith('#'): continue
                m=re.match(r'^\s*([A-Za-z_]+)\s*:\s*(.*)$',ln)
                if not m: continue
                k=m.group(1).strip().upper(); v=m.group(2).strip().replace(r'\n','\n')
                d[k]=v
            if 'CONTEXT' in d and ('A' in d or 'B' in d):
                scripts.append(ScriptedInteraction(
                    context=d.get('CONTEXT',''),
                    sage=d.get('SAGE',''),
                    optA=d.get('A','Opcja A'),
                    optB=d.get('B','Opcja B'),
                    good=d.get('GOOD','Poprawna odpowiedź.'),
                    bad=d.get('BAD','Niepoprawna — spróbuj ponownie.'),
                    speed_context=float(d.get('SPEED_CONTEXT',38.0) or 38.0),
                    speed_sage=float(d.get('SPEED_SAGE',32.0) or 32.0),
                    speed_feedback=float(d.get('SPEED_FEEDBACK',36.0) or 36.0),
                    correct_letter=d.get('CORRECT','B').strip().upper(),
                    avatar=d.get('AVATAR'),
                ))
        return scripts
    except Exception:
        return default_interaction_scripts()
from pygame.locals import *

# Nearest-neighbor scaling & DPI awareness for crisp pixels
os.environ.setdefault("SDL_RENDER_SCALE_QUALITY", "0")
os.environ.setdefault("SDL_VIDEO_HIGHDPI", "1")

def make_dpi_aware():
    if sys.platform != "win32":
        return
    try:
        import ctypes
        ctypes.windll.user32.SetProcessDpiAwarenessContext(-4)  # PER_MONITOR_AWARE_V2
    except Exception:
        try:
            import ctypes
            ctypes.windll.shcore.SetProcessDpiAwareness(2)  # per-monitor
        except Exception:
            try:
                import ctypes
                ctypes.windll.user32.SetProcessDPIAware()
            except Exception:
                pass

def probe_debug_enabled_flag():
    """Return True iff 'debug_enabled.txt' exists next to the game file (file or folder)."""
    try:
        roots = [os.getcwd()]
        try:
            roots.append(os.path.dirname(os.path.abspath(__file__)))
        except Exception:
            pass
        for r in roots:
            p = os.path.join(r, 'debug_enabled.txt')
            if os.path.exists(p):
                return True
    except Exception:
        pass
    return False

# -----------------------------
# 1) Constants
# -----------------------------
LOGICAL_W, LOGICAL_H = 1920, 1080
PLAY_H = 896
BAR_H = (LOGICAL_H - PLAY_H) // 2
PLAY_RECT = pygame.Rect(0, BAR_H, LOGICAL_W, PLAY_H)

PLAYER_W, PLAYER_H = 105, 250
MOVE_SPEED  = 750.0
GRAVITY     = 2700.0
JUMP_SPEED  = 875.0
COYOTE_TIME = 0.10

IDLE_MS=160; RUN_MS=200; JUMP_MS=120; CLIMB_MS=180
ANIM_GROUND_GRACE = 0.12

TILE=32; THRESHOLD=128
SUPPORT_TOLERANCE=8; SUPPORT_INSET=6; GROUND_LOSS_RATIO=0.25; SAFE_SUPPORT_FULL=0.99

VOID_MARGIN=60; RESPAWN_DELAY_S=0.10; BLINKS_TOTAL=5; BLINK_INTERVAL_S=0.17

LADDER_COLOR=(255,255,0); LADDER_TOL=32; CLIMB_SPEED=700.0; CLIMB_STEPOUT_TIME=0.21; LADDER_INTERACT_DELAY=0.05

BG_PARALLAX=1.0

DEBUG_COLL=(0,255,0); DEBUG_PLAYER=(255,60,60); DEBUG_TEXT=(255,255,255)
DBG_TRIGGER=(255,0,255); DBG_GATE_LOCK=(255,70,70); DBG_GATE_OPEN=(60,220,60)
DBG_LADDER=(255,255,0); DBG_PORTAL=(0,255,255); DBG_SAFE=(255,255,255); DBG_CLIP=(255,140,0)
BLACK=(0,0,0); SKY=(165,205,255)

TRIGGER_COLORS=[(255,0,255),(255,128,0),(128,255,0)]
GATE_COLORS=[(255,0,0),(200,0,0),(150,0,0)]
ARENA_COLOR=(100,0,200)
BOSS_COLOR=(100,100,100)
BOSS_TOL=0
DBG_BOSS=(255,0,200)
COLOR_TOL=32

# --- NPC placeholder (map-only) colors (strict equality) ---
NPC1_COLOR=(100,0,0)
NPC2_COLOR=(0,100,0)
NPC3_COLOR=(0,0,100)
DBG_NPC1=(0,180,255)
DBG_NPC2=(0,255,180)
DBG_NPC3=(255,255,0)

PORTAL_COLOR_MAPS={
    "lobby": {(0,0,255):"dynamic_world"},
    "world1": {(0,255,255):"lobby"},
    "world2": {(0,255,255):"lobby"},
    "world3": {(0,255,255):"lobby"},
    "world4": {(0,255,255):"lobby"},
    "world5": {(0,255,255):"lobby"},
}

DEFAULT_IDLE = os.path.join("assets","idle.png")
DEFAULT_RUNS = [os.path.join("assets","r1.png"), os.path.join("assets","r2.png")]
DEFAULT_JUMP = os.path.join("assets","jump.png")
SKINS_ROOT   = os.path.join("assets","skins")
SKIN_SLOTS   = {K_1:"1", K_2:"2", K_3:"3", K_4:"4", K_5:"5"}
AVATARS_DIR  = os.path.join("assets","avatars")
PIXEL_FONT_PATH = os.path.join("assets","pixel.ttf")

INTRO_TITLE_TIME=1.5; INTRO_FADE_TIME=0.6

# -----------------------------
# 2) Font & text
# -----------------------------
class PixelFont:
    def __init__(self, path, base_px=12, scale=2):
        self.scale=max(1,int(scale))
        if path and os.path.exists(path): self._font=pygame.font.Font(path, base_px)
        else: self._font=pygame.font.SysFont("consolas", base_px)
    def render(self, text, color=(255,255,255)):
        s=self._font.render(text, False, color)
        if self.scale!=1:
            w,h=s.get_size(); s=pygame.transform.scale(s,(w*self.scale, h*self.scale))
        return s

def wrap_draw_multiline(surface, font, text, x, y, max_w, line_h, color=(235,235,235)):
    text=text or ""; yy=y
    for para in text.split("\n"):
        words=para.split(" "); line=""
        for w in words:
            test=(line+" "+w).strip(); r=font.render(test, color)
            if r.get_width()>max_w and line:
                surface.blit(font.render(line, color),(x,yy)); yy+=line_h; line=w
            else:
                line=test
        if line:
            surface.blit(font.render(line, color),(x,yy)); yy+=line_h
    return yy

# -----------------------------
# 3) Intros, interactions, avatars
# -----------------------------
def _normalize_intro_text(raw):
    raw=raw.replace("\r\n","\n").replace("\r","\n")
    lines=raw.split("\n"); out=[]
    for ln in lines:
        s=ln.strip()
        if s and all(ch in "-—– " for ch in s) and ("—" in s or "–" in s) and ("---" not in s):
            out.append("---")
        else:
            out.append(ln)
    norm="\n".join(out); norm=re.sub(r"\n{3,}", "\n\n", norm)
    return norm

def load_world_intro(loc_key):
    base_dir=os.path.join("assets","worlds", loc_key.replace("world",""))
    p=os.path.join(base_dir,"intro.txt")
    worldname=f"Świat {loc_key.replace('world','')}"
    introtext="Witaj! Poznaj zasady bezpieczeństwa zanim ruszysz dalej."
    try:
        if os.path.exists(p):
            raw=open(p,"r",encoding="utf-8").read()
            worldname_found=None; intro_started=False; buf=[]
            for ln in raw.replace("\r\n","\n").replace("\r","\n").split("\n"):
                if not intro_started:
                    m_name=re.match(r'^\s*WORLDNAME\s*:\s*(.*)$', ln, re.IGNORECASE)
                    if m_name: worldname_found = (m_name.group(1).strip() or worldname); continue
                    m_intro=re.match(r'^\s*INTROTEXT\s*:\s*(.*)$', ln, re.IGNORECASE)
                    if m_intro: buf.append(m_intro.group(1)); intro_started=True; continue
                else:
                    buf.append(ln)
            if worldname_found: worldname=worldname_found
            introtext=_normalize_intro_text("\n".join(buf).strip()) or introtext
    except Exception:
        pass
    return worldname, introtext

@dataclass
class ScriptedInteraction:
    context: str
    sage: str
    optA: str
    optB: str
    good: str
    bad: str
    speed_context: float = 38.0
    speed_sage: float = 32.0
    speed_feedback: float = 36.0
    correct_letter: str = "B"
    avatar: str | None = None
def default_interaction_scripts():
    return [
        ScriptedInteraction(
            context="Kurier: 'Brakuje 3,50 zł za dopłatę. Kliknij link z SMS.'",
            sage="To phishing. Zawsze wpisuj adres ręcznie lub użyj oficjalnej aplikacji.",
            optA="Klikam link i płacę.",
            optB="Wchodzę ręcznie na stronę firmy kurierskiej.",
            good="Dobrze! Nie korzystaj z linków w SMS.",
            bad="Źle. Link z SMS może być fałszywy.",
            correct_letter="B"
        ),
        ScriptedInteraction(
            context="Mail: 'Twoje konto bankowe zostanie zablokowane. Zaloguj się w linku.'",
            sage="Nie loguj się przez link w mailu. Użyj aplikacji lub wpisz adres samodzielnie.",
            optA="Klikam link i loguję się.",
            optB="Uruchamiam aplikację banku lub wpisuję adres ręcznie.",
            good="Świetnie — to bezpieczne.",
            bad="Ryzyko przejęcia danych logowania.",
            correct_letter="B"
        ),
        ScriptedInteraction(
            context="Znajomy: 'Wyślij BLIK, oddam jutro.'",
            sage="Zweryfikuj tożsamość — konto mogło zostać przejęte.",
            optA="Wysyłam od razu.",
            optB="Dzwonię i potwierdzam tożsamość.",
            good="Tak jest — zawsze weryfikuj.",
            bad="Błąd. To może być oszustwo.",
            correct_letter="B"
        )
    ]

def evo_from_skin(s):
    try: return max(1, min(5, int(s or "1")))
    except: return 1

def load_head_image(key, evo_level=None):
    k=(key or "player").lower()
    if k=="player":
        if evo_level is not None:
            try:
                e=int(evo_level)
                if 1<=e<=5:
                    p=os.path.join(AVATARS_DIR,f"player{e}.png")
                    if os.path.exists(p): return pygame.image.load(p).convert_alpha()
            except: pass
        p=os.path.join(AVATARS_DIR,"player.png")
        if os.path.exists(p): return pygame.image.load(p).convert_alpha()
        img=pygame.Surface((256,256), pygame.SRCALPHA)
        pygame.draw.circle(img,(180,180,200,255),(128,110),64)
        pygame.draw.rect(img,(180,180,200,255), pygame.Rect(64,148,128,92), border_radius=12)
        return img
    p=os.path.join(AVATARS_DIR,f"{k}.png")
    if os.path.exists(p): return pygame.image.load(p).convert_alpha()
    return load_head_image("player", evo_level=evo_level)

def infer_speaker_from_text(txt):
    if not txt: return None
    m=re.match(r"^\s*([^\n:]{1,32})\s*:\s*", str(txt))
    if not m: return None
    key=m.group(1).strip().lower()
    key=re.sub(r"\s+","_", key); key=re.sub(r"[^0-9a-ząćęłńóśźż_-]","", key, flags=re.IGNORECASE)
    return key or None

# -----------------------------
# 4) Animations
# -----------------------------
def load_frame(path, target_h):
    if not path or not os.path.exists(path): return None
    raw=pygame.image.load(path).convert_alpha()
    if raw.get_height()!=target_h:
        scale=target_h/float(raw.get_height())
        raw=pygame.transform.scale(raw,(int(raw.get_width()*scale), target_h))
    return raw

def skin_paths(skin_folder):
    if skin_folder:
        base=os.path.join(SKINS_ROOT, skin_folder)
        return {"idle": os.path.join(base,"idle.png"),
                "runs": [os.path.join(base,"r1.png"), os.path.join(base,"r2.png")],
                "jump": os.path.join(base,"jump.png"),
                "climb":[os.path.join(base,"climb1.png"), os.path.join(base,"climb2.png")]}
    return {"idle": DEFAULT_IDLE, "runs": DEFAULT_RUNS, "jump": DEFAULT_JUMP, "climb": []}

def build_animations_from_paths(paths, w, h):
    def centerize(frames):
        max_w=max(f.get_width() for f in frames)
        out=[]
        for f in frames:
            if f.get_width()==max_w: out.append(f); continue
            pad=(max_w-f.get_width())//2
            canv=pygame.Surface((max_w,h), pygame.SRCALPHA); canv.blit(f,(pad,0)); out.append(canv)
        return out
    idle_r=[load_frame(paths.get("idle"),h)] if paths.get("idle") else []
    if not idle_r or idle_r[0] is None:
        s=pygame.Surface((w,h), pygame.SRCALPHA); s.fill((40,40,40)); idle_r=[s]
    run_r=[f for p in paths.get("runs",[]) if (f:=load_frame(p,h))] or idle_r[:]
    jump_r=[load_frame(paths.get("jump"),h)] if paths.get("jump") else []
    if not jump_r or jump_r[0] is None: jump_r=idle_r[:]
    climb_r=[f for p in paths.get("climb",[]) if (f:=load_frame(p,h))] or run_r[:]
    idle_r,run_r,jump_r,climb_r = map(centerize, [idle_r,run_r,jump_r,climb_r])
    def mirror(frames): return [pygame.transform.flip(f,True,False) for f in frames]
    return {"idle":{"right":idle_r,"left":mirror(idle_r)},
            "run":{"right":run_r,"left":mirror(run_r)},
            "jump":{"right":jump_r,"left":mirror(jump_r)},
            "climb":{"right":climb_r,"left":mirror(climb_r)}}

class Animator:
    DUR={"idle":IDLE_MS,"run":RUN_MS,"jump":JUMP_MS,"climb":CLIMB_MS}
    def __init__(self, anim): self.anim=anim; self.state="idle"; self.facing="right"; self.index=0; self.accum_ms=0
    def set_state(self, st):
        if st!=self.state: self.state=st; self.index=0; self.accum_ms=0
    def set_facing_dir(self, d): self.facing="right" if d>=0 else "left"
    def update(self, dt_ms):
        frames=self.anim[self.state][self.facing];
        if len(frames)<=1: return
        dur=self.DUR.get(self.state,120); self.accum_ms+=dt_ms
        while self.accum_ms>=dur:
            self.accum_ms-=dur; self.index=(self.index+1)%len(frames)
    def frame(self): return self.anim[self.state][self.facing][self.index]

# -----------------------------
# 5) World parsing & entities
# -----------------------------
@dataclass
class Location:
    key: str
    name: str
    bg_path: str
    mask_path: str
    spawn: tuple

class PortalEntity:
    def __init__(self, rect, target, base_color):
        self.rect = rect
        self.target = target
        self.color = base_color

class LadderEntity:
    def __init__(self, rect):
        self.rect = rect

class TriggerEntity:
    def __init__(self, rect, idx):
        self.rect = rect
        self.idx = idx

class GateEntity:
    def __init__(self, rect, idx):
        self.rect = rect
        self.idx = idx
        self.locked = True

def make_world_paths(key):
    base=os.path.join("assets","worlds",key)
    bg_new=os.path.join(base,"map","bg.png"); mask_new=os.path.join(base,"map","map_mask.png")
    bg_old=os.path.join(base,"bg.png"); mask_old=os.path.join(base,"map_mask.png")
    bg = bg_new if os.path.exists(bg_new) else (bg_old if os.path.exists(bg_old) else None)
    mask = mask_new if os.path.exists(mask_new) else (mask_old if os.path.exists(mask_old) else None)
    return bg, mask

def build_locations():
    lobby_bg,lobby_mask=make_world_paths("lobby")
    lobby=Location("lobby","Lobby", lobby_bg or os.path.join("assets","bg.png"), lobby_mask or os.path.join("assets","map_mask.png"), spawn=(250,None))
    worlds=[]
    for i in range(1,6):
        wbg,wmask=make_world_paths(str(i))
        worlds.append(Location(f"world{i}",f"World {i}", wbg or os.path.join("assets","bg.png"), wmask or os.path.join("assets","map_mask.png"), spawn=(300,None)))
    return {loc.key:loc for loc in [lobby]+worlds}

def load_background(path):
    if path and os.path.exists(path):
        img=pygame.image.load(path).convert(); h=PLAY_H; w=int(img.get_width()*(h/img.get_height()))
        return pygame.transform.scale(img,(w,h)), w, h
    return None,0,0

def parse_world_from_mask(mask_path, y_offset, tile, threshold, portal_color_map):
    if not (mask_path and os.path.exists(mask_path)): return [], 4096, [], [], [], [], []
    surf=pygame.image.load(mask_path).convert_alpha()
    if surf.get_height()!=PLAY_H:
        new_w=int(surf.get_width()*(PLAY_H/surf.get_height())); surf=pygame.transform.scale(surf,(new_w,PLAY_H))
    w,h=surf.get_width(), surf.get_height()
    gx_max,gy_max=w//tile, h//tile
    portal_grid=[[None]*gx_max for _ in range(gy_max)]
    solid_grid=[[False]*gx_max for _ in range(gy_max)]
    ladder_grid=[[False]*gx_max for _ in range(gy_max)]
    trigger_grid=[[-1]*gx_max for _ in range(gy_max)]
    gate_grid=[[-1]*gx_max for _ in range(gy_max)]
    arena_grid=[[False]*gx_max for _ in range(gy_max)]
    boss_grid=[[False]*gx_max for _ in range(gy_max)]
    portal_colors=list(portal_color_map.keys())
    for gy in range(gy_max):
        for gx in range(gx_max):
            cx,cy=gx*tile+tile//2, gy*tile+tile//2
            if cx>=w or cy>=h: continue
            r,g,b,*_ = surf.get_at((cx,cy))
            matched=None
            for pcol in portal_colors:
                if abs(r-pcol[0])<=COLOR_TOL and abs(g-pcol[1])<=COLOR_TOL and abs(b-pcol[2])<=COLOR_TOL:
                    matched=portal_color_map[pcol]; break
            if matched is not None: portal_grid[gy][gx]=matched; continue
            trig=False
            for ti,tcol in enumerate(TRIGGER_COLORS):
                if abs(r-tcol[0])<=COLOR_TOL and abs(g-tcol[1])<=COLOR_TOL and abs(b-tcol[2])<=COLOR_TOL:
                    trigger_grid[gy][gx]=ti; trig=True; break
            if trig: continue
            ghit=False
            for gi,gcol in enumerate(GATE_COLORS):
                if abs(r-gcol[0])<=COLOR_TOL and abs(g-gcol[1])<=COLOR_TOL and abs(b-gcol[2])<=COLOR_TOL:
                    gate_grid[gy][gx]=gi; ghit=True; break
            if ghit: continue
            if (abs(r-LADDER_COLOR[0])<=LADDER_TOL and abs(g-LADDER_COLOR[1])<=LADDER_TOL and abs(b-LADDER_COLOR[2])<=LADDER_TOL):
                ladder_grid[gy][gx]=True; continue
            if (r==BOSS_COLOR[0] and g==BOSS_COLOR[1] and b==BOSS_COLOR[2]):
                boss_grid[gy][gx]=True; continue
            if (r==ARENA_COLOR[0] and g==ARENA_COLOR[1] and b==ARENA_COLOR[2]):
                arena_grid[gy][gx]=True; continue
            if (r==0 and g==0 and b==0):
                solid_grid[gy][gx]=True
    colliders=[pygame.Rect(gx*tile, gy*tile+y_offset, tile, tile)
               for gy in range(gy_max) for gx in range(gx_max) if solid_grid[gy][gx]]

    def merge_regions(grid, accept_fn):
        visited=[[False]*gx_max for _ in range(gy_max)]
        rects=[]
        for gy in range(gy_max):
            for gx in range(gx_max):
                val=grid[gy][gx]
                if not accept_fn(val) or visited[gy][gx]: continue
                stack=[(gx,gy)]; visited[gy][gx]=True
                min_x=max_x=gx; min_y=max_y=gy
                while stack:
                    x,y=stack.pop()
                    min_x,min_y,max_x,max_y = min(min_x,x),min(min_y,y),max(max_x,x),max(max_y,y)
                    for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                        if 0<=nx<gx_max and 0<=ny<gy_max and (not visited[ny][nx]) and grid[ny][nx]==val:
                            visited[ny][nx]=True; stack.append((nx,ny))
                rects.append((val, pygame.Rect(min_x*tile, min_y*tile+y_offset, (max_x-min_x+1)*tile, (max_y-min_y+1)*tile)))
        return rects

    portals=[PortalEntity(rect, tgt, (0,0,255)) for tgt,rect in merge_regions(portal_grid, lambda v: v is not None)]
    # ladders per column (vertical merge)
    ladders=[]
    for gx in range(gx_max):
        gy=0
        while gy<gy_max:
            if ladder_grid[gy][gx]:
                start=gy
                while gy+1<gy_max and ladder_grid[gy+1][gx]: gy+=1
                end=gy
                ladders.append(LadderEntity(pygame.Rect(gx*tile, start*tile+y_offset, tile, (end-start+1)*tile)))
            gy+=1
    triggers=[TriggerEntity(rect, idx) for idx,rect in merge_regions(trigger_grid, lambda v: v>=0)]
    gates=[GateEntity(rect, idx) for idx,rect in merge_regions(gate_grid, lambda v: v>=0)]
    arena_zones=[rect for _v,rect in merge_regions(arena_grid, lambda v: v is True)]
    boss_spawns=[rect for _v,rect in merge_regions(boss_grid, lambda v: v is True)]
    return colliders, gx_max*tile, portals, ladders, triggers, gates, arena_zones, boss_spawns
def parse_npc_spawns(npc_mask_path, y_offset, tile):
    """Build NPC spawn rectangles from a separate npc_mask.png (strict RGB match)."""
    if not (npc_mask_path and os.path.exists(npc_mask_path)):
        return [], [], []
    surf = pygame.image.load(npc_mask_path).convert()
    if surf.get_height() != PLAY_H:
        new_w = int(surf.get_width() * (PLAY_H / surf.get_height()))
        surf = pygame.transform.scale(surf, (new_w, PLAY_H))
    w, h = surf.get_width(), surf.get_height()
    gx_max, gy_max = w // tile, h // tile
    g1 = [[False]*gx_max for _ in range(gy_max)]
    g2 = [[False]*gx_max for _ in range(gy_max)]
    g3 = [[False]*gx_max for _ in range(gy_max)]
    for gy in range(gy_max):
        for gx in range(gx_max):
            cx, cy = gx*tile + tile//2, gy*tile + tile//2
            if cx>=w or cy>=h:
                continue
            r,g,b,*_ = surf.get_at((cx,cy))
            if (r,g,b)==NPC1_COLOR:
                g1[gy][gx] = True
            elif (r,g,b)==NPC2_COLOR:
                g2[gy][gx] = True
            elif (r,g,b)==NPC3_COLOR:
                g3[gy][gx] = True

    def merge_bool_grid(grid):
        visited = [[False]*gx_max for _ in range(gy_max)]
        rects = []
        for y in range(gy_max):
            for x in range(gx_max):
                if not grid[y][x] or visited[y][x]:
                    continue
                stack = [(x,y)]
                visited[y][x] = True
                min_x = max_x = x
                min_y = max_y = y
                while stack:
                    cx,cy = stack.pop()
                    if cx<min_x: min_x=cx
                    if cy<min_y: min_y=cy
                    if cx>max_x: max_x=cx
                    if cy>max_y: max_y=cy
                    for nx,ny in ((cx-1,cy),(cx+1,cy),(cx,cy-1),(cx,cy+1)):
                        if 0<=nx<gx_max and 0<=ny<gy_max and (not visited[ny][nx]) and grid[ny][nx]:
                            visited[ny][nx] = True
                            stack.append((nx,ny))
                rects.append(pygame.Rect(min_x*tile, min_y*tile+y_offset, (max_x-min_x+1)*tile, (max_y-min_y+1)*tile))
        return rects
    return merge_bool_grid(g1), merge_bool_grid(g2), merge_bool_grid(g3)

def load_npc_image_scaled(world_number: int, npc_id: int, target_h: int):
    """
    Load npc1.png for given npc_id from assets/worlds/<world_number>/npc/npc<npc_id>/npc1.png
    and scale to target_h (preserving aspect). Returns a Surface.
    """
    base = os.path.join("assets","worlds", str(world_number), "npc", f"npc{npc_id}")
    p = os.path.join(base, "npc1.png")
    try:
        img = pygame.image.load(p).convert_alpha()
    except Exception:
        # Fallback placeholder
        img = pygame.Surface((int(max(1, target_h*0.6)), max(1, target_h)), pygame.SRCALPHA)
        pygame.draw.rect(img, (40,200,240,255), img.get_rect(), 4, border_radius=10)
    if target_h <= 0:
        target_h = max(1, img.get_height())
    if img.get_height() != target_h:
        scale = target_h / float(img.get_height())
        w = max(1, int(round(img.get_width() * scale)))
        img = pygame.transform.scale(img, (w, target_h))
    return img

def load_npc_frames_scaled(world_number: int, npc_id: int, target_h: int):
    base = os.path.join("assets","worlds", str(world_number), "npc", f"npc{npc_id}")
    p1 = os.path.join(base, "npc1.png")
    p2 = os.path.join(base, "npc2.png")
    frames = []
    for pth in (p1, p2):
        try:
            img = pygame.image.load(pth).convert_alpha()
            frames.append(img)
        except Exception:
            frames.append(None)
    if frames[0] is None and frames[1] is None:
        ph = pygame.Surface((max(1,int(target_h*0.6)), max(1,target_h)), pygame.SRCALPHA)
        pygame.draw.rect(ph, (240, 220, 40, 255), ph.get_rect(), 4, border_radius=10)
        frames = [ph, ph]
    else:
        if frames[0] is None and frames[1] is not None: frames[0]=frames[1].copy()
        if frames[1] is None and frames[0] is not None: frames[1]=frames[0].copy()
    out=[]
    target_h=max(1,int(target_h))
    for img in frames:
        if img.get_height()!=target_h:
            scale = target_h/float(img.get_height())
            w = max(1, int(round(img.get_width()*scale)))
            img = pygame.transform.scale(img, (w, target_h))
        out.append(img)
    return out

# ---- Portal frames: 2-frame per-world animation (frame1.png, frame2.png) ----
_PORTAL_FRAMES_CACHE = {}
def load_portal_frames_scaled(world_number: int, target_h: int):
    # Load assets/worlds/<world_number>/portal/frame1.png and frame2.png,
    # scale to target_h (preserving aspect). Returns [Surface, Surface].
    # On failure, returns two placeholder frames.
    key = (int(world_number) if world_number is not None else -1, int(max(1, target_h)))
    if key in _PORTAL_FRAMES_CACHE:
        return _PORTAL_FRAMES_CACHE[key]
    frames = []
    base = os.path.join('assets','worlds', str(int(world_number)), 'portal')
    p1 = os.path.join(base, 'frame1.png')
    p2 = os.path.join(base, 'frame2.png')
    for p in (p1, p2):
        try:
            if os.path.exists(p):
                img = pygame.image.load(p).convert_alpha()
                frames.append(img)
        except Exception:
            pass
    if len(frames) == 0:
        import pygame as _pg
        h = int(max(1, target_h))
        w = max(32, int(h*0.7))
        ph1 = _pg.Surface((w,h), _pg.SRCALPHA)
        ph2 = _pg.Surface((w,h), _pg.SRCALPHA)
        _pg.draw.rect(ph1, (120, 200, 255, 200), ph1.get_rect(), 6, border_radius=10)
        _pg.draw.rect(ph2, (120, 200, 255, 140), ph2.get_rect(), 6, border_radius=18)
        frames = [ph1, ph2]
    elif len(frames) == 1:
        frames = [frames[0], frames[0].copy()]
    out = []
    th = int(max(1, target_h))
    for img in frames:
        if img.get_height() != th:
            scale = th / float(img.get_height())
            w = max(1, int(round(img.get_width() * scale)))
            img = pygame.transform.scale(img, (w, th))
        out.append(img)
    _PORTAL_FRAMES_CACHE[key] = out
    return out
# Variant that supports a string world key "lobby" or an int world number
_PORTAL_FRAMES_CACHE_ANY = {}
def load_portal_frames_scaled_any(world_key, target_h: int):
    # Normalize cache key
    cache_world = str(world_key) if world_key is not None else "none"
    key = (cache_world, int(max(1, target_h)))
    if key in _PORTAL_FRAMES_CACHE_ANY:
        return _PORTAL_FRAMES_CACHE_ANY[key]
    # Decide base path by key type/value
    try:
        if isinstance(world_key, str) and world_key.lower() == "lobby":
            base = os.path.join("assets","worlds","lobby","portal")
        elif isinstance(world_key, str) and world_key.lower() == "ending":
            base = os.path.join("assets","ending","portal")
        else:
            wn = int(world_key)
            base = os.path.join("assets","worlds", str(wn), "portal")
    except Exception:
        # Fallback to lobby for unknown keys
        base = os.path.join("assets","worlds","lobby","portal")
    paths = [os.path.join(base, "frame1.png"), os.path.join(base, "frame2.png")]
    frames = []
    for p in paths:
        try:
            if os.path.exists(p):
                img = pygame.image.load(p).convert_alpha()
                frames.append(img)
        except Exception:
            pass
    if len(frames) == 0:
        import pygame as _pg
        h = int(max(1, target_h))
        w = max(32, int(h*0.7))
        ph1 = _pg.Surface((w,h), _pg.SRCALPHA)
        ph2 = _pg.Surface((w,h), _pg.SRCALPHA)
        _pg.draw.rect(ph1, (120, 200, 255, 200), ph1.get_rect(), 6, border_radius=10)
        _pg.draw.rect(ph2, (120, 200, 255, 140), ph2.get_rect(), 6, border_radius=18)
        frames = [ph1, ph2]
    elif len(frames) == 1:
        frames = [frames[0], frames[0].copy()]
    # Scale both
    out = []
    th = int(max(1, target_h))
    for img in frames:
        if img.get_height() != th:
            scale = th / float(img.get_height())
            w = max(1, int(round(img.get_width() * scale)))
            img = pygame.transform.scale(img, (w, th))
        out.append(img)
    _PORTAL_FRAMES_CACHE_ANY[key] = out
    return out

def build_collider_buckets(colliders, tile=TILE):
    buckets=defaultdict(list)
    for r in colliders: buckets[(r.x//tile, (r.y-PLAY_RECT.top)//tile)].append(r)
    return buckets

def iter_near_colliders(buckets, rect, tile=TILE, pad_cells=1):
    left=(rect.left//tile)-pad_cells; right=(rect.right//tile)+pad_cells
    top=((rect.top-PLAY_RECT.top)//tile)-pad_cells; bottom=((rect.bottom-PLAY_RECT.top)//tile)+pad_cells
    seen=set()
    for gy in range(top,bottom+1):
        for gx in range(left,right+1):
            for r in buckets.get((gx,gy),[]):
                if id(r) in seen: continue
                seen.add(id(r)); yield r

def ground_support_ratio_generic(player_rect, colliders_iter, inset):
    foot=pygame.Rect(player_rect.left+inset, player_rect.bottom, max(1, player_rect.width-2*inset), SUPPORT_TOLERANCE)
    supported=0
    for c in colliders_iter:
        if c.top < foot.bottom and c.top >= player_rect.bottom-1:
            overlap_left=max(foot.left,c.left); overlap_right=min(foot.right,c.right)
            if overlap_right>overlap_left: supported += (overlap_right-overlap_left)
    return supported/float(foot.width), foot

def ground_support_ratio(player_rect, colliders_iter):
    return ground_support_ratio_generic(player_rect, colliders_iter, SUPPORT_INSET)

def move_and_collide(px, py, vx, vy, dt, buckets, player_w, player_h):

    # Detect ground support at current position to allow stair-step only when grounded
    pr0 = pygame.Rect(int(px), int(py), player_w, player_h)
    support_ratio,_ = ground_support_ratio(pr0, iter_near_colliders(buckets, pr0))
    grounded0 = (support_ratio >= GROUND_LOSS_RATIO)

    on_ground = False
    px_next = px + vx*dt
    pr = pygame.Rect(int(px_next), int(py), player_w, player_h)

    # Horizontal collisions with optional 1-tile stair-step
    for c in iter_near_colliders(buckets, pr):
        if pr.colliderect(c):
            if grounded0 and vx != 0:
                step_target_y = c.top - player_h
                step_h = (py + player_h) - c.top
                if step_h > 0 and step_h <= TILE:
                    test_py = step_target_y
                    test_pr = pygame.Rect(int(px_next), int(test_py), player_w, player_h)
                    clear = True
                    for cc in iter_near_colliders(buckets, test_pr):
                        if test_pr.colliderect(cc):
                            clear = False; break
                    if clear:
                        py = test_py
                        pr.y = int(py)
                        # re-check with updated pr against same collider
                        pr.x = int(px_next)
                        continue
            if vx > 0:
                px_next = c.left - player_w
            elif vx < 0:
                px_next = c.right
            pr.x = int(px_next)

    # Vertical
    vy += GRAVITY * dt
    py_next = py + vy*dt
    pr.y = int(py_next)
    for c in iter_near_colliders(buckets, pr):
        if pr.colliderect(c):
            if vy > 0:
                py_next = c.top - player_h; vy = 0; on_ground = True
            elif vy < 0:
                py_next = c.bottom; vy = 0
            pr.y = int(py_next)

    pr_after = pygame.Rect(int(px_next), int(py_next), player_w, player_h)
    ratio,_ = ground_support_ratio(pr_after, iter_near_colliders(buckets, pr_after))
    if on_ground and ratio < GROUND_LOSS_RATIO:
        on_ground = False
    return px_next, py_next, vy, on_ground, ratio, None
# -----------------------------
# 6) Portals & wipes
# -----------------------------
PORTAL_IMG_GENERIC=os.path.join("assets","portals","portal_generic.png")
def portal_img_for_target(target_key):
    p1=os.path.join("assets","portals",f"{target_key}.png")
    if os.path.exists(p1): return p1
    p=os.path.join("assets","portals",f"portal_{target_key}.png")
    if os.path.exists(p): return p
    if os.path.exists(PORTAL_IMG_GENERIC): return PORTAL_IMG_GENERIC
    return None
def dynamic_target_for_evo(e): return f"world{e}" if 1<=e<=5 else "world1"
def required_level_for_portal(t):
    if t.startswith("world"):
        try: return max(1,min(5,int(t.replace("world",""))))
        except: return 1
    return 1
def snap_to_grid(v, grid=TILE): return int(round(v/float(grid))*grid)

def wipe_out_down(screen, clock, duration=0.55, blur_px=10, blur_bands=8, max_alpha=170):
    snapshot=screen.copy(); overlay_full=pygame.Surface((LOGICAL_W,LOGICAL_H), pygame.SRCALPHA)
    band=pygame.Surface((LOGICAL_W,blur_px), pygame.SRCALPHA); total=max(1,int(duration*120))
    for i in range(total+1):
        t=i/float(total); head=int(t*LOGICAL_H)
        screen.blit(snapshot,(0,0))
        if head>0:
            overlay_full.fill((0,0,0,255)); screen.blit(overlay_full,(0,0), area=pygame.Rect(0,0,LOGICAL_W,head))
        for b in range(blur_bands):
            y=head+b*blur_px
            if y>=LOGICAL_H: break
            a=max(0,int(max_alpha*(1.0 - b/float(blur_bands))))
            band.fill((0,0,0,a)); screen.blit(band,(0,y))
        pygame.display.flip(); clock.tick(120)

def wipe_in_down(screen, clock, duration=0.55, blur_px=10, blur_bands=8, max_alpha=170):
    snapshot=screen.copy(); overlay_full=pygame.Surface((LOGICAL_W,LOGICAL_H), pygame.SRCALPHA)
    band=pygame.Surface((LOGICAL_W,blur_px), pygame.SRCALPHA); total=max(1,int(duration*120))
    for i in range(total+1):
        t=i/float(total); head=int(t*LOGICAL_H)
        overlay_full.fill((0,0,0,255)); screen.blit(overlay_full,(0,0))
        screen.blit(snapshot,(0,0), area=pygame.Rect(0,0,LOGICAL_W,head))
        for b in range(blur_bands):
            y=head-(b+1)*blur_px
            if y<0: break
            a=max(0,int(max_alpha*(1.0 - b/float(blur_bands))))
            band.fill((0,0,0,a)); screen.blit(band,(0,y))
        pygame.display.flip(); clock.tick(120)

# -----------------------------
# 7) Typewriter & Interaction runtime

# -----------------------------
# 7b) Boss Quiz runtime (3-choice Q/A from bossfight.txt)
# -----------------------------

class BossQuizRuntime:
    """Boss Q&A drawn at top; instant question (no typewriter), randomized answer order, shake on wrong.
       Calls on_result(correct: bool) on confirm."""
    def __init__(self, questions, font, default_cps=32.0, on_result=None):
        import random
        self.questions_all = questions[:] if questions else []
        random.shuffle(self.questions_all)  # random order of questions
        self.questions = self.questions_all[:]
        self.font_ans = font
        try:
            qh = int(max( int(font.get_height()*1.5), font.get_height()+6 ))
            self.font_q = pygame.font.Font(None, qh)
        except Exception:
            self.font_q = font
        self.selection = 0
        self.state = 'question'   # 'question' | 'feedback'
        self.feedback_timer = 0.0
        self.feedback_time = 0.5
        
        self.feedback_time_correct = 0.45
        self.feedback_time_wrong = 1.0
        self._feedback_total_time = 0.0
        self.last_was_correct = True
        self.cur = None
        self.on_result = on_result
        self.shake_t = 0.0
        self.shake_amp = 6
        self.top_margin_px = 28
        # slide-in/out animation
        self.anim_state = 'enter'  # 'enter'|'visible'|'exit'|'hidden'
        self.anim_t = 0.0
        self.anim_dur = 0.87
        self.opt_texts = []   # shuffled ['A','B','C'] texts
        self.opt_perm = []    # permutation indices mapping from displayed index -> original [a,b,c] index
        self.correct_idx_shuffled = 0
        self.pick_next()

    def start_enter(self):
        self.anim_state='enter'; self.anim_t=0.0
    def start_exit(self):
        if self.anim_state!='exit':
            self.anim_state='exit'; self.anim_t=0.0
    def _ease_in(self, p):
        p=max(0.0,min(1.0,p)); return p*p*p
    def _ease_out(self, p):
        p=max(0.0,min(1.0,p)); q=1.0-p; return 1.0 - q*q*q
    def pick_next(self):
        import random
        if not self.questions:
            self.questions = self.questions_all[:]
            random.shuffle(self.questions)
        self.cur = self.questions.pop(0)
        # shuffle options and compute shuffled correct index
        options = [self.cur.get('a',''), self.cur.get('b',''), self.cur.get('c','')]
        perm = [0,1,2]
        random.shuffle(perm)
        self.opt_perm = perm
        self.opt_texts = [options[i] for i in perm]
        orig_corr = int(self.cur.get('correct', 0))
        self.correct_idx_shuffled = perm.index(orig_corr)
        # reset state
        self.selection = 0
        self.state = 'question'
        self.feedback_timer = 0.0
        self.shake_t = 0.0

    def handle_event(self, event):
        if self.state == 'feedback':
            return False
        if event.type == KEYDOWN:
            if event.key in (K_UP, K_w):
                self.selection = (self.selection - 1) % 3; return True
            if event.key in (K_DOWN, K_s):
                self.selection = (self.selection + 1) % 3; return True
            if event.key in (K_1, K_2, K_3):
                self.selection = {K_1:0, K_2:1, K_3:2}[event.key]; return True
            if event.key in (K_RETURN, K_SPACE, K_e, K_x, K_z):
                good = (self.selection == self.correct_idx_shuffled)
                self.state = 'feedback'
                self.last_was_correct = bool(good)
                total = getattr(self, 'feedback_time_correct', 0.45) if good else getattr(self, 'feedback_time_wrong', 1.0)
                self._feedback_total_time = float(total)
                self.feedback_timer = float(total)
                if not good:
                    self.shake_t = 0.25  # trigger horizontal shake
                try:
                    if callable(self.on_result):
                        self.on_result(bool(good))
                except Exception:
                    pass
                return True
        return False

    def update(self, dt):
        # --- ENDING FADE progression ---
        if getattr(self, 'ending_phase', None) == 'fadeout':
            self.ending_fade_t += dt
            if self.ending_fade_t >= self.ENDING_FADE_TIME:
                self.ending_phase = None
                self.ending_active = True
        if getattr(self, 'ending_active', False):
            return
        if getattr(self, 'ending_active', False):
            return

        # slide animation tick
        if self.anim_state in ('enter','exit'):
            self.anim_t += dt
            if self.anim_t >= self.anim_dur:
                self.anim_state = 'visible' if self.anim_state=='enter' else 'hidden'
        if self.state == 'feedback':
            self.feedback_timer = max(0.0, self.feedback_timer - dt)
            if self.feedback_timer <= 0.0:
                self.pick_next()
        if self.shake_t > 0.0:
            self.shake_t = max(0.0, self.shake_t - dt)
    def draw(self, surface):
        panel_h = int(PLAY_H * 0.30)
        panel_w = int(LOGICAL_W * 0.82)
        unit_x = (LOGICAL_W - panel_w)//2
        unit_y = PLAY_RECT.top + self.top_margin_px
        off_total = -(unit_y + panel_h)
        y_off = 0
        if self.anim_state=='enter':
            y_off = int(off_total * (1.0 - self._ease_in(self.anim_t / max(0.001, self.anim_dur))))
        elif self.anim_state=='exit':
            y_off = int(off_total * (self._ease_out(self.anim_t / max(0.001, self.anim_dur))))
        elif self.anim_state=='hidden':
            y_off = int(off_total)
        # horizontal shake offset when wrong
        offx = 0
        if self.shake_t > 0.0:
            phase = (self.shake_t * 40.0)
            offx = int(math.sin(phase) * self.shake_amp)
        panel = pygame.Surface((panel_w, panel_h), pygame.SRCALPHA)
        panel.fill((18, 20, 26, 225))
        pygame.draw.rect(panel, (190, 190, 220, 255), panel.get_rect(), 2, border_radius=10)

        y = 12
        # Instant full question text (no typewriter)
        shown = self.cur.get('q','')
        y = wrap_draw_multiline(panel, self.font_q, shown, 16, y, panel_w - 32, 28, (255, 240, 160))  # 255, 240, 160
        y += 6

        # Choices (shuffled)
        for i, text in enumerate(self.opt_texts):
            is_sel = (i == self.selection)
            col = (220,220,220)
            bg = None

            if self.state == 'feedback':
                good_sel = (self.selection == self.correct_idx_shuffled)
                if is_sel:
                    if good_sel:
                        col = (30,200,60)
                        bg  = (40,80,40,110)
                    else:
                        col = (220,50,50)
                        bg  = (90,30,30,110)
                if (not good_sel) and (i == self.correct_idx_shuffled) and (not is_sel):
                    # blink orange to reveal correct answer
                    try:
                        elapsed = max(0.0, float(getattr(self, "_feedback_total_time", 0.0)) - float(self.feedback_timer))
                    except Exception:
                        elapsed = 0.0
                    blink_on = int(elapsed * 6.0) % 2 == 0  # ~3 Hz
                    if blink_on:
                        col = (255,190,60)
                        bg  = (120,80,0,110)
            elif is_sel:
                col = (255,255,255)
                bg = (60,60,70,90)

            line = f"{['A','B','C'][i]}. {text}"
            surf = self.font_ans.render(line, col)
            if bg:
                box = pygame.Surface((surf.get_width()+12, surf.get_height()+6), pygame.SRCALPHA)
                box.fill(bg)
                panel.blit(box, (18, y-2))
            panel.blit(surf, (24, y))
            y += 30

        # Bottom-left mini instructions
        try:
            help_txt = 'Wybór: strzałki ↑/↓ lub 1–3, zatwierdź Enter'
            help_surf = self.font_ans.render(help_txt, (100,100,100))
            panel.blit(help_surf, (12, panel.get_height() - help_surf.get_height() - 8))
        except Exception:
            pass
        surface.blit(panel, (unit_x + offx, unit_y + y_off))
ADVANCE_KEYS={K_SPACE,K_RETURN,K_KP_ENTER,K_e,K_z,K_x,K_RIGHT}
ADVANCE_COOLDOWN=0.2

def is_advance_event(event): return (event.type==KEYDOWN) and (event.key in ADVANCE_KEYS)
def any_advance_key_down(keys):
    try: return any(keys[k] for k in ADVANCE_KEYS)
    except Exception: return False

class Typewriter:
    def __init__(self, text, cps):
        raw=text or ""
        try: self.pages=re.split(r'\s*---\s*', raw)
        except Exception: self.pages=[raw]
        if not self.pages: self.pages=[""]
        self.page_index=0; self.cps=max(1.0, float(cps)); self.shown=0.0; self.done=False
    def current_full(self): return self.pages[self.page_index]
    def update(self, dt):
        if self.done: return
        full=self.current_full(); self.shown += self.cps*dt
        if self.shown>=len(full): self.shown=float(len(full)); self.done=True
    def force_done(self): self.shown=float(len(self.current_full())); self.done=True
    def has_next_page(self): return self.page_index < len(self.pages)-1
    def next_page(self):
        if self.has_next_page(): self.page_index+=1; self.shown=0.0; self.done=False
    def get_text(self): return self.current_full()[:int(self.shown)]

class InteractionRuntime:
    def __init__(self, script: ScriptedInteraction):
        self.script=script; self.stage='context'
        self.ctx_tw=Typewriter(script.context, script.speed_context)
        self.sage_tw=Typewriter(script.sage, script.speed_sage) if script.sage else None
        self.feedback_tw=None
        self.swap=bool(random.getrandbits(1))
        self.viewA = script.optA if not self.swap else script.optB
        self.viewB = script.optB if not self.swap else script.optA
        canon_idx = 0 if script.correct_letter=="A" else 1
        self.correct_idx = canon_idx if not self.swap else (1-canon_idx)
        self.selection=0; self.result_good=None
    def update(self, dt):
        if   self.stage=='context': self.ctx_tw.update(dt)
        elif self.stage=='sage'   : self.sage_tw and self.sage_tw.update(dt)
        elif self.stage=='feedback': self.feedback_tw and self.feedback_tw.update(dt)
    def on_advance(self):
        if self.stage=='context':
            if not self.ctx_tw.done: self.ctx_tw.force_done(); return False
            if self.ctx_tw.has_next_page(): self.ctx_tw.next_page(); return False
            self.stage = 'sage' if (self.sage_tw and len(self.script.sage.strip())>0) else 'choices'; return False
        if self.stage=='sage':
            if not self.sage_tw.done: self.sage_tw.force_done(); return False
            if self.sage_tw.has_next_page(): self.sage_tw.next_page(); return False
            self.stage='choices'; return False
        if self.stage=='feedback':
            if not self.feedback_tw.done: self.feedback_tw.force_done(); return False
            if self.feedback_tw.has_next_page(): self.feedback_tw.next_page(); return False
            if self.result_good: return True
            self.stage='choices'; self.result_good=None; self.feedback_tw=None; return False
        return False
    def on_choice_move(self, dy): self.selection=(self.selection+dy)%2
    def on_choice_confirm(self, choose_idx):
        idx=self.selection if choose_idx is None else int(choose_idx)
        self.result_good=(idx==self.correct_idx)
        fb_text=self.script.good if self.result_good else self.script.bad
        self.feedback_tw=Typewriter(fb_text, self.script.speed_feedback)
        self.stage='feedback'

# -----------------------------
# 8) Helpers
# -----------------------------
def unlock_gates_by_index(gates, gate_idx):
    for g in gates:
        if g.idx==gate_idx: g.locked=False
def recompute_world_clip(gates, world_w_true):
    active=[g.rect.left for g in gates if g.locked]
    return min(active) if active else world_w_true
def ordinal_pl(n): return {1:"pierwsza",2:"druga",3:"trzecia"}.get(int(n), str(n))

# -----------------------------
# 9) Game
# -----------------------------
def load_world_summary(wn):
    """
    Read /assets/worlds/<wn>/summary.txt with lines like:
    MEDRZEC: text...
    PLAYER: text...
    Returns list of dicts: {"speaker": "medrzec"|"player", "text": str}
    """
    import os, re
    path = os.path.join("assets","worlds", str(wn), "summary.txt")
    items = []
    def _norm(tag):
        t = (tag or "").strip().upper()
        if t in ("MEDRZEC","MĘDRZEC","SAGE"):
            return "medrzec"
        if t in ("PLAYER","GRACZ","BOHATER"):
            return "player"
        return None
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            for raw in f:
                line = (raw or "").strip()
                if not line:
                    continue
                m = re.match(r'^\s*([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+)\s*:\s*(.*)$', line)
                if not m:
                    continue
                spk = _norm(m.group(1))
                txt = (m.group(2) or "").replace(r'\n', '\n')
                if spk:
                    items.append({"speaker": spk, "text": txt})
    if not items:
        items = [
            {"speaker":"medrzec","text":"Dobra robota. Ważne, że rozpoznałeś zagrożenia w tym świecie."},
            {"speaker":"player","text":"Dzięki! Lecę dalej."},
        ]
    return items

def load_game_intro_dialog():
    """
    Read assets/game_intro_dialog.txt with lines like:
    MEDRZEC: text...
    PLAYER: text...
    Returns list of dicts: {"speaker": "medrzec"|"player", "text": str}
    """
    import os, re
    path = os.path.join("assets", "game_intro_dialog.txt")
    items = []
    def _norm(tag):
        t = (tag or "").strip().upper()
        if t in ("MEDRZEC","MĘDRZEC","SAGE"):
            return "medrzec"
        if t in ("PLAYER","GRACZ","BOHATER"):
            return "player"
        return None
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            for raw in f:
                line = (raw or "").strip()
                if not line:
                    continue
                m = re.match(r'^\s*([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+)\s*:\s*(.*)$', line)
                if not m:
                    continue
                spk = _norm(m.group(1))
                txt = (m.group(2) or "").replace(r'\n', '\n')
                if spk:
                    items.append({"speaker": spk, "text": txt})
    if not items:
        items = [
            {"speaker":"medrzec","text":"Witaj w CyberEwolucji. Tu nauczysz się rozpoznawać oszustwa w sieci."},
            {"speaker":"player","text":"Jak się poruszać i co mam robić?"},
            {"speaker":"medrzec","text":"Sterowanie: A/D lub ←/→ — ruch; SPACE/W/↑ — skok; E — portal i wspinaczka; F11 — pełny ekran."},
            {"speaker":"medrzec","text":"Szukaj postaci i sytuacji, ucz się i zdobywaj punkty świadomości. Na końcu czeka boss."},
        ]
    return items


def _get_overlay_cached(self, alpha):
    key = int(alpha) & 255
    surf = self._overlay_cache.get(key)
    if surf is None:
        s = _get_overlay_cached(self, a) if 'a' in locals() else pygame.Surface((LOGICAL_W, LOGICAL_H), pygame.SRCALPHA)
        s.fill((0,0,0,key))
        self._overlay_cache[key] = s
        return s
    return surf

class Game:

    def _split_context_title(self, raw: str):
        """Return (title, body) parsed from CONTEXT: 'Title: body...'.
        If no colon is present, fallback to ('Kontekst', raw).
        Leading spaces/newlines after the colon are trimmed.
        """
        if not isinstance(raw, str) or not raw:
            return ('Kontekst', '')
        idx = raw.find(':')
        if idx == -1:
            return ('Kontekst', raw)
        title = raw[:idx].strip()
        body = raw[idx+1:].lstrip(' \t\n\r')
        return (title if title else 'Kontekst', body)

    def _get_world_number_from_key(self):
        """Parse and return the world number from keys like 'world2_xxx'. Returns int or None."""
        key = str(getattr(self, 'current_key', '') or '')
        try:
            import re as _re
            m = _re.search(r'world(\d+)', key)
            if m:
                return int(m.group(1))
            loc = getattr(self, 'current_loc', None)
            k2 = getattr(loc, 'key', None)
            if k2:
                m2 = _re.search(r'world(\d+)', str(k2))
                if m2:
                    return int(m2.group(1))
        except Exception:
            pass
        return None
    def load_scroll_image_for_current_world(self):
        wn = self._get_world_number_from_key()
        if wn is None:
            return None
        try:
            pth = os.path.join('assets','worlds', str(wn), 'arena', 'zwoj.png')
            if os.path.exists(pth):
                img = pygame.image.load(pth).convert_alpha()
                self._scroll_img = img
                self._scroll_img_world = wn
                return img
        except Exception:
            pass
        return None
    def _reset_state_for_world(self):

        # Schedule summary check when entering lobby
        if self.current_key == "lobby":
            self.summary_delay_t = 0.0
        """Reset boss/arena/scroll UI & flags when changing world/lobby.
        Keeps player evolution; ensures boss art/quiz reload per world."""
        # Boss/UI
        self.bossfight_active = False
        self.boss_quiz = None
        self.boss_dialog_started = False
        self.boss_dialog_mode = False
        self.skip_boss_intro_once = False
        self.boss_defeated = False
        self.boss_visible = False
        self.boss_blink_active = False
        self.hp_ui_anim_state = 'hidden'
        self.hp_ui_alpha = 0.0
        self.hp_ui_anim_t = 0.0
        # Scroll and effects
        self.scroll_active = False
        self.scroll_rect = None
        self.scroll_collected = False
        self._scroll_img = None
        self.scroll_bob_t = 0.0
        self.evolve_poof_active = False
        self.evolve_poof_t = 0.0
        # Evolution blink sequence (replaces 'poof')
        self.evo_blink_active = False
        self.evo_blink_elapsed = 0.0
        self.evo_off_count = 0
        self.evo_swapped = False
        self.evo_msg_timer = 0.0
        self._pending_portal_rect = None
        self._pending_portal_target = None
        self._portal_spawn_delay = 0.001
        self._portal_fade_speed = 3.0  # alpha per second as fraction of 255 (~0.33s)

        self.player_shake_t = 0.0
        self.boss_shake_t = 0.0
        self._boss_last_rect_for_drop = None
        # Boss frames/anim reset to force per-world skin
        self.boss_frames = []
        self.boss_anim_idx = 0
        self.boss_anim_acc = 0.0
        self.boss_anim_frozen = False
        # Try reload per-world data
        try:
            _ = self.load_boss_data_for_current_world()
            _ = self.load_boss_quiz_for_current_world()
        except Exception:
            pass
        return True

    def evolve_player_up(self):
        """Trigger 4-blink evolution sequence: 2 blinks old skin, swap + 'Evolution UP', 2 blinks new skin."""
        try:
            cur = int(self.current_skin)
        except Exception:
            cur = 1
        new_evo = min(5, max(1, cur+1))
        self._evo_next_skin = str(new_evo)
        self.evo_blink_active = True
        self.evo_blink_elapsed = 0.0
        self.evo_off_count = 0
        self.evo_swapped = False
        self.evo_msg_timer = 0.0
        self.draw_visible = True


    def _ext_after_init(self): pass
    def _ext_before_update(self, dt: float): pass
    def _ext_after_update(self, dt: float): pass
    def _ext_before_draw(self, surface): pass
    def _ext_after_draw(self, surface): pass
    def _ext_after_world_load(self): pass

    def toggle_fullscreen(self):
        """Safe FULLSCREEN <-> windowed toggle that keeps logical resolution and preserves cursor visibility in start menu."""
        try:
            self.fullscreen = not self.fullscreen
            flags = (FULLSCREEN | SCALED) if self.fullscreen else (SCALED | RESIZABLE)
            self.screen = pygame.display.set_mode((LOGICAL_W, LOGICAL_H), flags)
            # Set cursor visible in start menu, hidden otherwise
            try:
                pygame.mouse.set_visible(bool(getattr(self,'start_menu_active',False)))
            except Exception:
                pass
        except Exception as _e:
            # fail-safe: revert to previous state
            try:
                self.fullscreen = not self.fullscreen
                flags = (FULLSCREEN | SCALED) if self.fullscreen else (SCALED | RESIZABLE)
                self.screen = pygame.display.set_mode((LOGICAL_W, LOGICAL_H), flags)
            except Exception:
                pass

    def load_boss_quiz_for_current_world(self):
        """Parse /assets/worlds/<wn>/bossfight.txt into list of Q/A dicts:
           {q, a, b, c, correct (0..2), cps}"""
        key = str(self.current_key)
        wn = None
        if key.endswith('_arena') and key.startswith('world'):
            try: wn = int(key.replace('world','').replace('_arena',''))
            except: wn = None
        elif key.startswith('world'):
            try: wn = int(key.replace('world',''))
            except: wn = None
        if wn is None:
            return []
        path = os.path.join("assets","worlds",str(wn),"bossfight.txt")
        if not os.path.exists(path):
            return []
        questions = []
        q = a = b = c = None
        correct = None
        speed = None
        def flush():
            if q is None: return
            try:
                corr_letter = (correct or 'A').strip().upper()
                corr_idx = {'A':0,'B':1,'C':2}.get(corr_letter, 0)
            except Exception:
                corr_idx = 0
            try:
                cps_val = float(speed) if (speed is not None) else 32.0
            except Exception:
                cps_val = 32.0
            questions.append({'q':q or '', 'a':a or '', 'b':b or '', 'c':c or '',
                              'correct': corr_idx, 'cps': cps_val})
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                for raw in f:
                    line = (raw or '').strip()
                    if not line:
                        continue
                    if line.startswith("Q:"):
                        # push previous
                        if q is not None:
                            flush()
                            a = b = c = None; correct = None; speed = None
                        q = line.split(":",1)[1].strip()
                    elif line.startswith("A:"):
                        a = line.split(":",1)[1].strip()
                    elif line.startswith("B:"):
                        b = line.split(":",1)[1].strip()
                    elif line.startswith("C:"):
                        c = line.split(":",1)[1].strip()
                    elif line.upper().startswith("CORRECT"):
                        correct = line.split(":",1)[1].strip()
                    elif line.upper().startswith("SPEED_Q"):
                        speed = line.split(":",1)[1].strip()
                    else:
                        # ignore other keys here (INTRO, BOSSNAME handled elsewhere)
                        pass
                # flush tail
                flush()
        except Exception:
            return []
        # filter incomplete qs
        out = []
        for item in questions:
            if item['q'] and item['a'] and item['b'] and item['c']:
                out.append(item)
        return out
    def load_boss_data_for_current_world(self):
        """Parse assets/worlds/<X>/bossfight.txt and load boss avatar bossX.png or fallback boss.png."""
        try:
            key=str(self.current_key)
            wn=None
            if isinstance(self.current_key, str):
                if key.endswith("_arena"):
                    try: wn=int(key.replace("world","").replace("_arena",""))
                    except: wn=None
                elif key.startswith("world"):
                    try: wn=int(key.replace("world",""))
                    except: wn=None
            if wn is None:
                return None
            txt_path=os.path.join("assets","worlds",str(wn),"bossfight.txt")
            name="BOSS"; intro="..."
            outro="..."
            if os.path.exists(txt_path):
                try:
                    with open(txt_path,"r",encoding="utf-8",errors="ignore") as f:
                        for raw in f:
                            line=(raw or "").strip()
                            if not line: continue
                            if line.startswith("BOSSNAME:"): name=line.split(":",1)[1].strip()
                            elif line.startswith("INTRO:"): intro=line.split(":",1)[1].strip().replace("\\n","\n")
                            elif line.startswith("OUTRO:"): outro=line.split(":",1)[1].strip().replace("\\n","\n")
                except Exception:
                    pass
            # Avatar
            av=None
            for pth in (os.path.join("assets","avatars",f"boss{wn}.png"),
                        os.path.join("assets","avatars","boss.png")):
                if os.path.exists(pth):
                    try:
                        av=pygame.image.load(pth).convert_alpha()
                        break
                    except Exception:
                        av=None
                        # CEv2.35: parse HP from bossfight.txt
            hp_from_file = 1000
            try:
                txt = raw if 'raw' in locals() else open(txt_path,'r',encoding='utf-8').read()
                for line in txt.replace('\r','').split('\n'):
                    mhp = re.match(r'^\s*(?:\{?\s*HP\s*\}?|BOSS_HP)\s*:\s*(\d+)\s*$', line, re.IGNORECASE)
                    if mhp:
                        hp_from_file = int(mhp.group(1))
                        break
            except Exception:
                hp_from_file = 1000
            self.boss_data={'name':name,'intro':intro,'outro':outro,'wn':wn,'hp':self._get_boss_hp_static(wn)}
            self.boss_avatar=av
            return self.boss_data
        except Exception:
            self.boss_data=None; self.boss_avatar=None
            return None

    def __init__(self):
        self._debug_allowed = probe_debug_enabled_flag()
        self._debug_probe_acc = 0.0
        self.boss_quiz = None
        # --- CEv2.34: HP / Bossfight defaults ---
        self.bossfight_active = False
        # UI animation (HP bars fade)
        self.hp_ui_anim_state='hidden'
        self.hp_ui_anim_t=0.0
        self.hp_ui_anim_dur=0.5
        self.hp_ui_alpha=0.0
        self.player_hp_max = 300
        self.player_hp = 300
        self.boss_hp_max = 0
        self.boss_hp = 0
        self.boss_rect_current = None

        # --- Boss/UI & defeat/victory states ---
        self.boss_visible = True
        self.boss_blink_active = False
        self.boss_blink_t = 0.0

        self.scroll_active = False
        self.scroll_rect = None
        self.scroll_bob_t = 0.0
        self._scroll_img = None
        self.scroll_collected = False

        self.death_menu_active = False
        self.death_menu_selection = 0
        self.death_blink_active = False
        self.death_blink_t = 0.0

        self.draw_visible = True  # player visibility (blinking toggles this)
        self.player_shake_t = 0.0
        self.boss_shake_t = 0.0
        self.shake_amp_px = 6


        self.player_shake_off = (0, 0)
        self.boss_shake_off = (0, 0)
# skip boss pre-dialog once (for "Walcz ponownie")
        self.skip_boss_intro_once = False

        make_dpi_aware(); pygame.init()
        pygame.display.set_caption("CyberEvolution")
        self.screen=pygame.display.set_mode((LOGICAL_W,LOGICAL_H), FULLSCREEN|SCALED)
        try: pygame.mouse.set_visible(False)
        except Exception: pass
        self.clock=pygame.time.Clock(); self.fullscreen=True
        self.dt = 1.0/120.0  # default frame delta to prevent first-frame access errors
        self.UI_FONT=PixelFont(PIXEL_FONT_PATH, base_px=12, scale=2)
        self.UI_FONT_BIG=PixelFont(PIXEL_FONT_PATH, base_px=12, scale=3)
        self.UI_FONT_BIG_BIG=PixelFont(PIXEL_FONT_PATH, base_px=12, scale=4)
        self._overlay_cache = {}  # cached semi-transparent surfaces by alpha
        # --- Start Menu / boot flags ---
        # Pause menu state
        self.pause_active = False
        self.pause_selection = 0
        self.debug_fps=False
        self.start_menu_active = True
        try:
            pygame.mouse.set_visible(True)
        except Exception:
            pass
        self.start_menu_selection = 0
        self.freeze_active = True
        self.enable_newgame_intro = False
        self.intro_cutscene_active = False
        self.start_menu_bg=None
        try:
            candidates=[
                os.path.join('assets','start_menu.png'),
                os.path.join(os.getcwd(),'assets','start_menu.png'),
                os.path.join(os.path.dirname(__file__),'assets','start_menu.png'),
                r'C:\\Users\\Szymon\\Desktop\\CyberEvolution\\assets\\start_menu.png']
            for cand in candidates:
                if os.path.exists(cand):
                    self.start_menu_bg = pygame.image.load(cand).convert(); break
        except Exception:
            self.start_menu_bg=None
        self._autosave_label='Kontynuuj'
        try: self._refresh_autosave_label()
        except Exception: pass

        self.quiz_top_margin_px = 64
        try:
            with open(__file__,"r",encoding="utf-8") as f: self.code_lines=sum(1 for _ in f)
        except Exception: self.code_lines=0
        self.debug_enabled=False
        if not self._debug_allowed: self.debug_enabled=False

        self.locations=build_locations(); self.current_key="lobby"; self.current_loc=self.locations[self.current_key]
        self.bg_surf,self.bg_w,self.bg_h = load_background(self.current_loc.bg_path)
        self.portal_color_map=PORTAL_COLOR_MAPS.get(self.current_key,{})
        (self.colliders, self.WORLD_W_true, self.portals, self.ladders, self.triggers, self.gates, self.arena_zones, self.boss_spawns) = \
            parse_world_from_mask(self.current_loc.mask_path, PLAY_RECT.top, TILE, THRESHOLD, self.portal_color_map)
        self.collider_buckets=build_collider_buckets(self.colliders, TILE)
        self.WORLD_W_local=recompute_world_clip(self.gates, self.WORLD_W_true)

        self.current_skin="1"
        self.animator=Animator(build_animations_from_paths(skin_paths(self.current_skin), PLAYER_W, PLAYER_H))
        if self.current_key=='lobby':
            self.px,self.py,self.on_ground = self.place_player_dropin_lobby_center()
            self.lobby_dropin_active=True  # input lock during drop-in (no overlay)
            self.lobby_dropin_lock_t = self.estimate_fall_time(self.px, self.py, vy0=self.py) + 0.02
        else:
            self.px,self.py,self.on_ground = self.place_player_on_spawn(200.0, PLAY_RECT.bottom-PLAYER_H, self.current_loc.spawn)
        self.vy=0.0; self.facing=1; self.coyote_timer=0.0; self.anim_ground_timer=0.0
        self.draw_visible=True

        self.evolve_poof_active = False
        self.evolve_poof_t = 0.0
        # Evolution blink sequence (replaces 'poof')
        self.evo_blink_active = False
        self.evo_blink_elapsed = 0.0
        self.evo_off_count = 0
        self.evo_swapped = False
        self.evo_msg_timer = 0.0
        self._pending_portal_rect = None
        self._portal_spawn_delay = 0.001
        self._portal_fade_speed = 3.0  # alpha per second as fraction of 255 (~0.33s)

        self.evolve_poof_dur = 0.35
        # --- Lobby drop-in & arena intro flags (init defaults) ---
        self.lobby_dropin_active = getattr(self, 'lobby_dropin_active', False)
        self.arena_intro_active = getattr(self, 'arena_intro_active', False)
        self.arena_intro_t=0.0
        self.ARENA_INTRO_SPEED=MOVE_SPEED*0.7
        self.arena_intro_target_x=300.0  # world x to reach during intro
        self.pending_wipe_in=False

        self.respawn_state="normal"; self.respawn_t=0.0
        self.last_safe_pos=(self.px,self.py); self.last_safe_full_pos=None

        self.climbing=False; self.climb_target_y=None; self.climb_side_dir=1; self.climb_rect=None; self.climb_stepout=0.0
        self.ladder_hover_t=0.0; self.ladder_hover_id=None

        self.progress=defaultdict(set)
        self.world_scripts={}
        self.interaction_active=False; self.inter_idx=None; self.inter_runtime=None

        self.intro_active=False; self.intro_phase=None; self.BOSS_FADE_IN_TIME=0.7; self.boss_dialog_mode=False; self.boss_defeated=False; self.boss_data=None; self.boss_avatar=None; self.intro_timer=0.0; self.intro_text_tw=None; self.intro_fade_t=0.0; self.world_display_name="Lobby"
        # Summary bookkeeping
        self.last_completed_world = None
        self.last_summarized_world = None
        self.summary_delay_t = 0.0

        # Summary dialog state (Lobby)
        self.summary_active = False
        self.summary_items = []
        self.summary_idx = 0
        self.summary_tw = None
        self.summary_speaker = "medrzec"
        self._summary_pending_wn = None
        # If this was intro, mark as shown and reset title mode
        if getattr(self, 'summary_as_intro', False):
            self.summary_as_intro = False
            self.game_intro_shown = True

        # Summary dialog presentation
        self.summary_top_margin_px = 64
        self.summary_fade_t = 0.0
        self.summary_fade_dur = 0.5

        # Reuse Summary dialog for Game Intro ("Wstęp")
        self.summary_as_intro = False   # when True, title becomes "Wstęp" and content comes from game_intro_dialog.txt
        self.game_intro_shown = False   # show only once per session


        self._welcome_back_pending = False
        self.advance_cd=0.0; self.advance_latch=False; self.prev_e_pressed=False; self.prev_b_pressed=False
        self._portal_img_cache={}; self._portal_scaled_cache={}
        self._lobby_bg_variant = 'normal'
        self.ending_active = False  # ending screen state
        self.ending_phase = None  # 'fadeout' -> None -> ending_active
        self.ending_fade_t = 0.0
        self.ENDING_FADE_TIME = 1.2  # seconds
        self.ending_text = ""
        self.ending_tw = None
        self.ENDING_STORY_PATH = os.path.join("assets","ending","ending_story.txt")
        self.boss_frames=[]; self.boss_anim_idx=0; self.boss_anim_acc=0.0; self.boss_spawns=[] ; self.boss_anim_frozen = False
        # NPC placeholder runtime
        self.npc1_spawns=[]; self.npc2_spawns=[]; self.npc3_spawns=[]
        # Build NPC spawns for current world map (never on arena)
        if (not str(self.current_key).endswith('_arena')) and str(self.current_key).startswith('world'):
            try:
                wn = int(str(self.current_key).replace('world',''))
                npc_mask = os.path.join('assets','worlds', str(wn), 'npc', 'npc_mask.png')
                self.npc1_spawns, self.npc2_spawns, self.npc3_spawns = parse_npc_spawns(npc_mask, PLAY_RECT.top, TILE)
            except Exception:
                self.npc1_spawns=[]; self.npc2_spawns=[]; self.npc3_spawns=[]
        else:
            self.npc1_spawns=[]; self.npc2_spawns=[]; self.npc3_spawns=[]
        self.npc_img_cache={}  # {(npc_id,height): Surface}
        self.npc_frames_cache={}  # {(world,npc_id,height): [Surface, ...]}
        self.npc_anim_idx={1:0,2:0,3:0}
        self.npc_anim_acc={1:0.0,2:0.0,3:0.0}
        self.npc_anim_speed=0.8  # seconds per frame SZYBKOŚĆ ANIMACJI
        # Portal animation (2-frame)
        self.portal_anim_idx = 0
        self.portal_anim_acc = 0.0
        self.portal_anim_speed = 0.8  # seconds per frame (match NPC speed)


    # ---- boss helpers ----        self._ext_after_init()

        self.ending_unlocked = False  # unlock after OUTRO closes

    def load_boss_frames(self, world_number):
        """Load boss frames: prefers boss.gif (PIL) then boss1.png/boss2.png, finally placeholder.
        Frames are pre-scaled to the first boss placeholder height (kept aspect)."""
        base = os.path.join("assets","worlds", str(world_number), "boss")
        png1 = os.path.join(base, "boss1.png")
        png2 = os.path.join(base, "boss2.png")

        # Target height from first placeholder
        target_h = None
        try:
            if getattr(self, "boss_spawns", None):
                target_h = int(self.boss_spawns[0].h)
        except Exception:
            target_h = None

        frames = []

        def _scale(img):
            if target_h and img.get_height() > 0 and target_h != img.get_height():
                scale = target_h / float(img.get_height())
                w = max(1, int(round(img.get_width() * scale)))
                return pygame.transform.scale(img, (w, target_h))
            return img

        # Animation: two PNGs
        if not frames:
            for p in (png1, png2):
                if os.path.exists(p):
                    try:
                        img = pygame.image.load(p).convert_alpha()
                        frames.append(img)
                    except Exception:
                        pass
            # Jeśli wczytano PNG — ustal tempo animacji (domyślnie 0.35 sekundy na klatkę)
            self.boss_frame_durs = [0.8 for _ in frames]

        # Final fallback: simple placeholder X (duplicated)
        if not frames:
            ph = pygame.Surface((128,128), pygame.SRCALPHA)
            ph.fill((0,0,0,0))
            pygame.draw.rect(ph,(180,0,255,255), ph.get_rect(), 6, border_radius=8)
            pygame.draw.line(ph,(180,0,255,255),(0,0),(ph.get_width(),ph.get_height()),6)
            pygame.draw.line(ph,(180,0,255,255),(0,ph.get_height()),(ph.get_width(),0),6)
            frames = [ph, ph]

        # Pre-scale
        frames = [_scale(f) for f in frames]
        return frames

    def estimate_fall_time(self, x, y, vx0=0.0, vy0=0.0, max_time=5.0):
        """Roughly simulate pure-vertical fall until ground using collision solver; return time seconds."""
        t=0.0; dt=1.0/240.0; vy=vy0; px=x; py=y
        while t<max_time:
            px,py,vy,on_ground,_,_ = move_and_collide(px,py,0.0,vy,dt,self.collider_buckets,PLAYER_W,PLAYER_H)
            t+=dt
            if on_ground:
                break
        return min(t, max_time)

    def place_player_on_spawn(self, px, py, spawn):
        sx,sy=spawn; x=float(sx)
        if sy is None:
            y=PLAY_RECT.top; vy=0.0; on_ground=False
            for _ in range(120):
                vy+=GRAVITY*(1/120); y+=vy*(1/120)
                _,y_after,vy_after,on_g,_,_ = move_and_collide(x,y,0.0,vy,(1/120),self.collider_buckets,PLAYER_W,PLAYER_H)
                y,vy,on_ground=y_after,vy_after,on_g
                if on_ground: break
            return x,y,on_ground
        return float(sx), float(sy), False

    def center_x_for_screen(self):
        """World X so that player appears at screen center with camera_x clamped to 0 in lobby."""
        return max(0.0, min(self.WORLD_W_local - PLAYER_W, LOGICAL_W/2 - PLAYER_W/2))

    def place_player_dropin_lobby_center(self, offset_px=TILE*2):
        """Spawn slightly above the visible play area center so player falls into the lobby."""
        x = self.center_x_for_screen()
        y = PLAY_RECT.top - PLAYER_H - abs(int(offset_px))
        return x, y, False

    def get_portal_image(self, target_key):
        if target_key in self._portal_img_cache: return self._portal_img_cache[target_key]
        pth=portal_img_for_target(target_key)
        img=pygame.image.load(pth).convert_alpha() if (pth and os.path.exists(pth)) else None
        self._portal_img_cache[target_key]=img; return img

    def get_portal_image_scaled(self, target_key, target_h):
        base=self.get_portal_image(target_key)
        if not base: return None
        key=(target_key,int(target_h))
        if key in self._portal_scaled_cache: return self._portal_scaled_cache[key]
        src_h=base.get_height()
        scaled = base if (src_h<=0 or target_h<=0 or src_h==target_h) else pygame.transform.scale(base,(int(base.get_width()*(target_h/float(src_h))), int(target_h)))
        self._portal_scaled_cache[key]=scaled; return scaled

    # ---- events ----


    def _start_welcome_back(self):
        """Show a simple one-shot welcome-back dialog when loading from autosave."""
        try:
            self.summary_items = [{"speaker":"medrzec","text":"Witaj ponownie, użytkowniku."}]
            self.summary_idx = 0
            cur = self.summary_items[0]
            self.summary_speaker = cur.get("speaker","medrzec")
            self.summary_tw = Typewriter(cur.get("text",""), 32.0)
            self.summary_active = True
            self.summary_as_intro = False
            self.summary_fade_t = 0.0
            self.advance_latch = True
        except Exception:
            self.summary_active = False
    def _start_game_intro(self):
        """Start game intro by reusing the Summary dialog UI, but with different title and items."""
        try:
            items = load_game_intro_dialog()
        except Exception:
            items = [{"speaker":"medrzec","text":"Witaj!"}]
        # Prime summary state with intro content
        self.summary_items = items
        self.summary_idx = 0
        cur = self.summary_items[0] if self.summary_items else {"speaker":"medrzec","text":""}
        self.summary_speaker = cur.get("speaker","medrzec")
        self.summary_tw = Typewriter(cur.get("text",""), 32.0)
        self.summary_active = True
        self.summary_as_intro = True
        self.summary_fade_t = 0.0
        self.advance_latch = True  # require key-up before first advance

    def _start_summary_dialog(self, wn: int):
        """Start summary dialog for world number wn after returning to Lobby."""
        try:
            self.summary_items = load_world_summary(int(wn))
        except Exception:
            self.summary_items = [{"speaker":"medrzec","text":"Gratulacje ukończenia świata."}]
        self.summary_idx = 0
        cur = self.summary_items[0] if self.summary_items else {"speaker":"medrzec","text":""}
        self.summary_speaker = cur.get("speaker","medrzec")
        self.summary_tw = Typewriter(cur.get("text",""), 36.0)
        self.summary_active = True
        self.summary_fade_t = 0.0
        self.advance_latch = True  # require key-up before first advance

    def handle_events(self):
        for event in pygame.event.get():
            # --- Global ESC to toggle Pause ---
            if event.type==KEYDOWN and event.key==K_ESCAPE:
                if not getattr(self,'start_menu_active',False):
                    self.pause_active = not getattr(self,'pause_active',False)
                    if self.pause_active:
                        self.pause_selection = 0
                    return True

            # --- Start menu handling (highest priority) ---
            # --- Pause menu input ---
            if getattr(self,'pause_active',False):
                if event.type==QUIT: return False
                if event.type==KEYDOWN:
                    if event.key in (K_UP, K_w, K_LEFT): self.pause_selection=(self.pause_selection-1)%2; return True
                    if event.key in (K_DOWN, K_s, K_RIGHT): self.pause_selection=(self.pause_selection+1)%2; return True
                    if event.key in (K_RETURN, K_SPACE, K_e):
                        if self.pause_selection==0:
                            self.pause_active=False; return True
                        else:
                            return False
                continue
            if getattr(self,'start_menu_active',False):

                if event.type == MOUSEMOTION:
                    try:
                        mx, my = event.pos
                        base_x = LOGICAL_W//2 - 220
                        base_y = LOGICAL_H//2 - 20
                        for i in range(3):
                            rect = pygame.Rect(base_x, base_y - 6 + i*50, 440, 40)
                            if rect.collidepoint(mx, my):
                                self.start_menu_selection = i
                                break
                    except Exception:
                        pass
                    return True
                if event.type == MOUSEBUTTONDOWN and getattr(event, 'button', 0) == 1:
                    try:
                        mx, my = event.pos
                        base_x = LOGICAL_W//2 - 220
                        base_y = LOGICAL_H//2 - 20
                        clicked = None
                        for i in range(3):
                            rect = pygame.Rect(base_x, base_y - 6 + i*50, 440, 40)
                            if rect.collidepoint(mx, my):
                                clicked = i
                                break
                        if clicked is not None:
                            self.start_menu_selection = clicked
                            if clicked == 0:
                                self._start_new_game()
                                return True
                            elif clicked == 1:
                                ok = self.load_from_autosave()
                                if not ok:
                                    self._start_new_game()
                                return True
                            else:
                                return False
                    except Exception:
                        pass
                    return True
                if event.type==QUIT: return False
                if event.type==KEYDOWN:
                    if event.key in (K_UP, K_w, K_LEFT): self.start_menu_selection=(self.start_menu_selection-1)%3; return True
                    if event.key in (K_DOWN, K_s, K_RIGHT): self.start_menu_selection=(self.start_menu_selection+1)%3; return True
                    if event.key in (K_RETURN, K_SPACE, K_e):
                        if self.start_menu_selection==0:
                            self._start_new_game(); return True
                        elif self.start_menu_selection==1:
                            ok=self.load_from_autosave();
                            if not ok: self._start_new_game()
                            return True
                        else:
                            return False
                continue
            # --- Global ENDING screen input handling ---
            if getattr(self, 'ending_active', False):
                # Allow closing the window with OS kill at any time.
                if event.type == QUIT:
                    return False
                # During ending: ignore all keys until the typewriter finishes.
                if event.type == KEYDOWN:
                    tw_done = False
                    try:
                        tw_done = bool(self.ending_tw and self.ending_tw.done)
                    except Exception:
                        tw_done = False
                    if tw_done:
                        # Any key after text finished -> back to start menu.
                        self._end_to_start_menu()
                        continue
                    # Otherwise swallow the key and keep showing the ending.
                    continue
                # Swallow all other events during ending.
                continue

            # Summary dialog handling (blocks other input)
            if self.summary_active:
                if event.type == KEYDOWN and is_advance_event(event):
                    if self.summary_tw and not self.summary_tw.done:
                        self.summary_tw.force_done()
                    else:
                        self.summary_idx += 1
                        if self.summary_idx >= len(self.summary_items):
                            # finish summary -> clear and prevent auto-retrigger
                            self.summary_active = False
                            self.summary_items = []
                            self.summary_tw = None
                            self.summary_speaker = "medrzec"
                            try:
                                _wn_done = self.last_completed_world if self.last_completed_world is not None else self._summary_pending_wn
                                if _wn_done is not None:
                                    self.last_summarized_world = int(_wn_done)
                            except Exception:
                                pass
                            # Unlock ending portal after OUTRO closes
                            try:
                                if int(self.last_summarized_world) >= 5:
                                    self.ending_unlocked = True
                            except Exception:
                                pass
                            self.last_completed_world = None
                            self._summary_pending_wn = None
                            # If this was intro, mark as shown and reset title mode
                            if getattr(self, 'summary_as_intro', False):
                                self.summary_as_intro = False
                                self.game_intro_shown = True

                        else:
                            cur = self.summary_items[self.summary_idx]
                            self.summary_speaker = cur.get("speaker","medrzec")
                            self.summary_tw = Typewriter(cur.get("text",""), 36.0)
                continue

            # Death menu controls
            if self.death_menu_active:
                if event.type == KEYDOWN:
                    if event.key in (K_UP, K_w, K_LEFT):
                        self.death_menu_selection = (self.death_menu_selection - 1) % 2
                        return True
                    if event.key in (K_DOWN, K_s, K_RIGHT):
                        self.death_menu_selection = (self.death_menu_selection + 1) % 2
                        return True
                    if event.key in (K_RETURN, K_SPACE, K_e):
                        sel = self.death_menu_selection
                        self.death_menu_active = False
                        if sel == 0:
                            self.restart_bossfight()
                        else:
                            try:
                                wn = int(''.join(ch for ch in str(self.current_key) if ch.isdigit()) or '1')
                            except Exception:
                                wn = 1
                            self.goto_world_and_reset_progress(wn)
                        return True
            # Death menu controls
            if self.death_menu_active and event.type==KEYDOWN:
                if event.key in (K_UP, K_w, K_LEFT):
                    self.death_menu_selection = (self.death_menu_selection - 1) % 2; return True
                if event.key in (K_DOWN, K_s, K_RIGHT):
                    self.death_menu_selection = (self.death_menu_selection + 1) % 2; return True
                if event.key in (K_RETURN, K_SPACE, K_e):
                    sel = self.death_menu_selection
                    self.death_menu_active = False
                    if sel == 0:
                        self.restart_bossfight(); return True
                    else:
                        try:
                            wn = int(''.join(ch for ch in str(self.current_key) if ch.isdigit()) or '1')
                        except Exception:
                            wn = 1
                        self.goto_world_and_reset_progress(wn); return True
            # Route input to boss quiz if active
            if (not self.death_menu_active) and self.boss_quiz and getattr(self.boss_quiz, 'anim_state', 'visible') != 'hidden':
                self.boss_quiz.handle_event(event)
            if event.type==QUIT: return False
            if event.type==KEYDOWN:
                if event.key==K_ESCAPE: return False
                if event.key==K_F11:
                    self.toggle_fullscreen()
                if event.key==K_F2 and self._debug_allowed: self.debug_enabled=not self.debug_enabled

                # Debug: instant boss kill (requires debug_enabled.txt next to the game file)
                try:
                    _base_dir = os.path.dirname(__file__)
                except Exception:
                    _base_dir = os.getcwd()
                if self._debug_allowed and (event.key == K_k):
                    if (getattr(self, 'bossfight_active', False) or getattr(self, 'boss_visible', False)) and (not getattr(self,'boss_defeated',False)):
                        try:
                            self.boss_hp = 0
                        except Exception:
                            pass
                        try:
                            self.start_boss_defeat_sequence()
                        except Exception:
                            pass
                        return True
                if self._debug_allowed and (event.key in SKIN_SLOTS) and (not self.interaction_active) and (not self.intro_active) and (self.lobby_dropin_lock_t<=0.0) and (not self.arena_intro_active):
                    new_skin=SKIN_SLOTS[event.key]
                    if new_skin!=self.current_skin:
                        self.current_skin=new_skin
                        prev_state,prev_facing=self.animator.state,self.animator.facing
                        self.animator=Animator(build_animations_from_paths(skin_paths(self.current_skin), PLAYER_W, PLAYER_H))
                        self.animator.set_state(prev_state); self.animator.facing=prev_facing; self.animator.index=0; self.animator.accum_ms=0

                # Interaction
                if self.interaction_active and self.inter_runtime:
                    st=self.inter_runtime.stage
                    if st in ('context','sage','feedback'):
                        if is_advance_event(event) and (self.advance_cd<=0.0) and (not self.advance_latch):
                            end_now=self.inter_runtime.on_advance()
                            self.advance_cd=ADVANCE_COOLDOWN; self.advance_latch=True
                            if end_now:
                                self.progress[self.current_key].add(f"{self.current_key}_t{self.inter_idx+1}")
                                unlock_gates_by_index(self.gates, self.inter_idx)
                                self.WORLD_W_local=recompute_world_clip(self.gates, self.WORLD_W_true)
                                self.interaction_active=False; self.inter_runtime=None; self.inter_idx=None
                    elif st=='choices':
                        if event.key in (K_UP,K_w): self.inter_runtime.on_choice_move(-1)
                        elif event.key in (K_DOWN,K_s): self.inter_runtime.on_choice_move(+1)
                        elif event.key in (K_1,K_KP1): self.inter_runtime.on_choice_confirm(0)
                        elif event.key in (K_2,K_KP2): self.inter_runtime.on_choice_confirm(1)
                        elif event.key in (K_RETURN,K_KP_ENTER,K_SPACE,K_e):
                            self.inter_runtime.on_choice_confirm(None)

                if self.intro_active and self.intro_phase=='text':
                    if is_advance_event(event) and (self.advance_cd<=0.0) and (not self.advance_latch):
                        if self.intro_text_tw and not self.intro_text_tw.done:
                            self.intro_text_tw.force_done(); self.advance_cd=ADVANCE_COOLDOWN; self.advance_latch=True
                        else:
                            if self.intro_text_tw and self.intro_text_tw.has_next_page():
                                self.intro_text_tw.next_page(); self.advance_cd=ADVANCE_COOLDOWN; self.advance_latch=True
                            else:
                                self.intro_active=False; self.intro_phase=None; self.advance_cd=ADVANCE_COOLDOWN; self.advance_latch=True
        return True

    # ---- update ----
    def update(self, dt):
        # START_MENU_FREEZE
        if getattr(self,'start_menu_active',False):
            return
        # PAUSE_FREEZE
        if getattr(self,'pause_active',False):
            return
        # START_MENU_FREEZE
        if getattr(self,'start_menu_active',False):
            return True

        # _AUTOSAVE_WHEN_LOBBY: write autosave when in lobby (post-world)
        try:
            if (getattr(self,'current_key','')=='lobby') and (not getattr(self,'start_menu_active',False)):
                evo = evo_from_skin(getattr(self,'current_skin','1'))
                self._write_autosave(evo)
                self._refresh_autosave_label()
        except Exception:
            pass

        # --- Damage shake timers (decay) ---
        if self.player_shake_t > 0.0:
            self.player_shake_t = max(0.0, self.player_shake_t - dt)
        if self.boss_shake_t > 0.0:
            self.boss_shake_t = max(0.0, self.boss_shake_t - dt)
        self._ext_before_update(dt)
        # Spawn ending portal after boss outro dialog closes (World 5)
        if getattr(self, '_boss_outro_pending_portal', False) and (not self.intro_active):
            try:
                pr = getattr(self, '_boss_last_rect_for_drop', None) or getattr(self, 'boss_rect_current', None)
                if not pr and self.arena_zones:
                    pr = self.arena_zones[0] if isinstance(self.arena_zones[0], pygame.Rect) else None
                if not pr:
                    pr = pygame.Rect(int(self.px)-40, int(self.py)-40, 80, 80)
                self._pending_portal_rect = pr.copy() if hasattr(pr,'copy') else pygame.Rect(pr.x, pr.y, pr.w, pr.h)
                self._pending_portal_target = 'ending'
                self._portal_spawn_delay = 0.001
            except Exception:
                # Fallback: still try to schedule portal at player pos
                try:
                    self._pending_portal_rect = pygame.Rect(int(self.px)-40, int(self.py)-40, 80, 80)
                    self._pending_portal_target = 'ending'
                    self._portal_spawn_delay = 0.001
                except Exception:
                    pass
            self._boss_outro_pending_portal = False
        # HP UI fade anim tick
        # Re-check debug gate once per second
        self._debug_probe_acc = getattr(self, '_debug_probe_acc', 0.0) + dt
        if self._debug_probe_acc >= 1.0:
            self._debug_probe_acc = 0.0
            try:
                self._debug_allowed = probe_debug_enabled_flag()
            except Exception:
                self._debug_allowed = False
            if not self._debug_allowed:
                try:
                    self.debug_enabled = False
                except Exception:
                    pass

        # --- Evolution blink sequence controller ---
        if self.evo_blink_active:
            self.evo_blink_elapsed += dt
            phase = int(self.evo_blink_elapsed / BLINK_INTERVAL_S)
            self.draw_visible = (phase % 2 == 0)
            prev_phase = getattr(self, '_evo_prev_phase', -1)
            if phase != prev_phase:
                self._evo_prev_phase = phase
                if (phase % 2) == 1:
                    self.evo_off_count += 1
                    if (self.evo_off_count == 2) and (not self.evo_swapped):
                        try:
                            prev_state, prev_facing = self.animator.state, self.animator.facing
                        except Exception:
                            prev_state, prev_facing = 'idle', 1
                        self.current_skin = getattr(self, '_evo_next_skin', self.current_skin)
                        try:
                            self.animator = Animator(build_animations_from_paths(skin_paths(self.current_skin), PLAYER_W, PLAYER_H))
                            self.animator.set_state(prev_state); self.animator.facing = prev_facing
                            self.animator.index = 0; self.animator.accum_ms = 0
                        except Exception:
                            pass
                        self.evo_swapped = True
                        self.evo_msg_timer = 1.0
            if self.evo_off_count >= 4:
                self.evo_blink_active = False
                self.draw_visible = True
                self._portal_spawn_delay = 0.5
                self._pending_portal_rect = getattr(self, '_boss_last_rect_for_drop', None)

        if self.evo_msg_timer > 0.0:
            self.evo_msg_timer = max(0.0, self.evo_msg_timer - dt)

        if self._portal_spawn_delay > 0.0:
            self._portal_spawn_delay -= dt
            if self._portal_spawn_delay <= 0.0 and self._pending_portal_rect:
                pr = self._pending_portal_rect.copy()
                tgt = getattr(self, '_pending_portal_target', 'lobby') or 'lobby'
                new_portal = PortalEntity(pr, tgt, (0,0,255))
                new_portal.alpha = 0
                new_portal._fade_in = True
                self.portals.append(new_portal)
                self._pending_portal_rect = None
                self._pending_portal_target = None

        if getattr(self, 'ending_active', False):
            return

        for p in self.portals:
            if hasattr(p, '_fade_in') and p._fade_in:
                try:
                    p.alpha = int(min(255, (p.alpha or 0) + 255.0 * dt / 0.5))
                    if p.alpha >= 255:
                        p.alpha = 255; p._fade_in = False
                except Exception:
                    p._fade_in = False

        if self.hp_ui_anim_state=='enter':
            self.hp_ui_anim_t += dt
            p=max(0.0,min(1.0,self.hp_ui_anim_t/max(0.001,self.hp_ui_anim_dur)))
            self.hp_ui_alpha=p*p*p
            if self.hp_ui_anim_t>=self.hp_ui_anim_dur:
                self.hp_ui_anim_state='visible'; self.hp_ui_alpha=1.0
        elif self.hp_ui_anim_state=='exit':
            self.hp_ui_anim_t += dt
            p=max(0.0,min(1.0,self.hp_ui_anim_t/max(0.001,self.hp_ui_anim_dur)))
            self.hp_ui_alpha=1.0 - (1.0 - p)**3
            if self.hp_ui_anim_t>=self.hp_ui_anim_dur:
                self.hp_ui_anim_state='hidden'; self.hp_ui_alpha=0.0
        # --- CEv2.34: auto-activate bossfight after boss intro dialog ends ---
        if (not self.intro_active) and (getattr(self,'boss_dialog_started',False) or getattr(self,'skip_boss_intro_once',False)) and (not self.bossfight_active) and str(self.current_key).endswith('_arena') and (not getattr(self,'boss_defeated',False)) and (not getattr(self,'arena_intro_active',False)) and (not getattr(self,'pending_wipe_in',False)):
            hp_from_file = 1000
            try:
                hp_from_file = int(getattr(self, 'boss_data', {}).get('hp', 1000))
            except Exception:
                pass
            self.player_hp_max = 300
            self.player_hp = 300
            self.boss_hp_max = hp_from_file
            self.boss_hp = hp_from_file
            self.bossfight_active = True
            if self.skip_boss_intro_once:
                self.skip_boss_intro_once=False
            if self.boss_quiz is None:
                qs = self.load_boss_quiz_for_current_world()
                self.boss_quiz = BossQuizRuntime(qs, self.UI_FONT, on_result=self.on_boss_answer)
                self.boss_quiz.top_margin_px = int(getattr(self,'quiz_top_margin_px',28))
                try: self.boss_quiz.start_enter()
                except Exception: pass
                self.hp_ui_anim_state='enter'; self.hp_ui_anim_t=0.0
        keys=pygame.key.get_pressed()

        b_now=keys[K_b]; just_B=(b_now and not self.prev_b_pressed); self.prev_b_pressed=b_now
        if self._debug_allowed and just_B:
            for g in self.gates: g.locked=False
            self.WORLD_W_local=recompute_world_clip(self.gates, self.WORLD_W_true)
            target_x=max(0.0, float(self.WORLD_W_local)-2000.0)
            self.px,self.py,self.on_ground=self.place_player_on_spawn(self.px,self.py,(int(target_x),None))
            self.vy=0.0

        self.advance_cd=max(0.0, self.advance_cd-dt)
        # countdown lobby drop-in lock time (time-based)
        if self.lobby_dropin_lock_t>0.0:
            self.lobby_dropin_lock_t = max(0.0, self.lobby_dropin_lock_t - dt)
        # Boss quiz tick
        if self.boss_quiz and getattr(self.boss_quiz, 'anim_state', 'visible') != 'hidden':
            self.boss_quiz.update(dt)
            if self.boss_hp<=0:
                if self.boss_quiz and getattr(self.boss_quiz,'anim_state','')!='exit':
                    try: self.boss_quiz.start_exit()
                    except Exception: pass
                    self.hp_ui_anim_state='exit'; self.hp_ui_anim_t=0.0
                elif (not self.boss_quiz) or getattr(self.boss_quiz,'anim_state','')=='hidden':
                    self.bossfight_active=False; self.boss_quiz=None; self.start_boss_defeat_sequence()
            elif self.player_hp<=0:
                if self.boss_quiz and getattr(self.boss_quiz,'anim_state','')!='exit':
                    try: self.boss_quiz.start_exit()
                    except Exception: pass
                    self.hp_ui_anim_state='exit'; self.hp_ui_anim_t=0.0
                elif (not self.boss_quiz) or getattr(self.boss_quiz,'anim_state','')=='hidden':
                    self.bossfight_active=False; self.boss_quiz=None; self.start_player_defeat_sequence()

        # ## NPC ANIM TICK: simple 2-frame animation per npc_id
        if (not str(self.current_key).endswith('_arena')) and str(self.current_key).startswith('world'):
            for _nid in (1,2,3):
                self.npc_anim_acc[_nid] += dt
                if self.npc_anim_acc[_nid] >= self.npc_anim_speed:
                    self.npc_anim_acc[_nid] = 0.0
                    self.npc_anim_idx[_nid] = 1 - self.npc_anim_idx[_nid]

        # -- Portal animation tick (2-frame), same rhythm as NPC --
        try:
            self.portal_anim_acc += dt
            if self.portal_anim_acc >= self.portal_anim_speed:
                self.portal_anim_acc = 0.0
                self.portal_anim_idx = 1 - self.portal_anim_idx
        except Exception:
            pass

        if self.advance_latch and not any_advance_key_down(keys): self.advance_latch=False

        input_enabled=(not self.interaction_active) and (not getattr(self,'evo_blink_active',False)) and (self.respawn_state=="normal") and (not self.climbing) and (self.climb_stepout<=0.0) and (not self.intro_active) and (self.lobby_dropin_lock_t<=0.0) and (not self.arena_intro_active) and (not (str(self.current_key).endswith('_arena') and not self.boss_defeated) and (not self.death_menu_active)) and (not self.summary_active)
        vx=0.0
        if input_enabled:
            if keys[K_a] or keys[K_LEFT]: vx-=MOVE_SPEED; self.facing=-1
            if keys[K_d] or keys[K_RIGHT]: vx+=MOVE_SPEED; self.facing=1 if vx>0 else self.facing

        want_jump=input_enabled and (keys[K_SPACE] or keys[K_w] or keys[K_UP])
        if want_jump and (self.on_ground or (self.coyote_timer>0.0)):
            self.vy=-JUMP_SPEED; self.on_ground=False; self.coyote_timer=0.0

        is_falling=(self.vy>120.0 and not self.on_ground)
        # --- LOBBY DROP-IN: force pure vertical fall (time-based lock) ---
        if self.lobby_dropin_active:
            vx = 0.0
            self.facing = -1
            try:
                self.px = self.center_x_for_screen()
            except Exception:
                pass
            if self.lobby_dropin_lock_t<=0.0:
                self.lobby_dropin_active=False


        # --- Arena intro: forced walk-in from left for set duration ---
        if self.arena_intro_active:
            # walk-in until reaching target world X (500px from left)
            step = self.ARENA_INTRO_SPEED * dt
            self.facing = 1
            if self.px + step >= self.arena_intro_target_x:
                self.px = self.arena_intro_target_x
                self.arena_intro_active=False
                vx = 0.0
                if (not getattr(self,'boss_dialog_started',False)) and (not getattr(self,'skip_boss_intro_once',False)):
                    self.load_boss_data_for_current_world()
                    data=self.boss_data or {}
                    self.world_display_name = data.get('name','BOSS')
                    intro_text = data.get('intro','...')
                    self.intro_active=True; self.intro_phase='boss_fade_in'; self.intro_fade_t=0.0; self.intro_text_tw=Typewriter(intro_text, 40.0)
                    self.boss_dialog_mode=True; self.boss_dialog_started=True; self.advance_latch=True
            else:
                vx = self.ARENA_INTRO_SPEED

        if self.climbing or self.climb_stepout>0.0:
            if self.climb_stepout>0.0:
                WALK_OUT_SPEED=MOVE_SPEED*0.6
                dt_step=min(dt, self.climb_stepout)
                self.px,self.py,_vy_tmp,self.on_ground,_,_ = move_and_collide(self.px,self.py,self.climb_side_dir*WALK_OUT_SPEED,180.0,dt_step,self.collider_buckets,PLAYER_W,PLAYER_H)
                self.climb_stepout-=dt_step
                if self.climb_stepout<=0.0:
                    self.climbing=False; self.vy=0.0
            else:
                step=CLIMB_SPEED*dt; self.py=max(self.climb_target_y, self.py-step)
                vx=0.0; self.vy=0.0; self.on_ground=False
                if self.climb_rect:
                    if self.climb_side_dir>0: self.px=max(self.px, self.climb_rect.right-PLAYER_W)
                    else: self.px=min(self.px, self.climb_rect.left)
                if self.py<=self.climb_target_y+0.5 and self.climb_stepout<=0.0:
                    self.py=self.climb_target_y; self.climb_stepout=CLIMB_STEPOUT_TIME
        else:
            if self.arena_intro_active:
                # Cutscene: walk in from left, ignore collisions and gravity
                self.px += vx*dt
                self.vy = 0.0
                self.on_ground = True
            elif self.colliders:
                self.px,self.py,self.vy,self.on_ground,_,_ = move_and_collide(self.px,self.py,vx,self.vy,dt,self.collider_buckets,PLAYER_W,PLAYER_H)
                if self.on_ground:
                    self.coyote_timer=COYOTE_TIME; self.anim_ground_timer=ANIM_GROUND_GRACE
                else:
                    self.coyote_timer=max(0.0,self.coyote_timer-dt); self.anim_ground_timer=max(0.0,self.anim_ground_timer-dt)
            else:
                self.vy+=GRAVITY*dt; self.py+=self.vy*dt
                if self.py+PLAYER_H>=PLAY_RECT.bottom: self.py=PLAY_RECT.bottom-PLAYER_H; self.vy=0.0; self.on_ground=True
                if self.on_ground:
                    self.coyote_timer=COYOTE_TIME; self.anim_ground_timer=ANIM_GROUND_GRACE
                else:
                    self.coyote_timer=max(0.0,self.coyote_timer-dt); self.anim_ground_timer=max(0.0,self.anim_ground_timer-dt)

        if self.px+PLAYER_W>self.WORLD_W_local: self.px=self.WORLD_W_local-PLAYER_W

        void_line=PLAY_RECT.bottom+VOID_MARGIN

        # Boss blink → vanish → drop scroll
        if self.boss_blink_active:
            self.boss_blink_t += dt
            # make boss visible toggle
            self.boss_visible = (int(self.boss_blink_t/BLINK_INTERVAL_S)%2==0)
            if self.boss_blink_t >= (BLINKS_TOTAL*BLINK_INTERVAL_S):
                self.boss_blink_active = False
                self.boss_visible = False
                r = getattr(self, '_boss_last_rect_for_drop', None) or getattr(self, 'boss_rect_current', None)
                if r and not self.scroll_active:
                    wn = None
                    try:
                        wn = self._get_world_number_from_key()
                    except Exception:
                        wn = None
                    if wn == 5:
                        outro_text = (getattr(self,'boss_data',{}) or {}).get('outro') or (getattr(self,'boss_data',{}) or {}).get('intro') or '...'
                        self.intro_active=True; self.intro_phase='text'; self.intro_text_tw=Typewriter(outro_text, 40.0)
                        self.boss_dialog_mode=True; self.boss_dialog_started=True; self.advance_latch=True
                        self._boss_outro_pending_portal = True
                        self._boss_outro_drop_rect = r.copy() if hasattr(r,'copy') else pygame.Rect(r.x,r.y,r.w,r.h)
                    else:
                        sz=80
                        self.scroll_rect = pygame.Rect(r.centerx - sz//2, r.bottom - sz - 20, sz, sz)
                        self.scroll_active=True; self._scroll_img=None; self.scroll_bob_t=0.0
                        self.load_scroll_image_for_current_world()

        # Scroll bobbing
        if self.scroll_active:
            self.scroll_bob_t += dt
        if self.evolve_poof_active:
            self.evolve_poof_t += dt
            if self.evolve_poof_t >= self.evolve_poof_dur:
                self.evolve_poof_active = False
        # Player blink → vanish → death menu
        if self.death_blink_active:
            self.death_blink_t += dt
            self.draw_visible = (int(self.death_blink_t/BLINK_INTERVAL_S)%2==0)
            if self.death_blink_t >= (BLINKS_TOTAL*BLINK_INTERVAL_S):
                self.death_blink_active = False
                self.draw_visible = False
                self.death_menu_active = True
                self.death_menu_selection = 0

        # Scroll pickup
        if self.scroll_active and self.scroll_rect and hasattr(self, 'player_rect'):
            if self.player_rect.colliderect(self.scroll_rect):
                self.scroll_active = False
                self.scroll_collected = True
                try:
                    _wn = int(''.join(ch for ch in str(self.current_key) if ch.isdigit()) or '1')
                    self._summary_pending_wn = _wn
                    self.last_completed_world = _wn
                except Exception:
                    self._summary_pending_wn = self._summary_pending_wn or None
                try:
                    key = str(self.current_key)
                    if key not in self.progress:
                        self.progress[key] = set()
                    self.progress[key].add('scroll_collected')
                except Exception:
                    pass
                # Evolution and portal spawn
                try:
                    self.evolve_player_up()
                except Exception:
                    pass
                try:
                    # Portal spawn will be delayed & faded in update()
                    pass
                except Exception:
                    pass

        if (self.py>void_line) and self.respawn_state=="normal":
            self.respawn_state="falling"; self.respawn_t=0.0; self.draw_visible=False
            self.climbing=False; self.climb_stepout=0.0
            self.interaction_active=False; self.inter_runtime=None; self.inter_idx=None
        if self.respawn_state=="falling":
            self.respawn_t+=dt
            if self.respawn_t>=RESPAWN_DELAY_S:
                base_x,base_y=(self.last_safe_full_pos if self.last_safe_full_pos else self.last_safe_pos)
                respawn_x=base_x if self.last_safe_full_pos else max(0, base_x-2*TILE)
                self.px=max(0,min(self.WORLD_W_local-PLAYER_W, respawn_x)); self.py=base_y
                self.vy=0.0; self.on_ground=True
                self.respawn_state="blinking"; self.respawn_t=0.0; self.draw_visible=True
        elif self.respawn_state=="blinking":
            self.respawn_t+=dt; self.draw_visible=(int(self.respawn_t/BLINK_INTERVAL_S)%2==0)
            if self.respawn_t>=BLINKS_TOTAL*BLINK_INTERVAL_S:
                self.respawn_state="normal"; self.respawn_t=0.0; self.draw_visible=True

        if self.on_ground and self.respawn_state=="normal" and not self.climbing and self.climb_stepout<=0.0:
            self.last_safe_pos=(self.px,self.py)
            pr_now=pygame.Rect(int(self.px),int(self.py),PLAYER_W,PLAYER_H)
            full_ratio,_=ground_support_ratio_generic(pr_now, iter_near_colliders(self.collider_buckets, pr_now), inset=0)
            if full_ratio>=SAFE_SUPPORT_FULL: self.last_safe_full_pos=(self.px,self.py)

        player_world_rect=pygame.Rect(int(self.px), int(self.py), PLAYER_W, PLAYER_H)

        if (not str(self.current_key).endswith("_arena")):
            for a_rect in self.arena_zones:
                if player_world_rect.colliderect(a_rect):
                    m=re.match(r"^world(\d+)$", str(self.current_key))
                    if m:
                        wn=m.group(1)
                        arena_bg=os.path.join("assets","worlds", wn, "arena","bg.png")
                        arena_mask=os.path.join("assets","worlds", wn, "arena","map_mask.png")
                        self.current_key=f"world{wn}_arena"
                        self.current_loc=Location(self.current_key,f"Arena {wn}",arena_bg,arena_mask, spawn=(LOGICAL_W//2,None))
                        self._reset_state_for_world()
                        self.bg_surf,self.bg_w,self.bg_h = load_background(self.current_loc.bg_path)
                        self.portal_color_map={}
                        (self.colliders, self.WORLD_W_true, self.portals, self.ladders, self.triggers, self.gates, self.arena_zones, self.boss_spawns) = \
                            parse_world_from_mask(self.current_loc.mask_path, PLAY_RECT.top, TILE, THRESHOLD, self.portal_color_map)
                        self.collider_buckets=build_collider_buckets(self.colliders, TILE)
                        self.WORLD_W_local=recompute_world_clip(self.gates, self.WORLD_W_true)
                        # Arena: no NPC spawns on arena
                        self.npc1_spawns=[]; self.npc2_spawns=[]; self.npc3_spawns=[]
                        # Arena intro cutscene: walk in from left with control lock
                        _sx,_sy,_sg = self.place_player_on_spawn(self.px,self.py,self.current_loc.spawn)
                        self.px = -150.0
                        self.py = _sy
                        self.on_ground = True
                        self.vy = 0.0
                        self.arena_intro_active=True
                        self.arena_intro_t=0.0
                        self.arena_intro_target_x = 300.0
                        self.interaction_active=False; self.inter_runtime=None; self.inter_idx=None
                    break

        active_portal=None; portal_target=None
        current_evo=evo_from_skin(self.current_skin)
        for p in self.portals:
            if player_world_rect.colliderect(p.rect):
                if self.current_key=="lobby":
                    dyn_target=('ending' if getattr(self,'ending_unlocked',False) else dynamic_target_for_evo(current_evo))
                    if current_evo>=required_level_for_portal(dyn_target): active_portal=p; portal_target=dyn_target
                else:
                    active_portal=p; portal_target=p.target
                break

        active_ladder=None; candidate=None
        if (not self.interaction_active) and self.respawn_state=="normal" and not self.climbing and self.climb_stepout<=0.0 and (not is_falling) and (not self.intro_active) and (self.lobby_dropin_lock_t<=0.0) and (not self.arena_intro_active):
            for lad in self.ladders:
                if player_world_rect.colliderect(lad.rect): candidate=lad; break
        if candidate:
            cid=(candidate.rect.x,candidate.rect.y,candidate.rect.w,candidate.rect.h)
            if self.ladder_hover_id==cid: self.ladder_hover_t+=dt
            else: self.ladder_hover_id=cid; self.ladder_hover_t=0.0
            if self.ladder_hover_t>=LADDER_INTERACT_DELAY: active_ladder=candidate
        else:
            self.ladder_hover_id=None; self.ladder_hover_t=0.0

        # Interactions trigger (all worlds)
        if (not self.interaction_active) and self.respawn_state=="normal" and (not self.climbing) and (self.climb_stepout<=0.0) and (self.lobby_dropin_lock_t<=0.0) and (not self.arena_intro_active):
            for t in self.triggers:
                key=f"{self.current_key}_t{t.idx+1}"
                if key in self.progress[self.current_key]: continue
                if t.rect.contains(player_world_rect):
                    wn = int(''.join(ch for ch in str(self.current_key) if ch.isdigit()) or '1')
                    if wn not in self.world_scripts:
                        self.world_scripts[wn] = parse_world_scripts(wn)
                    scripts = self.world_scripts[wn]
                    script = scripts[min(t.idx, len(scripts)-1)]
                    self.inter_runtime = InteractionRuntime(script); self.inter_idx = t.idx; self.interaction_active = True
                    break

        e_now=keys[K_e]; just_E=(e_now and not self.prev_e_pressed); self.prev_e_pressed=e_now
        if (not self.interaction_active) and active_ladder and just_E and self.respawn_state=="normal" and not self.climbing and self.climb_stepout<=0.0 and (not is_falling) and (not self.intro_active) and (self.lobby_dropin_lock_t<=0.0) and (not self.arena_intro_active):
            self.climb_rect=active_ladder.rect; self.climb_target_y=self.climb_rect.top-PLAYER_H
            self.climb_side_dir= 1 if (self.px+PLAYER_W/2) < self.climb_rect.centerx else -1
            self.animator.set_state("climb"); self.animator.set_facing_dir(self.climb_side_dir); self.climbing=True

        if (not self.interaction_active) and (not active_ladder) and active_portal and just_E and (portal_target in self.locations or portal_target=='ending') \
           and self.respawn_state=="normal" and not self.climbing and self.climb_stepout<=0.0 and (not self.intro_active) and (self.lobby_dropin_lock_t<=0.0) and (not self.arena_intro_active):
            if active_portal and portal_target == 'ending':
                self.ending_phase="fadeout"; self.ending_fade_t=0.0
                return True

                        # Ending portal (special): open ending (black screen) immediately
            if active_portal and portal_target == 'ending' and just_E and (not active_ladder):
                self.ending_phase="fadeout"; self.ending_fade_t=0.0
                return True
            if self.current_key!="lobby" and portal_target=="lobby":

                try:
                    _prev_key = str(self.current_key)
                    _wn_prev = int(''.join(ch for ch in _prev_key if ch.isdigit()) or '1')
                except Exception:
                    _wn_prev = None
                try:
                    had_scroll = ('scroll_collected' in self.progress.get(self.current_key, set()))
                except Exception:
                    had_scroll = False
                if (_wn_prev is not None) and had_scroll:
                    self._summary_pending_wn = _wn_prev
                self.progress[self.current_key].clear()
                # If we just finished World 4, switch Lobby background to bg_empty.png
                try:
                    if int(_wn_prev) >= 4:
                        self._lobby_bg_variant = 'empty'
                except Exception:
                    pass
            wipe_out_down(self.screen, self.clock, duration=0.55)
            self.current_key=portal_target; self.current_loc=self.locations[self.current_key]
            # If any world with scroll collected is >=4, use empty lobby bg
            try:
                completed_max = 0
                for k, s in self.progress.items():
                    if 'scroll_collected' in s:
                        try:
                            num = int(''.join(ch for ch in str(k) if ch.isdigit()) or '0')
                            if num > completed_max:
                                completed_max = num
                        except Exception:
                            pass
                if completed_max >= 4:
                    self._lobby_bg_variant = 'empty'
            except Exception:
                pass
            self._reset_state_for_world()
            self.bg_surf,self.bg_w,self.bg_h = load_background(self.current_loc.bg_path)
            if self.current_key == 'lobby' and getattr(self, '_lobby_bg_variant', 'normal') == 'empty':
                try:
                    pth = os.path.join('assets','worlds','lobby','bg_empty.png')
                    if os.path.exists(pth):
                        img = pygame.image.load(pth).convert()
                        self.bg_surf, self.bg_w, self.bg_h = img, img.get_width(), img.get_height()
                except Exception:
                    pass
            self.portal_color_map=PORTAL_COLOR_MAPS.get(self.current_key,{})
            (self.colliders, self.WORLD_W_true, self.portals, self.ladders, self.triggers, self.gates, self.arena_zones, self.boss_spawns) = \
                parse_world_from_mask(self.current_loc.mask_path, PLAY_RECT.top, TILE, THRESHOLD, self.portal_color_map)
            self.collider_buckets=build_collider_buckets(self.colliders, TILE)
            # Build NPC spawns per-world (map)
            if (not str(self.current_key).endswith('_arena')) and str(self.current_key).startswith('world'):
                try:
                    wn = self._get_world_number_from_key() or 1
                    npc_mask = os.path.join('assets','worlds', str(wn), 'npc', 'npc_mask.png')
                    self.npc1_spawns, self.npc2_spawns, self.npc3_spawns = parse_npc_spawns(npc_mask, PLAY_RECT.top, TILE)
                except Exception:
                    self.npc1_spawns=[]; self.npc2_spawns=[]; self.npc3_spawns=[]
            else:
                self.npc1_spawns=[]; self.npc2_spawns=[]; self.npc3_spawns=[]
            for ik in self.progress[self.current_key]:
                try:
                    _,tname=ik.split("_t"); tidx=int(tname)-1; unlock_gates_by_index(self.gates, tidx)
                except: pass
            self.WORLD_W_local=recompute_world_clip(self.gates, self.WORLD_W_true)
            if self.current_key=='lobby':
                self.px,self.py,self.on_ground = self.place_player_dropin_lobby_center()
                self.lobby_dropin_active=True  # input lock during drop-in (no overlay)
                self.lobby_dropin_lock_t = self.estimate_fall_time(self.px, self.py, vy0=self.vy) + 0.02
            else:
                self.px,self.py,self.on_ground=self.place_player_on_spawn(self.px,self.py,self.current_loc.spawn)
            self.vy=0.0
            self.respawn_state="normal"; self.respawn_t=0.0; self.draw_visible=True
            self.climbing=False; self.climb_target_y=None; self.climb_rect=None; self.climb_stepout=0.0
            self.last_safe_pos=(self.px,self.py); self.last_safe_full_pos=None
            prev_state,prev_facing=self.animator.state,self.animator.facing
            self.animator=Animator(build_animations_from_paths(skin_paths(self.current_skin), PLAYER_W, PLAYER_H))
            self.animator.set_state(prev_state); self.animator.facing=prev_facing; self.animator.index=0; self.animator.accum_ms=0
            if self.current_key!="lobby":
                self.world_display_name,intro_text=load_world_intro(self.current_key)
                self.intro_active=True; self.intro_phase="title"; self.intro_timer=0.0; self.intro_text_tw=Typewriter(intro_text, 32.0)
            else:
                self.world_display_name="Lobby"
            self.pending_wipe_in=True; return

        if self.climbing or self.climb_stepout>0.0:
            self.animator.set_state("climb"); self.animator.set_facing_dir(self.climb_side_dir)
        else:
            ground_for_anim = self.on_ground or (self.anim_ground_timer>0.0)
            self.animator.set_state("jump" if not ground_for_anim else ("run" if abs(vx)>1.0 else "idle"))
            self.animator.set_facing_dir(self.facing)
        self.animator.update(int(dt*1000))

        self.player_center_x=self.px+PLAYER_W/2
        if not str(self.current_key).endswith("_arena"):
            self.camera_x=max(0, min(self.player_center_x-LOGICAL_W/2, max(0, self.WORLD_W_local-LOGICAL_W)))
            # Clamp player within world bounds for non-arena maps
            left_bound = 0
            right_bound = max(0, self.WORLD_W_local - PLAYER_W)
            if self.px < left_bound: self.px = left_bound
            if self.px > right_bound: self.px = right_bound
        else:
            self.camera_x = 0 if self.arena_intro_active else max(0, (self.WORLD_W_local-LOGICAL_W)/2)

            # Auto-start summary dialog in Lobby (deprecated, kept as fallback)
            if (self._summary_pending_wn is not None) and (self.current_key == "lobby") and (not self.summary_active):
                wn = self._summary_pending_wn
                self._summary_pending_wn = None

                # If this was intro, mark as shown and reset title mode
                if getattr(self, 'summary_as_intro', False):
                    self.summary_as_intro = False
                    self.game_intro_shown = True

                self._start_summary_dialog(wn)        # # Start game intro in Lobby once, after drop-in and when safe (no overlays)
        if self.current_key == "lobby" and (not getattr(self, 'summary_active', False)) and (not getattr(self, 'game_intro_shown', False)):
            safe = (self.lobby_dropin_lock_t <= 0.0) and self.on_ground
            safe = safe and (not self.interaction_active) and (not self.death_menu_active) and (not self.arena_intro_active)
            try:
                quiz_visible = bool(self.boss_quiz) and getattr(self.boss_quiz, 'anim_state', 'visible') != 'hidden'
            except Exception:
                quiz_visible = False
            if safe and (not quiz_visible):
                try:
                    self._start_game_intro()  # call _start_game_intro
                except Exception:
                    pass
        # Show welcome-back dialog once after loading a save
        if self.current_key == "lobby" and getattr(self, "_welcome_back_pending", False) and (not getattr(self, 'summary_active', False)):
            safe = (self.lobby_dropin_lock_t <= 0.0) and self.on_ground
            safe = safe and (not self.interaction_active) and (not self.death_menu_active) and (not self.arena_intro_active)
            try:
                quiz_visible = bool(self.boss_quiz) and getattr(self.boss_quiz, 'anim_state', 'visible') != 'hidden'
            except Exception:
                quiz_visible = False
            if safe and (not quiz_visible):
                try:
                    self._start_welcome_back()
                    self._welcome_back_pending = False
                except Exception:
                    self._welcome_back_pending = False

        # Delayed start for summary in Lobby (robust trigger)
        if self.current_key == "lobby" and (not self.summary_active):
            # wait until drop-in finished and player touched the ground
            if (self.lobby_dropin_lock_t <= 0.0) and self.on_ground:
                wn = self.last_completed_world if self.last_completed_world is not None else self._summary_pending_wn
                if (wn is not None) and (self.last_summarized_world is not None) and (int(wn) == int(self.last_summarized_world)):
                    wn = None
                if wn is not None:
                    try:
                        self._start_summary_dialog(int(wn))
                        self.last_summarized_world = int(wn)
                    except Exception:
                        pass
                    self._summary_pending_wn = None
                    # If this was intro, mark as shown and reset title mode
                    if getattr(self, 'summary_as_intro', False):
                        self.summary_as_intro = False
                        self.game_intro_shown = True

                    self.last_completed_world = None

        # Clamp player within arena screen
        if str(self.current_key).endswith("_arena") and (not self.arena_intro_active):
            left_bound=self.camera_x
            right_bound=self.camera_x+LOGICAL_W-PLAYER_W
            if self.px<left_bound: self.px=left_bound
            if self.px>right_bound: self.px=right_bound

        if self.interaction_active and self.inter_runtime: self.inter_runtime.update(dt)
        # Lazy-load boss frames on first arena entry
        if str(self.current_key).endswith("_arena") and not self.boss_frames:
            try:
                wn=int(''.join(ch for ch in str(self.current_key) if ch.isdigit()) or '1')
                self.boss_frames=self.load_boss_frames(wn)
            except Exception:
                self.boss_frames=[]
        if self.boss_frames and (not getattr(self,'boss_anim_frozen',False)):
            self.boss_anim_acc += dt
            frame_durs = getattr(self, 'boss_frame_durs', None)
            if not frame_durs or len(frame_durs) != len(self.boss_frames):
                frame_durs = [0.35 for _ in self.boss_frames]  # domyślnie 0.35 s/klatkę
            if self.boss_anim_acc >= frame_durs[self.boss_anim_idx % len(self.boss_frames)]:
                self.boss_anim_acc = 0.0
                self.boss_anim_idx = (self.boss_anim_idx + 1) % len(self.boss_frames)


    # ---- bossfight helpers ----        self._ext_after_update(dt)

    def _apply_damage_shake(self, target: str):
        if target == 'player':
            self.player_shake_t = 0.25
        elif target == 'boss':
            self.boss_shake_t = 0.25

    def on_boss_answer(self, correct: bool):
        """Apply 100 dmg; if someone hits 0 HP, hide UI first then run sequence."""
        if not self.bossfight_active:
            return
        dmg = 100
        if bool(correct):
            self.boss_hp = max(0, int(self.boss_hp) - dmg)
            self._apply_damage_shake('boss')
        else:
            self.player_hp = max(0, int(self.player_hp) - dmg)
            self._apply_damage_shake('player')
        # Immediate UI off when lethal
        if self.boss_hp <= 0:
            self.bossfight_active = False
            self.boss_quiz = None
            self.start_boss_defeat_sequence()
        elif self.player_hp <= 0:
            self.bossfight_active = False
            self.boss_quiz = None
            self.start_player_defeat_sequence()

    def start_boss_defeat_sequence(self):
        # Freeze boss animation before blinking
        self.boss_anim_frozen = True
        # Safety: ensure UI is hidden once boss is defeated
        self.bossfight_active = False
        self.boss_quiz = None
        """Boss blink → vanish → drop scroll; movement unlocked."""
        self.boss_visible = True
        self.boss_blink_active = True
        self.boss_blink_t = 0.0
        self.boss_defeated = True
        try:
            _wn = int(''.join(ch for ch in str(self.current_key) if ch.isdigit()) or '1')
            self._summary_pending_wn = _wn
        except Exception:
            self._summary_pending_wn = self._summary_pending_wn or None
        self._boss_last_rect_for_drop = getattr(self, 'boss_rect_current', None)
        # ensure movement is allowed
        # (we already turned off bossfight_active in on_boss_answer)

    def start_player_defeat_sequence(self):
        """Player blink → vanish → death menu."""
        # Safety: ensure boss UI is off
        self.bossfight_active = False
        self.boss_quiz = None
        self.death_blink_active = True
        self.death_blink_t = 0.0
        self.draw_visible = True  # start visible; blinking toggles

    def restart_bossfight(self):
        """Hide UI → wipe-in → arena intro walk-in → directly to questions (skip boss dialog)."""
        # Hide any UI remnants
        self.bossfight_active = False
        self.boss_quiz = None
        self.death_menu_active = False
        self.death_blink_active = False
        self.draw_visible = True
        # Reset HP from file
        hp_from_file = 1000
        try:
            hp_from_file = int(getattr(self, 'boss_data', {}).get('hp', 1000))
        except Exception:
            pass
        self.player_hp_max = 300; self.player_hp = 300
        self.boss_hp_max = hp_from_file; self.boss_hp = hp_from_file
        self.boss_defeated = False
        # Position & intro
        try:
            _sx,_sy,_sg = self.place_player_on_spawn(self.px,self.py,self.current_loc.spawn)
            self.px = -150.0; self.py = _sy; self.on_ground=True; self.vy=0.0
        except Exception:
            pass
        self.skip_boss_intro_once = True
        self.boss_anim_frozen = False
        self.boss_dialog_mode = False
        self.bossfight_active = False
        self.arena_intro_active=True; self.arena_intro_t=0.0; self.arena_intro_target_x = 300.0
        self.boss_dialog_started = False
        self.pending_wipe_in = True  # smooth wipe-in

    def goto_world_and_reset_progress(self, world_number: int):
        """Teleport to world start; reset progress; skip world intro; do wipe-in."""
        try:
            target_key = f"world{int(world_number)}"
        except Exception:
            target_key = "world1"
        if target_key not in self.locations:
            return
        # Clear UI/flags
        self.boss_anim_frozen = False
        self.boss_dialog_started = False
        self.skip_boss_intro_once = False
        self.arena_intro_active = False
        self.bossfight_active = False
        self.boss_quiz = None
        self.boss_defeated = False
        self.boss_visible = False
        self.boss_blink_active = False
        self.scroll_active = False
        self.scroll_rect = None
        self.death_menu_active = False
        self.death_blink_active = False
        self.draw_visible = True
        # Reset world
        self.progress[target_key].clear()
        wipe_out_down(self.screen, self.clock, duration=0.55)
        self.current_key = target_key
        self.current_loc = self.locations[self.current_key]
        self._reset_state_for_world()
        self.bg_surf,self.bg_w,self.bg_h = load_background(self.current_loc.bg_path)
        self.portal_color_map=PORTAL_COLOR_MAPS.get(self.current_key,{})
        (self.colliders, self.WORLD_W_true, self.portals, self.ladders, self.triggers, self.gates, self.arena_zones, self.boss_spawns) = \
            parse_world_from_mask(self.current_loc.mask_path, PLAY_RECT.top, TILE, THRESHOLD, self.portal_color_map)
        self.collider_buckets=build_collider_buckets(self.colliders, TILE)
        try:
            wn = int(''.join(ch for ch in str(self.current_key) if ch.isdigit()) or '1')
            npc_mask = os.path.join('assets','worlds', str(wn), 'npc', 'npc_mask.png')
            self.npc1_spawns, self.npc2_spawns, self.npc3_spawns = parse_npc_spawns(npc_mask, PLAY_RECT.top, TILE)
        except Exception:
            self.npc1_spawns=[]; self.npc2_spawns=[]; self.npc3_spawns=[]
        for ik in self.progress[self.current_key]:
            try:
                _,tname=ik.split("_t"); tidx=int(tname)-1; unlock_gates_by_index(self.gates, tidx)
            except: pass
        self.WORLD_W_local=recompute_world_clip(self.gates, self.WORLD_W_true)
        self.px,self.py,self.on_ground=self.place_player_on_spawn(self.px,self.py,self.current_loc.spawn)
        self.vy=0.0
        self.respawn_state="normal"; self.respawn_t=0.0; self.draw_visible=True
        self.climbing=False; self.climb_target_y=None; self.climb_rect=None; self.climb_stepout=0.0
        self.last_safe_pos=(self.px,self.py); self.last_safe_full_pos=None
        prev_state,prev_facing=self.animator.state,self.animator.facing
        self.animator=Animator(build_animations_from_paths(skin_paths(self.current_skin), PLAYER_W, PLAYER_H))
        self.animator.set_state(prev_state); self.animator.facing=prev_facing; self.animator.index=0; self.animator.accum_ms=0
        # Skip title/intro fully
        self.world_display_name,_intro_text = load_world_intro(self.current_key)
        self.intro_active=False; self.intro_phase=None; self.intro_timer=0.0; self.intro_text_tw=None
        self.pending_wipe_in=True

# ---- draw ----

    def _draw_ending(self, s):
        # Black background
        pygame.draw.rect(s, (0,0,0), pygame.Rect(0,0,LOGICAL_W,LOGICAL_H))
        # Lazy-init typewriter from file (once)
        try:
            if self.ending_tw is None:
                # Load story from file
                txt = ""
                try:
                    with open(self.ENDING_STORY_PATH, 'r', encoding='utf-8') as f:
                        txt = f.read()
                except Exception:
                    txt = ("Zamykasz oczy i czujesz, jak świat gry powoli gaśnie.\n"
                           "Wdech. Wydech. Wracasz do siebie — bogatszy o wiedzę i czujność.\n\n"
                           "To dopiero początek Twojej świadomości w sieci. Dziękujemy za grę.")
                self.ending_text = txt
                # Use the global project default 40 cps (matches boss intro)
                self.ending_tw = Typewriter(self.ending_text, 40.0)
        except Exception:
            pass

        # Update typewriter
        try:
            if self.ending_tw: self.ending_tw.update(self.dt)
        except Exception:
            pass

        # Word-wrap typed text with newline support
        cur_txt = self.ending_tw.get_text() if self.ending_tw else (self.ending_text or "")
        max_w = int(LOGICAL_W * 0.86)
        line_h = self.UI_FONT.render('Ag', (255,255,255)).get_height() + 10

        # Measure total height for vertical centering
        def wrap_lines(text):
            out_lines=[]
            for para in (text or "").split("\n"):
                words = para.split(" ")
                line = ""
                for w in words:
                    test = (line + " " + w).strip()
                    if not test:
                        continue
                    r = self.UI_FONT.render(test, (255,255,255))
                    if r.get_width() > max_w and line:
                        out_lines.append(line)
                        line = w
                    else:
                        line = test
                if line:
                    out_lines.append(line)
            return out_lines

        lines_out = wrap_lines(cur_txt)
        total_h = len(lines_out) * line_h
        y = (LOGICAL_H - total_h) // 2

        for line in lines_out:
            surf = self.UI_FONT.render(line, (255,255,255))
            s.blit(surf, ((LOGICAL_W - surf.get_width())//2, y))
            y += line_h

    def draw(self):
        # Start Menu overlay
        if getattr(self,'start_menu_active',False):
            s=self.screen
            try:
                if self.start_menu_bg:
                    bg=pygame.transform.scale(self.start_menu_bg,(LOGICAL_W,LOGICAL_H)); s.blit(bg,(0,0))
                else:
                    s.fill((8,10,14))
            except Exception:
                s.fill((8,10,14))
            opts=['Nowa gra', getattr(self,'_autosave_label','Kontynuuj'), 'Wyjdź z gry']
            title=self.UI_FONT_BIG_BIG.render('CyberEvolution', (220,220,255))
            title_y=LOGICAL_H//2-120
            s.blit(title,(LOGICAL_W//2 - title.get_width()//2, title_y))
            y=LOGICAL_H//2 - 20
            for i,opt in enumerate(opts):
                col=(255,255,255) if i==getattr(self,'start_menu_selection',0) else (200,200,200)
                if i==getattr(self,'start_menu_selection',0):
                    pygame.draw.rect(s,(70,70,90),(LOGICAL_W//2 - 220, y-6, 440, 40), border_radius=8)
                label=self.UI_FONT.render(opt, col)
                s.blit(label,(LOGICAL_W//2 - label.get_width()//2, y))
                y+=50
            pygame.display.flip(); return
        self._ext_before_draw(self.screen)
        s = self.screen
        if getattr(self, 'ending_active', False):
            self._draw_ending(s)
            pygame.display.flip()
            return
        s.fill(BLACK)
        s.set_clip(PLAY_RECT)
        if self.bg_surf:

            bg_cam_x=self.camera_x*BG_PARALLAX
            first=int(math.floor(bg_cam_x//self.bg_w)); start_x=-int(bg_cam_x-first*self.bg_w)
            y=PLAY_RECT.top; x=start_x
            while x<LOGICAL_W: s.blit(self.bg_surf,(x,y)); x+=self.bg_w
        else:
            pygame.draw.rect(s, SKY, PLAY_RECT)

        for p in self.portals:
            # Determine which world's portal frames to use
            draw_target = dynamic_target_for_evo(evo_from_skin(self.current_skin)) if self.current_key=="lobby" else p.target
            wn_for_frames = None
            if self.current_key == "lobby":
                try:
                    if str(draw_target).startswith("world"):
                        wn_for_frames = int(''.join(ch for ch in str(draw_target) if ch.isdigit()) or '1')
                except Exception:
                    wn_for_frames = None
            else:
                try:
                    wn_for_frames = self._get_world_number_from_key()
                except Exception:
                    wn_for_frames = None
            if wn_for_frames is None:
                try:
                    wn_for_frames = int(''.join(ch for ch in str(draw_target) if ch.isdigit()) or '1')
                except Exception:
                    wn_for_frames = 1
            portal_key = ('ending' if str(getattr(p,'target','')) == 'ending' else ('lobby' if str(getattr(p,'target','')) == 'lobby' else int(wn_for_frames)))
            frames = load_portal_frames_scaled_any(portal_key, int(p.rect.h))
            img = frames[self.portal_anim_idx % len(frames)]
            draw_x = int(p.rect.centerx - self.camera_x - img.get_width()/2)
            draw_y = p.rect.bottom - img.get_height()
            img_to_draw = img
            try:
                if hasattr(p, 'alpha'):
                    img_to_draw = img.copy()
                    img_to_draw.set_alpha(max(0, min(255, int(p.alpha))))
            except Exception:
                img_to_draw = img
            s.blit(img_to_draw, (draw_x, draw_y))
        # Boss quiz panel (top overlay; no dimming)
        if self.bossfight_active and self.boss_quiz:
            if self.bossfight_active and self.boss_quiz and (not self.death_menu_active) and (not self.death_blink_active) and (not self.boss_blink_active) and (not self.arena_intro_active) and (not self.pending_wipe_in):
                self.boss_quiz.draw(self.screen)


        # HP bars during bossfight


        if getattr(self, 'bossfight_active', False):


            if getattr(self,'bossfight_active',False) and (not getattr(self,'death_menu_active',False)) and (not getattr(self,'death_blink_active',False)) and (not getattr(self,'boss_blink_active',False)) and (not self.death_menu_active) and (not self.death_blink_active) and (not self.boss_blink_active) and (not self.arena_intro_active) and (not self.pending_wipe_in):
                                hp_layer = _get_overlay_cached(self, a) if 'a' in locals() else pygame.Surface((LOGICAL_W, LOGICAL_H), pygame.SRCALPHA)

                                self._draw_hp_bars(hp_layer)

                                hp_layer.set_alpha(int(max(0, min(1, self.hp_ui_alpha)) * 255))

                                self.screen.blit(hp_layer, (0, 0))


        # --- NPC sprites on world maps (animated 2 frames) ---


        if (not str(self.current_key).endswith('_arena')) and str(self.current_key).startswith('world'):


            wn = int(str(self.current_key).replace('world',''))


            s = self.screen


            def _get_frames(npc_id, h):


                key = (wn, npc_id, int(h))


                fr = self.npc_frames_cache.get(key)


                if fr is None:


                    fr = load_npc_frames_scaled(wn, npc_id, int(h))


                    self.npc_frames_cache[key] = fr


                return fr


            for r in self.npc1_spawns:


                fr = _get_frames(1, r.h); f = fr[self.npc_anim_idx[1] % len(fr)]


                s.blit(f, (int(r.centerx - self.camera_x - f.get_width()/2), r.bottom - f.get_height()))


            for r in self.npc2_spawns:


                fr = _get_frames(2, r.h); f = fr[self.npc_anim_idx[2] % len(fr)]


                s.blit(f, (int(r.centerx - self.camera_x - f.get_width()/2), r.bottom - f.get_height()))


            for r in self.npc3_spawns:


                fr = _get_frames(3, r.h); f = fr[self.npc_anim_idx[3] % len(fr)]


                s.blit(f, (int(r.centerx - self.camera_x - f.get_width()/2), r.bottom - f.get_height()))
        # Boss placeholder(s)
        if hasattr(self,'boss_spawns') and self.boss_spawns and self.boss_frames:
            bf=self.boss_frames[self.boss_anim_idx % len(self.boss_frames)]
            for r in self.boss_spawns:
                bx=int(r.centerx - self.camera_x - bf.get_width()/2)
                by=r.bottom - bf.get_height()
                offx, offy = 0, 0
                if self.boss_shake_t>0.0:
                    import random
                    amp = int(self.shake_amp_px)
                    offx = random.randint(-amp, amp)
                    offy = random.randint(-int(0.6*amp), int(0.6*amp))
                self.boss_rect_current = pygame.Rect(bx, by, bf.get_width(), bf.get_height())
                # Respect blink visibility: draw only when visible or when no blink is active
                if (not self.boss_defeated) or (self.boss_blink_active and self.boss_visible):
                    s.blit(bf, (bx+offx, by+offy))

        player_rect_screen=pygame.Rect(int(self.px-self.camera_x), int(self.py), PLAYER_W, PLAYER_H)
        self.player_rect = player_rect_screen
        if self.draw_visible:
            frame=self.animator.frame()
            offx_p, offy_p = 0, 0
            if self.player_shake_t>0.0:
                import random
                amp = int(self.shake_amp_px)
                offx_p = random.randint(-amp, amp)
                offy_p = random.randint(-int(0.6*amp), int(0.6*amp))
            if not getattr(self,'evolve_poof_active',False):

                s.blit(frame,(player_rect_screen.centerx-frame.get_width()//2 + offx_p,
                player_rect_screen.bottom-frame.get_height() + offy_p))

            else:

                t=max(0.0,min(1.0,self.evolve_poof_t/max(0.001,self.evolve_poof_dur)))

                rad=int((PLAYER_W*0.8)*(0.6+0.8*t))

                alpha=int(255*(1.0-t))

                poof=pygame.Surface((rad*2,rad*2), pygame.SRCALPHA)

                pygame.draw.circle(poof,(255,255,255,alpha),(rad,rad),rad)

                s.blit(poof,(player_rect_screen.centerx-rad, player_rect_screen.centery-rad))

                s.set_clip(None)
        # --- ENDING FADE-OUT OVERLAY (drawn before letterbox) ---
        if getattr(self, 'ending_phase', None) == 'fadeout':
            t = min(1.0, self.ending_fade_t / max(0.001, self.ENDING_FADE_TIME))
            a = int(255 * t)
            _fade = _get_overlay_cached(self, a) if 'a' in locals() else pygame.Surface((LOGICAL_W, LOGICAL_H), pygame.SRCALPHA)
            _fade.fill((0,0,0,a))
            s.blit(_fade, (0,0))
        if (BAR_H>0) and (not getattr(self,'_suppress_letterbox',False)):
            pygame.draw.rect(s, BLACK, pygame.Rect(0,0,LOGICAL_W,BAR_H))
        # Evolution message above the player
        if self.evo_msg_timer > 0.0:
            try:
                text = 'Evolution UP!'
                label = self.UI_FONT.render(text, (0,255,0))
                outline = self.UI_FONT.render(text, (0,0,0))
                lx = player_rect_screen.centerx - label.get_width()//2
                ly = player_rect_screen.centery - label.get_height()//2
                # 1px outline
                for dx, dy in ((-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)):
                    s.blit(outline, (lx+dx, ly+dy))
                s.blit(label, (lx, ly))
            except Exception:
                pass

            if (BAR_H>0) and (not getattr(self,'_suppress_letterbox',False)):

                pygame.draw.rect(s, BLACK, pygame.Rect(0,PLAY_RECT.bottom,LOGICAL_W,BAR_H))

        if (not self.interaction_active) and (not self.climbing) and self.draw_visible and self.respawn_state=="normal" and self.climb_stepout<=0.0 and (not self.intro_active) and (self.lobby_dropin_lock_t<=0.0) and (not self.arena_intro_active):
            pwr=pygame.Rect(int(self.px), int(self.py), PLAYER_W, PLAYER_H)
            active_portal=None; portal_target=None
            current_evo=evo_from_skin(self.current_skin)
            for p in self.portals:
                if pwr.colliderect(p.rect):
                    if self.current_key=="lobby":
                        dyn_target=dynamic_target_for_evo(current_evo)
                        if current_evo>=required_level_for_portal(dyn_target): active_portal=p; portal_target=dyn_target
                    else:
                        active_portal=p; portal_target=p.target
                    break
            active_ladder=None
            for lad in self.ladders:
                if pwr.colliderect(lad.rect): active_ladder=lad; break
            if active_ladder and (self.ladder_hover_t>=LADDER_INTERACT_DELAY):
                tip=self.UI_FONT.render("E: wspinaj się",(255,255,255))
                tw,th=tip.get_size(); s.blit(tip,(player_rect_screen.centerx-tw//2, player_rect_screen.top-(th+8)))
            elif active_portal and portal_target:
                tip=self.UI_FONT.render(("E: wejdź do świata") if self.current_key=="lobby" else(("WRÓĆ DO RZECZYWISTOŚCI") if self.current_key=="world5_arena" else "E: powrót do lobby"),(255,255,255))
                tw,th=tip.get_size(); s.blit(tip,(player_rect_screen.centerx-tw//2, player_rect_screen.top-(th+8)))

        if self.interaction_active and self.inter_runtime:
            player_in_upper = (player_rect_screen.centery < (PLAY_RECT.top + PLAY_H/2))
            panel_h=int(PLAY_H*0.35); panel_w=int(LOGICAL_W*0.66); gap=16; avatar_size=panel_h
            total_w=avatar_size+gap+panel_w; unit_x=(LOGICAL_W-total_w)//2; unit_y=(PLAY_RECT.bottom-panel_h-16) if player_in_upper else (PLAY_RECT.top+16)
            avatar_box=pygame.Surface((avatar_size,avatar_size), pygame.SRCALPHA); avatar_box.fill((16,18,24,218))
            pygame.draw.rect(avatar_box,(185,185,220,255), avatar_box.get_rect(), 2, border_radius=10)
            st=self.inter_runtime.stage; current_evo=evo_from_skin(self.current_skin)
            if st == 'context':
                speaker = (self.inter_runtime.script.avatar or 'player')
            elif st in ('sage','feedback'):
                speaker = 'medrzec'
            elif st == 'choices':
                speaker = 'player'
            else:
                speaker = 'player'
            head_img=load_head_image(speaker, evo_level=current_evo)
            pad=10; avail=avatar_size-2*pad
            if head_img.get_width()>=head_img.get_height():
                scale=avail/float(head_img.get_width()); scaled=pygame.transform.scale(head_img,(int(head_img.get_width()*scale), int(head_img.get_height()*scale)))
            else:
                scale=avail/float(head_img.get_height()); scaled=pygame.transform.scale(head_img,(int(head_img.get_width()*scale), int(head_img.get_height()*scale)))
            ax=(avatar_size-scaled.get_width())//2; ay=(avatar_size-scaled.get_height())//2; avatar_box.blit(scaled,(ax,ay))
            panel=pygame.Surface((panel_w,panel_h), pygame.SRCALPHA); panel.fill((16,18,24,218))
            pygame.draw.rect(panel,(185,185,220,255), panel.get_rect(), 2, border_radius=10)
            title=(f"{self.world_display_name} - Interakcja {ordinal_pl(self.inter_idx+1)}" if self.inter_idx is not None else f"{self.world_display_name}")
            t_surf=self.UI_FONT.render(title,(255,255,0)); panel.blit(t_surf,(12,10)); y=10+t_surf.get_height()+6
            tw = self.inter_runtime.ctx_tw
            full = tw.current_full() if hasattr(tw,'current_full') else ''
            # Title from full text (instant), body from typed text with title prefix trimmed
            ctx_title, _ = self._split_context_title(full)
            # Compute prefix_end = len('Title:' + optional spaces) based on *full* text
            colon = full.find(':')
            prefix_end = 0
            if colon != -1:
                prefix_end = colon + 1
                # include any spaces right after ':'
                while prefix_end < len(full) and full[prefix_end] == ' ':
                    prefix_end += 1
            typed = tw.get_text()
            typed = str(typed) if typed is not None else ''
            # If we haven't typed past the prefix yet, body is empty to avoid flicker
            ctx = typed[prefix_end:] if len(typed) > prefix_end else ''
            ctx_label=self.UI_FONT.render( (ctx_title.rstrip(':') + ':') ,(180,210,255)); panel.blit(ctx_label,(12,y)); y+=ctx_label.get_height()+2
            y=wrap_draw_multiline(panel, self.UI_FONT, ctx, 16, y, panel_w-32, 28, (235,235,235))
            if st in ('context','sage','feedback'):
                y+=8
                if st=='context':
                    arrow_ready=self.inter_runtime.ctx_tw.done
                elif st=='sage':
                    s_label=self.UI_FONT.render("Mędrzec:",(255,230,180)); panel.blit(s_label,(12,y)); y+=s_label.get_height()+2
                    cur=self.inter_runtime.sage_tw.get_text() if self.inter_runtime.sage_tw else ""
                    y=wrap_draw_multiline(panel, self.UI_FONT, cur, 16, y, panel_w-32, 28, (250,235,210))
                    arrow_ready=(self.inter_runtime.sage_tw.done if self.inter_runtime.sage_tw else True)
                else:
                    fb=self.inter_runtime.feedback_tw.get_text() if self.inter_runtime.feedback_tw else ""
                    y=wrap_draw_multiline(panel, self.UI_FONT, fb, 16, y, panel_w-32, 28, (220,255,220))
                    arrow_ready=(self.inter_runtime.feedback_tw.done if self.inter_runtime.feedback_tw else True)
                if arrow_ready:
                    enter_hint=self.UI_FONT.render("ENTER aby przejść dalej",(200,200,200))
                    panel.blit(enter_hint,(panel_w-enter_hint.get_width()-12, panel_h-enter_hint.get_height()-10))
            elif st=='choices':
                y+=10; ch_label=self.UI_FONT.render("Wybierz reakcję:",(200,230,255)); panel.blit(ch_label,(12,y)); y+=ch_label.get_height()+10
                opts=[("A",self.inter_runtime.viewA), ("B",self.inter_runtime.viewB)]
                for i,(tag,text) in enumerate(opts):
                    sel=(i==self.inter_runtime.selection)
                    if sel:
                        box=pygame.Surface((panel_w-32,34), pygame.SRCALPHA); box.fill((60,90,140,110)); panel.blit(box,(16,y-2))
                    col=(255,255,255) if sel else (210,210,210)
                    txt=self.UI_FONT.render(f"{tag}. {text}", col); panel.blit(txt,(24,y)); y+=38
                hint=self.UI_FONT.render("↑/↓ lub 1/2 — wybór, Enter/Spacja/E — zatwierdź",(180,180,200))
                panel.blit(hint,(16, panel_h-hint.get_height()-10))
            s.blit(avatar_box,(unit_x,unit_y)); s.blit(panel,(unit_x+avatar_size+gap, unit_y))

        if self.intro_active:
            alpha=150
            if self.intro_phase=="boss_fade_in":
                self.intro_fade_t+=self.dt
                alpha=int(150*min(1.0, self.intro_fade_t/max(0.001,self.BOSS_FADE_IN_TIME)))
                if self.intro_fade_t>=self.BOSS_FADE_IN_TIME:
                    self.intro_phase="text"
                    if self.intro_text_tw: self.intro_text_tw.shown=0.0; self.intro_text_tw.done=False
            overlay=pygame.Surface((LOGICAL_W,LOGICAL_H), pygame.SRCALPHA); overlay.fill((0,0,0,alpha)); s.blit(overlay,(0,0))
            if self.intro_phase=="title":
                title_font=PixelFont(PIXEL_FONT_PATH, base_px=16, scale=5)
                ts=title_font.render(self.world_display_name,(255,240,160))
                s.blit(ts,((LOGICAL_W-ts.get_width())//2, (LOGICAL_H-ts.get_height())//2))
                self.intro_timer+=self.dt
                if self.intro_timer>=INTRO_TITLE_TIME:
                    self.intro_phase="title_fade"; self.intro_fade_t=0.0
            elif self.intro_phase=="title_fade":
                title_font=PixelFont(PIXEL_FONT_PATH, base_px=16, scale=5)
                ts=title_font.render(self.world_display_name,(255,240,160))
                self.intro_fade_t+=self.dt; alpha=max(0, 255-int(255*(self.intro_fade_t/max(0.001,INTRO_FADE_TIME))))
                ts.set_alpha(alpha); s.blit(ts,((LOGICAL_W-ts.get_width())//2, (LOGICAL_H-ts.get_height())//2))
                if self.intro_fade_t>=INTRO_FADE_TIME:
                    self.intro_phase="text"
                    if self.intro_text_tw: self.intro_text_tw.shown=0.0; self.intro_text_tw.done=False
            elif self.intro_phase=="text":
                # Special case: World 5 intro has NO sage avatar (text window only)
                is_world5 = (not self.boss_dialog_mode) and (str(self.current_key) == "world5")
                panel_h=int(PLAY_H*0.35); panel_w=int(LOGICAL_W*0.66); gap=16; avatar_size=panel_h
                if is_world5:
                    unit_x=(LOGICAL_W-panel_w)//2; unit_y=(PLAY_RECT.top+PLAY_H-panel_h)//2
                    panel=pygame.Surface((panel_w,panel_h), pygame.SRCALPHA); panel.fill((16,18,24,218))
                    pygame.draw.rect(panel,(185,185,220,255), panel.get_rect(), 2, border_radius=10)
                    t_surf=self.UI_FONT.render(f"{self.world_display_name} — Wstęp",(255,255,0)); panel.blit(t_surf,(12,10)); y=10+t_surf.get_height()+8
                    if self.intro_text_tw: self.intro_text_tw.update(self.dt)
                    cur=self.intro_text_tw.get_text() if self.intro_text_tw else ""
                    y=wrap_draw_multiline(panel, self.UI_FONT, cur, 16, y, panel_w-32, 28, (250,235,210))
                    if self.intro_text_tw and self.intro_text_tw.done:
                        enter_hint=self.UI_FONT.render("ENTER aby przejść dalej",(200,200,200))
                        panel.blit(enter_hint,(panel_w-enter_hint.get_width()-12, panel_h-enter_hint.get_height()-10))
                    s.blit(panel,(unit_x, unit_y))
                else:
                    total_w=avatar_size+gap+panel_w; unit_x=(LOGICAL_W-total_w)//2; unit_y=(PLAY_RECT.top+PLAY_H-panel_h)//2
                    avatar_box=pygame.Surface((avatar_size,avatar_size), pygame.SRCALPHA); avatar_box.fill((16,18,24,218))
                    pygame.draw.rect(avatar_box,(185,185,220,255), avatar_box.get_rect(), 2, border_radius=10)
                    head_img=(self.boss_avatar if (self.boss_dialog_mode and self.boss_avatar) else load_head_image("medrzec")); pad=10; avail=avatar_size-2*pad
                    if head_img.get_width()>=head_img.get_height():
                        scale=avail/float(head_img.get_width()); scaled=pygame.transform.scale(head_img,(int(head_img.get_width()*scale), int(head_img.get_height()*scale)))
                    else:
                        scale=avail/float(head_img.get_height()); scaled=pygame.transform.scale(head_img,(int(head_img.get_width()*scale), int(head_img.get_height()*scale)))
                    ax=(avatar_size-scaled.get_width())//2; ay=(avatar_size-scaled.get_height())//2; avatar_box.blit(scaled,(ax,ay))
                    panel=pygame.Surface((panel_w,panel_h), pygame.SRCALPHA); panel.fill((16,18,24,218))
                    pygame.draw.rect(panel,(185,185,220,255), panel.get_rect(), 2, border_radius=10)
                    t_surf=self.UI_FONT.render(f"{self.world_display_name} — Wstęp",(255,255,0)); panel.blit(t_surf,(12,10)); y=10+t_surf.get_height()+8
                    if self.intro_text_tw: self.intro_text_tw.update(self.dt)
                    cur=self.intro_text_tw.get_text() if self.intro_text_tw else ""
                    y=wrap_draw_multiline(panel, self.UI_FONT, cur, 16, y, panel_w-32, 28, (250,235,210))
                    if self.intro_text_tw and self.intro_text_tw.done:
                        enter_hint=self.UI_FONT.render("ENTER aby przejść dalej",(200,200,200))
                        panel.blit(enter_hint,(panel_w-enter_hint.get_width()-12, panel_h-enter_hint.get_height()-10))
                    s.blit(avatar_box,(unit_x,unit_y)); s.blit(panel,(unit_x+avatar_size+gap, unit_y))

        if self.debug_enabled:
            fps=self.UI_FONT.render(f"FPS: {int(self.clock.get_fps())}  |  Świat: {self.current_key}  |  Ewolucja: {evo_from_skin(self.current_skin)}  |  LOC: {self.code_lines}", DEBUG_TEXT)
            s.blit(fps,(12,12))
            view_world=pygame.Rect(int(self.camera_x), PLAY_RECT.top, LOGICAL_W, PLAY_H)
            for gx in range((view_world.left//TILE)-1, (view_world.right//TILE)+2):
                for gy in range(((view_world.top-PLAY_RECT.top)//TILE)-1, ((view_world.bottom-PLAY_RECT.top)//TILE)+2):
                    for c in self.collider_buckets.get((gx,gy),[]):
                        pygame.draw.rect(s, DEBUG_COLL, pygame.Rect(c.x-int(self.camera_x), c.y, c.w, c.h), 1)
            pygame.draw.rect(s, DEBUG_PLAYER, player_rect_screen, 2)
            for t in self.triggers:
                pygame.draw.rect(s, DBG_TRIGGER, pygame.Rect(t.rect.x-int(self.camera_x), t.rect.y, t.rect.w, t.rect.h), 1)
            for g in self.gates:
                col=DBG_GATE_LOCK if g.locked else DBG_GATE_OPEN
                pygame.draw.rect(s, col, pygame.Rect(g.rect.x-int(self.camera_x), g.rect.y, g.rect.w, g.rect.h), 2)
            for lad in self.ladders:
                pygame.draw.rect(s, DBG_LADDER, pygame.Rect(lad.rect.x-int(self.camera_x), lad.rect.y, lad.rect.w, lad.rect.h), 1)
            for p in self.portals:
                pygame.draw.rect(s, DBG_PORTAL, pygame.Rect(p.rect.x-int(self.camera_x), p.rect.y, p.rect.w, p.rect.h), 1)
            if hasattr(self,'boss_spawns'):
                for r in self.boss_spawns:
                    pygame.draw.rect(s, DBG_BOSS, pygame.Rect(r.x-int(self.camera_x), r.y, r.w, r.h), 2)
            # NPC placeholders — per-world map
            if (not str(self.current_key).endswith('_arena')) and str(self.current_key).startswith('world'):
                if hasattr(self,'npc1_spawns'):
                    for r in self.npc1_spawns:
                        pygame.draw.rect(s, DBG_NPC1, pygame.Rect(r.x-int(self.camera_x), r.y, r.w, r.h), 1)
                if hasattr(self,'npc2_spawns'):
                    for r in self.npc2_spawns:
                        pygame.draw.rect(s, DBG_NPC2, pygame.Rect(r.x-int(self.camera_x), r.y, r.w, r.h), 1)
                if hasattr(self,'npc3_spawns'):
                    for r in self.npc3_spawns:
                        pygame.draw.rect(s, DBG_NPC3, pygame.Rect(r.x-int(self.camera_x), r.y, r.w, r.h), 1)

            if self.last_safe_full_pos:
                sx,sy=self.last_safe_full_pos; sx-=self.camera_x
                pygame.draw.line(s, DBG_SAFE, (sx-8,sy), (sx+8,sy),2); pygame.draw.line(s, DBG_SAFE, (sx,sy-8),(sx,sy+8),2)
            clip_x=int(self.WORLD_W_local-self.camera_x)
            pygame.draw.line(s, DBG_CLIP, (clip_x,PLAY_RECT.top),(clip_x,PLAY_RECT.bottom),2)

        if self.scroll_active and self.scroll_rect:
            sr = self.scroll_rect
            bob = int(math.sin(self.scroll_bob_t*4.4) * 10)
            draw_rect = pygame.Rect(sr.left, sr.top + bob, sr.w, sr.h)
            img = self._scroll_img
            if img is None:
                try:
                    wn = self._get_world_number_from_key()
                    if wn is not None:
                        pth = os.path.join('assets','worlds', str(wn), 'arena', 'zwoj.png')
                        if os.path.exists(pth):
                            img = pygame.image.load(pth).convert_alpha()
                            self._scroll_img = img
                except Exception:
                    pass
            if img:
                if img.get_width()!=draw_rect.w or img.get_height()!=draw_rect.h:
                    try:
                        img = pygame.transform.smoothscale(img, (draw_rect.w, draw_rect.h))
                    except Exception:
                        img = pygame.transform.scale(img, (draw_rect.w, draw_rect.h))
                s.blit(img, draw_rect)
            else:
                pygame.draw.rect(s, (235,210,120), draw_rect, border_radius=10)
                pygame.draw.rect(s, (120,90,30), draw_rect, 3, border_radius=10)
                lbl = self.UI_FONT.render('Zwój', (30,30,30))
                s.blit(lbl, (draw_rect.centerx - lbl.get_width()//2, draw_rect.top - lbl.get_height() - 4))
        # Death menu overlay
        if self.death_menu_active:
            ov = pygame.Surface((LOGICAL_W,LOGICAL_H), pygame.SRCALPHA)
            ov.fill((0,0,0,180))
            s.blit(ov,(0,0))
            panel_w, panel_h = 620, 200
            panel = pygame.Surface((panel_w, panel_h), pygame.SRCALPHA)
            panel.fill((16,18,24,230))
            pygame.draw.rect(panel,(185,185,220,255), panel.get_rect(),2, border_radius=10)
            title = self.UI_FONT.render("Przegrałeś", (255,220,220))
            panel.blit(title, (panel_w//2 - title.get_width()//2, 18))
            opts = ["Walcz ponownie", "Przejdź świat jeszcze raz"]
            y = 70
            for i,opt in enumerate(opts):
                col = (255,255,255) if i==self.death_menu_selection else (200,200,200)
                if i==self.death_menu_selection:
                    pygame.draw.rect(panel, (70,70,90,110), (20, y-4, panel_w-40, 34), border_radius=8)
                txt = self.UI_FONT.render(opt, col)
                panel.blit(txt, (panel_w//2 - txt.get_width()//2, y))
                y += 40
            s.blit(panel, (LOGICAL_W//2 - panel_w//2, LOGICAL_H//2 - panel_h//2))        # Summary dialog overlay (Lobby)
        if self.summary_active and self.summary_tw:
            # Position: top area with configurable margin
            panel_h=int(PLAY_H*0.35); panel_w=int(LOGICAL_W*0.66); gap=16; avatar_size=panel_h
            total_w=avatar_size+gap+panel_w; unit_x=(LOGICAL_W-total_w)//2; unit_y=PLAY_RECT.top + int(self.summary_top_margin_px)
            # Fade-in factor
            try:
                self.summary_fade_t = min(self.summary_fade_dur, self.summary_fade_t + self.dt)
            except Exception:
                pass
            fade_a = int(255 * (0.0 if self.summary_fade_dur<=0 else min(1.0, self.summary_fade_t / self.summary_fade_dur)))
            # Avatar box
            avatar_box=pygame.Surface((avatar_size,avatar_size), pygame.SRCALPHA)
            avatar_box.fill((16,18,24,230))
            pygame.draw.rect(avatar_box,(185,185,220,255), avatar_box.get_rect(),2, border_radius=10)
            # Avatar per speaker
            evo_level = evo_from_skin(self.current_skin)
            spk = self.summary_speaker if isinstance(self.summary_speaker, str) else "medrzec"
            head_img = load_head_image("player" if spk=="player" else "medrzec", evo_level=evo_level if spk=="player" else None)
            pad=10; avail=avatar_size-2*pad
            if head_img.get_width()>=head_img.get_height():
                scale=avail/float(head_img.get_width()); scaled=pygame.transform.scale(head_img,(int(head_img.get_width()*scale), int(head_img.get_height()*scale)))
            else:
                scale=avail/float(head_img.get_height()); scaled=pygame.transform.scale(head_img,(int(head_img.get_width()*scale), int(head_img.get_height()*scale)))
            ax=(avatar_size-scaled.get_width())//2; ay=(avatar_size-scaled.get_height())//2; avatar_box.blit(scaled,(ax,ay))
            avatar_box.set_alpha(fade_a)
            # Panel
            panel=pygame.Surface((panel_w,panel_h), pygame.SRCALPHA)
            panel.fill((16,18,24,230))
            pygame.draw.rect(panel,(185,185,220,255), panel.get_rect(),2, border_radius=10)
            t_surf=self.UI_FONT.render(("Wstęp" if getattr(self,"summary_as_intro",False) else "Podsumowanie"), (255,255,0)); panel.blit(t_surf,(12,10)); y=10+t_surf.get_height()+8
            # Typewriter text
            try:
                self.summary_tw.update(self.dt)
            except Exception:
                pass
            cur_txt = self.summary_tw.get_text() if self.summary_tw else ""
            y = wrap_draw_multiline(panel, self.UI_FONT, cur_txt, 16, y, panel_w-32, 28, (235,235,235))
            if self.summary_tw and self.summary_tw.done:
                hint=self.UI_FONT.render("ENTER aby przejść dalej",(200,200,200))
                panel.blit(hint,(panel_w-hint.get_width()-12, panel_h-hint.get_height()-10))
            panel.set_alpha(fade_a)
            s.blit(avatar_box,(unit_x,unit_y)); s.blit(panel,(unit_x+avatar_size+gap, unit_y))

        if self.pending_wipe_in:
            wipe_in_down(s, self.clock, duration=0.55); self.pending_wipe_in=False

        # --- Ending fadeout overlay (smooth black) ---
        if getattr(self, 'ending_phase', None) == 'fadeout':
            try:
                self.ending_fade_t = min(self.ENDING_FADE_TIME, self.ending_fade_t + self.dt)
            except Exception:
                # Fallback if dt missing
                self.ending_fade_t = self.ENDING_FADE_TIME
            # Compute alpha 0..255
            try:
                alpha = int(max(0, min(255, 255 * (self.ending_fade_t / max(0.001, self.ENDING_FADE_TIME)))))
            except Exception:
                alpha = 255
            overlay = _get_overlay_cached(self, a) if 'a' in locals() else pygame.Surface((LOGICAL_W, LOGICAL_H), pygame.SRCALPHA)
            overlay.fill((0,0,0, alpha))
            s.blit(overlay, (0,0))
            if self.ending_fade_t >= self.ENDING_FADE_TIME:
                self.ending_phase = None
                # Now activate the ending screen (typewriter will lazy-init in _draw_ending)
                self.ending_active = True
                # --- LETTERBOX (TOPMOST, final) ---
        if (BAR_H>0) and (not getattr(self,'_suppress_letterbox',False)):
            pygame.draw.rect(s, BLACK, pygame.Rect(0, 0, LOGICAL_W, BAR_H))
            pygame.draw.rect(s, BLACK, pygame.Rect(0, PLAY_RECT.bottom, LOGICAL_W, BAR_H))

        # Pause overlay (top-most)
        if getattr(self,'pause_active',False):
            try:
                ov = _get_overlay_cached(self, a) if 'a' in locals() else pygame.Surface((LOGICAL_W, LOGICAL_H), pygame.SRCALPHA)
                ov.fill((0,0,0,160))
                s.blit(ov,(0,0))
                # draw pause panel
                panel_w, panel_h = 520, 220
                x = LOGICAL_W//2 - panel_w//2
                y = LOGICAL_H//2 - panel_h//2
                pygame.draw.rect(s, (20,22,28), (x,y,panel_w,panel_h), border_radius=16)
                pygame.draw.rect(s, (70,72,84), (x,y,panel_w,panel_h), width=2, border_radius=16)
                title = self.UI_FONT_BIG.render('PAUZA', (220,220,255))
                s.blit(title, (LOGICAL_W//2 - title.get_width()//2, y+20))
                opts = ['Kontynuuj', 'Wyjdź z gry']
                yy = y + 90
                for i,opt in enumerate(opts):
                    col = (255,255,255) if i==getattr(self,'pause_selection',0) else (200,200,200)
                    if i == getattr(self,'pause_selection',0):
                        pygame.draw.rect(s, (70,70,90), (x+40, yy-6, panel_w-80, 42), border_radius=10)
                    lbl = self.UI_FONT.render(opt, col)
                    s.blit(lbl, (LOGICAL_W//2 - lbl.get_width()//2, yy))
                    yy += 52
            except Exception:
                pass
        try:
            pygame.display.flip()
        except Exception:
            pass
        # DEBUG_FPS overlay
        if getattr(self,'debug_fps',False):
            try:
                fps_txt = self.UI_FONT.render(f"{int(self.clock.get_fps()):d} FPS", (180,180,180))
                pad=6
                r = fps_txt.get_rect(topleft=(10,10))
                pygame.draw.rect(self.screen, (0,0,0,140), (r.x-pad, r.y-pad, r.w+2*pad, r.h+2*pad))
                self.screen.blit(fps_txt, (10,10))
            except Exception:
                pass

    def _draw_hp_bars(self, surface):
        """Draw HP bars above heads: player (green) and boss (red), labels centered *inside* the bars.
           Bars are scaled 1.5× vs previous size."""
        if not getattr(self, 'bossfight_active', False):
            return

        # Geometry (1.5×)
        base_w, base_h, pad = 200, 14, 10
        w = int(base_w * 1.5)
        h = int(base_h * 1.5)

        # ---- Player bar ----
        prect = getattr(self, 'player_rect', None)
        if prect:
            x = prect.centerx - w // 2
            y = prect.top - pad - h
            cur  = max(0, min(getattr(self, 'player_hp', 0), max(1, getattr(self, 'player_hp_max', 1))))
            pmax = max(1, getattr(self, 'player_hp_max', 1))
            fill_w = int(w * (cur / pmax))

            pygame.draw.rect(surface, (0,0,0),       (x-2, y-2, w+4, h+4))
            pygame.draw.rect(surface, (60,60,60),  (x,   y,   w,   h  ))
            pygame.draw.rect(surface, (50,200,50),    (x,   y,   fill_w, h))

            # numeric label inside
            try:
                txt = f"{cur}/{pmax}"
                label = self.UI_FONT.render(txt, (255,255,255))
                lx = x + (w - label.get_width()) // 2
                ly = y + (h - label.get_height()) // 2
                surface.blit(label, (lx, ly))
            except Exception:
                pass

        # ---- Boss bar ----
        brect = getattr(self, 'boss_rect_current', None)
        if brect:
            x = brect.centerx - w // 2
            y = brect.top - pad - h
            cur  = max(0, min(getattr(self, 'boss_hp', 0), max(1, getattr(self, 'boss_hp_max', 1))))
            bmax = max(1, getattr(self, 'boss_hp_max', 1))
            fill_w = int(w * (cur / bmax))

            pygame.draw.rect(surface, (0,0,0),       (x-2, y-2, w+4, h+4))
            pygame.draw.rect(surface, (60,60,60),  (x,   y,   w,   h  ))
            pygame.draw.rect(surface, (200,50,50),    (x,   y,   fill_w, h))

            # numeric label inside
            try:
                txt = f"{cur}/{bmax}"
                label = self.UI_FONT.render(txt, (255,255,255))
                lx = x + (w - label.get_width()) // 2
                ly = y + (h - label.get_height()) // 2
                surface.blit(label, (lx, ly))
            except Exception:
                pass

    def _get_boss_hp_static(self, wn):
        """Static HP map per world number."""
        hp_map = {1:500, 2:600, 3:700, 4:800, 5:1000}
        try:
            return int(hp_map.get(int(wn), 1000))
        except Exception:
            return 1000

        def _refresh_autosave_label(self):
            import os, json
            p=os.path.join('assets','autosave.json')
            if os.path.exists(p):
                try:
                    with open(p,'r',encoding='utf-8') as f:
                        d=json.load(f)
                    evo=d.get('evolution')
                    if isinstance(evo,int):
                        label = 'Kontynuuj (Ewolucja %d)' % evo
                    else:
                        skin=str(d.get('current_skin','1'))
                        try:
                            label = 'Kontynuuj (Ewolucja %d)' % int(evo_from_skin(skin))
                        except Exception:
                            label = 'Kontynuuj (Zapis)'
                    self._autosave_label = label
                except Exception:
                    self._autosave_label='Kontynuuj (Zapis)'
            else:
                self._autosave_label='Kontynuuj'

    # === Autosave utilities & start helpers ===
    def _refresh_autosave_label(self):
        import os, json
        p=os.path.join('assets','autosave.json')
        if os.path.exists(p):
            try:
                with open(p,'r',encoding='utf-8') as f:
                    d=json.load(f)
                evo=d.get('evolution')
                self._autosave_label = ('Kontynuuj (Ewolucja %d)'%evo) if isinstance(evo,int) else 'Kontynuuj (Zapis)'
            except Exception:
                self._autosave_label='Kontynuuj (Zapis)'
        else:
            self._autosave_label='Kontynuuj'


    def _write_autosave(self, evolution:int=0):
        import os, json
        try:
            os.makedirs('assets', exist_ok=True)
            with open(os.path.join('assets','autosave.json'),'w',encoding='utf-8') as f:
                json.dump({
                    'current_key': getattr(self,'current_key','lobby'),
                    'evolution': int(evo_from_skin(getattr(self,'current_skin','1'))),
                    'current_skin': getattr(self,'current_skin','1'),
                    'lobby_bg_variant': getattr(self,'_lobby_bg_variant','normal')
                }, f)
        except Exception:
            pass

    def _enter_lobby_dropin(self):
        try: self.FREEZE(False)
        except Exception: pass
        self.start_menu_active=False
        self.intro_cutscene_active=False
        try:
            wipe_out_down(self.screen, self.clock, duration=0.35)
        except Exception:
            pass
        self.current_key='lobby'
        self.current_loc=self.locations[self.current_key]
        self.bg_surf,self.bg_w,self.bg_h=load_background(self.current_loc.bg_path)
        # Apply lobby background variant if needed
        try:
            if getattr(self, '_lobby_bg_variant', 'normal') == 'empty':
                import os
                pth = os.path.join('assets','worlds','lobby','bg_empty.png')
                if os.path.exists(pth):
                    img = pygame.image.load(pth).convert()
                    self.bg_surf, self.bg_w, self.bg_h = img, img.get_width(), img.get_height()
        except Exception:
            pass
        # Hide mouse when entering gameplay
        try:
            pygame.mouse.set_visible(False)
        except Exception:
            pass

        self.portal_color_map=PORTAL_COLOR_MAPS.get(self.current_key,{})
        (self.colliders, self.WORLD_W_true, self.portals, self.lifts, self.triggers, self.gates, self.arena_zones, self.boss_spawns)=\
            parse_world_from_mask(self.current_loc.mask_path, PLAY_RECT.top, TILE, THRESHOLD, self.portal_color_map)
        self.collider_buckets=build_collider_buckets(self.colliders, TILE)
        self.WORLD_W_local=recompute_world_clip(self.gates, self.WORLD_W_true)
        self.px,self.py,self.on_ground=self.place_player_dropin_lobby_center()
        self.lobby_dropin_active=True
        self.lobby_dropin_lock_t=0.35
        self.vy=0.0; self.facing=1
        st=getattr(self.animator,'state','idle'); fc=getattr(self.animator,'facing',1)
        self.animator=Animator(build_animations_from_paths(skin_paths(self.current_skin), PLAYER_W, PLAYER_H))
        self.animator.set_state(st); self.animator.facing=fc; self.animator.index=0; self.animator.accum_ms=0
        self.pending_wipe_in=True
        return True

    def _start_new_game(self):
        try:
            self.progress.clear()
        except Exception:
            from collections import defaultdict
            self.progress=defaultdict(set)
        self.current_skin='1'
        if getattr(self,'enable_newgame_intro',False):
            self.intro_cutscene_active=True
            self.intro_cutscene_active=False
        return self._enter_lobby_dropin()



    def load_from_autosave(self):
        import os, json
        p = os.path.join('assets','autosave.json')
        if not os.path.exists(p):
            return False
        try:
            with open(p,'r',encoding='utf-8') as f:
                d = json.load(f)
            self.current_skin = str(d.get('current_skin', getattr(self,'current_skin','1')))
            # On load, do not show game intro again
            self.game_intro_shown = True
            # Apply lobby background variant (default 'normal') BEFORE entering lobby
            try:
                self._lobby_bg_variant = str(d.get('lobby_bg_variant', getattr(self,'_lobby_bg_variant','normal')))
            except Exception:
                self._lobby_bg_variant = getattr(self,'_lobby_bg_variant','normal')
            # Schedule a welcome-back dialog in lobby after drop-in
            try:
                evo_level = int(evo_from_skin(getattr(self,'current_skin','1')))
            except Exception:
                evo_level = 1
            self._welcome_back_pending = (evo_level < 5)
            self._enter_lobby_dropin()
            return True
        except Exception:
            return False

    def _end_to_start_menu(self):
        """Return to start menu after ending instead of quitting."""
        try:
            self.ending_active = False
            self.ending_phase = None
            # Reset overlays and timers that might interfere
            self.pause_active = False
            self.summary_active = False
            # Go to start menu
            self.start_menu_active = True
            self.start_menu_selection = 0
            try:
                pygame.mouse.set_visible(True)
            except Exception:
                pass
            # Ensure letterbox will not draw in lobby or start menu
        except Exception:
            # Fail-safe: if anything goes wrong, just set start menu active
            self.start_menu_active = True

    def run(self):
        while True:
            # Compute dt first (120 FPS cap) for consistent smoothness
            try:
                self.dt = self.clock.tick(120) / 1000.0
            except Exception:
                self.dt = 1.0/120.0
            if not self.handle_events():
                break
            self.update(self.dt)
            self.draw()


# --- CEv5.2 monkey patches: preintro + suppress letterbox in lobby/start menu ---

def _ce_patch_install():
    _orig_init = Game.__init__
    def _init_wrapped(self, *a, **kw):
        _orig_init(self, *a, **kw)
        self.preintro_active = False
        self.preintro_tw = None
        import os as _os
        self.PREINTRO_TEXT_PATH = _os.path.join('assets','game_intro.txt')
    Game.__init__ = _init_wrapped

    _orig_draw = Game.draw
    def _draw_wrapped(self):
        try:
            self._suppress_letterbox = bool(getattr(self,'start_menu_active',False) or str(getattr(self,'current_key',''))=='lobby')
        except Exception:
            self._suppress_letterbox = True
        if getattr(self,'preintro_active', False):
            try:
                s = self.screen
                import pygame
                pygame.draw.rect(s, (0,0,0), pygame.Rect(0,0,LOGICAL_W,LOGICAL_H))
                if self.preintro_tw is None:
                    txt = ""
                    try:
                        with open(self.PREINTRO_TEXT_PATH, 'r', encoding='utf-8') as f:
                            txt = f.read()
                    except Exception:
                        txt = "Witaj w CyberEvolution.\n\nPrzed Tobą podróż przez światy świadomości. Ucz się, sprawdzaj, nie klikaj bezmyślnie."
                    self.preintro_tw = Typewriter(txt, 40.0)
                if self.preintro_tw:
                    self.preintro_tw.update(self.dt)
                cur = str(self.preintro_tw.get_text() if self.preintro_tw else "" or "")
                pad_x = 140
                max_w = LOGICAL_W - 2*pad_x
                line_h = 36
                y = LOGICAL_H//3
                y = wrap_draw_multiline(s, self.UI_FONT, cur, pad_x, y, max_w, line_h, (230,230,230))
                if getattr(self.preintro_tw,'done',False):
                    hint = self.UI_FONT.render("Naciśnij dowolny klawisz, aby rozpocząć", (200,200,200))
                    s.blit(hint, (LOGICAL_W//2 - hint.get_width()//2, LOGICAL_H - 120))
                import pygame as _pg
                try:
                    _pg.display.flip()
                except Exception:
                    pass
            except Exception:
                pass
            return
        return _orig_draw(self)
    Game.draw = _draw_wrapped

    _orig_handle = Game.handle_events
    def _handle_wrapped(self):
        import pygame
        from pygame.locals import QUIT, KEYDOWN
        for event in pygame.event.get():
            if getattr(self,'preintro_active',False):
                if event.type == QUIT:
                    return False
                if event.type == KEYDOWN:
                    try:
                        if self.preintro_tw and not self.preintro_tw.done:
                            self.preintro_tw.force_done()
                        else:
                            self.preintro_active = False
                            self.preintro_tw = None
                            self._enter_lobby_dropin()
                            return True
                    except Exception:
                        self.preintro_active = False
                        self._enter_lobby_dropin()
                        return True
                continue
            pygame.event.post(event)
            break
        return _orig_handle(self)
    Game.handle_events = _handle_wrapped

    if hasattr(Game, '_start_new_game'):
        def _sng_wrapped(self):
            try:
                self.progress.clear()
            except Exception:
                from collections import defaultdict
                self.progress = defaultdict(set)
            self.current_skin = '1'
            self.preintro_active = True
            self.preintro_tw = None
            return True
        Game._start_new_game = _sng_wrapped

_ce_patch_install()


# --- CEv5.3 monkey patch: Ending screen layout match preintro + return to lobby ---

def _ce_patch_ending():
    # Patch draw ending to left-align with bottom hint
    def _draw_ending_patched(self, s):
        import pygame
        pygame.draw.rect(s, (0,0,0), pygame.Rect(0,0,LOGICAL_W,LOGICAL_H))
        # Lazy-init typewriter from file (once)
        try:
            if self.ending_tw is None:
                txt = ""
                try:
                    with open(self.ENDING_STORY_PATH, 'r', encoding='utf-8') as f:
                        txt = f.read()
                except Exception:
                    txt = ("Zamykasz oczy i czujesz, jak świat gry powoli gaśnie.\n"
                           "Wdech. Wydech. Wracasz do siebie — bogatszy o wiedzę i czujność.\n\n"
                           "To dopiero początek Twojej świadomości w sieci. Dziękujemy za grę.")
                self.ending_text = txt
                # 40 cps to match project default
                self.ending_tw = Typewriter(self.ending_text, 40.0)
        except Exception:
            pass

        try:
            if self.ending_tw:
                self.ending_tw.update(self.dt)
        except Exception:
            pass

        # Left-aligned text like preintro
        try:
            cur_txt = str(self.ending_tw.get_text() if self.ending_tw else "" or "")
        except Exception:
            cur_txt = ""
        pad_x = 140
        max_w = LOGICAL_W - 2*pad_x
        line_h = 36
        y = LOGICAL_H//3
        try:
            y = wrap_draw_multiline(s, self.UI_FONT, cur_txt, pad_x, y, max_w, line_h, (230,230,230))
        except Exception:
            pass

        # Bottom hint when done
        try:
            if getattr(self.ending_tw, 'done', False):
                hint = self.UI_FONT.render("Kliknij dowolny klawisz, by wyjść", (200,200,200))
                s.blit(hint, (LOGICAL_W//2 - hint.get_width()//2, LOGICAL_H - 120))
        except Exception:
            pass

    # Install patched method
    Game._draw_ending = _draw_ending_patched

    # Patch handle_events ending branch to return to lobby
    _orig_handle = Game.handle_events
    def _handle_events_patched(self):
        import pygame
        from pygame.locals import QUIT, KEYDOWN
        for event in pygame.event.get():
            if getattr(self, 'ending_active', False):
                if event.type == QUIT:
                    return False
                if event.type == KEYDOWN:
                    tw_done = False
                    try:
                        tw_done = bool(self.ending_tw and self.ending_tw.done)
                    except Exception:
                        tw_done = False
                    if not tw_done:
                        try:
                            if self.ending_tw: self.ending_tw.force_done()
                        except Exception:
                            pass
                    else:
                        try:
                            self._end_to_lobby()
                        except Exception:
                            try:
                                self.ending_active = False
                                self.ending_phase = None
                                self._enter_lobby_dropin()
                            except Exception:
                                self.start_menu_active = True
                        return True
                continue
            pygame.event.post(event)
            break
        return _orig_handle(self)
    Game.handle_events = _handle_events_patched

    if not hasattr(Game, "_end_to_lobby"):
        def _end_to_lobby(self):
            try:
                self.ending_active = False
                self.ending_phase = None
                self.pause_active = False
                self.summary_active = False
                self._enter_lobby_dropin()
            except Exception:
                self.start_menu_active = True
        Game._end_to_lobby = _end_to_lobby

_ce_patch_ending()


# --- CEv5.4 monkey patch:
# 1) Ending: any key -> START MENU (not lobby)
# 2) Preintro & Ending: pagination '---' and explicit '\n'; show "Kliknij Enter aby przejść dalej" on page breaks
# 3) Preserve previous behaviors elsewhere

def _cev54_install():
    import pygame
    from pygame.locals import QUIT, KEYDOWN, K_RETURN, K_SPACE, K_e

    def _split_pages(raw: str):
        # Replace literal "\n" with newline, then split by '---' page breaks
        raw = (raw or "").replace("\\n", "\n")
        parts = [p.strip() for p in raw.split('---')]
        if not parts:
            parts = [""]
        return parts

    # Patch preintro draw to support pages
    _orig_draw = Game.draw
    def _draw_wrapped(self):
        # Suppress letterbox in menu/lobby if flag system exists
        try:
            self._suppress_letterbox = bool(getattr(self, 'start_menu_active', False) or str(getattr(self, 'current_key', '')) == 'lobby')
        except Exception:
            pass

        if getattr(self, 'preintro_active', False):
            s = self.screen
            pygame.draw.rect(s, (0,0,0), pygame.Rect(0,0,LOGICAL_W,LOGICAL_H))
            # Lazy-init pages and typewriter
            if getattr(self, 'preintro_pages', None) is None:
                # Load from assets/game_intro.txt similar to CEv5.2
                txt = ""
                try:
                    with open(self.PREINTRO_TEXT_PATH, 'r', encoding='utf-8') as f:
                        txt = f.read()
                except Exception:
                    txt = "Witaj w CyberEvolution.\n\nPrzed Tobą podróż przez światy świadomości.\nUcz się, sprawdzaj, nie klikaj bezmyślnie."
                self.preintro_pages = _split_pages(txt)
                self.preintro_page_idx = 0
                self.preintro_tw = Typewriter(self.preintro_pages[0], 40.0)
            # Update TW
            try:
                if self.preintro_tw:
                    self.preintro_tw.update(self.dt)
            except Exception:
                pass
            # Draw page text left-aligned like before
            try:
                cur = str(self.preintro_tw.get_text() if self.preintro_tw else "" or "")
            except Exception:
                cur = ""
            pad_x = 140
            max_w = LOGICAL_W - 2*pad_x
            line_h = 36
            y = LOGICAL_H//3
            try:
                y = wrap_draw_multiline(s, self.UI_FONT, cur, pad_x, y, max_w, line_h, (230,230,230))
            except Exception:
                pass
            # Bottom hint
            try:
                done = bool(self.preintro_tw and self.preintro_tw.done)
                is_last = (self.preintro_page_idx >= len(self.preintro_pages)-1)
                if done:
                    hint_text = "Kliknij dowolny klawisz, aby rozpocząć" if is_last else "Kliknij Enter aby przejść dalej"
                    hint = self.UI_FONT.render(hint_text, (200,200,200))
                    s.blit(hint, (LOGICAL_W//2 - hint.get_width()//2, LOGICAL_H - 120))
            except Exception:
                pass
            try:
                pygame.display.flip()
            except Exception:
                pass
            return

        # Ending active uses Game._draw_ending (we patch it below)
        return _orig_draw(self)
    Game.draw = _draw_wrapped

    # Patch preintro input to advance pages or finish
    _orig_handle = Game.handle_events
    def _handle_wrapped(self):
        # Intercept ending and preintro at top
        for event in pygame.event.get():
            # Ending screen handling (redirect to START MENU)
            if getattr(self, 'ending_active', False):
                if event.type == QUIT:
                    return False
                if event.type == KEYDOWN:
                    tw_done = False
                    try:
                        tw_done = bool(self.ending_tw and self.ending_tw.done)
                    except Exception:
                        tw_done = False
                    # Pagination for ending
                    if tw_done:
                        # If we have multiple pages and not at the last one, advance page
                        pages = getattr(self, 'ending_pages', None)
                        page_idx = getattr(self, 'ending_page_idx', 0)
                        if isinstance(pages, list) and pages and page_idx < len(pages)-1:
                            try:
                                self.ending_page_idx += 1
                                self.ending_tw = Typewriter(pages[self.ending_page_idx], 40.0)
                            except Exception:
                                # Fail safe: go to start menu
                                try:
                                    self._end_to_start_menu()
                                except Exception:
                                    self.start_menu_active = True
                            return True
                        # Final page finished -> back to start menu
                        try:
                            self._end_to_start_menu()
                        except Exception:
                            self.start_menu_active = True
                        return True
                    else:
                        # Force-finish current page typing
                        try:
                            if self.ending_tw: self.ending_tw.force_done()
                        except Exception:
                            pass
                        return True
                # Consume all events while ending
                continue

            # PREINTRO handling
            if getattr(self, 'preintro_active', False):
                if event.type == QUIT:
                    return False
                if event.type == KEYDOWN:
                    done = False
                    try:
                        done = bool(self.preintro_tw and self.preintro_tw.done)
                    except Exception:
                        done = False
                    if not done:
                        try:
                            if self.preintro_tw: self.preintro_tw.force_done()
                        except Exception:
                            pass
                        return True
                    # Page advance or finish
                    pages = getattr(self, 'preintro_pages', None)
                    idx = getattr(self, 'preintro_page_idx', 0)
                    if isinstance(pages, list) and pages and idx < len(pages)-1:
                        try:
                            self.preintro_page_idx += 1
                            self.preintro_tw = Typewriter(pages[self.preintro_page_idx], 40.0)
                        except Exception:
                            # Worst case: enter lobby
                            self.preintro_active = False
                            self._enter_lobby_dropin()
                        return True
                    # Last page finished -> enter lobby
                    self.preintro_active = False
                    self.preintro_tw = None
                    self.preintro_pages = None
                    self._enter_lobby_dropin()
                    return True
                continue

            # Not in special screens: hand over event to original by reposting it and breaking
            pygame.event.post(event)
            break

        return _orig_handle(self)
    Game.handle_events = _handle_wrapped

    # Patch ending draw to mirror preintro and support pages
    def _draw_ending_patched(self, s):
        import pygame
        pygame.draw.rect(s, (0,0,0), pygame.Rect(0,0,LOGICAL_W,LOGICAL_H))
        # Lazy-init ending pages and TW
        if getattr(self, 'ending_pages', None) is None:
            txt = ""
            try:
                with open(self.ENDING_STORY_PATH, 'r', encoding='utf-8') as f:
                    txt = f.read()
            except Exception:
                txt = ("Zamykasz oczy i czujesz, jak świat gry powoli gaśnie.\n"
                       "Wdech. Wydech. Wracasz do siebie — bogatszy o wiedzę i czujność.\n\n"
                       "To dopiero początek Twojej świadomości w sieci. Dziękujemy za grę.")
            self.ending_pages = _split_pages(txt)
            self.ending_page_idx = 0
            self.ending_tw = Typewriter(self.ending_pages[0], 40.0)
        # Update TW
        try:
            if self.ending_tw:
                self.ending_tw.update(self.dt)
        except Exception:
            pass
        # Draw current page left-aligned
        try:
            cur = str(self.ending_tw.get_text() if self.ending_tw else "" or "")
        except Exception:
            cur = ""
        pad_x = 140
        max_w = LOGICAL_W - 2*pad_x
        line_h = 36
        y = LOGICAL_H//3
        try:
            y = wrap_draw_multiline(s, self.UI_FONT, cur, pad_x, y, max_w, line_h, (230,230,230))
        except Exception:
            pass
        # Bottom hint
        try:
            done = bool(self.ending_tw and self.ending_tw.done)
            is_last = (self.ending_page_idx >= len(self.ending_pages)-1)
            if done:
                hint_text = "Kliknij dowolny klawisz by wyjść" if is_last else "Kliknij Enter aby przejść dalej"
                hint = self.UI_FONT.render(hint_text, (200,200,200))
                s.blit(hint, (LOGICAL_W//2 - hint.get_width()//2, LOGICAL_H - 120))
        except Exception:
            pass

    # Install ending draw
    Game._draw_ending = _draw_ending_patched

    # Provide _end_to_start_menu if not present
    if not hasattr(Game, "_end_to_start_menu"):
        def _end_to_start_menu(self):
            try:
                self.ending_active = False
                self.ending_phase = None
                self.pause_active = False
                self.summary_active = False
                self.start_menu_active = True
                self.start_menu_selection = 0
            except Exception:
                self.start_menu_active = True
        Game._end_to_start_menu = _end_to_start_menu

_cev54_install()


# --- CEv5.6: Performance optimization layer (non-invasive monkey patch) ---
# Goals:
# - Pre-scale and cache backgrounds and common sprites to avoid per-frame transforms
# - Cache text surfaces for menu/options to avoid re-rendering every frame
# - Cache semi-transparent overlays (pause/ending) [partial in CEv5.51]
# - Smooth dt slightly to reduce microstutter on variable frame times
# - Batch draw static world elements into a cached layer per location
# - Avoid per-frame allocation hot spots

import pygame

class _SurfaceCache:
    def __init__(self):
        self._img = {}
        self._scaled = {}
        self._text = {}

    def image(self, path):
        if not path:
            return None
        key = ('img', path)
        surf = self._img.get(key)
        if surf is None:
            try:
                surf = pygame.image.load(path).convert_alpha()
            except Exception:
                try:
                    surf = pygame.image.load(path).convert()
                except Exception:
                    surf = None
            self._img[key] = surf
        return surf

    def scaled(self, surf, size):
        if not surf:
            return None
        key = ('scaled', id(surf), int(size[0]), int(size[1]))
        out = self._scaled.get(key)
        if out is None:
            out = pygame.transform.smoothscale(surf, size) if hasattr(pygame.transform, 'smoothscale') else pygame.transform.scale(surf, size)
            self._scaled[key] = out
        return out

    def text(self, font, text, color):
        key = ('text', id(font), str(text), tuple(color))
        surf = self._text.get(key)
        if surf is None:
            surf = font.render(text, color)
            self._text[key] = surf
        return surf

_SURF_CACHE = _SurfaceCache()

# Lightweight moving average for dt to reduce microstutter
def _smooth_dt(prev_dt, new_dt):
    # Blend 80% new, 20% old; clamp extremes
    new_dt = max(0.0, min(1/20.0, float(new_dt)))  # clamp to 50 ms
    if prev_dt is None:
        return new_dt
    return 0.8*new_dt + 0.2*prev_dt

def _batch_build_static_layer(game):
    """Build a cached static layer for current location: background + non-animated tiles that don't change."""
    try:
        loc = getattr(game, 'current_loc', None)
        if loc is None:
            return None
        cache_key = ('static_layer', getattr(game, 'current_key', ''), getattr(game, 'bg_w', 0), getattr(game, 'bg_h', 0))
        cached = getattr(game, '_static_layers', {}).get(cache_key)
        if cached is not None:
            return cached
        # Create layer
        layer = pygame.Surface((LOGICAL_W, LOGICAL_H), pygame.SRCALPHA)
        # Background scaled once
        bg = getattr(game, 'bg_surf', None)
        if bg:
            if bg.get_width() == LOGICAL_W and bg.get_height() == LOGICAL_H:
                layer.blit(bg, (0,0))
            else:
                bg_scaled = _SURF_CACHE.scaled(bg, (LOGICAL_W, LOGICAL_H))
                if bg_scaled:
                    layer.blit(bg_scaled, (0,0))
        if not hasattr(game, '_static_layers'):
            game._static_layers = {}
        game._static_layers[cache_key] = layer
        return layer
    except Exception:
        return None

def _install_perf():
    # Patch Game.__init__ to add caches and dt smoothing buffer
    _orig_init = Game.__init__
    def _init_wrapped(self, *a, **kw):
        _orig_init(self, *a, **kw)
        self._perf_dt = None
        self._static_layers = {}
        self._menu_label_cache = {}
        if not hasattr(self, '_overlay_cache'):
            self._overlay_cache = {}
        try:
            if getattr(self, 'start_menu_bg', None):
                _ = _SURF_CACHE.scaled(self.start_menu_bg, (LOGICAL_W, LOGICAL_H))
        except Exception:
            pass
    Game.__init__ = _init_wrapped

    # Patch Game.run to smooth dt
    _orig_run = Game.run
    def _run_wrapped(self):
        while True:
            try:
                raw_dt = self.clock.tick(120) / 1000.0
            except Exception:
                raw_dt = 1.0/120.0
            self._perf_dt = _smooth_dt(self._perf_dt, raw_dt)
            self.dt = self._perf_dt
            if not self.handle_events():
                break
            self.update(self.dt)
            self.draw()
        return True
    Game.run = _run_wrapped

    # Invalidate static layer on lobby enter
    if hasattr(Game, '_enter_lobby_dropin'):
        _orig_enter_lobby = Game._enter_lobby_dropin
        def _enter_lobby_wrapped(self):
            try:
                self._static_layers.clear()
            except Exception:
                pass
            return _orig_enter_lobby(self)
        Game._enter_lobby_dropin = _enter_lobby_wrapped

    # Patch draw to blit static layer first
    _orig_draw = Game.draw
    def _draw_wrapped(self):
        s = self.screen
        use_static = (not getattr(self,'start_menu_active',False)) and (not getattr(self,'preintro_active',False)) and (not getattr(self,'ending_active',False))
        if use_static:
            layer = _batch_build_static_layer(self)
            if layer:
                try:
                    s.blit(layer, (0,0))
                except Exception:
                    pass
        return _orig_draw(self)
    Game.draw = _draw_wrapped

    # Start menu draw optimization removed to avoid freeze; rely on original draw.

_install_perf = _install_perf


# --- CEv5.6.2 fix: letterbox suppression after ending + force proper Game Intro on New Game ---

def _cev562_install():
    import pygame
    from pygame.locals import QUIT, KEYDOWN

    # Ensure letterbox suppressed in lobby and start menu every frame
    if hasattr(Game, 'draw'):
        _orig_draw = Game.draw
        def _draw_lb_wrapped(self):
            try:
                self._suppress_letterbox = bool(getattr(self,'start_menu_active',False) or str(getattr(self,'current_key',''))=='lobby')
            except Exception:
                self._suppress_letterbox = True
            return _orig_draw(self)
        Game.draw = _draw_lb_wrapped

    # Force correct intro flow on New Game
    if hasattr(Game, '_start_new_game'):
        _orig_sng = Game._start_new_game
        def _sng_wrapped(self):
            try:
                # Reset summary/intro flags to ensure the proper intro dialog shows
                self.summary_active = False
                self.summary_as_intro = False
                self.game_intro_shown = False
                self._force_intro_pending = True  # custom flag used by update hook
            except Exception:
                self._force_intro_pending = True
            # Activate preintro screen as before (will enter lobby after it finishes)
            try:
                self.preintro_active = True
                self.preintro_tw = None
            except Exception:
                pass
            return True
        Game._start_new_game = _sng_wrapped

    # Hook update to trigger _start_game_intro once in lobby after preintro
    if hasattr(Game, 'update') and hasattr(Game, '_start_game_intro'):
        _orig_update = Game.update
        def _update_intro_wrapped(self, dt):
            # If we owe the player the intro and we're in lobby w/o overlays, fire it
            try:
                if getattr(self,'_force_intro_pending', False):
                    if str(getattr(self,'current_key','')) == 'lobby':
                        safe = (not getattr(self,'pause_active',False)) and (not getattr(self,'preintro_active',False)) and (not getattr(self,'ending_active',False))                                and (not getattr(self,'summary_active',False)) and (not getattr(self,'interaction_active',False))
                        if safe:
                            try:
                                self._start_game_intro()
                                self._force_intro_pending = False
                            except Exception:
                                # If it somehow fails, at least drop the flag to avoid soft-lock
                                self._force_intro_pending = False
            except Exception:
                pass
            return _orig_update(self, dt)
        Game.update = _update_intro_wrapped

    # Ensure ending returns to start menu and clears letterbox bars
    if hasattr(Game, '_end_to_start_menu'):
        _orig_end_to_menu = Game._end_to_start_menu
        def _end_to_menu_wrapped(self):
            try:
                self._suppress_letterbox = True
            except Exception:
                pass
            return _orig_end_to_menu(self)
        Game._end_to_start_menu = _end_to_menu_wrapped

_cev562_install()
_install_perf()

if __name__ == '__main__':
    Game().run()
