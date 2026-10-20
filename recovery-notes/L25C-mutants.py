from pathlib import Path
import os, subprocess, json, re
p = Path('src/canvas/nodes/shared/valueSourceMark.tsx')
good = p.read_text()
start = good.index('export function goalTargetSourceMark(')
end = good.index('/** Source glyphs', start)
region = good[start:end]
mutants = [
    ('brief-undercredit', "target.source === 'brief'", 'false'),
    ('brief-overcredit-node-quote', "target.source === 'brief'", "target.source === 'brief' || data?.provenance === 'from_brief'"),
    ('editor-undercredit', "target.source === 'user'", 'false'),
    ('editor-overcredit-brief', "target.source === 'user'", "target.source === 'user' || target.source === 'brief'"),
    ('unknown-as-olumi', "return { kind: 'unknown', label: VALUE_SOURCE_MARK_LABEL.unknown }", "return { kind: 'olumi', label: 'Olumi’s estimate' }"),
    ('unknown-as-brief', "return { kind: 'unknown', label: VALUE_SOURCE_MARK_LABEL.unknown }", "return { kind: 'brief', label: VALUE_SOURCE_MARK_LABEL.brief }"),
    ('olumi-undercredit', "data?.provenance === 'inferred' || data?.provenance === 'proxy'", 'false'),
    ('olumi-as-brief', "return { kind: 'olumi', label: 'Olumi’s estimate' }", "return { kind: 'brief', label: VALUE_SOURCE_MARK_LABEL.brief }"),
]
env = dict(os.environ, VITE_SUPABASE_URL='http://localhost:54321', VITE_SUPABASE_ANON_KEY='test-anon-key')
results = []
try:
    for name, old, new in mutants:
        assert region.count(old) == 1, name
        p.write_text(good[:start] + region.replace(old, new, 1) + good[end:])
        log = Path(f'recovery-notes/L25C-mutant-{name}.log')
        with log.open('w') as f:
            r = subprocess.run(['pnpm', 'exec', 'vitest', 'run', 'src/canvas/nodes/__tests__/GoalNode.targetSourceMark.paul23Sep.spec.tsx'], env=env, stdout=f, stderr=subprocess.STDOUT)
        summary = re.findall(r'Tests\s+([^\n]+)', log.read_text())
        result = {'mutant': name, 'exit': r.returncode, 'summary': summary[-1:]}
        results.append(result)
        print(json.dumps(result), flush=True)
finally:
    p.write_text(good)
    Path('recovery-notes/L25C-mutants.json').write_text(json.dumps(results, indent=2) + '\n')
assert len(results) == len(mutants) and all(r['exit'] == 1 and 'failed' in ''.join(r['summary']) for r in results)
