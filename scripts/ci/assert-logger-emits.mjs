#!/usr/bin/env node
// scripts/ci/assert-logger-emits.mjs
// =============================================================================
// Fails the build if `src/lib/logger.ts` was compiled into a NO-OP.
// =============================================================================
//
// WHAT SHIPPED, AND WHY NOTHING CAUGHT IT
// ---------------------------------------
// On 2026-08-27 the deployed staging build (18727b64) carried this as the whole
// of the application logger:
//
//     Wc = { debug:(...e)=>{Hc("debug")}, info:(...e)=>{Hc("info")},
//            warn:(...e)=>{Hc("warn")},   error:(...e)=>{Hc("error")},
//            getLevel:()=>zc }
//
// Every method evaluated its level gate, discarded the result, and returned.
// The source was correct — `logger.warn` ends in `console.warn('[WARN]', ...)`.
// Production strips console CALL EXPRESSIONS twice, independently:
//
//     vite.config.ts:157  build.minify: 'terser'
//     vite.config.ts:160  build.terserOptions.compress.drop_console: true
//     vite.config.ts:193  esbuild.drop: mode === 'production' ? [...] : undefined
//
// The consequence was not "logs were missing". It was that a fence which FIRED
// and a fence which did not were INDISTINGUISHABLE on a deployed build, so a
// Core acceptance criterion could not be witnessed at all.
//
// ⚠ THE REASON THIS GUARD SCANS BUILD OUTPUT AND NOT SOURCE.
// A source-level spec CANNOT see this defect. A jsdom test asserting
// `logger.warn` calls `console.warn` would have passed green through the entire
// life of the bug, because vitest never runs the production minify pipeline.
// Reviewers looked at the source, and the source was fine. The defect existed
// only in the emitted artefact, so only an assertion against the emitted
// artefact can hold it closed. That is the whole point of this file.
//
// WHAT THIS GUARD CAN SEE
//   · That each of debug/info/warn/error survives into `dist/` as a real CALL
//     whose first argument is that level's own tag literal.
//   · That the strip is still doing its job for everything else: zero
//     bare-`console`-rooted call expressions anywhere in `dist/`.
//
// WHAT THIS GUARD CANNOT SEE — state it, do not imply coverage
//   · Whether the sink actually reaches a human. It proves a call EXISTS in the
//     artefact, not that a browser console received it. That is a live witness's
//     job, not a build guard's.
//   · Whether the LEVEL configuration is right. `VITE_LOG_LEVEL` and the
//     prod-default `warn` are runtime concerns; a correctly-emitting logger set
//     to `error` still says nothing at `warn`. Unchanged by this guard.
//   · Any logging path that does not route through `src/lib/logger.ts`.
//   · Whether the message CONTENT is correct or safe. Field-level review is a
//     human job; this only asserts the pipe is open.
//   · Netlify's own deploy build. This runs in CI on the artefact CI produced.
//     A divergence between CI's build and Netlify's would be invisible here.
//
// ANTI-VACUITY (CLAUDE.md trap 13)
//   · `collectChunks` THROWS on zero files and on zero total bytes. An empty
//     `dist/` can never be reported as clean — that is exactly the shape an
//     ENOSPC or a skipped build takes, and it must be a hard error.
//   · `selfTest()` runs on EVERY invocation, before any verdict, with a CONTRAST
//     PAIR: a live shape MUST be detected, and both a dead shape and a
//     tag/method MISMATCH must NOT be. Without the contrast half, a detector
//     that matches everything passes every positive control and is
//     indistinguishable from a strict one.
//
// IDENTITY BINDING (CLAUDE.md trap 19)
// The emission check does not merely look for `[WARN]` somewhere in the bundle.
// It requires the tag to sit in FIRST-ARGUMENT position of a call whose METHOD
// NAME matches that tag (`.warn("[WARN]"`). A stray `[WARN]` in unrelated copy,
// or a `.warn("[ERROR]"` transposition, does not satisfy it.
//
// POSTURE: BLOCKING, in the `build` job of "Staging Gate".
// `staging` branch protection requires exactly ONE check, "Staging Gate", whose
// `needs` includes `build`. This runs after `pnpm run build` in that job, so it
// scans the artefact that job just produced and its failure fails the gate.
//   Derived 2026-08-28:
//     gh api repos/Talchain/DecisionGuideAI/branches/staging/protection \
//       --jq '.required_status_checks.contexts'   → ["Staging Gate"]
//   Re-derive before assuming this is still where the blocking happens.
// Deliberately NOT wired into `build:ci` (what Netlify runs): a false red must
// gate the MERGE, never break the staging DEPLOY for every lane.
// =============================================================================

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(HERE, '../..')

/** The artefact class this guard covers. Printed on every run — a reader must
 *  never have to assume what was scanned. */
const SCANNABLE = /\.(js|mjs|cjs)$/i
export const SCANNED_CLASS = 'dist/**/*.{js,mjs,cjs}'

/** The four levels, and the tag literal each one must carry into the bundle. */
export const LEVELS = /** @type {const} */ (['debug', 'info', 'warn', 'error'])

/**
 * A call whose method is a log level and whose FIRST argument is a tag literal.
 * Accepts optional-call (`x?.warn(`) and plain (`x.warn(`) — `target: 'esnext'`
 * preserves `?.` today, but a target change must not silently blind the guard.
 */
const EMISSION = /(?:\?\.|\.)\s*(debug|info|warn|error)\s*\(\s*(["'])\[(DEBUG|INFO|WARN|ERROR)\]\2/g

/**
 * A call expression rooted at the BARE global `console`. `window.console.log(…)`
 * and `x.console.log(…)` are deliberately excluded: a namespaced console call is
 * how a dependency legitimately survives the strip, and two such calls (PostHog)
 * are present in every build of this app.
 */
const BARE_CONSOLE = /(?<![.\w$])console\s*\.\s*(?:log|warn|error|info|debug)\s*\(/g

/** Thrown when a scan had nothing to assert against. Never swallow this. */
export class VacuousScanError extends Error {}

/** Every scannable file under `dir`, recursively. */
export function collectFiles(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) collectFiles(full, out)
    else if (SCANNABLE.test(full)) out.push(full)
  }
  return out
}

/**
 * Which levels emit in this text, bound by IDENTITY (method name must equal tag).
 * @returns {{ emitting: Set<string>, mismatches: Array<{method:string, tag:string}> }}
 */
export function scanEmission(text) {
  const emitting = new Set()
  const mismatches = []
  EMISSION.lastIndex = 0
  let m
  while ((m = EMISSION.exec(text)) !== null) {
    const method = m[1]
    const tag = m[3]
    if (method.toUpperCase() === tag) emitting.add(method)
    else mismatches.push({ method, tag })
  }
  return { emitting, mismatches }
}

/** How many bare-`console`-rooted call expressions this text contains. */
export function countBareConsole(text) {
  BARE_CONSOLE.lastIndex = 0
  return (text.match(BARE_CONSOLE) || []).length
}

/**
 * Read every chunk.
 * @throws {VacuousScanError} on zero files, or on files totalling zero bytes.
 */
export function collectChunks(distDir) {
  const files = collectFiles(distDir)
  if (files.length === 0) {
    throw new VacuousScanError(
      `No ${SCANNED_CLASS} found under ${distDir}. An empty scan cannot be a pass — ` +
        `did the build run, or did it fail (ENOSPC prints a clean-looking tail)?`
    )
  }
  const chunks = files.map((file) => ({ file, text: readFileSync(file, 'utf8') }))
  const bytes = chunks.reduce((n, c) => n + c.text.length, 0)
  if (bytes === 0) {
    throw new VacuousScanError(
      `${files.length} chunk(s) under ${distDir} totalling ZERO bytes. Refusing to pass.`
    )
  }
  return { chunks, bytes }
}

/**
 * Prove the detector is alive HERE — this Node, this file, this run — before any
 * verdict. A detector that has silently stopped matching is otherwise
 * indistinguishable from a healthy bundle.
 * @throws {Error} if any control disagrees.
 */
export function selfTest() {
  // POSITIVE: the shape a working logger compiles to.
  const live = 'ju={warn:(...e)=>{Au("warn")&&Cu?.warn("[WARN]",...e)}}'
  if (!scanEmission(live).emitting.has('warn')) {
    throw new Error('selfTest: live emission shape NOT detected — detector is blind.')
  }

  // CONTRAST 1: the exact dead shape that shipped. Must NOT be detected.
  const dead = 'Wc={warn:(...e)=>{Hc("warn")},error:(...e)=>{Hc("error")}}'
  if (scanEmission(dead).emitting.size !== 0) {
    throw new Error('selfTest: dead no-op shape WAS detected — detector matches anything.')
  }

  // CONTRAST 2: identity binding. A tag in the wrong method must not satisfy it.
  const transposed = 'x?.warn("[ERROR]",...e)'
  const t = scanEmission(transposed)
  if (t.emitting.size !== 0 || t.mismatches.length !== 1) {
    throw new Error('selfTest: tag/method mismatch not rejected — binding is by value, not identity.')
  }

  // CONTRAST 3: the tag alone, with no call, must not satisfy it.
  if (scanEmission('const s="[WARN] something"').emitting.size !== 0) {
    throw new Error('selfTest: a bare tag literal satisfied the emission check.')
  }

  // NARROWNESS controls: bare console caught, namespaced console spared.
  if (countBareConsole('console.warn("x")') !== 1) {
    throw new Error('selfTest: bare console call NOT counted — narrowness check is blind.')
  }
  if (countBareConsole('window.console.warn("x")') !== 0) {
    throw new Error('selfTest: namespaced console call WAS counted — narrowness check over-matches.')
  }
}

/**
 * CLI entry.
 * @returns {number} process exit code (0 pass, 1 fail)
 */
export function run({ distDir, log = console.log, err = console.error }) {
  selfTest()

  const { chunks, bytes } = collectChunks(distDir)
  log(`scanned: ${SCANNED_CLASS}  (${chunks.length} chunks, ${bytes} bytes)`)

  const emitting = new Set()
  const mismatches = []
  let bare = 0
  const bareFiles = []
  for (const c of chunks) {
    for (const lvl of scanEmission(c.text).emitting) emitting.add(lvl)
    for (const mm of scanEmission(c.text).mismatches) mismatches.push({ ...mm, file: c.file })
    const n = countBareConsole(c.text)
    if (n > 0) {
      bare += n
      bareFiles.push(`${path.relative(distDir, c.file)} (${n})`)
    }
  }

  let failed = false

  const missing = LEVELS.filter((l) => !emitting.has(l))
  if (missing.length > 0) {
    failed = true
    err('')
    err(`FAIL: the application logger is a NO-OP in the emitted bundle.`)
    err(`  levels with no surviving emission: ${missing.join(', ')}`)
    err(`  levels that do emit:               ${[...emitting].join(', ') || '(none)'}`)
    err('')
    err(`  The level gate still evaluates; the call it guards has been removed at`)
    err(`  build time. On such a build a fence that fired and a fence that did not`)
    err(`  are indistinguishable, so no logged behaviour can be witnessed at all.`)
    err('')
    err(`  Most likely cause: an emission in src/lib/logger.ts was written as a bare`)
    err(`  \`console.x(...)\` again. Production strips those twice — see the comment`)
    err(`  at the top of src/lib/logger.ts. Route it through the module's sink.`)
  } else {
    log(`emission: all ${LEVELS.length} levels emit (${LEVELS.join(', ')})`)
  }

  if (mismatches.length > 0) {
    log(`note: ${mismatches.length} tag/method mismatch(es) seen and ignored — ` +
        mismatches.map((m) => `.${m.method}("[${m.tag}]")`).join(', '))
  }

  if (bare > 0) {
    failed = true
    err('')
    err(`FAIL: ${bare} bare \`console.*\` call expression(s) survived into the bundle.`)
    err(`  ${bareFiles.join('\n  ')}`)
    err('')
    err(`  The production console strip exists so developer chatter and any payload`)
    err(`  passed to it never reach a user — this repo is PUBLIC. The logger's own`)
    err(`  sink is exempt BY DESIGN and BY NARROW MEANS (it is not rooted at the`)
    err(`  global \`console\`). If this fired because someone relaxed`)
    err(`  \`drop_console\` or \`esbuild.drop\` in vite.config.ts to fix logging,`)
    err(`  that is the wrong fix: it ships every stray console.log in the codebase.`)
  } else {
    log(`narrowness: 0 bare-console call expressions (strip still active)`)
  }

  return failed ? 1 : 0
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const distDir = path.join(ROOT, 'dist')
  let code
  try {
    code = run({ distDir })
  } catch (e) {
    console.error(`FAIL: ${e instanceof VacuousScanError ? 'vacuous scan' : 'error'} — ${e.message}`)
    code = 1
  }
  process.exit(code)
}
