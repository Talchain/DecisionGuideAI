from pathlib import Path
import os, subprocess, json, re
p = Path('src/canvas/domain/goalTarget.ts')
good = p.read_text()
old = "data.threshold_source === 'cee_inference' ? 'olumi' : 'unrecorded'"
assert good.count(old) == 1
env = dict(os.environ, VITE_SUPABASE_URL='http://localhost:54321', VITE_SUPABASE_ANON_KEY='test-anon-key')
results = []
try:
    for name, source in [('inference-undercredit', 'unrecorded'), ('inference-as-brief', 'brief')]:
        p.write_text(good.replace(old, "data.threshold_source === 'cee_inference' ? '" + source + "' : 'unrecorded'"))
        log = Path(f'recovery-notes/L25D-mutant-{name}.log')
        with log.open('w') as f:
            r = subprocess.run(['npx', 'vitest', 'run', 'src/canvas/nodes/__tests__/GoalNode.targetSourceMark.paul23Sep.spec.tsx'], env=env, stdout=f, stderr=subprocess.STDOUT)
        summary = re.findall(r'Tests\s+([^\n]+)', log.read_text())
        result = {'mutant': name, 'exit': r.returncode, 'summary': summary[-1:]}
        results.append(result)
        print(json.dumps(result), flush=True)
finally:
    p.write_text(good)
    Path('recovery-notes/L25D-mutants.json').write_text(json.dumps(results, indent=2) + '\n')
assert len(results) == 2 and all(r['exit'] == 1 and '2 failed | 24 passed' in ''.join(r['summary']) for r in results)
