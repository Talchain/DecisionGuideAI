#!/usr/bin/env node
// J1: one local Supabase schema from BOTH repos' migrations, in timestamp order.
//
// DGAI creates `scenarios` and the browser-side tables; CEE alters `scenarios` and
// owns the v5 append RPCs. Neither repo's CI ever applies the other's migrations,
// so this step is itself a seam check (Integrator ruling, J1-SPEC-RULING §0).
//
// usage: merge-migrations.mjs <dgai/supabase/migrations> <cee/supabase/migrations> <out dir>
// Ties on the timestamp are ordered DGAI first (it owns the base tables). A file
// that BOTH repos carry under one name is applied once, but only when its SQL is the
// same ignoring comments; a same-named pair whose SQL differs is a hard error,
// because the hosted project records one version and only one of them ever ran.

import fs from 'node:fs'
import path from 'node:path'

const [dgaiDir, ceeDir, outDir] = process.argv.slice(2)
if (!dgaiDir || !ceeDir || !outDir) { console.error('usage: merge-migrations.mjs <dgai> <cee> <out>'); process.exit(2) }

const PATTERN = /^(\d{14})_[\w.-]+\.sql$/

// Migrations that cannot replay on an empty database because they act on rows
// that only ever existed in the hosted project. Each one is applied with
// foreign-key triggers off (session_replication_role = replica) for that file
// only, and listed in MIGRATION-ORDER.tsv, so it is a visible finding rather than
// a silent skip. Add a file here only with the reason that run measured.
const NON_REPLAYABLE = {
  // "-- Test script to verify decision options data": inserts decision_analysis
  // for decision 2c7918d1-…, a row absent from any fresh database (FK 23503, J1 run 37297237396).
  '20250301143416_violet_hall.sql': 'test-data insert for a hosted-only decisions row',
}
const read = (dir, repo) => fs.readdirSync(dir).filter((f) => PATTERN.test(f)).map((f) => ({ repo, dir, file: f, ts: f.match(PATTERN)[1] }))
const sqlOf = (m) => fs.readFileSync(path.join(m.dir, m.file), 'utf8')
  .split('\n').filter((l) => !/^\s*--/.test(l)).join('\n').replace(/\s+/g, ' ').trim()

const dgai = read(dgaiDir, 'dgai')
const cee = read(ceeDir, 'cee')
const shared = []
const ceeOnly = cee.filter((c) => {
  const twin = dgai.find((d) => d.file === c.file)
  if (!twin) return true
  if (sqlOf(twin) !== sqlOf(c)) {
    console.error(`[migrations] ${c.file} is in both repos with DIFFERENT SQL; the hosted project ran only one`)
    process.exit(1)
  }
  shared.push(c.file)
  return false
})
const all = [...dgai, ...ceeOnly]
  .sort((a, b) => (a.ts === b.ts ? (a.repo === 'dgai' ? -1 : 1) : a.ts < b.ts ? -1 : 1))
for (const f of shared) console.log(`[migrations] ${f}: in both repos, same SQL (comments aside); applied once`)

// Same timestamp in both repos: give the later one a unique version, keeping order.
fs.mkdirSync(outDir, { recursive: true })
const seen = new Set()
const manifest = []
for (const m of all) {
  let ts = m.ts
  while (seen.has(ts)) ts = String(BigInt(ts) + 1n)
  seen.add(ts)
  const out = ts === m.ts ? m.file : m.file.replace(m.ts, ts)
  const why = NON_REPLAYABLE[m.file]
  const sql = fs.readFileSync(path.join(m.dir, m.file), 'utf8')
  fs.writeFileSync(path.join(outDir, out), why
    ? `SET session_replication_role = replica;\n${sql.trimEnd().replace(/;?$/, ';')}\nRESET session_replication_role;\n`
    : sql)
  manifest.push(`${out}\t${m.repo}${ts === m.ts ? '' : `\t(renumbered from ${m.ts})`}${why ? `\tNON-REPLAYABLE, FK off: ${why}` : ''}`)
}
fs.writeFileSync(path.join(outDir, '..', 'MIGRATION-ORDER.tsv'), [...manifest, ...shared.map((f) => `${f}\tshared (dgai copy applied)`)].join('\n') + '\n')
const count = (r) => all.filter((m) => m.repo === r).length
console.log(`[migrations] ${all.length} applied in order: dgai ${count('dgai')} + cee ${count('cee')} (+${shared.length} shared, applied once)`)
for (const f of Object.keys(NON_REPLAYABLE)) {
  if (!all.some((m) => m.file === f)) { console.error(`[migrations] NON_REPLAYABLE names ${f}, which no repo carries: stale list`); process.exit(1) }
  console.log(`[migrations] ${f}: NON-REPLAYABLE (${NON_REPLAYABLE[f]}), applied with FK triggers off`)
}
if (count('dgai') === 0 || count('cee') === 0) { console.error('[migrations] one repo contributed 0 migrations: wrong path'); process.exit(1) }
