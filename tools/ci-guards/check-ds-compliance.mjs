#!/usr/bin/env node
/**
 * check-ds-compliance.mjs — Design System v5 drift ratchet (Stage 2a).
 *
 * Occurrence-SIGNATURE ratchet (not a count-only gate). Each violation is keyed by
 * {class, file, offending-token} with a per-signature COUNT — there is NO line hash
 * (it was rejected as it produced a ~1.2 MB churny baseline; see sigKey). The gate
 * compares the current scan to a committed baseline and reports NET-NEW signatures
 * (counts above baseline). Because every (class, file, token) count is tracked
 * independently, a new violation in file B cannot be hidden by removing an old one in
 * file A — the brief's core requirement. Deliberate tradeoff: a within-file,
 * same-token add+remove is net-zero and is not flagged (it is not an "elsewhere" hide).
 *
 * ── Modes (Stage 2b: ENFORCING — the soak is over) ─────────────────────────
 *   (default)    Scan `src`, compare to baseline, PRINT net-new + summary, exit 0
 *                for detected violations. Retained for local inspection only.
 *                (A missing/corrupt baseline is a misconfiguration and ALWAYS
 *                exits 1 — even here.)
 *   --enforce    exit 1 if any net-new violation exists. THIS is what CI runs, in
 *                both ci.yml and — because only that one is required — the
 *                `tsc` job of staging-full-tests.yml, which the "Staging Gate"
 *                aggregator depends on.
 *   --update     Regenerate the baseline JSON from the current scan root. REFUSES
 *                to run if that would raise any gating signature's count: the
 *                ratchet may only move downward (see assertRatchetOnlyDescends).
 *   --force      With --update only: bless an increase anyway, printing every
 *                signature blessed. Never silent.
 *   --root <dir> Scan a different root (default `src`). Used by the self-test
 *                to point at the isolated fixtures; production always scans src.
 *   --json       Emit machine-readable summary.
 *
 * ── WHY THIS IS NOW ENFORCING (and was not for a month) ────────────────────
 * Stage 2a shipped report-only because the July soak surfaced 65 "net-new" hexes
 * that were ALL false positives — PR references such as `#739` in comment prose,
 * matched as 3-digit hex. The diagnosis was recorded and the guard was left
 * advisory rather than fixed, so from then on NO Design System rule gated
 * anything. The stripper is fixed (tools/ci-guards/lib/ds-token-context.mjs, with
 * the measurement and the false-negative controls in its header) and the guard is
 * promoted in the same change, in that order — promoting first would have turned
 * CI red on comments.
 *
 * The production gate scans `src/` ONLY. Deliberately-bad fixtures live under
 * tools/ci-guards/__fixtures__/ (outside src/) and are scanned only by the
 * guard's own test via --root — never by the production gate.
 *
 * Class modes:
 *   ratchet  — large existing debt; no NET-NEW allowed (baseline = current).
 *   report   — surfaced but never gates, even under --enforce (e.g. emoji,
 *              which spans fixtures/sandbox/debug and needs precise, deferred
 *              migration — see ds-compliance-report.md).
 */
import { promises as fs } from 'fs'
import path from 'path'
import { stripComments, isColourValuePosition, isAmbiguousNumericHex } from './lib/ds-token-context.mjs'

const ROOT = process.cwd()

// ── Emoji / unicode-symbol-as-icon detection (report-only) ──────────────────
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{FE0F}✅✔✖⚠❌✨✓✗]/u
const ICON_KEY = /\b(?:icon|symbol|glyph|emoji)\s*[:=]/

const LEGACY = /\b(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline|decoration|placeholder|caret|accent)-(?:sand|ink|paper|sun|mint|sky|carrot|lilac)\b/g
const HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g
const UPPERCASE = /\buppercase\b/g
const PANEL_TYPO = /\b(?:text-(?:xs|sm|base|lg|xl|2xl|3xl|5xl)|font-(?:medium|semibold|bold))\b/g

const isTest = (p) => /(\.spec\.|\.test\.|__tests__\/|__fixtures__\/)/.test(p)
const under = (p, dir) => p === dir || p.startsWith(dir + '/')

/**
 * Each class: how to decide file scope (inScope) and what tokens a line yields
 * (lineTokens). Returning [] means "no violation on this line".
 *
 * Exclusion policy — deliberately PER-CLASS, not global (documented so the contract
 * is explicit; see the exclusion fixtures in __fixtures__/ds-compliance/excluded):
 *  - Tests/fixtures (.spec/.test/__tests__/__fixtures__): excluded from ALL classes
 *    via isTest() — not product code.
 *  - components/debug, poc, canvas/theme dirs + var(--token,#hex) fallbacks: excluded
 *    ONLY from `production-hex` (brief scoping decision #1 — that dev/throwaway UI
 *    legitimately uses raw hex, and fallbacks are token-first). They are intentionally
 *    NOT excluded from legacy-token / uppercase / panel-typography / emoji: those drift
 *    types must not be (re)introduced anywhere, including dev tooling.
 *  - .css / .module.css: only `legacy-tailwind-token` scans .css at all; the other
 *    classes scan .ts/.tsx only, so CSS modules are excluded by extension.
 *  - Comments (line, block and JSX `{/* … *\/}`): excluded ONLY from `production-hex`,
 *    via `stripComments: true`. A hex in a comment is documentation, not usage. The
 *    other classes deliberately still scan comments: a `bg-sand` or `text-xs` written
 *    into a comment is a migration instruction that WILL be copied into code.
 *    Changing that would silently lower three baselines — do not "unify" it.
 */
const CLASSES = [
  {
    id: 'legacy-tailwind-token',
    mode: 'ratchet',
    description: 'Legacy colour tokens (sand/ink/paper/sun/mint/sky/carrot/lilac) as Tailwind classes',
    inScope: (p) => /\.(ts|tsx|css)$/.test(p) && !isTest(p),
    lineTokens: (line) => line.match(LEGACY) || [],
  },
  {
    id: 'production-hex',
    mode: 'ratchet',
    description: 'Raw hex colour literals in production .ts/.tsx (excl. debug/poc/theme/tests + var() fallbacks)',
    inScope: (p) =>
      /\.(ts|tsx)$/.test(p) && !isTest(p) &&
      !under(p, 'components/debug') && !under(p, 'poc') && !under(p, 'canvas/theme'),
    // Comments are NOT colour usage, and comment membership is multi-line STATE,
    // so this class is fed comment-blanked lines by stripComments() rather than
    // testing each line's prefix. See lib/ds-token-context.mjs for why a prefix
    // test cannot work and why "reject digit-only tokens" is measurably wrong.
    stripComments: true,
    lineTokens: (code) => {
      const out = []
      let m
      HEX.lastIndex = 0
      while ((m = HEX.exec(code)) !== null) {
        // Scoping decision #1: var(--token, #hex) fallbacks are excluded.
        // (stripComments preserves column offsets so this slice still aligns.)
        if (/var\(--[\w-]+,\s*$/.test(code.slice(0, m.index))) continue
        // A bare `#NNN` is either a colour or a PR/issue reference in a STRING
        // literal, which no comment stripper can reach. Settle it by POSITION:
        // a colour sits at the start of a value slot, a reference sits mid-prose.
        if (isAmbiguousNumericHex(m[0]) && !isColourValuePosition(code, m.index)) continue
        out.push(m[0].toUpperCase())
      }
      return out
    },
  },
  {
    id: 'uppercase-text',
    mode: 'ratchet',
    description: 'Styling-driven all-caps (uppercase class) — sentence case required (DS v5 §2)',
    inScope: (p) => /\.tsx$/.test(p) && !isTest(p),
    lineTokens: (line) => line.match(UPPERCASE) || [],
  },
  {
    id: 'panel-typography-scoped',
    mode: 'ratchet',
    description: 'Raw text-/font- utilities in panel scope — must use panelHeader/Body/Meta (DS v5 §2.4)',
    inScope: (p) =>
      !isTest(p) &&
      (under(p, 'components/results') || under(p, 'canvas/panels') ||
       p === 'canvas/ui/EdgeInspector.tsx'),
    lineTokens: (line) => line.match(PANEL_TYPO) || [],
  },
  {
    id: 'emoji-icon',
    mode: 'report', // never gates — precise migration is deferred (see report)
    description: 'Emoji / unicode-symbol used as a rendered icon (icon:/symbol:/glyph: with emoji)',
    inScope: (p) => /\.(ts|tsx)$/.test(p) && !isTest(p),
    lineTokens: (line) => {
      const s = line.trim()
      if (s.startsWith('//') || s.startsWith('*') || s.startsWith('/*')) return []
      if (s.includes('console.')) return []
      if (!ICON_KEY.test(line) || !EMOJI.test(line)) return []
      const m = line.match(EMOJI)
      return m ? [m[0]] : []
    },
  },
]

async function* walk(dir) {
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
  for (const ent of entries) {
    if (ent.name === 'node_modules' || ent.name === 'dist') continue
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) yield* walk(p)
    else yield p
  }
}

function sigKey(classId, relPath, token) {
  return `${classId} :: ${relPath} :: ${token}`
}

/** Scan a root dir → { [classId]: { total, byFile:{f:n}, signatures:{sig:{count,file,token,sample}} } } */
async function scan(rootDir) {
  const result = {}
  for (const c of CLASSES) result[c.id] = { total: 0, byFile: {}, signatures: {} }
  for await (const abs of walk(rootDir)) {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/')
    const scopeRel = path.relative(rootDir, abs).split(path.sep).join('/')
    let text
    try { text = await fs.readFile(abs, 'utf8') } catch { continue }
    const lines = text.split('\n')
    // Computed lazily and at most once per file; stripComments() returns exactly
    // one entry per source line (asserted below) so line indices stay shared
    // between the raw and stripped views — the raw line is what gets sampled.
    let stripped = null
    for (const c of CLASSES) {
      // Scope is decided on the path RELATIVE TO THE SCAN ROOT (scopeRel), so the
      // same class scopes work for production (root=src) and fixtures (root=fixture
      // dir mirroring the src layout). `rel` (repo-relative) is used only for the
      // human-readable file path and the occurrence signature.
      if (!c.inScope(scopeRel)) continue
      let scanLines = lines
      if (c.stripComments) {
        if (stripped === null) {
          stripped = stripComments(text)
          if (stripped.length !== lines.length) {
            throw new Error(`stripComments changed the line count for ${rel} (${stripped.length} vs ${lines.length}) — offsets would be wrong`)
          }
        }
        scanLines = stripped
      }
      for (let i = 0; i < scanLines.length; i++) {
        for (const token of c.lineTokens(scanLines[i])) {
          const sig = sigKey(c.id, rel, token)
          const bucket = result[c.id]
          bucket.total++
          bucket.byFile[rel] = (bucket.byFile[rel] || 0) + 1
          // Sample the RAW line, always: a blanked comment is unreadable, and the
          // sample is the only thing a human reviewing the baseline diff can see.
          if (!bucket.signatures[sig]) bucket.signatures[sig] = { count: 0, file: rel, token, sample: lines[i].trim().slice(0, 120) }
          bucket.signatures[sig].count++
        }
      }
    }
  }
  return result
}

/** Net-new = signatures (or counts) present now but above the baseline. */
function diff(current, baseline) {
  const netNew = {}
  for (const c of CLASSES) {
    const cur = current[c.id]?.signatures || {}
    const base = (baseline.classes?.[c.id]?.signatures) || {}
    const items = []
    for (const [sig, info] of Object.entries(cur)) {
      const baseCount = base[sig]?.count || 0
      if (info.count > baseCount) {
        items.push({ file: info.file, token: info.token, sample: info.sample, delta: info.count - baseCount })
      }
    }
    if (items.length) netNew[c.id] = { mode: c.mode, items }
  }
  return netNew
}

function fmtBaseline(current) {
  const classes = {}
  for (const c of CLASSES) {
    const b = current[c.id]
    // byFile sorted desc for human review
    const byFile = Object.fromEntries(Object.entries(b.byFile).sort((a, z) => z[1] - a[1]))
    classes[c.id] = { mode: c.mode, description: c.description, total: b.total, byFile, signatures: b.signatures }
  }
  return {
    _meta: {
      purpose: 'DS v5 drift ratchet baseline (Stage 2a). Net-new occurrence-signatures above these counts are flagged.',
      scanRoot: 'src',
      rollout: 'ENFORCING — CI runs --enforce in ci.yml and in staging-full-tests.yml`s `tsc` job, which the required "Staging Gate" check depends on.',
      regenerate: 'node tools/ci-guards/check-ds-compliance.mjs --update  (refuses to raise any gating signature count; --force blesses loudly)',
    },
    classes,
  }
}

/**
 * THE RATCHET MUST ONLY MOVE DOWNWARD.
 *
 * `--update` used to write the baseline unconditionally, with no assertion of any
 * kind — so real drift could be blessed by whoever ran it next, silently, and the
 * gate would then be green about the very violation it had just been taught to
 * accept. A ratchet you can wind backwards without saying so is not a ratchet.
 *
 * Mechanically: the new baseline IS the current scan, so "no gating signature's
 * count rises" is exactly "the current scan has no net-new in a gating class".
 * One check therefore covers both statements of the rule.
 *
 * SCOPE, stated honestly. This is UNCONDITIONAL whenever a baseline already
 * exists, and it is inherently like-for-like: it compares the current scan against
 * the very file it is about to overwrite. Two consequences worth knowing:
 *  - Bootstrapping (no readable baseline yet) has nothing to compare and is allowed,
 *    with a printed line saying so.
 *  - Re-pointing an existing baseline at a DIFFERENT --root is not like-for-like, so
 *    the assertion refuses. That is the intended answer, not a limitation: use
 *    --force, or a fresh baseline path.
 * What it does NOT cover: a change to a detector that makes it see LESS. That
 * lowers the baseline legitimately and is indistinguishable, mechanically, from
 * genuine debt repair — it stays a REVIEW obligation on the guard's own diff.
 */
function assertRatchetOnlyDescends(current, baseline, { force }) {
  const netNew = diff(current, baseline)
  const gaining = Object.entries(netNew).filter(([, v]) => v.mode === 'ratchet')
  if (!gaining.length) {
    console.log('DS-compliance --update: ratchet assertion PASSED — no gating signature count rises.')
    return
  }
  const total = gaining.reduce((s, [, v]) => s + v.items.reduce((n, i) => n + i.delta, 0), 0)
  const header = force ? 'DS-compliance --update: FORCED past the ratchet assertion' : 'DS-compliance --update: REFUSED'
  const log = force ? console.warn : console.error
  log(`\n${header} — ${total} occurrence(s) across ${gaining.length} gating class(es) would be RAISED:`)
  for (const [id, v] of gaining) {
    log(`  ${id}:`)
    for (const it of v.items) log(`    +${it.delta}  ${it.file}  ${it.token}  ${it.sample}`)
  }
  if (force) {
    console.warn('\nBlessed deliberately via --force. Every signature raised is listed above; put the justification in the commit message.')
    return
  }
  console.error('\nThe DS ratchet may only move DOWNWARD. Fix the violations above, or — if this')
  console.error('is a deliberate widening of a detector — re-run with `--update --force`, which')
  console.error('prints every signature it blesses so the change is reviewable in the diff.')
  process.exit(1)
}

async function main() {
  const args = process.argv.slice(2)
  const enforce = args.includes('--enforce')
  const update = args.includes('--update')
  const force = args.includes('--force')
  const asJson = args.includes('--json')
  const rootIdx = args.indexOf('--root')
  const scanRoot = rootIdx >= 0 ? args[rootIdx + 1] : 'src'
  // --baseline lets the fixture self-test point at an isolated baseline; the
  // production gate always uses the committed src baseline.
  const blIdx = args.indexOf('--baseline')
  const baselinePath = blIdx >= 0
    ? path.resolve(ROOT, args[blIdx + 1])
    : path.join(ROOT, 'tools/ci-guards/ds-compliance-baseline.json')

  // path.resolve (not join) so an absolute --root is honoured, not misresolved.
  const current = await scan(path.resolve(ROOT, scanRoot))

  if (update) {
    // Read the OUTGOING baseline first: the assertion is a comparison, so an
    // update that cannot see what it is replacing cannot be checked.
    let prev = null
    try { prev = JSON.parse(await fs.readFile(baselinePath, 'utf8')) } catch { /* bootstrap */ }
    if (prev === null) {
      console.log('DS-compliance --update: no readable existing baseline — bootstrapping, nothing to ratchet against.')
    } else {
      assertRatchetOnlyDescends(current, prev, { force })
    }
    await fs.writeFile(baselinePath, JSON.stringify(fmtBaseline(current), null, 2) + '\n')
    console.log('DS-compliance baseline written:', path.relative(ROOT, baselinePath))
    for (const c of CLASSES) console.log(`  ${c.id} (${c.mode}): ${current[c.id].total}`)
    return
  }

  // A missing/corrupt baseline is a guard MISCONFIGURATION, not DS debt, so it FAILS
  // unconditionally — even in report-only mode. Otherwise removing or breaking the
  // baseline file would silently drop the ratchet (a false negative). Report-only
  // applies only to detected violations, never to an absent/unreadable baseline.
  let baseline
  try {
    baseline = JSON.parse(await fs.readFile(baselinePath, 'utf8'))
  } catch (e) {
    console.error(`DS-compliance: baseline missing or unreadable at ${path.relative(ROOT, baselinePath)} — ${e?.message || e}`)
    console.error('This is a guard misconfiguration (not DS debt). Run `npm run ci:guard:ds:update` to regenerate.')
    process.exit(1)
  }

  const netNew = diff(current, baseline)
  const gating = Object.entries(netNew).filter(([, v]) => v.mode === 'ratchet')
  const reportOnly = Object.entries(netNew).filter(([, v]) => v.mode === 'report')

  if (asJson) { console.log(JSON.stringify({ netNew }, null, 2)); }
  else {
    console.log('\n[1m── Design System v5 compliance ratchet ──[0m')
    for (const c of CLASSES) {
      const cur = current[c.id]?.total ?? 0
      const base = baseline.classes?.[c.id]?.total ?? 0
      const delta = cur - base
      const tag = c.mode === 'report' ? 'report' : 'ratchet'
      const mark = delta > 0 && c.mode === 'ratchet' ? '[31m▲' : (delta < 0 ? '[32m▼' : ' ')
      console.log(`  ${mark} ${c.id} [${tag}]: ${cur} (baseline ${base}, Δ${delta >= 0 ? '+' : ''}${delta})[0m`)
    }
    if (gating.length) {
      console.log('\n[31mNET-NEW violations (would block under --enforce):[0m')
      for (const [id, v] of gating) {
        console.log(`  ${id}:`)
        for (const it of v.items.slice(0, 25)) console.log(`    ${it.file}  ${it.token}  ${it.sample}`)
        if (v.items.length > 25) console.log(`    … +${v.items.length - 25} more`)
      }
    }
    if (reportOnly.length) {
      console.log('\n[33mNet-new in report-only classes (never blocks):[0m')
      for (const [id, v] of reportOnly) console.log(`  ${id}: +${v.items.reduce((s, i) => s + i.delta, 0)}`)
    }
    if (!gating.length) console.log('\n[32m✓ No net-new ratcheted violations vs baseline.[0m')
  }

  if (enforce && gating.length) {
    console.error(`\nDS-compliance ENFORCE: ${gating.length} class(es) have net-new violations.`)
    process.exit(1)
  }
  // Soak / report-only default: never blocks.
  process.exit(0)
}

main().catch((e) => { console.error('check-ds-compliance crashed:', e?.message || e); process.exit(1) })
