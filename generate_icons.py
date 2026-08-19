import os
from PIL import Image, ImageDraw, ImageFilter

def make_gradient_squircle(size, radius, colors):
    s = size
    bg = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)

    c1, c2, c3 = colors
    for y in range(s):
        t = y / float(s)
        if t < 0.5:
            t2 = t * 2.0
            r = int(c1[0] * (1 - t2) + c2[0] * t2)
            g = int(c1[1] * (1 - t2) + c2[1] * t2)
            b = int(c1[2] * (1 - t2) + c2[2] * t2)
        else:
            t2 = (t - 0.5) * 2.0
            r = int(c2[0] * (1 - t2) + c3[0] * t2)
            g = int(c2[1] * (1 - t2) + c3[1] * t2)
            b = int(c2[2] * (1 - t2) + c3[2] * t2)
        bg_draw.line([(0, y), (s, y)], fill=(r, g, b, 255), width=1)

    margin = int(s * 0.02)
    mask = Image.new('L', (s, s), 0)
    m_draw = ImageDraw.Draw(mask)
    m_draw.rounded_rectangle([margin, margin, s - margin, s - margin], radius=radius, fill=255)

    res = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    res.paste(bg, (0, 0), mask)
    return res

def create_crisp_icon(size):
    # Render at 4x super-sampled size for razor-sharp antialiasing
    scale = 4
    s = size * scale
    radius = int(s * 0.24)

    # Vibrant royal electric blue / sapphire gradient
    colors = (
        (0, 195, 255),   # Bright cyan #00c3ff
        (10, 102, 255),  # Vivid electric blue #0a66ff
        (30, 41, 190)    # Deep royal blue #1e29be
    )
    base = make_gradient_squircle(s, radius, colors)

    # High-contrast white border
    margin = int(s * 0.02)
    border = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(border)
    b_draw.rounded_rectangle(
        [margin, margin, s - margin, s - margin],
        radius=radius,
        outline=(255, 255, 255, 210),
        width=max(2 * scale, int(s * 0.028))
    )

    # Outer Lightning Bolt Coordinates (0..1)
    # Perfectly proportioned, bold, dynamic
    bolt_outer = [
        (0.55, 0.12),
        (0.24, 0.50),
        (0.47, 0.50),
        (0.42, 0.88),
        (0.76, 0.44),
        (0.53, 0.44),
    ]
    poly_outer = [(int(x * s), int(y * s)) for x, y in bolt_outer]

    # Drop shadow
    shadow = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    sh_draw = ImageDraw.Draw(shadow)
    sh_draw.polygon(poly_outer, fill=(0, 15, 60, 160))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=int(s * 0.03)))

    # Outer rim (Pure White)
    rim = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    r_draw = ImageDraw.Draw(rim)
    r_draw.polygon(poly_outer, fill=(255, 255, 255, 255))

    # Inner Gold Body
    bolt_inner = [
        (0.55, 0.17),
        (0.29, 0.49),
        (0.48, 0.49),
        (0.44, 0.83),
        (0.71, 0.45),
        (0.52, 0.45),
    ]
    poly_inner = [(int(x * s), int(y * s)) for x, y in bolt_inner]
    gold = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(gold)
    g_draw.polygon(poly_inner, fill=(255, 215, 0, 255))

    # Inner White Core Accent
    bolt_core = [
        (0.54, 0.23),
        (0.35, 0.48),
        (0.48, 0.48),
        (0.45, 0.77),
        (0.65, 0.46),
        (0.52, 0.46),
    ]
    poly_core = [(int(x * s), int(y * s)) for x, y in bolt_core]
    core = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    c_draw = ImageDraw.Draw(core)
    c_draw.polygon(poly_core, fill=(255, 255, 255, 240))

    # Composite
    comp = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    comp.paste(base, (0, 0), base)
    comp.paste(border, (0, 0), border)
    comp.paste(shadow, (0, int(s * 0.02)), shadow)
    comp.paste(rim, (0, 0), rim)
    comp.paste(gold, (0, 0), gold)
    comp.paste(core, (0, 0), core)

    # Downsample to exact target size
    return comp.resize((size, size), Image.Resampling.LANCZOS)

def create_16px():
    # 16x16 icon needs extra thick, solid silhouette and bright high-contrast colors
    s = 64  # 4x of 16
    radius = 16
    colors = (
        (0, 210, 255),
        (0, 102, 255),
        (20, 40, 210)
    )
    base = make_gradient_squircle(s, radius, colors)

    # Crisp border
    border = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(border)
    b_draw.rounded_rectangle([1, 1, s - 2, s - 2], radius=radius, outline=(255, 255, 255, 240), width=3)

    # Thick, chunky bolt
    poly_outer = [
        (int(s * 0.58), int(s * 0.10)),
        (int(s * 0.20), int(s * 0.50)),
        (int(s * 0.48), int(s * 0.50)),
        (int(s * 0.40), int(s * 0.90)),
        (int(s * 0.80), int(s * 0.46)),
        (int(s * 0.52), int(s * 0.46)),
    ]
    rim = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(rim).polygon(poly_outer, fill=(255, 255, 255, 255))

    poly_gold = [
        (int(s * 0.57), int(s * 0.18)),
        (int(s * 0.28), int(s * 0.48)),
        (int(s * 0.48), int(s * 0.48)),
        (int(s * 0.43), int(s * 0.82)),
        (int(s * 0.72), int(s * 0.48)),
        (int(s * 0.52), int(s * 0.48)),
    ]
    gold = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(gold).polygon(poly_gold, fill=(255, 220, 0, 255))

    comp = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    comp.paste(base, (0, 0), base)
    comp.paste(border, (0, 0), border)
    comp.paste(rim, (0, 0), rim)
    comp.paste(gold, (0, 0), gold)

    return comp.resize((16, 16), Image.Resampling.LANCZOS)

def main():
    os.makedirs('icons', exist_ok=True)

    # 16x16
    im16 = create_16px()
    im16.save('icons/icon16.png', format='PNG', optimize=True)

    # 32, 48, 128
    for sz in [32, 48, 128]:
        im = create_crisp_icon(sz)
        im.save(f'icons/icon{sz}.png', format='PNG', optimize=True)

    print('Generated all icons cleanly!')

if __name__ == '__main__':
    main()
