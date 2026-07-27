#!/usr/bin/env node
/**
 * Regenerate the claim-ownership drift baseline.
 *
 *   node tools/ci-guards/update-claim-drift-baseline.mjs            # write + print diff
 *   node tools/ci-guards/update-claim-drift-baseline.mjs --check    # print only, exit 1 on drift
 *
 * THE ESCAPE HATCH, HONESTLY NAMED. There is no env var and no silent bypass:
 * accepting drift means running this command in the same PR, which puts the new
 * rows in the diff where review happens. It prints the delta so the PR body can
 * quote it.
 *
 * ⚠ IT CARRIES NO DETECTION LOGIC OF ITS OWN. Discovery, the regexes, the
 * sanctioned-chain rule and the file format all live in
 * `src/test/claimDrift/claimDriftWalker.ts` — the SAME module the gate imports —
 * and are loaded here through Vite's SSR loader so this script can run that
 * TypeScript unmodified. A generator with its own copy of the rules is a mirror
 * of the gate, and a mirror that drifts writes a baseline the gate then treats
 * as truth. There is exactly one implementation; this file is a driver.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createServer } from 'vite'

const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim()

const CHECK_ONLY = process.argv.includes('--check')
const UNKNOWN = process.argv.slice(2).filter((a) => a !== '--check')
if (UNKNOWN.length > 0) {
  console.error(`usage: node tools/ci-guards/update-claim-drift-baseline.mjs [--check]`)
  process.exit(2)
}

const server = await createServer({
  configFile: false,
  root: REPO_ROOT,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null },
})

let exitCode = 0
try {
  const engine = await server.ssrLoadModule('/src/test/claimDrift/claimDriftWalker.ts')

  const all = engine.trackedSourceFiles()
  const prod = engine.productionFiles(all)

  // The same floor the gate asserts. A generator that writes an empty baseline
  // because it saw an empty tree would hand the gate a green lie, permanently.
  if (prod.length <= engine.MIN_PROD_FILES) {
    throw new Error(
      `Only ${prod.length} production source files found (floor: ${engine.MIN_PROD_FILES}). ` +
        `Refusing to write a baseline from a vacuous scan.`,
    )
  }

  const families = await engine.discoverFamilies(all)
  if (families.length === 0) {
    throw new Error('No claim families discovered — refusing to write a baseline that polices nothing.')
  }

  const { rows } = engine.walk(families, prod)
  const next = engine.renderBaseline(rows)
  const path = engine.BASELINE_PATH
  const prev = existsSync(path) ? readFileSync(path, 'utf8') : null

  const summarise = (text) => {
    if (text === null) return new Map()
    const m = new Map()
    for (const line of text.split('\n')) {
      if (/^\s*(#|$)/.test(line)) continue
      const [c, family, rel] = line.split('\t')
      m.set(`${family}\t${rel}`, c)
    }
    return m
  }
  const before = summarise(prev)
  const after = summarise(next)

  const changes = []
  for (const [k, v] of after) {
    if (!before.has(k)) changes.push(`+ ${v}\t${k}`)
    else if (before.get(k) !== v) changes.push(`~ ${before.get(k)} → ${v}\t${k}`)
  }
  for (const k of before.keys()) if (!after.has(k)) changes.push(`- (removed)\t${k}`)
  changes.sort()

  console.log(`families discovered: ${families.length}`)
  for (const f of families) {
    const own = rows.filter((r) => r.family === f.family)
    const violating = own.filter((r) => !r.exempt)
    const exemptRows = own.filter((r) => r.exempt)
    const hits = violating.reduce((s, r) => s + r.count, 0)
    const suppressed = exemptRows.reduce((s, r) => s + r.count, 0)
    console.log(
      `  ${f.family.padEnd(20)} owner=${f.ownerRel}  ` +
        `chooser=${f.callInstead ?? 'NONE (frozen debt)'}  ` +
        `${violating.length} file(s) / ${hits} hit(s)  ` +
        `+ ${exemptRows.length} attested producer(s) suppressing ${suppressed} read(s)`,
    )
  }
  console.log(`scanned: ${prod.length} production files of ${all.length} tracked`)

  if (changes.length === 0) {
    console.log('\nbaseline unchanged.')
  } else {
    console.log(`\nbaseline delta (${changes.length} row(s)):`)
    for (const c of changes) console.log(`  ${c}`)
    exitCode = CHECK_ONLY ? 1 : 0
  }

  if (!CHECK_ONLY && prev !== next) {
    writeFileSync(path, next, 'utf8')
    console.log(`\nwrote ${path}`)
  }
} catch (err) {
  console.error(`\nclaim-drift baseline generation FAILED: ${err && err.message ? err.message : err}`)
  exitCode = 1
} finally {
  await server.close()
}

process.exit(exitCode)
