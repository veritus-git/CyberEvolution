import qrcode
import qrcode.image.svg
import os

target_url = "https://cyberevolution.zsolawa.edu.pl/"

# 1. Generate high-res PNG QR Code with cyberpunk high contrast
qr_png = qrcode.QRCode(
    version=2,
    error_correction=qrcode.constants.ERROR_CORRECT_M,
    box_size=12,
    border=3,
)
qr_png.add_data(target_url)
qr_png.make(fit=True)

img_png = qr_png.make_image(fill_color="#00e5ff", back_color="#07090e")
os.makedirs("assets", exist_ok=True)
img_png.save("assets/qr_code.png")

# Also a classic dark-on-white version for universal scanner compatibility
qr_classic = qrcode.QRCode(
    version=2,
    error_correction=qrcode.constants.ERROR_CORRECT_M,
    box_size=12,
    border=3,
)
qr_classic.add_data(target_url)
qr_classic.make(fit=True)
img_classic = qr_classic.make_image(fill_color="#000000", back_color="#ffffff")
img_classic.save("assets/qr_code_scan.png")

# 2. Generate SVG QR Code
factory = qrcode.image.svg.SvgPathImage
qr_svg = qrcode.QRCode(
    version=2,
    error_correction=qrcode.constants.ERROR_CORRECT_M,
    box_size=12,
    border=3,
    image_factory=factory
)
qr_svg.add_data(target_url)
qr_svg.make(fit=True)
svg_img = qr_svg.make_image()
svg_img.save("assets/qr_code.svg")

print("QR codes generated successfully in assets/!")
