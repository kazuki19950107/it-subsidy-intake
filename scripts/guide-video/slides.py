# 図のスライド（LINE アプリ側の操作など、画面を撮れないところ）を描く
from PIL import ImageDraw, ImageFont

INK, BRAND, MUTE = (24, 24, 27), (229, 83, 45), (113, 113, 122)
LINE_GREEN = (6, 199, 85)
CARD, RULE = (255, 255, 255), (228, 228, 231)
FONT_B = r"C:/Windows/Fonts/BIZ-UDGothicB.ttc"
FONT_R = r"C:/Windows/Fonts/BIZ-UDGothicR.ttc"


def f(path, size):
    return ImageFont.truetype(path, size)


def center_text(d, cx, y, text, font, fill=INK):
    w = d.textlength(text, font=font)
    d.text((cx - w / 2, y), text, font=font, fill=fill)


def card(d, x0, y0, x1, y1, border=RULE, width=2, fill=CARD):
    d.rounded_rectangle([x0, y0, x1, y1], radius=22, fill=fill, outline=border, width=width)


def arrow(d, x0, y, x1, color=MUTE, label=None):
    d.line([x0, y, x1 - 14, y], fill=color, width=6)
    d.polygon([(x1, y), (x1 - 22, y - 14), (x1 - 22, y + 14)], fill=color)
    if label:
        lf = f(FONT_R, 24)
        w = d.textlength(label, font=lf)
        d.text(((x0 + x1) / 2 - w / 2, y - 46), label, font=lf, fill=MUTE)


def wrap_lines(d, text, font, width):
    out, cur = [], ""
    for ch in text:
        if d.textlength(cur + ch, font=font) > width:
            out.append(cur)
            cur = ch
        else:
            cur += ch
    if cur:
        out.append(cur)
    return out


def slide_title(d, W, y, text, sub=None):
    center_text(d, W / 2, y, text, f(FONT_B, 52))
    if sub:
        center_text(d, W / 2, y + 74, sub, f(FONT_R, 28), MUTE)


def line_overview(img, W, top, bottom):
    d = ImageDraw.Draw(img)
    slide_title(d, W, top + 30, "公式LINEのしくみ", "公式LINEは2種類のグループに入ります")
    y0, y1 = top + 210, bottom - 60
    cw = 470
    xs = [130, (W - cw) // 2, W - 130 - cw]
    items = [
        ("お客様のグループ", ["お客様", "社内の担当者", "公式LINE"], "名前は「3次BU×会社名様」", RULE),
        ("公式LINE＋Tsumugi", ["グループ名から", "案件に自動で紐付け", "社内に通知を送る"], "", LINE_GREEN),
        ("社内用グループ", ["社内の担当者だけ", "公式LINE"], "社内向けの通知が届く", INK),
    ]
    for (title, lines, note, color), x in zip(items, xs):
        card(d, x, y0, x + cw, y1, border=color, width=4 if color != RULE else 2)
        center_text(d, x + cw / 2, y0 + 36, title, f(FONT_B, 38))
        yy = y0 + 120
        for ln in lines:
            center_text(d, x + cw / 2, yy, "・" + ln if title != "公式LINE＋Tsumugi" else ln, f(FONT_R, 32))
            yy += 56
        if note:
            center_text(d, x + cw / 2, y1 - 80, note, f(FONT_B, 28), BRAND)
    ym = (y0 + y1) // 2
    arrow(d, xs[0] + cw + 14, ym, xs[1] - 14, label="招待")
    arrow(d, xs[1] + cw + 14, ym, xs[2] - 14, label="通知")


def line_internal_steps(img, W, top, bottom):
    d = ImageDraw.Draw(img)
    slide_title(d, W, top + 30, "社内用グループを作る（LINEアプリ）", "最初に1回だけ")
    steps = [
        ("1", "LINEアプリで新しいグループを作る", "メンバーは社内の担当者だけ。名前は自由（例: 補助金 通知用）"),
        ("2", "グループに公式LINEを招待する", "「メンバーを招待」で公式LINEを選ぶ。参加するとあいさつが届きます"),
        ("3", "Tsumugi の「LINE」画面を開く", "新しいグループが並ぶので「社内用にする」を押す"),
    ]
    y = top + 220
    for num, head, body in steps:
        card(d, 260, y, W - 260, y + 150)
        d.ellipse([300, y + 40, 370, y + 110], fill=LINE_GREEN)
        center_text(d, 335, y + 50, num, f(FONT_B, 40), (255, 255, 255))
        d.text((410, y + 32), head, font=f(FONT_B, 38), fill=INK)
        d.text((410, y + 92), body, font=f(FONT_R, 28), fill=MUTE)
        y += 180


def line_naming(img, W, top, bottom):
    d = ImageDraw.Draw(img)
    slide_title(d, W, top + 30, "お客様のグループ名のつけ方", "この形にすると、公式LINEを招待しただけで案件に紐付きます")
    parts = [("3次", "回次", BRAND), ("BU", "ツール", (37, 99, 235)), ("×", "", MUTE), ("MEM株式会社", "会社名", INK), ("様", "", MUTE)]
    big = f(FONT_B, 96)
    total = sum(d.textlength(p[0], font=big) + 12 for p in parts)
    x = (W - total) / 2
    y = top + 260
    for text, label, color in parts:
        w = d.textlength(text, font=big)
        d.text((x, y), text, font=big, fill=color)
        if label:
            d.line([x, y + 130, x + w, y + 130], fill=color, width=6)
            center_text(d, x + w / 2, y + 150, label, f(FONT_B, 34), color)
        x += w + 12
    notes = "全角・半角、「株式会社」の有無、末尾の「様」、空白の違いは気にしなくて大丈夫です。名前を後から変えても、毎朝読み直します。"
    nf = f(FONT_R, 30)
    yy = top + 500
    for ln in wrap_lines(d, notes, nf, W - 520):
        center_text(d, W / 2, yy, ln, nf, MUTE)
        yy += 48


def line_unlinked(img, W, top, bottom):
    d = ImageDraw.Draw(img)
    slide_title(d, W, top + 30, "自動で紐付かなかったとき", "同じ会社名の案件が複数あるなど、1件に絞れないときは「未紐付け」になります")
    x0, x1, y0 = 240, W - 240, top + 230
    card(d, x0, y0, x1, y0 + 300)
    hf, bf = f(FONT_B, 26), f(FONT_R, 30)
    cols = [x0 + 40, x0 + 620, x0 + 820]
    for c, t in zip(cols, ["グループ名", "種類", "案件"]):
        d.text((c, y0 + 30), t, font=hf, fill=MUTE)
    d.line([x0 + 30, y0 + 80, x1 - 30, y0 + 80], fill=RULE, width=2)
    d.text((cols[0], y0 + 110), "3次BU×サンプル様", font=f(FONT_B, 34), fill=INK)
    d.rounded_rectangle([cols[1], y0 + 108, cols[1] + 110, y0 + 152], radius=8, outline=RULE, width=2)
    d.text((cols[1] + 22, y0 + 114), "顧客", font=f(FONT_R, 26), fill=INK)
    # 案件を選ぶ欄（強調）
    sx0, sy0, sx1, sy1 = cols[2], y0 + 100, x1 - 40, y0 + 160
    d.rounded_rectangle([sx0 - 10, sy0 - 10, sx1 + 10, sy1 + 10], radius=14, outline=BRAND, width=5)
    d.rounded_rectangle([sx0, sy0, sx1, sy1], radius=10, fill=CARD, outline=RULE, width=2)
    d.text((sx0 + 20, sy0 + 14), "未紐付け　▼　（候補から案件を選ぶ）", font=bf, fill=INK)
    d.text((sx0, sy1 + 30), "候補 2件", font=f(FONT_R, 26), fill=MUTE)
    center_text(d, W / 2, y0 + 360, "「LINE」画面で、そのグループの「案件」から正しい案件を選ぶと保存されます。", f(FONT_R, 30), MUTE)


def line_notify(img, W, top, bottom):
    d = ImageDraw.Draw(img)
    slide_title(d, W, top + 30, "社内用グループに届く通知", "無料プランは月200通（送った回数×受け取る人数で数えます）")
    rows = [
        ("お客様が書類をそろえて送信したとき", "すぐに", "1通×人数"),
        ("ポータルの状態が変わった案件があったとき", "毎朝6時にまとめて", "1日1通×人数"),
        ("ポータルの同期に失敗したとき", "すぐに", "1通×人数"),
        ("公式LINEを招待したときのあいさつ", "招待したとき", "数えない"),
    ]
    x0, x1, y = 200, W - 200, top + 210
    hf, bf = f(FONT_B, 28), f(FONT_R, 32)
    cols = [x0 + 30, x0 + 900, x0 + 1240]
    card(d, x0, y, x1, y + 90 + len(rows) * 96)
    for c, t in zip(cols, ["いつ", "タイミング", "通数"]):
        d.text((c, y + 28), t, font=hf, fill=MUTE)
    yy = y + 90
    for a, b, c in rows:
        d.line([x0 + 20, yy, x1 - 20, yy], fill=RULE, width=2)
        d.text((cols[0], yy + 28), a, font=bf, fill=INK)
        d.text((cols[1], yy + 28), b, font=bf, fill=INK)
        d.text((cols[2], yy + 28), c, font=f(FONT_B, 32), fill=LINE_GREEN if c == "数えない" else INK)
        yy += 96


SLIDES = {
    "line_overview": line_overview,
    "line_internal_steps": line_internal_steps,
    "line_naming": line_naming,
    "line_unlinked": line_unlinked,
    "line_notify": line_notify,
}
