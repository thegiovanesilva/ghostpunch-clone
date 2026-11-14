"""Gera as texturas de IMAGEM do jogo (autorais, desenhadas por código com PIL/numpy).
Uso: python3 tools/bake_textures.py   -> grava em public/textures/
As texturas de superfície (piso, paredes, teto, madeira, sujeira) são geradas em tempo de execução em src/textures.js."""
import math, random, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'textures')
os.makedirs(OUT, exist_ok=True)

def noise(w, h, amp, seed, blur=0):
    rng = np.random.default_rng(seed)
    n = rng.normal(0, amp, (h, w)).astype(np.float32)
    im = Image.fromarray(np.clip(n + 128, 0, 255).astype(np.uint8))
    if blur: im = im.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(im).astype(np.float32) - 128

def add_noise(img, amp, seed, blur=0):
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    n = noise(img.width, img.height, amp, seed, blur)
    a += n[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def vignette(img, strength=0.7, power=2.0):
    w, h = img.size
    y, x = np.mgrid[0:h, 0:w]
    d = np.sqrt(((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2) / math.sqrt(2)
    k = 1 - strength * np.clip(d, 0, 1) ** power
    a = np.asarray(img).astype(np.float32) * k[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def craquelure(img, n, seed, color=(12, 8, 6), alpha=110):
    """rachaduras finas de tinta velha"""
    rnd = random.Random(seed)
    ov = Image.new('RGBA', img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    w, h = img.size
    for _ in range(n):
        x, y = rnd.uniform(0, w), rnd.uniform(0, h); ang = rnd.uniform(0, math.tau)
        for _ in range(rnd.randint(6, 26)):
            ang += rnd.uniform(-0.7, 0.7); L = rnd.uniform(4, 12)
            nx, ny = x + math.cos(ang) * L, y + math.sin(ang) * L
            d.line([x, y, nx, ny], fill=color + (rnd.randint(alpha // 2, alpha),), width=1)
            x, y = nx, ny
    return Image.alpha_composite(img.convert('RGBA'), ov).convert('RGB')

def stains(img, n, seed, color=(20, 12, 6), amax=120, rmin=10, rmax=70):
    rnd = random.Random(seed)
    ov = Image.new('RGBA', img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    w, h = img.size
    for _ in range(n):
        x, y, r = rnd.uniform(0, w), rnd.uniform(0, h), rnd.uniform(rmin, rmax)
        d.ellipse([x - r, y - r * rnd.uniform(0.6, 1.2), x + r, y + r * rnd.uniform(0.6, 1.2)], fill=color + (rnd.randint(amax // 3, amax),))
    ov = ov.filter(ImageFilter.GaussianBlur(rmax / 4))
    return Image.alpha_composite(img.convert('RGBA'), ov).convert('RGB')

# ---------------- RETRATOS: pintura a óleo escurecida, rosto pálido, olhos riscados ----------------
def portrait(name, seed, hair=(14, 10, 10), dress=(26, 14, 22), bg=(38, 26, 18), scratched=True, child=False):
    rnd = random.Random(seed); W, H = 384, 512
    img = Image.new('RGB', (W, H), bg); d = ImageDraw.Draw(img)
    # fundo com pinceladas
    for _ in range(260):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H); c = rnd.randint(-14, 14)
        d.ellipse([x - 30, y - 8, x + 30, y + 8], fill=(bg[0] + c, bg[1] + c, bg[2] + c))
    img = img.filter(ImageFilter.GaussianBlur(6)); d = ImageDraw.Draw(img)
    cx = W / 2 + rnd.uniform(-10, 10); fy = 190 if not child else 215; fw = 62 if not child else 54; fh = 84 if not child else 66
    # ombros / vestido
    d.polygon([(cx - 150, H), (cx - 120, fy + 150), (cx - 40, fy + 96), (cx + 40, fy + 96), (cx + 120, fy + 150), (cx + 150, H)], fill=dress)
    d.polygon([(cx - 30, fy + 60), (cx + 30, fy + 60), (cx + 40, fy + 104), (cx, fy + 128), (cx - 40, fy + 104)], fill=(150, 142, 128))   # pescoço
    d.polygon([(cx - 44, fy + 100), (cx, fy + 150), (cx + 44, fy + 100), (cx + 60, fy + 120), (cx, fy + 180), (cx - 60, fy + 120)], fill=(196, 188, 170))  # gola
    # cabelo atrás
    d.ellipse([cx - fw - 26, fy - fh - 30, cx + fw + 26, fy + fh + (120 if not child else 60)], fill=hair)
    # rosto
    d.ellipse([cx - fw, fy - fh, cx + fw, fy + fh], fill=(186, 178, 160))
    d.ellipse([cx - fw + 8, fy - fh + 30, cx + fw - 8, fy + fh + 6], fill=(192, 184, 166))
    # sombras do rosto (bochechas fundas)
    for sx in (-1, 1):
        d.ellipse([cx + sx * (fw - 22) - 16, fy + 6, cx + sx * (fw - 22) + 16, fy + 60], fill=(150, 140, 126))
    # franja / risca
    d.pieslice([cx - fw - 14, fy - fh - 26, cx + fw + 14, fy + 10], 180, 360, fill=hair)
    d.polygon([(cx - 6, fy - fh + 34), (cx + 6, fy - fh + 34), (cx, fy - fh - 6)], fill=(186, 178, 160))
    # órbitas escuras
    ey = fy - 8
    for sx in (-1, 1):
        ex = cx + sx * fw * 0.42
        d.ellipse([ex - 19, ey - 13, ex + 19, ey + 14], fill=(74, 58, 56))
        d.ellipse([ex - 12, ey - 8, ex + 12, ey + 9], fill=(16, 10, 12))
        if not scratched: d.ellipse([ex - 2, ey - 2, ex + 2, ey + 2], fill=(210, 210, 200))
    # nariz e boca
    d.line([cx - 3, ey + 16, cx - 6, fy + 34, cx + 5, fy + 36], fill=(120, 108, 98), width=3)
    my = fy + 56
    d.line([cx - 22, my, cx - 8, my + 3, cx + 8, my + 3, cx + 22, my - 1], fill=(70, 30, 34), width=4)
    img = img.filter(ImageFilter.GaussianBlur(2.2))
    # verniz amarelado + escurecimento
    a = np.asarray(img).astype(np.float32); a *= np.array([0.86, 0.78, 0.58]); img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    img = add_noise(img, 9, seed + 1); img = add_noise(img, 14, seed + 2, blur=5)
    img = stains(img, 14, seed + 3, color=(10, 6, 4), amax=150)
    d = ImageDraw.Draw(img)
    if scratched:  # alguém riscou os olhos (e a boca) com raiva
        for sx in (-1, 1):
            ex = cx + sx * fw * 0.42
            for _ in range(46):
                a0 = rnd.uniform(-0.5, 0.5) + (0 if rnd.random() < 0.7 else 1.2); L = rnd.uniform(14, 40)
                x0, y0 = ex + rnd.uniform(-10, 10), ey + rnd.uniform(-9, 9)
                col = rnd.choice([(8, 5, 5), (8, 5, 5), (150, 138, 120), (60, 8, 8)])
                d.line([x0 - math.cos(a0) * L, y0 - math.sin(a0) * L, x0 + math.cos(a0) * L, y0 + math.sin(a0) * L], fill=col, width=rnd.choice([1, 1, 2, 3]))
        # escorrido escuro saindo dos olhos
        ov = Image.new('RGBA', img.size, (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
        for sx in (-1, 1):
            ex = cx + sx * fw * 0.42
            for _ in range(5):
                x = ex + rnd.uniform(-9, 9); L = rnd.uniform(40, 190)
                od.line([x, ey + 4, x + rnd.uniform(-4, 4), ey + L], fill=(26, 4, 6, rnd.randint(120, 220)), width=rnd.choice([2, 3, 4]))
        ov = ov.filter(ImageFilter.GaussianBlur(1.1)); img = Image.alpha_composite(img.convert('RGBA'), ov).convert('RGB')
    img = craquelure(img, 150, seed + 4)
    img = vignette(img, 0.85, 1.6)
    img.save(os.path.join(OUT, name), quality=84)

# ---------------- PAISAGENS: casa no morro / árvore morta, quase preto ----------------
def scene(name, seed, kind):
    rnd = random.Random(seed); W, H = 512, 352
    img = Image.new('RGB', (W, H)); px = img.load()
    for y in range(H):
        t = y / H
        for x in range(W): px[x, y] = (int(34 + 46 * t), int(34 + 30 * t), int(40 + 8 * t))
    d = ImageDraw.Draw(img)
    d.ellipse([W * 0.62, 40, W * 0.62 + 56, 96], fill=(170, 160, 120))  # lua doente
    for _ in range(40):
        x, y = rnd.uniform(0, W), rnd.uniform(20, 170)
        d.ellipse([x - 60, y - 9, x + 60, y + 9], fill=(26, 24, 30))
    img = img.filter(ImageFilter.GaussianBlur(5)); d = ImageDraw.Draw(img)
    hill = [(0, H)] + [(x, 250 - 60 * math.exp(-((x - W * 0.42) / 150) ** 2) + 6 * math.sin(x / 23)) for x in range(0, W + 8, 8)] + [(W, H)]
    d.polygon(hill, fill=(9, 8, 10))
    if kind == 'house':
        bx, by = W * 0.42, 190
        d.rectangle([bx - 46, by - 70, bx + 46, by + 6], fill=(7, 6, 8))
        d.polygon([(bx - 56, by - 70), (bx, by - 118), (bx + 56, by - 70)], fill=(7, 6, 8))
        d.rectangle([bx + 20, by - 150, bx + 44, by - 70], fill=(7, 6, 8)); d.polygon([(bx + 16, by - 150), (bx + 32, by - 178), (bx + 48, by - 150)], fill=(7, 6, 8))
        d.rectangle([bx - 30, by - 50, bx - 16, by - 30], fill=(190, 150, 50))  # uma única janela acesa
        d.rectangle([bx + 27, by - 130, bx + 37, by - 114], fill=(60, 14, 14))
    else:
        def branch(x, y, ang, L, wd, depth):
            if depth == 0 or L < 5: return
            nx, ny = x + math.cos(ang) * L, y + math.sin(ang) * L
            d.line([x, y, nx, ny], fill=(6, 5, 7), width=max(1, int(wd)))
            for _ in range(rnd.choice([1, 2, 2, 3])):
                branch(nx, ny, ang + rnd.uniform(-0.75, 0.75), L * rnd.uniform(0.62, 0.82), wd * 0.68, depth - 1)
        branch(W * 0.4, 212, -math.pi / 2 + 0.08, 60, 11, 7)
        # figura parada embaixo da árvore
        fx = W * 0.4 + 70
        d.ellipse([fx - 5, 196, fx + 5, 206], fill=(150, 150, 150)); d.polygon([(fx - 7, 206), (fx + 7, 206), (fx + 10, 240), (fx - 10, 240)], fill=(170, 170, 176))
    img = img.filter(ImageFilter.GaussianBlur(1.0))
    img = add_noise(img, 8, seed + 1); img = add_noise(img, 12, seed + 2, blur=6)
    img = stains(img, 10, seed + 3, color=(6, 4, 3), amax=150)
    img = craquelure(img, 130, seed + 4); img = vignette(img, 0.8, 1.8)
    img.save(os.path.join(OUT, name), quality=84)

# ---------------- TAPETE persa gasto ----------------
def rug(name, W, H, seed, field=(92, 14, 22)):
    rnd = random.Random(seed)
    q = Image.new('RGB', (W // 2, H // 2), field); d = ImageDraw.Draw(q)
    gold, dark, cream = (150, 112, 48), (30, 8, 14), (170, 150, 112)
    qw, qh = W // 2, H // 2
    for i, (c, wd) in enumerate([(dark, 10), (gold, 4), (dark, 16), (cream, 3), (dark, 5)]):
        o = sum(w for _, w in [(dark, 10), (gold, 4), (dark, 16), (cream, 3), (dark, 5)][:i])
        d.rectangle([o, o, qw, o + wd], fill=c); d.rectangle([o, o, o + wd, qh], fill=c)
    # dentes na borda
    for x in range(18, qw, 12): d.polygon([(x, 14), (x + 6, 28), (x + 12, 14)], fill=gold)
    for y in range(18, qh, 12): d.polygon([(14, y), (28, y + 6), (14, y + 12)], fill=gold)
    # losangos no campo
    step = 34
    for gy in range(48, qh + step, step):
        for gx in range(48 + (gy // step % 2) * step // 2, qw + step, step):
            r = 10
            d.polygon([(gx, gy - r), (gx + r * 0.7, gy), (gx, gy + r), (gx - r * 0.7, gy)], fill=dark, outline=gold)
            d.ellipse([gx - 2, gy - 2, gx + 2, gy + 2], fill=cream)
    # medalhão central (canto inferior direito do quadrante = centro do tapete)
    for r, c in [(qh * 0.62, dark), (qh * 0.56, gold), (qh * 0.52, (70, 10, 18)), (qh * 0.3, dark), (qh * 0.26, cream), (qh * 0.22, field), (qh * 0.08, gold)]:
        d.ellipse([qw - r * 1.25, qh - r, qw + r * 1.25, qh + r], fill=c)
    for k in range(12):
        a = k * math.pi / 12; r1, r2 = qh * 0.34, qh * 0.5
        d.line([qw - math.cos(a) * r1 * 1.25, qh - math.sin(a) * r1, qw - math.cos(a) * r2 * 1.25, qh - math.sin(a) * r2], fill=gold, width=2)
    img = Image.new('RGB', (W, H))
    img.paste(q, (0, 0)); img.paste(q.transpose(Image.FLIP_LEFT_RIGHT), (W // 2, 0))
    img.paste(q.transpose(Image.FLIP_TOP_BOTTOM), (0, H // 2)); img.paste(q.transpose(Image.ROTATE_180), (W // 2, H // 2))
    img = img.filter(ImageFilter.GaussianBlur(0.7))
    # trama do tecido + desgaste
    a = np.asarray(img).astype(np.float32)
    yy, xx = np.mgrid[0:H, 0:W]
    a *= (0.9 + 0.1 * np.sin(xx * 2.2) * np.sin(yy * 2.2))[..., None]
    wear = np.clip(noise(W, H, 60, seed + 5, blur=26) / 60 + 0.25, 0, 1)   # áreas desbotadas
    grey = a.mean(axis=2, keepdims=True) * 0.9 + 26
    a = a * (1 - 0.55 * wear[..., None]) + grey * 0.55 * wear[..., None]
    a *= 0.72
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    img = add_noise(img, 10, seed + 6)
    img = stains(img, 9, seed + 7, color=(10, 3, 3), amax=190, rmin=14, rmax=min(W, H) // 5)
    img.save(os.path.join(OUT, name), quality=82)

# ---------------- AZULEJO de cozinha encardido (repete) ----------------
def tiles(name, seed):
    rnd = random.Random(seed); S = 256; img = Image.new('RGB', (S, S), (26, 24, 22)); d = ImageDraw.Draw(img)
    for j in range(2):
        for i in range(2):
            c = (150, 146, 128) if (i + j) % 2 == 0 else (34, 36, 38)
            c = tuple(v + rnd.randint(-8, 8) for v in c)
            d.rectangle([i * 128 + 3, j * 128 + 3, i * 128 + 124, j * 128 + 124], fill=c)
    for _ in range(3):  # trincas
        x, y = rnd.uniform(0, S), rnd.uniform(0, S); ang = rnd.uniform(0, math.tau)
        for _ in range(14):
            ang += rnd.uniform(-0.5, 0.5); nx, ny = x + math.cos(ang) * 12, y + math.sin(ang) * 12
            d.line([x, y, nx, ny], fill=(14, 12, 10), width=1); x, y = nx, ny
    img = add_noise(img, 7, seed + 1); img = add_noise(img, 18, seed + 2, blur=10)
    img = stains(img, 8, seed + 3, color=(40, 26, 8), amax=110, rmin=10, rmax=44)
    a = np.asarray(img).astype(np.float32) * 0.8
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name), quality=82)

# ---------------- PORTA de entrada: almofadada, arranhada por dentro ----------------
def door(name, seed):
    rnd = random.Random(seed); W, H = 256, 420; base = (58, 34, 18)
    img = Image.new('RGB', (W, H), base); d = ImageDraw.Draw(img)
    for x in range(0, W, 2):  # veios verticais
        c = rnd.randint(-10, 10); d.line([x, 0, x + rnd.randint(-3, 3), H], fill=(base[0] + c, base[1] + c, base[2] + c // 2), width=2)
    for (x0, y0, x1, y1) in [(26, 26, 116, 170), (140, 26, 230, 170), (26, 196, 116, 300), (140, 196, 230, 300), (26, 326, 230, 396)]:
        d.rectangle([x0, y0, x1, y1], outline=(20, 11, 6), width=5); d.rectangle([x0 + 7, y0 + 7, x1 - 7, y1 - 7], outline=(84, 54, 30), width=2)
    img = img.filter(ImageFilter.GaussianBlur(0.8)); d = ImageDraw.Draw(img)
    for _ in range(4):  # arranhões de unha: 4 riscos paralelos descendo
        x, y = rnd.uniform(40, 180), rnd.uniform(120, 260); L = rnd.uniform(70, 150); sl = rnd.uniform(-0.25, 0.25)
        for k in range(4):
            xo = x + k * 9
            d.line([xo, y + rnd.uniform(-8, 8), xo + sl * L, y + L + rnd.uniform(-14, 14)], fill=(150, 120, 86), width=2)
            d.line([xo + 2, y, xo + 2 + sl * L, y + L], fill=(18, 9, 5), width=1)
    img = add_noise(img, 8, seed + 1); img = stains(img, 12, seed + 2, color=(8, 5, 3), amax=170, rmin=14, rmax=60)
    ov = Image.new('RGBA', img.size, (0, 0, 0, 0)); od = ImageDraw.Draw(ov)  # marca de mão ensanguentada
    hx, hy = 150, 150
    od.ellipse([hx - 16, hy - 14, hx + 16, hy + 20], fill=(70, 6, 8, 190))
    for k, (dx, L) in enumerate([(-15, 26), (-6, 34), (3, 36), (12, 30)]): od.line([hx + dx, hy - 8, hx + dx + (k - 1.5) * 2, hy - 8 - L], fill=(70, 6, 8, 190), width=7)
    od.line([hx - 16, hy + 6, hx - 30, hy - 6], fill=(70, 6, 8, 190), width=8)
    for dx in (-8, 4, 10): od.line([hx + dx, hy + 16, hx + dx + rnd.uniform(-3, 3), hy + rnd.uniform(60, 150)], fill=(60, 5, 7, 170), width=3)
    ov = ov.filter(ImageFilter.GaussianBlur(1.3)); img = Image.alpha_composite(img.convert('RGBA'), ov).convert('RGB')
    a = np.asarray(img).astype(np.float32) * 0.85
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name), quality=84)

# ---------------- SANGUE seco (PNG com transparência): poça/respingo e escorrido de parede ----------------
def blood(name, seed, drips=False, S=512):
    rnd = random.Random(seed)
    m = Image.new('L', (S, S), 0); d = ImageDraw.Draw(m)
    cx, cy = S / 2, S * (0.3 if drips else 0.5)
    for _ in range(26):  # massa central irregular
        a, r = rnd.uniform(0, math.tau), rnd.uniform(0, S * 0.13); rr = rnd.uniform(S * 0.04, S * 0.13)
        x, y = cx + math.cos(a) * r * (1.6 if drips else 1), cy + math.sin(a) * r * (0.5 if drips else 1)
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=255)
    for _ in range(150):  # respingos: gotas alongadas saindo do centro
        a = rnd.uniform(0, math.tau); r = rnd.uniform(S * 0.14, S * 0.47) * rnd.random() ** 0.5; rr = rnd.uniform(1.5, 9) * (1 - r / (S * 0.6))
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r * (0.6 if drips else 1)
        ex, ey = math.cos(a) * rr * rnd.uniform(1, 2.6), math.sin(a) * rr * rnd.uniform(1, 2.6)
        d.line([x - ex, y - ey, x + ex, y + ey], fill=255, width=max(1, int(rr)))
        d.ellipse([x + ex - rr, y + ey - rr, x + ex + rr, y + ey + rr], fill=255)
    if drips:
        for _ in range(16):
            x = cx + rnd.uniform(-S * 0.3, S * 0.3); L = rnd.uniform(S * 0.12, S * 0.62); wd = rnd.uniform(3, 9)
            d.line([x, cy, x + rnd.uniform(-4, 4), cy + L], fill=255, width=int(wd)); d.ellipse([x - wd * 0.8, cy + L - wd, x + wd * 0.8, cy + L + wd * 0.9], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(2.2)).point(lambda v: 255 if v > 110 else 0).filter(ImageFilter.GaussianBlur(1.0))
    al = np.asarray(m).astype(np.float32) / 255
    core = np.asarray(m.filter(ImageFilter.GaussianBlur(12))).astype(np.float32) / 255   # centro mais escuro/grosso
    n = noise(S, S, 30, seed + 1, blur=3) / 100
    r = 185 - 95 * core + 50 * n; g = 14 - 8 * core + 8 * n; b = 12 - 6 * core + 8 * n
    alpha = al * np.clip(0.72 + 0.25 * core + n, 0, 1)
    rgba = np.dstack([np.clip(r, 0, 255), np.clip(g, 0, 255), np.clip(b, 0, 255), np.clip(alpha * 255, 0, 255)]).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, name), optimize=True)

portrait('portrait_1.jpg', 11)
portrait('portrait_2.jpg', 23, hair=(40, 32, 26), dress=(14, 14, 16), bg=(30, 30, 24))
portrait('portrait_3.jpg', 37, hair=(10, 8, 8), dress=(150, 142, 128), bg=(26, 20, 22), child=True)
portrait('portrait_4.jpg', 51, hair=(70, 66, 60), dress=(20, 12, 10), bg=(34, 22, 16), scratched=False)
scene('scene_1.jpg', 5, 'house'); scene('scene_2.jpg', 9, 'tree')
rug('rug.jpg', 512, 400, 3); rug('runner.jpg', 224, 1000, 4, field=(70, 12, 26))
tiles('tiles.jpg', 7); door('door.jpg', 13)
blood('blood_floor_1.png', 21); blood('blood_floor_2.png', 22); blood('blood_wall_1.png', 31, drips=True); blood('blood_wall_2.png', 32, drips=True)
print({f: os.path.getsize(os.path.join(OUT, f)) // 1024 for f in sorted(os.listdir(OUT))})
