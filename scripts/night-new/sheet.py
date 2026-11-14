from PIL import Image, ImageDraw
from pathlib import Path
import sys
root=Path('/Users/paulslee/olumi-work/ui-evidence/look/night-new')
item=sys.argv[1]
files=[p for p in (root/item).glob('*.png') if not p.name.startswith('SHEET')]
for f in files:
 if f.name.startswith('SHEET'):continue
 narrow='-1128-' in f.name
 target=Path('/Users/paulslee/olumi-work/ui-evidence/design-20261113')/('after-1128x707.png' if narrow else 'after-2000x1200.png')
 a=Image.open(target).convert('RGB');b=Image.open(f).convert('RGB')
 # Full resolution, same scale: owner can zoom the side-by-side without losing type.
 canvas=Image.new('RGB',(a.width+b.width+36,max(a.height,b.height)+56),'#f7f5f0')
 d=ImageDraw.Draw(canvas);d.text((12,12),'TARGET (composite)',fill='#213238');d.text((a.width+24,12),f'{item} / {f.name} (served state)',fill='#213238')
 canvas.paste(a,(12,44));canvas.paste(b,(a.width+24,44));canvas.save(f.with_name('SHEET-'+f.name))
print(item,len(files),'side-by-side sheets')
