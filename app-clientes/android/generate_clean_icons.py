import os
from PIL import Image, ImageDraw

project_dir = '/home/samir/Documentos/apex-clientes/aplicativos/apexplan-bright-connect'
logo_app_path = os.path.join(project_dir, 'public/logo aplicativo .png')
res_dir = os.path.join(project_dir, 'android/app/src/main/res/')

def make_circle(im):
    im = im.convert("RGBA")
    mask = Image.new("L", im.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0) + im.size, fill=255)
    output = Image.new("RGBA", im.size, (0, 0, 0, 0))
    output.paste(im, (0, 0), mask=mask)
    return output

def make_rounded_rect(im, radius=150):
    im = im.convert("RGBA")
    mask = Image.new("L", im.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, im.size[0], im.size[1]), radius=radius, fill=255)
    output = Image.new("RGBA", im.size, (0, 0, 0, 0))
    output.paste(im, (0, 0), mask=mask)
    return output

def main():
    if not os.path.exists(logo_app_path):
        print(f"Error: logo aplicativo .png not found at {logo_app_path}")
        return

    print("Opening app logo...")
    img = Image.open(logo_app_path)
    
    # Convert to RGB to find bounding box of non-white pixels
    img_rgb = img.convert("RGB")
    width, height = img.size
    
    left, top, right, bottom = width, height, 0, 0
    for y in range(height):
        for x in range(width):
            r, g, b = img_rgb.getpixel((x, y))
            if not (r > 240 and g > 240 and b > 240):
                if x < left: left = x
                if x > right: right = x
                if y < top: top = y
                if y > bottom: bottom = y

    # Crop the blue logo (removing the white outer border)
    print(f"Cropping logo: left={left}, top={top}, right={right}, bottom={bottom}")
    cropped_img = img.crop((left, top, right, bottom))
    
    # Use the blue color from the center-left edge of the cropped logo
    blue_color = cropped_img.convert("RGB").getpixel((cropped_img.width // 2, 20))
    hex_blue = "#{:02x}{:02x}{:02x}".format(*blue_color)
    print(f"Detected blue background color: {hex_blue} {blue_color}")
    
    # Update ic_launcher_background.xml color
    background_xml_path = os.path.join(res_dir, 'values/ic_launcher_background.xml')
    print(f"Updating {background_xml_path} to color {hex_blue}...")
    bg_content = f"""<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">{hex_blue}</color>
</resources>
"""
    with open(background_xml_path, 'w') as f:
        f.write(bg_content)

    # Legacy (Square) and Round
    sizes = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192
    }

    # Apply rounded rectangle mask to cropped image to remove white corners
    clean_cropped = make_rounded_rect(cropped_img, radius=120)
    
    # Round image for legacy round launcher icon
    circle_img = make_circle(cropped_img)

    print("Generating legacy and round launcher icons...")
    for folder, size in sizes.items():
        out_dir = os.path.join(res_dir, folder)
        os.makedirs(out_dir, exist_ok=True)
        
        # Legacy square icon uses cropped blue square with rounded corners
        resized_sq = clean_cropped.resize((size, size), Image.Resampling.LANCZOS)
        resized_sq.save(os.path.join(out_dir, 'ic_launcher.png'), 'PNG')
        
        # Legacy round icon uses circle masked logo
        resized_rd = circle_img.resize((size, size), Image.Resampling.LANCZOS)
        resized_rd.save(os.path.join(out_dir, 'ic_launcher_round.png'), 'PNG')
        print(f" Saved legacy/round to {folder} ({size}x{size})")

    # Adaptive Foreground
    fg_sizes = {
        'mipmap-mdpi': 108,
        'mipmap-hdpi': 162,
        'mipmap-xhdpi': 216,
        'mipmap-xxhdpi': 324,
        'mipmap-xxxhdpi': 432
    }

    print("Generating adaptive foreground icons...")
    for folder, size in fg_sizes.items():
        out_dir = os.path.join(res_dir, folder)
        os.makedirs(out_dir, exist_ok=True)
        
        # Logo inside adaptive icon should take up 70% of the space
        logo_size = int(size * 0.70)
        logo_resized = clean_cropped.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
        
        # Create transparent canvas
        fg_canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        offset = (size - logo_size) // 2
        
        # Paste cropped logo
        fg_canvas.paste(logo_resized, (offset, offset), mask=logo_resized)
        fg_canvas.save(os.path.join(out_dir, 'ic_launcher_foreground.png'), 'PNG')
        print(f" Saved adaptive foreground to {folder} ({size}x{size})")

    print("All Android launcher icons successfully updated with no white borders!")

if __name__ == '__main__':
    main()
