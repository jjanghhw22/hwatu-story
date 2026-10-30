"""골목간판풍 화투 원본(1024×1536 PNG 48장)을 게임용 카드로 변환한다.
- 파일 이름의 번호 n(01~48)이 게임 카드 id n-1에 대응한다(1월 광·띠·피·피 … 12월 비광·제비·비띠·비쌍피, src/cards.ts 슬롯 순서와 같음).
- 400×600(2:3)으로 LANCZOS 축소 후 256색(Floyd–Steinberg 디더링)으로 압축: 장당 평균 약 64KB.
- 뒷면(back.png)은 1월 피 카드의 바깥 테두리를 그대로 쓰고 안쪽에 짙은 붉은 판 + 마름모 무늬 + 매화 문양을 그린다.
사용: python tools/prepare-cards.py <원본 폴더> public/assets/cards   (Pillow 필요: pip install pillow)
"""
import sys, os, glob, math
from PIL import Image, ImageDraw

def save_q(im, path):
    q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
    q.save(path, optimize=True)

def main(src, dst, W=400, H=600):
    fs = sorted(glob.glob(os.path.join(src, '*.png')), key=lambda f: int(os.path.basename(f).split('_')[1]))
    assert len(fs) == 48, f'48장이어야 함: {len(fs)}'
    os.makedirs(dst, exist_ok=True)
    for f in fs:
        n = int(os.path.basename(f).split('_')[1])
        im = Image.open(f).convert('RGBA').resize((W, H), Image.LANCZOS)
        save_q(im, os.path.join(dst, f'card-{n-1:02d}.png'))
    base = Image.open(fs[2]).convert('RGBA'); Wb, Hb = base.size
    back = base.copy(); d = ImageDraw.Draw(back)
    ins = 50; d.rectangle([ins, ins, Wb-ins-1, Hb-ins-1], fill=(22, 20, 20, 255))
    ins2 = ins + 12
    panel = Image.new('RGBA', (Wb-2*ins2, Hb-2*ins2), (150, 28, 22, 255)); pd = ImageDraw.Draw(panel); pw, ph = panel.size
    for k in range(-ph, pw+ph, 64):
        pd.line([(k, 0), (k+ph, ph)], fill=(176, 44, 34, 255), width=5); pd.line([(k, ph), (k+ph, 0)], fill=(176, 44, 34, 255), width=5)
    cx, cy = pw//2, ph//2
    for r, col, wd in [(250, (22, 20, 20, 255), 14), (226, (214, 58, 40, 255), 10), (170, (22, 20, 20, 255), 8)]:
        pd.ellipse([cx-r, cy-r, cx+r, cy+r], outline=col, width=wd)
    pd.ellipse([cx-150, cy-150, cx+150, cy+150], fill=(198, 40, 30, 255))
    for i in range(5):
        a = math.radians(i*72-90); px, py = cx+math.cos(a)*70, cy+math.sin(a)*70
        pd.ellipse([px-58, py-58, px+58, py+58], fill=(240, 228, 205, 255), outline=(22, 20, 20, 255), width=8)
    pd.ellipse([cx-34, cy-34, cx+34, cy+34], fill=(230, 180, 40, 255), outline=(22, 20, 20, 255), width=8)
    noise = Image.effect_noise(panel.size, 24).convert('L')
    panel = Image.composite(panel, Image.new('RGBA', panel.size, (120, 20, 16, 255)), noise.point(lambda v: 255 if v > 40 else 225))
    back.paste(panel, (ins2, ins2))
    save_q(back.resize((W, H), Image.LANCZOS), os.path.join(dst, 'back.png'))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
