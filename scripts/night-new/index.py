from pathlib import Path
from html import escape
import subprocess
root=Path('/Users/paulslee/olumi-work/ui-evidence/look/night-new')
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
items=[
('1. Stage and opening','01-stage-final/SHEET-approved-1128-open.png'),
('2. Structured panel','02-panel-final/SHEET-pending-1128-open.png'),
('3. Provisional review','03-approval-final/SHEET-approve-1128-before.png'),
('4. Typed calculation notes','04-explanation/SHEET-approved-1128-calculation.png'),
('5. Offline failure and retry','05-failure/SHEET-draft-1128-retry-failed.png'),
('6. Figure edit and recalculation','06-edit-final/SHEET-edit-1128-changed.png'),
('7. Kept disagreement after restart','07-reopen-final/1128/SHEET-cold-paul-01-cold-opening.png'),
]
html='''<!doctype html><meta charset="utf-8"><title>Olumi new look — functional test slice</title>
<style>body{font:15px/1.6 system-ui;color:#213238;background:#f7f5f0;max-width:1500px;margin:32px auto;padding:0 24px}section{margin:36px 0}img{width:100%;border:1px solid #d9d8d0;border-radius:10px}h1,h2{line-height:1.25}a{color:#126474}code{font-size:12px}p{max-width:80ch}</style>
<h1>Olumi new look — functional test slice</h1><p>Targets are composites. The right-hand images are real served states. Click any sheet for its full pixel size. Conditions and uncertainty are preserved; long content and overflow scroll or pan.</p>'''
html+=f'<p>Local UI head: <code>{head}</code>. Producer dependency: <code>a4ecada53048ab457e8d1f270766d1d915b8d120</code>. No provider requests. See the OUT file for the exact checks and remaining limits.</p>'
html+='<h2>Final opening matrix</h2>'
for state in ['approved','pending']:
 for size in ['2000','1128','133']:
  path=f'FINAL/SHEET-{state}-{size}-open.png'
  html+=f'<p><a href="{path}">{state} · {size}</a></p>'
for title,path in items:
 html+=f'<section><h2>{escape(title)}</h2><a href="{path}"><img loading="lazy" src="{path}" alt="{escape(title)}: target on the left, served state on the right"></a></section>'
(root/'index.html').write_text(html)
