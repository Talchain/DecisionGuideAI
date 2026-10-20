from pathlib import Path
import os, subprocess, json
p=Path('src/canvas/nodes/shared/valueSourceMark.tsx')
good=p.read_text()
quote="data?.provenance === 'from_brief'\n      && typeof data.source_quote === 'string' && data.source_quote.trim() !== ''"
inferred="data?.provenance === 'inferred' || data?.provenance === 'proxy'"
mutants=[
 ('brief-omitted', quote, 'false'),
 ('brief-overcredited', quote, "data?.provenance === 'from_brief' || (typeof data?.source_quote === 'string' && data.source_quote.trim() !== '')"),
 ('olumi-omitted', inferred, 'false'),
 ('olumi-credited-to-user', "return { kind: 'olumi', label: 'Olumi’s estimate' }", "return { kind: 'brief', label: VALUE_SOURCE_MARK_LABEL.brief }"),
 ('unknown-credited-to-olumi', "  return { kind: 'unknown', label: VALUE_SOURCE_MARK_LABEL.unknown }\n}\n\n/** Source glyphs", "  return { kind: 'olumi', label: 'Olumi’s estimate' }\n}\n\n/** Source glyphs"),
 ('unknown-credited-to-user', "  return { kind: 'unknown', label: VALUE_SOURCE_MARK_LABEL.unknown }\n}\n\n/** Source glyphs", "  return { kind: 'brief', label: VALUE_SOURCE_MARK_LABEL.brief }\n}\n\n/** Source glyphs"),
]
env=dict(os.environ,VITE_SUPABASE_URL='http://localhost:54321',VITE_SUPABASE_ANON_KEY='test-anon-key')
results=[]
try:
 for name,old,new in mutants:
  assert good.count(old)==1,(name,good.count(old))
  p.write_text(good.replace(old,new,1))
  log=Path(f'recovery-notes/L25-mutant-{name}.log')
  with log.open('w') as f:
   r=subprocess.run(['pnpm','exec','vitest','run','src/canvas/nodes/__tests__/GoalNode.targetSourceMark.paul23Sep.spec.tsx'],env=env,stdout=f,stderr=subprocess.STDOUT)
  results.append({'mutant':name,'exit':r.returncode,'killed':r.returncode==1})
  print(json.dumps(results[-1]),flush=True)
finally:
 p.write_text(good)
 Path('recovery-notes/L25-mutants.json').write_text(json.dumps(results,indent=2)+'\n')
assert len(results)==6 and all(r['killed'] for r in results)
