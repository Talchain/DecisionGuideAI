#!/usr/bin/env node
// J1: one local Supabase schema from BOTH repos' migrations, in timestamp order.
//
// DGAI creates `scenarios` and the browser-side tables; CEE alters `scenarios` and
// owns the v5 append RPCs. Neither repo's CI ever applies the other's migrations,
// so this step is itself a seam check (Integrator ruling, J1-SPEC-RULING §0).
//
// usage: merge-migrations.mjs <dgai/supabase/migrations> <cee/supabase/migrations> <out dir>
// Ties on the timestamp are ordered DGAI first (it owns the base tables). A file
// name that both repos use is a hard error: the second would be silently skipped.

import fs from 'node:fs'
import path from 'node:path'

const [dgaiDir, ceeDir, outDir] = process.argv.slice(2)
if (!dgaiDir || !ceeDir || !outDir) { console.error('usage: merge-migrations.mjs <dgai> <cee> <out>'); process.exit(2) }

const PATTERN = /^(\d{14})_[\w.-]+\.sql$/
const read = (dir, repo) => fs.readdirSync(dir).filter((f) => PATTERN.test(f)).map((f) => ({ repo, dir, file: f, ts: f.match(PATTERN)[1] }))
const all = [...read(dgaiDir, 'dgai'), ...read(ceeDir, 'cee')]
  .sort((a, b) => (a.ts === b.ts ? (a.repo === 'dgai' ? -1 : 1) : a.ts < b.ts ? -1 : 1))

const names = new Map()
for (const m of all) {
  if (names.has(m.file)) { console.error(`[migrations] ${m.file} exists in both repos`); process.exit(1) }
  names.set(m.file, m.repo)
}

// Same timestamp in both repos: give the later one a unique version, keeping order.
fs.mkdirSync(outDir, { recursive: true })
const seen = new Set()
const manifest = []
for (const m of all) {
  let ts = m.ts
  while (seen.has(ts)) ts = String(BigInt(ts) + 1n)
  seen.add(ts)
  const out = ts === m.ts ? m.file : m.file.replace(m.ts, ts)
  fs.copyFileSync(path.join(m.dir, m.file), path.join(outDir, out))
  manifest.push(`${out}\t${m.repo}${ts === m.ts ? '' : `\t(renumbered from ${m.ts})`}`)
}
fs.writeFileSync(path.join(outDir, '..', 'MIGRATION-ORDER.tsv'), manifest.join('\n') + '\n')
const count = (r) => all.filter((m) => m.repo === r).length
console.log(`[migrations] ${all.length} applied in order: dgai ${count('dgai')} + cee ${count('cee')}`)
if (count('dgai') === 0 || count('cee') === 0) { console.error('[migrations] one repo contributed 0 migrations: wrong path'); process.exit(1) }
