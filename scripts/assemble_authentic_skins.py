import os
import subprocess
from PIL import Image
import numpy as np

# ------------------------------------------------------------------------------
# 1. LOAD AUTHENTIC ORIGINAL REFERENCES (commit 942e939 - BEFORE ANY WORK)
# ------------------------------------------------------------------------------
print('=== Loading authentic originals from commit 942e939 ===')
AUTH_DIR = '/home/linux/.gemini/antigravity-ide/brain/5097ccf1-2c16-43c7-a4b9-e8c4d652bd08/authentic_original_skins'
os.makedirs(AUTH_DIR, exist_ok=True)

for s in [1, 2, 3, 4, 5]:
    for f in ['idle.png', 'r1.png', 'r2.png']:
        out_p = f'{AUTH_DIR}/skin{s}_{f}'
        if not os.path.exists(out_p):
            data = subprocess.check_output(['git', 'show', f'942e939:assets/skins/{s}/{f}'])
            with open(out_p, 'wb') as fp:
                fp.write(data)

# Authentic original idle sprites
orig_s3 = Image.open(f'{AUTH_DIR}/skin3_idle.png').convert('RGBA')
orig_s4 = Image.open(f'{AUTH_DIR}/skin4_idle.png').convert('RGBA')
orig_s5 = Image.open(f'{AUTH_DIR}/skin5_idle.png').convert('RGBA')

# ------------------------------------------------------------------------------
# 2. COLOR PALETTES DIRECTLY EXTRACTED FROM AUTHENTIC ORIGINALS
# ------------------------------------------------------------------------------
# In Skin 1:
# Hoodie colors:
C_HOODIE_LIGHT  = (180, 180, 180, 255)
C_HOODIE_MID    = (120, 120, 120, 255)
C_HOODIE_SHADOW = (105, 105, 105, 255)
C_HOODIE_DARK   = (87, 87, 87, 255)
C_HOODIE_DEEP   = (69, 69, 69, 255)

# Jeans colors:
C_JEANS_LIGHT  = (55, 81, 163, 255)
C_JEANS_MID    = (29, 50, 125, 255)
C_JEANS_SHADOW = (8, 26, 94, 255)
C_JEANS_DEEP   = (3, 10, 36, 255)

# Shoes colors:
C_SHOE_BODY = (41, 41, 41, 255)
C_SHOE_SOLE = (70, 70, 70, 255)

# Skin 4 Authentic Outfit:
C_TAN_LIGHT  = (220, 202, 168, 255)
C_TAN_MAIN   = (202, 179, 140, 255) # authentic tan jacket main
C_TAN_MID    = (152, 127, 89, 255)  # authentic tan jacket mid
C_TAN_SHADOW = (108, 87, 58, 255)   # authentic tan jacket shadow

C_CARGO_LIGHT  = (69, 97, 125, 255) # authentic cargo light
C_CARGO_MID    = (47, 70, 96, 255)  # authentic cargo mid
C_CARGO_SHADOW = (25, 37, 55, 255)  # authentic cargo shadow

C_SHIRT_MAIN = (60, 77, 66, 255)    # authentic undershirt
C_SHIRT_MID  = (41, 50, 46, 255)
C_SHIRT_SHAD = (32, 41, 38, 255)

# Skin 5 Cyber Features:
C_CYAN_NEON   = (33, 246, 224, 255) # #21f6e0
C_CYAN_MID    = (44, 201, 180, 255)
C_DECK_CASE   = (60, 60, 60, 255)
C_DECK_BORDER = (30, 30, 30, 255)
C_WIRE_YELLOW = (255, 242, 0, 255)
C_WIRE_RED    = (237, 28, 36, 255)
C_WIRE_GREEN  = (34, 177, 76, 255)
C_STRAP       = (45, 45, 45, 255)

# Color replacement map for Skin 4
MAP_SKIN4 = {
    C_HOODIE_LIGHT:  C_TAN_MAIN,
    C_HOODIE_MID:    C_TAN_MID,
    C_HOODIE_SHADOW: C_TAN_SHADOW,
    C_HOODIE_DARK:   C_TAN_SHADOW,
    C_HOODIE_DEEP:   C_TAN_SHADOW,
    C_JEANS_LIGHT:   C_CARGO_LIGHT,
    C_JEANS_MID:     C_CARGO_MID,
    C_JEANS_SHADOW:  C_CARGO_SHADOW,
    C_JEANS_DEEP:    C_CARGO_SHADOW,
}

# Head crop from authentic Skin 3 (gamer headset + cyan glasses)
head_s3 = orig_s3.crop((0, 0, 42, 38))

# Head crop from authentic Skin 4
head_s4 = orig_s4.crop((0, 0, 42, 38))

# Head crop from authentic Skin 5 (headset with cyan LED)
head_s5 = orig_s5.crop((0, 0, 44, 38))

# Head offsets calculated from Skin 1 vs Skin 2 tech diff
HEAD_OFFSETS = {
    'idle.png':  (16, 0),
    'idle1.png': (16, 0),
    'idle2.png': (16, -1),
    'idle3.png': (16, -1),
    'idle4.png': (16, -1),
    'r1.png':    (14, -1),
    'r2.png':    (15, -1),
    'r3.png':    (15, -3),
    'r4.png':    (15, -5),
    'r5.png':    (16, -3),
    'r6.png':    (17, -1),
    'r7.png':    (16, -2),
    'r8.png':    (15, -3),
    'jump1.png': (20, 6),
    'jump2.png': (18, 1),
    'jump.png':  (18, 1),
    'fall1.png': (20, 7),
    'fall2.png': (19, 7),
    'fall.png':  (19, 6),
}

# ------------------------------------------------------------------------------
# 3. BUILD SKIN 3
# ------------------------------------------------------------------------------
print('=== Assembling Skin 3 (Authentic Gamer Headset & Cyan Glasses) ===')
s3_dir = 'assets/skins/3'
os.makedirs(s3_dir, exist_ok=True)

# A. RUN: From PixelLab generated 8-frame run
pl_s3_run = '/home/linux/.gemini/antigravity-ide/brain/5097ccf1-2c16-43c7-a4b9-e8c4d652bd08/pixellab_generated/skin3_run'
for i in range(1, 9):
    im = Image.open(f'{pl_s3_run}/frame_{i}.png').convert('RGBA')
    im.save(f'{s3_dir}/r{i}.png')

# B. JUMP, FALL, IDLE: STRICTLY BASED ON SKIN 1 & 2 (FRONT KNEE FORWARD IN JUMP!)
for fname in ['idle.png', 'idle1.png', 'idle2.png', 'idle3.png', 'idle4.png',
              'jump1.png', 'jump2.png', 'jump.png',
              'fall1.png', 'fall2.png', 'fall.png']:
    base = Image.open(f'assets/skins/1/{fname}').convert('RGBA')
    hx, hy = HEAD_OFFSETS[fname]
    base.paste(head_s3, (hx, hy), head_s3)
    base.save(f'{s3_dir}/{fname}')

# C. CLIMB: Universal ladder climb from 1 & 2 with clean headset band (no black blob!)
for i in range(1, 5):
    im_c = Image.open(f'assets/skins/1/climb{i}.png').convert('RGBA')
    arr = np.array(im_c)
    # Headset band across back of head: y=[8, 12], x=[26, 48]
    for y in range(8, 13):
        for x in range(26, 48):
            if arr[y, x, 3] > 0 and tuple(arr[y, x]) != (0, 0, 0, 255):
                arr[y, x] = (45, 45, 45, 255)
    # Earcups on sides
    for y in range(12, 22):
        for x in [22, 23, 24, 49, 50, 51]:
            if arr[y, x, 3] > 0:
                arr[y, x] = (30, 30, 30, 255)
    # Subtle cyan accents
    for y in range(15, 19):
        arr[y, 23] = C_CYAN_MID
        arr[y, 50] = C_CYAN_MID
    Image.fromarray(arr).save(f'{s3_dir}/climb{i}.png')

print('Skin 3 assembled successfully!')

# ------------------------------------------------------------------------------
# 4. BUILD SKIN 4
# ------------------------------------------------------------------------------
print('\n=== Assembling Skin 4 (Authentic Tan Jacket, Undershirt, Cargo Pants) ===')
s4_dir = 'assets/skins/4'
os.makedirs(s4_dir, exist_ok=True)

# A. RUN: From PixelLab generated 8-frame run (User approved: "chód skina 4 i 5 jest super")
pl_s4_run = '/home/linux/.gemini/antigravity-ide/brain/5097ccf1-2c16-43c7-a4b9-e8c4d652bd08/skin4_pixellab_run'
for i in range(1, 9):
    im = Image.open(f'{pl_s4_run}/frame_{i}.png').convert('RGBA')
    im.save(f'{s4_dir}/r{i}.png')

# B. JUMP, FALL, IDLE: STRICTLY BASED ON SKIN 1 & 2 (FRONT KNEE FORWARD IN JUMP!)
for fname in ['idle.png', 'idle1.png', 'idle2.png', 'idle3.png', 'idle4.png',
              'jump1.png', 'jump2.png', 'jump.png',
              'fall1.png', 'fall2.png', 'fall.png']:
    s1_im = Image.open(f'assets/skins/1/{fname}').convert('RGBA')
    arr = np.array(s1_im)
    h, w, _ = arr.shape
    
    # 1. Color transform clothes using authentic palette
    for y in range(h):
        for x in range(w):
            if y >= 25:
                rgba = tuple(arr[y, x])
                if rgba in MAP_SKIN4:
                    arr[y, x] = MAP_SKIN4[rgba]
                elif rgba in [C_SHOE_BODY, C_SHOE_SOLE]:
                    arr[y, x] = (35, 35, 35, 255)
                    
    # 2. Add authentic dark undershirt down chest center (y: 38..65, width ~6px)
    hx, hy = HEAD_OFFSETS[fname]
    chest_center = hx + 19
    for y in range(max(38, hy + 38), min(66, hy + 66)):
        if y < h:
            for x in range(chest_center - 2, chest_center + 3):
                if 0 <= x < w and arr[y, x, 3] > 0:
                    if tuple(arr[y, x]) in [C_TAN_MAIN, C_TAN_MID, C_TAN_SHADOW]:
                        arr[y, x] = C_SHIRT_MAIN if x in [chest_center - 1, chest_center] else C_SHIRT_SHAD

    frame_s4 = Image.fromarray(arr)
    # Paste authentic Skin 4 head
    frame_s4.paste(head_s4, (hx, hy), head_s4)
    frame_s4.save(f'{s4_dir}/{fname}')

# C. CLIMB: Back view with tan jacket and cargo pants
for i in range(1, 5):
    im3 = Image.open(f'{s3_dir}/climb{i}.png').convert('RGBA')
    arr = np.array(im3)
    h, w, _ = arr.shape
    for y in range(h):
        for x in range(w):
            if y >= 25:
                rgba = tuple(arr[y, x])
                if rgba in MAP_SKIN4:
                    arr[y, x] = MAP_SKIN4[rgba]
                elif rgba in [C_SHOE_BODY, C_SHOE_SOLE]:
                    arr[y, x] = (35, 35, 35, 255)
    Image.fromarray(arr).save(f'{s4_dir}/climb{i}.png')

print('Skin 4 assembled successfully!')

# ------------------------------------------------------------------------------
# 5. BUILD SKIN 5
# ------------------------------------------------------------------------------
print('\n=== Assembling Skin 5 (Cyber Master with Cyberdeck & Neon Cyan Trim) ===')
s5_dir = 'assets/skins/5'
os.makedirs(s5_dir, exist_ok=True)

# A. RUN: From PixelLab generated 8-frame run (User approved: "chód skina 4 i 5 jest super")
pl_s5_run = '/home/linux/.gemini/antigravity-ide/brain/5097ccf1-2c16-43c7-a4b9-e8c4d652bd08/skin5_pixellab_run'
for i in range(1, 9):
    im = Image.open(f'{pl_s5_run}/frame_{i}.png').convert('RGBA')
    im.save(f'{s5_dir}/r{i}.png')

# B. JUMP, FALL, IDLE: STRICTLY BASED ON SKIN 1 & 2 (FRONT KNEE FORWARD IN JUMP!)
for fname in ['idle.png', 'idle1.png', 'idle2.png', 'idle3.png', 'idle4.png',
              'jump1.png', 'jump2.png', 'jump.png',
              'fall1.png', 'fall2.png', 'fall.png']:
    s4_im = Image.open(f'{s4_dir}/{fname}').convert('RGBA')
    arr = np.array(s4_im)
    h, w, _ = arr.shape
    
    hx, hy = HEAD_OFFSETS[fname]
    chest_center = hx + 19
    
    # 1. Neon cyan trim along jacket edges
    for y in range(max(34, hy + 34), min(66, hy + 66)):
        if y < h:
            for zx in [chest_center - 3, chest_center + 3]:
                if 0 <= zx < w and arr[y, zx, 3] > 0:
                    if tuple(arr[y, zx]) in [C_TAN_MAIN, C_TAN_MID, C_TAN_SHADOW]:
                        arr[y, zx] = C_CYAN_NEON
                        
    # 2. Cyberdeck terminal on hip / hand
    deck_x = chest_center - 14
    deck_y = min(h - 25, max(58, hy + 58))
    for dy in range(10):
        for dx in range(8):
            px = deck_x + dx
            py = deck_y + dy
            if 0 <= px < w and 0 <= py < h and arr[py, px, 3] > 0:
                arr[py, px] = C_DECK_BORDER if (dy in [0, 9] or dx in [0, 7]) else C_DECK_CASE
                
    # 3. Dangling colored patch cables
    if deck_y + 14 < h:
        for wy in range(deck_y + 10, min(h, deck_y + 14)):
            arr[wy, deck_x + 2] = C_WIRE_YELLOW
        for wy in range(deck_y + 10, min(h, deck_y + 13)):
            arr[wy, deck_x + 4] = C_WIRE_RED
        for wy in range(deck_y + 10, min(h, deck_y + 12)):
            arr[wy, deck_x + 6] = C_WIRE_GREEN

    frame_s5 = Image.fromarray(arr)
    # Paste authentic Skin 5 head (with cyan LED)
    frame_s5.paste(head_s5, (hx, hy), head_s5)
    frame_s5.save(f'{s5_dir}/{fname}')

# C. CLIMB: Back view with neon cyan hood trim, diagonal strap, cyberdeck & wires
for i in range(1, 5):
    im4_c = Image.open(f'{s4_dir}/climb{i}.png').convert('RGBA')
    arr = np.array(im4_c)
    h, w, _ = arr.shape
    
    # Neon cyan hood trim
    for y in range(35, 45):
        for x in range(26, 48):
            if tuple(arr[y, x]) == C_TAN_SHADOW:
                arr[y, x] = C_CYAN_NEON
                
    # Diagonal equipment strap
    for step in range(30):
        t = step / 30.0
        sx = int(28 + t * (46 - 28))
        sy = int(30 + t * (60 - 30))
        if 0 <= sx < w and 0 <= sy < h and arr[sy, sx, 3] > 0:
            arr[sy, sx] = C_STRAP
            if sx + 1 < w:
                arr[sy, sx + 1] = C_STRAP
                
    # Cyberdeck on hip
    for dy in range(9):
        for dx in range(6):
            px = 48 + dx
            py = 59 + dy
            if 0 <= px < w and 0 <= py < h and arr[py, px, 3] > 0:
                arr[py, px] = C_DECK_BORDER if (dy in [0, 8] or dx in [0, 5]) else C_DECK_CASE
                
    # Dangling wires
    if 69 < h:
        arr[68, 49] = C_WIRE_YELLOW
        arr[69, 49] = C_WIRE_YELLOW
        arr[68, 51] = C_WIRE_RED
        arr[69, 51] = C_WIRE_RED
        arr[68, 53] = C_WIRE_GREEN

    Image.fromarray(arr).save(f'{s5_dir}/climb{i}.png')

print('Skin 5 assembled successfully!')
print('\nAll 3 skins (3, 4, 5) built with authentic reference palette & 100% Skin 1/2 platformer mechanics!')
