#!/usr/bin/env node
/**
 * WHAT MOVED — every linux reference that changed in a re-bless, named, counted
 * in pixels, and written loudly into the step summary.
 *
 * This exists because of the one real objection to refreshing references
 * automatically: a regression merged to `staging` becomes the new reference and
 * stops being flagged. That trade-off was taken deliberately (the PR job is what
 * catches it, against references at most one commit old), and it is only
 * defensible if the adoption is VISIBLE. A silent auto-bless is the defect the
 * whole exercise is about, so this script refuses to let one happen quietly:
 * it names every image, prints the pixel count, writes a diff image, and says
 * how many multiples of the tolerance each change is.
 *
 * ⛔ IT IS ALSO THE POSTCONDITION GATE, AND THAT IS ITS MORE IMPORTANT JOB.
 * A re-bless run's EXIT CODE cannot be the gate: under `VISREG_BLESS=1` the
 * harness's own self-test is expected to fail (`updateSnapshots: 'all'` makes
 * `toHaveScreenshot` WRITE where the self-test asserts it THROWS), so a run that
 * wrote all ten references correctly still exits non-zero. The gate is derived
 * instead, and it fails CLOSED:
 *
 *   1. the capture manifest must exist — the caller DELETES it before blessing,
 *      so a bless that never ran cannot look like "nothing moved";
 *   2. the manifest must name EXACTLY the committed reference set, both
 *      directions — a short run (six states captured, four stale) is refused;
 *   3. a reference may only be UPDATED, never added or removed. Adding one is a
 *      new claim about the product and stays a human decision;
 *   4. every rewritten reference must clear a byte floor, so a blank or
 *      truncated capture can never be adopted.
 *
 * The self-test writes `__selftest-blank.png` and `__selftest-nearly-uniform.png`
 * into the reference directory and unlinks them in a `finally`. A hard crash
 * leaves one behind, so they are reported and NEVER staged — which is also why
 * the caller stages the file list this script emits rather than `git add <dir>`.
 *
 * Usage:
 *   node scripts/visual/reference-delta.mjs \
 *     --before <dir> --after <dir> --manifest <file> \
 *     --diff-out <dir> --json <file> --changed-files <file> [--summary <file>]
 *
 * Exit codes: 0 decided (see `changed` in the JSON) · 2 refused, nothing adopted.
 */

import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// pngjs and pixelmatch are CommonJS. `createRequire` is used rather than a bare
// `import` so this does not depend on named-export detection working for either.
const require = createRequire(import.meta.url)
const { PNG } = require('pngjs')
const pixelmatch = require('pixelmatch')

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const HARNESS = join(REPO_ROOT, 'e2e', 'visual', 'harness.ts')
const REFERENCE_DIR_REL = 'e2e/visual/references/linux'
/** A PNG smaller than this is not a screenshot of this product. Mirrors the floor the harness asserts. */
const BYTE_FLOOR = 8_000
const SELFTEST_FIXTURE = /^__selftest-/

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i]
    if (!k?.startsWith('--')) die(`unexpected argument "${k}"`)
    out[k.slice(2)] = argv[i + 1]
  }
  for (const required of ['before', 'after', 'manifest', 'diff-out', 'json', 'changed-files']) {
    if (!out[required]) die(`--${required} is required`)
  }
  return out
}

function die(message) {
  process.stderr.write(`reference-delta: ${message}\n`)
  process.exit(2)
}

/**
 * The tolerance constants are DERIVED from the harness, never copied. A second
 * hand-maintained copy of a number is how a report starts describing a
 * threshold the harness no longer uses (CLAUDE.md trap 12), and the failure
 * would be silent — the ratios would simply be scaled against the wrong bar.
 */
function harnessConstants() {
  if (!existsSync(HARNESS)) die(`cannot read ${HARNESS} — the tolerance constants are derived from it, not copied`)
  const src = readFileSync(HARNESS, 'utf8')
  const threshold = src.match(/export const PIXEL_THRESHOLD\s*=\s*([0-9.]+)/)
  const ratio = src.match(/export const MAX_DIFF_PIXEL_RATIO\s*=\s*([0-9.]+)/)
  if (!threshold || !ratio) {
    die('could not read PIXEL_THRESHOLD / MAX_DIFF_PIXEL_RATIO from e2e/visual/harness.ts — they were renamed or moved')
  }
  return { pixelThreshold: Number(threshold[1]), maxDiffPixelRatio: Number(ratio[1]) }
}

const pngNames = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .map((f) => f.slice(0, -4))
    .sort()

function main() {
  const args = parseArgs(process.argv.slice(2))
  const { pixelThreshold, maxDiffPixelRatio } = harnessConstants()
  const lines = []
  const say = (s = '') => lines.push(s)

  const flush = (code) => {
    const text = `${lines.join('\n')}\n`
    process.stdout.write(text)
    if (args.summary) appendFileSync(args.summary, text, 'utf8')
    process.exit(code)
  }

  if (!existsSync(args.before)) die(`--before ${args.before} does not exist`)
  if (!existsSync(args.after)) die(`--after ${args.after} does not exist`)

  const committed = pngNames(args.before)
  const produced = pngNames(args.after)
  const strays = produced.filter((n) => !committed.includes(n))
  const selftestStrays = strays.filter((n) => SELFTEST_FIXTURE.test(n))
  const realStrays = strays.filter((n) => !SELFTEST_FIXTURE.test(n))
  const vanished = committed.filter((n) => !produced.includes(n))

  say('### 🖼 Linux visual references — auto-refresh')
  say('')

  // ── Gate 1: the manifest proves this run captured, and captured everything ──
  if (!existsSync(args.manifest)) {
    say('**REFUSED — no capture manifest.** The re-bless run did not reach `globalSetup`, or did not run at all.')
    say('')
    say('The caller deletes the manifest before blessing precisely so that "the bless never ran" cannot')
    say('be reported as "nothing moved". Nothing has been adopted.')
    flush(2)
  }
  const captured = readFileSync(args.manifest, 'utf8')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()

  const notCaptured = committed.filter((n) => !captured.includes(n))
  const notCommitted = captured.filter((n) => !committed.includes(n))
  if (captured.length === 0 || notCaptured.length > 0 || notCommitted.length > 0) {
    say('**REFUSED — the run did not capture the committed set.** Nothing has been adopted.')
    say('')
    say('```')
    say(`captured  ${captured.length}: ${captured.join(', ') || '(none)'}`)
    say(`committed ${committed.length}: ${committed.join(', ')}`)
    if (notCaptured.length) say(`NOT CAPTURED  ${notCaptured.join(', ')}   ← these references would have gone stale silently`)
    if (notCommitted.length) say(`NOT COMMITTED ${notCommitted.join(', ')}  ← a NEW state: adding a reference is a human decision`)
    say('```')
    say('')
    say('A partial re-bless would leave some references describing this commit and others describing an')
    say('older one — a reference set that is internally inconsistent is worse than one that is uniformly stale.')
    flush(2)
  }

  // ── Gate 2: update only. Adding or removing a reference stays a human act ──
  if (realStrays.length > 0 || vanished.length > 0) {
    say('**REFUSED — the reference SET changed, not just its contents.** Nothing has been adopted.')
    say('')
    say('```')
    if (realStrays.length) say(`ADDED    ${realStrays.join(', ')}`)
    if (vanished.length) say(`REMOVED  ${vanished.join(', ')}`)
    say('```')
    say('')
    say('This job refreshes references that already exist. Adding one is a new claim about what the')
    say('product should look like: bless it locally, look at the image, and commit it yourself')
    say('(`scripts/visual/rebless.sh`, then `e2e/visual/README.md`).')
    flush(2)
  }

  // ── The measurement ────────────────────────────────────────────────────────
  mkdirSync(args['diff-out'], { recursive: true })
  const changed = []
  const unchanged = []

  for (const name of committed) {
    const beforePath = join(args.before, `${name}.png`)
    const afterPath = join(args.after, `${name}.png`)
    const beforeBuf = readFileSync(beforePath)
    const afterBuf = readFileSync(afterPath)

    // A blank or truncated capture must never be adopted. The harness asserts
    // this itself after every blessed write; asserted again here because a
    // harness that died mid-run did not assert it for the states it never reached.
    if (statSync(afterPath).size < BYTE_FLOOR) {
      say(`**REFUSED — \`${name}\` was rewritten as ${statSync(afterPath).size} bytes**, below the ${BYTE_FLOOR}-byte floor.`)
      say('')
      say('That is not a screenshot of this product. Nothing has been adopted.')
      flush(2)
    }

    if (beforeBuf.equals(afterBuf)) {
      unchanged.push(name)
      continue
    }

    const before = PNG.sync.read(beforeBuf)
    const after = PNG.sync.read(afterBuf)

    if (before.width !== after.width || before.height !== after.height) {
      changed.push({
        name,
        resized: true,
        from: `${before.width}x${before.height}`,
        to: `${after.width}x${after.height}`,
        diffPixels: null,
        totalPixels: after.width * after.height,
        ratio: null,
      })
      continue
    }

    const diff = new PNG({ width: before.width, height: before.height })
    const diffPixels = pixelmatch(before.data, after.data, diff.data, before.width, before.height, {
      threshold: pixelThreshold,
    })
    writeFileSync(join(args['diff-out'], `${name}.diff.png`), PNG.sync.write(diff))
    writeFileSync(join(args['diff-out'], `${name}.before.png`), beforeBuf)
    writeFileSync(join(args['diff-out'], `${name}.after.png`), afterBuf)
    const totalPixels = before.width * before.height
    changed.push({ name, resized: false, diffPixels, totalPixels, ratio: diffPixels / totalPixels })
  }

  // ── The loud summary ───────────────────────────────────────────────────────
  if (changed.length === 0) {
    say('**No reference moved.** The committed linux references already describe this commit.')
    say('')
    say(`Checked ${committed.length} references, byte-for-byte, against a fresh capture on this runner.`)
  } else {
    say(`**${changed.length} of ${committed.length} references changed and have been ADOPTED as the new baseline.**`)
    say('')
    say('⚠ Every pixel listed below is now the reference. If one of these changes is a regression, it')
    say('will not be flagged again — it is the baseline from this commit onward. **Look at the diffs in')
    say('the `visual-reference-delta-linux` artefact.** The defence against adopting a regression is the')
    say('PR job, which compares against references at most one commit old; this summary is the record.')
    say('')
    say('| reference | pixels changed | of total | × tolerance |')
    say('|---|---:|---:|---:|')
    for (const c of changed) {
      if (c.resized) {
        say(`| \`${c.name}\` | **RESIZED** ${c.from} → ${c.to} | — | — |`)
        continue
      }
      const pct = (c.ratio * 100).toFixed(4)
      const multiples = (c.ratio / maxDiffPixelRatio).toFixed(1)
      say(`| \`${c.name}\` | ${c.diffPixels.toLocaleString('en-GB')} | ${pct}% of ${c.totalPixels.toLocaleString('en-GB')} | ${multiples}× |`)
    }
    say('')
    const totalDiff = changed.reduce((n, c) => n + (c.diffPixels ?? 0), 0)
    say(`Tolerance is \`maxDiffPixelRatio = ${maxDiffPixelRatio}\` (${(maxDiffPixelRatio * 100).toFixed(2)}%), pixel threshold \`${pixelThreshold}\` — both read from \`e2e/visual/harness.ts\`, not copied.`)
    say(`Total pixels adopted: **${totalDiff.toLocaleString('en-GB')}**.`)
  }

  if (unchanged.length > 0) {
    say('')
    say(`Unchanged: ${unchanged.map((n) => `\`${n}\``).join(', ')}.`)
  }

  if (selftestStrays.length > 0) {
    say('')
    say(`⚠ Left behind by the self-test and NOT staged: ${selftestStrays.map((n) => `\`${n}\``).join(', ')}.`)
    say('These fixtures are written into the reference directory and unlinked in a `finally`; one surviving')
    say('means a self-test crashed hard. It is never committed, but it is worth knowing about.')
  }

  writeFileSync(
    args.json,
    `${JSON.stringify({ changed, unchanged, selftestStrays, maxDiffPixelRatio, pixelThreshold }, null, 2)}\n`,
    'utf8',
  )
  writeFileSync(args['changed-files'], changed.map((c) => `${REFERENCE_DIR_REL}/${c.name}.png`).join('\n') + (changed.length ? '\n' : ''), 'utf8')

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed.length}\n`, 'utf8')
  }

  flush(0)
}

main()
