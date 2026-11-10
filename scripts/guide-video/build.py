# 説明動画（public/guide/tsumugi-guide.mp4）を作り直すスクリプト。ffmpeg（FF のパス）と edge-tts・Pillow が必要。
# 説明動画を組み立てる: 画面の画像 + 字幕 + 読み上げ音声 → mp4
# 使い方: python build.py <出力mp4のパス>
import asyncio, json, os, subprocess, sys, textwrap
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from slides import SLIDES

HERE = os.path.dirname(os.path.abspath(__file__))
FF = r"C:/Users/azmag/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin"
FONT_B = r"C:/Windows/Fonts/BIZ-UDGothicB.ttc"
FONT_R = r"C:/Windows/Fonts/BIZ-UDGothicR.ttc"
FONT_LATIN = r"C:/Windows/Fonts/seguisb.ttf"
VOICE = "ja-JP-NanamiNeural"
W, H = 1920, 1080
TOP, BOTTOM = 84, 210  # 上の見出し帯・下の字幕帯の高さ
INK, BRAND, BG = (24, 24, 27), (229, 83, 45), (244, 244, 245)

scenes = json.load(open(os.path.join(HERE, "scenes.json"), encoding="utf-8"))
out_mp4 = sys.argv[1]
work = os.path.join(HERE, "work")
os.makedirs(work, exist_ok=True)
steps_total = sum(1 for s in scenes if s.get("img") or s.get("slide"))


def font(path, size):
    return ImageFont.truetype(path, size)


def wrap(text, f, max_w, draw):
    """日本語を幅で折り返す（文字単位）"""
    lines, cur = [], ""
    for ch in text:
        if draw.textlength(cur + ch, font=f) > max_w:
            lines.append(cur)
            cur = ch
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return lines


def bezier(p0, p1, p2, p3, n=24):
    return [
        (
            (1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t ** 2 * p2[0] + t ** 3 * p3[0],
            (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t ** 2 * p2[1] + t ** 3 * p3[1],
        )
        for t in [i / n for i in range(n + 1)]
    ]


def logo(img, x, y, size=34):
    # 実際のロゴ（components/brand/Logo.tsx）と同じ形: 32 単位の SVG を 4 倍で描いて縮小
    k = 4
    big = Image.new("RGBA", (32 * k, 32 * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    d.rounded_rectangle([1 * k, 1 * k, 31 * k, 31 * k], radius=8 * k, fill=INK)
    pts = bezier((7.5, 21.5), (10.5, 21.5), (11, 10.5), (15.5, 10.5)) + bezier((15.5, 10.5), (20, 10.5), (19.5, 21.5), (24, 15))
    pts = [(px * k, py * k) for px, py in pts]
    w = 2.4 * k
    d.line(pts, fill=(255, 255, 255), width=int(w))
    for px, py in pts:
        d.ellipse([px - w / 2, py - w / 2, px + w / 2, py + w / 2], fill=(255, 255, 255))
    d.ellipse([(7.5 - 2.1) * k, (21.5 - 2.1) * k, (7.5 + 2.1) * k, (21.5 + 2.1) * k], fill=(255, 255, 255))
    d.ellipse([(24.2 - 3) * k, (14.6 - 3) * k, (24.2 + 3) * k, (14.6 + 3) * k], fill=BRAND)
    mark = big.resize((size, size), Image.LANCZOS)
    img.paste(mark, (x, y), mark)


def find_highlight(shot):
    """スクリーンショットの中の朱色の枠（押す場所）の範囲を探す（縮小すると細い枠が消えるので原寸で 2px おきに見る）"""
    px = shot.load()
    xs, ys = [], []
    for yy in range(0, shot.height, 2):
        for xx in range(0, shot.width, 2):
            r, g, b = px[xx, yy][:3]
            if r > 170 and r - g > 70 and r - b > 100 and g < 130:
                xs.append(xx)
                ys.append(yy)
    if len(xs) < 20:
        return None
    return (min(xs), min(ys), max(xs), max(ys))


def crop_focus(shot, aspect):
    """押す場所を中心に、表示枠の縦横比で切り出して大きく見せる。収まらなければ全体"""
    bb = find_highlight(shot)
    cw = shot.width
    ch = int(cw / aspect)
    if bb is None or ch >= shot.height:
        return shot
    top0, bot0 = bb[1], bb[3]
    if bot0 - top0 > ch - 40:
        return shot  # 囲みが大きすぎるときは全体を見せる
    cy = (top0 + bot0) / 2
    top = int(min(max(cy - ch / 2, 0), shot.height - ch))
    return shot.crop((0, top, cw, top + ch))


def render(i, sc, step_no):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    if sc.get("img") is None and not sc.get("slide"):
        # タイトル・終わりの画面
        lf2 = font(FONT_LATIN, 84)
        lw0 = d.textlength("Tsumugi", font=lf2)
        x0 = int((W - (100 + 24 + lw0)) / 2)
        logo(img, x0, 352, 100)
        d.text((x0 + 124, 352), "Tsumugi", font=lf2, fill=INK)
        tf = font(FONT_B, 64)
        tw = d.textlength(sc["title"], font=tf)
        d.text(((W - tw) / 2, 520), sc["title"], font=tf, fill=INK)
        sf = font(FONT_R, 36)
        sw = d.textlength(sc["sub"], font=sf)
        d.text(((W - sw) / 2, 620), sc["sub"], font=sf, fill=(82, 82, 91))
    else:
        # 上の見出し帯
        d.rectangle([0, 0, W, TOP], fill=(255, 255, 255))
        d.line([0, TOP, W, TOP], fill=(228, 228, 231), width=2)
        logo(img, 36, 24, 36)
        d.text((86, 20), "Tsumugi", font=font(FONT_LATIN, 32), fill=INK)
        d.text((86 + d.textlength("Tsumugi", font=font(FONT_LATIN, 32)) + 14, 28), "使い方", font=font(FONT_B, 28), fill=(113, 113, 122))
        label = f"STEP {step_no} / {steps_total}"
        lf = font(FONT_B, 26)
        lw = d.textlength(label, font=lf)
        d.rounded_rectangle([W - 60 - lw - 520, 22, W - 40, 62], radius=20, fill=(244, 244, 245))
        d.text((W - 40 - 520 - lw - 4, 29), label, font=lf, fill=BRAND)
        d.text((W - 40 - 500, 29), sc["step"], font=font(FONT_B, 26), fill=INK)
        if sc.get("slide"):
            SLIDES[sc["slide"]](img, W, TOP, H - BOTTOM)
            d = ImageDraw.Draw(img)
        else:
            paste_shot(img, d, sc)
        # 下の字幕帯
        draw_caption(d, sc)
    path = os.path.join(work, f"s{i:02d}.png")
    img.save(path)
    return path


def paste_shot(img, d, sc):
    if True:
        # 画面の画像（余白をとって中央に）
        shot = Image.open(os.path.join(HERE, "scenes", sc["img"])).convert("RGB")
        area_h = H - TOP - BOTTOM - 40
        area_w = W - 160
        shot = crop_focus(shot, area_w / area_h)
        scale = min(area_h / shot.height, area_w / shot.width)
        sw, sh = int(shot.width * scale), int(shot.height * scale)
        shot = shot.resize((sw, sh), Image.LANCZOS)
        x, y = (W - sw) // 2, TOP + 20 + (area_h - sh) // 2
        d.rounded_rectangle([x - 3, y - 3, x + sw + 3, y + sh + 3], radius=10, fill=(212, 212, 216))
        img.paste(shot, (x, y))


def draw_caption(d, sc):
    if True:
        d.rectangle([0, H - BOTTOM, W, H], fill=INK)
        cf = font(FONT_B, 38)
        lines = wrap(sc.get("caption", sc["say"]), cf, W - 240, d)[:3]
        total_h = len(lines) * 54
        ty = H - BOTTOM + (BOTTOM - total_h) // 2
        for ln in lines:
            lw2 = d.textlength(ln, font=cf)
            d.text(((W - lw2) / 2, ty), ln, font=cf, fill=(255, 255, 255))
            ty += 54


async def tts(text, path):
    import edge_tts
    await edge_tts.Communicate(text, VOICE, rate="+5%").save(path)


def duration(path):
    out = subprocess.check_output([f"{FF}/ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path])
    return float(out.strip())


async def main():
    parts = []
    step_no = 0
    for i, sc in enumerate(scenes):
        if sc.get("img") or sc.get("slide"):
            step_no += 1
        png = render(i, sc, step_no)
        mp3 = os.path.join(work, f"s{i:02d}.mp3")
        await tts(sc["say"], mp3)
        dur = duration(mp3) + 0.9
        part = os.path.join(work, f"s{i:02d}.mp4")
        subprocess.check_call([
            f"{FF}/ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", png, "-i", mp3,
            "-t", f"{dur:.2f}", "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-tune", "stillimage", "-crf", "20",
            "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "1", "-af", "apad", "-shortest", part,
        ])
        parts.append(part)
        print(f"scene {i:02d}: {dur:.1f}s")
    listfile = os.path.join(work, "list.txt")
    with open(listfile, "w", encoding="utf-8") as f:
        for p in parts:
            f.write(f"file '{p.replace(os.sep, '/')}'\n")
    subprocess.check_call([f"{FF}/ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listfile, "-c", "copy", "-movflags", "+faststart", out_mp4])
    print("total", round(duration(out_mp4), 1), "s ->", out_mp4)


asyncio.run(main())
