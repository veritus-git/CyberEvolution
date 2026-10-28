import base64

with open('public/icon-192.png', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('utf-8')

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="100%" height="100%">
  <image width="192" height="192" href="data:image/png;base64,{b64}" style="image-rendering: pixelated; image-rendering: -moz-crisp-edges; image-rendering: crisp-edges;" />
</svg>'''

with open('public/favicon.svg', 'w', encoding='utf-8') as out:
    out.write(svg)

print("public/favicon.svg updated with original game logo/avatar icon!")
