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
 * ── Modes (Stage 2a ships REPORT-ONLY / soak) ──────────────────────────────
 *   (default)    Scan `src`, compare to baseline, PRINT net-new + summary, exit 0
 *                for detected violations. This is the soak rollout: it surfaces drift
 *                without blocking pushes. A follow-up flips the default to --enforce
 *                once the baseline has soaked. (A missing/corrupt baseline is a
 *                misconfiguration and ALWAYS exits 1 — even here.)
 *   --enforce    exit 1 if any net-new violation exists. Used by the guard's
 *                own fixture self-test to PROVE the ratchet/hard-fail logic,
 *                and by the future promotion to a blocking gate.
 *   --update     Regenerate the baseline JSON from the current scan root.
 *   --root <dir> Scan a different root (default `src`). Used by the self-test
 *                to point at the isolated fixtures; production always scans src.
 *   --json       Emit machine-readable summary.
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
    lineTokens: (line) => {
      const out = []
      let m
      HEX.lastIndex = 0
      while ((m = HEX.exec(line)) !== null) {
        // Scoping decision #1: var(--token, #hex) fallbacks are excluded.
        if (/var\(--[\w-]+,\s*$/.test(line.slice(0, m.index))) continue
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
    for (const c of CLASSES) {
      // Scope is decided on the path RELATIVE TO THE SCAN ROOT (scopeRel), so the
      // same class scopes work for production (root=src) and fixtures (root=fixture
      // dir mirroring the src layout). `rel` (repo-relative) is used only for the
      // human-readable file path and the occurrence signature.
      if (!c.inScope(scopeRel)) continue
      for (const line of lines) {
        for (const token of c.lineTokens(line)) {
          const sig = sigKey(c.id, rel, token, line)
          const bucket = result[c.id]
          bucket.total++
          bucket.byFile[rel] = (bucket.byFile[rel] || 0) + 1
          if (!bucket.signatures[sig]) bucket.signatures[sig] = { count: 0, file: rel, token, sample: line.trim().slice(0, 120) }
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
      rollout: 'report-only / soak — production gate prints but does not block; promote to --enforce in a follow-up.',
      regenerate: 'node tools/ci-guards/check-ds-compliance.mjs --update',
    },
    classes,
  }
}

async function main() {
  const args = process.argv.slice(2)
  const enforce = args.includes('--enforce')
  const update = args.includes('--update')
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
