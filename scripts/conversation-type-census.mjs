#!/usr/bin/env node
/**
 * Conversation-panel type census (lane F3 — one type scale).
 *
 * Enumerates every distinct font-size / font-weight / line-height that reaches
 * the conversation panel and the V5 block renderers, across every mechanism:
 *
 *   1. tailwind — text-* / font-* / leading-* utility classes in source
 *   2. token    — typography.X / typo('X') references, RESOLVED by parsing
 *                 src/styles/typography.ts at run time (derived, never mirrored)
 *   3. css      — raw declarations in Conversation.module.css (and any other
 *                 .css file in scope), with var(--conv-type-*) indirection
 *                 resolved against the definitions in the same file
 *   4. inline   — fontSize / fontWeight / lineHeight in JSX style objects
 *
 * Output: one line per (value, mechanism, file:line) hit, then the distinct
 * size / weight / line-height sets. `--json` emits a machine-readable summary
 * consumed by tests/ci-guards/conversation-type-census.spec.ts.
 *
 * FAIL-LOUD RULES (trap-12: a silent gap in a census is worse than no census):
 *   - unknown named text-* size class            → error
 *   - `font:` shorthand in CSS                   → error
 *   - rem/em/calc/clamp font-size                → error (add handling first),
 *     with ONE sanctioned exception: `text-[length:calc(Npx*var(--x,1))]`, the
 *     canvas counter-scale, which resolves to its declared N (see
 *     COUNTER_SCALED_PX below — anything wider than that shape still errors)
 *   - template-interpolated `text-${...}`        → error
 *   - typography token name not found            → error
 *   - non-literal inline fontSize/fontWeight     → error
 *   - var(--conv-type-*) used but never defined  → error
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/*
 * ⚠⚠ THIS SCOPE WAS TWO DIRECTORIES AND THE PANEL RENDERS FROM MANY MORE — the
 * census reported "4 distinct sizes, zero raw hits" while SEVEN sizes rendered
 * in the panel column. Derived 26 Aug 2026 by walking the import closure from
 * the panel's own roots (`FloatingOlumiPanel`, `OlumiTabBody`,
 * `ConversationPanel`, `ChatThread`): 698 rendering files, of which 92 were in
 * scope. The guard was not wrong about what it measured; it measured a
 * DIRECTORY and was read as measuring the PANEL.
 *
 * Added below: the panel's own hosts and the surfaces that render in the same
 * dock column and were governed by neither this census nor
 * `check-ds-compliance`'s `panel-typography-scoped` class.
 *
 * ⛔ WHAT IS STILL NOT GOVERNED, STATED SO THE NEXT READER DOES NOT INHERIT MY
 * ERROR: `src/canvas/components` at large — 315 files carrying 232 off-scale
 * hits (16px x199, 20px x11, 18px x10, 10px x8, plus 28/30/36). That is the
 * canvas and its modals, not the panel column, and it needs its own scale
 * decision before it can be brought under an absolute-list census. Do not read
 * a green census as "the app has three type sizes".
 */
const SCOPE_DIRS = [
  'src/canvas/conversation',
  'src/v5/blocks',
  'src/canvas/components/pre-analysis',
  'src/canvas/shared',
  'src/canvas/model-tab-v2',
]
/** Panel/dock hosts that are single files rather than directories. */
const SCOPE_FILES = [
  'src/canvas/components/FloatingOlumiPanel.tsx',
  'src/canvas/components/OlumiTabBody.tsx',
  'src/canvas/components/OutputsDock.tsx',
]
const TYPOGRAPHY_TS = 'src/styles/typography.ts'
const EXCLUDE_DIR_NAMES = new Set(['__tests__', 'tests', '__fixtures__'])

// Tailwind v3 default theme (version-pinned; unknown names fail loud below).
const TW_SIZE_PX = {
  xs: 12, sm: 14, base: 16, lg: 18, xl: 20,
  '2xl': 24, '3xl': 30, '4xl': 36, '5xl': 48, '6xl': 60,
}
const TW_WEIGHT = {
  thin: 100, extralight: 200, light: 300, normal: 400, medium: 500,
  semibold: 600, bold: 700, extrabold: 800, black: 900,
}
const TW_LEADING = {
  none: 1, tight: 1.25, snug: 1.375, normal: 1.5, relaxed: 1.625, loose: 2,
}

const errors = []
const hits = [] // { kind: 'size'|'weight'|'lineHeight', value, mechanism, file, line }

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (!EXCLUDE_DIR_NAMES.has(entry)) out.push(...walk(full))
    } else if (/\.(tsx?|css)$/.test(entry) && !/\.(test|spec)\./.test(entry)) {
      out.push(full)
    }
  }
  return out
}

function lineOf(src, index) {
  return src.slice(0, index).split('\n').length
}

function record(kind, value, mechanism, file, line) {
  hits.push({ kind, value, mechanism, file: path.relative(ROOT, file), line })
}

// ---------------------------------------------------------------------------
// Token table: parse src/styles/typography.ts (derive, don't mirror).
// ---------------------------------------------------------------------------
function parseTypographyTokens() {
  const src = readFileSync(path.join(ROOT, TYPOGRAPHY_TS), 'utf8')
  const tokens = {}
  const re = /^\s{2}(\w+):\s*'([^']*)'/gm
  let m
  while ((m = re.exec(src)) !== null) {
    tokens[m[1]] = classesToTraits(m[2], `${TYPOGRAPHY_TS} token "${m[1]}"`)
  }
  if (Object.keys(tokens).length === 0) {
    errors.push(`No tokens parsed from ${TYPOGRAPHY_TS} — parser drift, fix the census`)
  }
  return tokens
}

/**
 * The one arbitrary-length shape the census resolves rather than rejects:
 * `text-[length:calc(13px*var(--canvas-label-scale,1))]`. The custom property's
 * fallback MUST be exactly 1, so the declared px is the size everywhere the
 * property is unset. Anything else keeps erroring.
 */
const COUNTER_SCALED_PX = /^text-\[length:calc\((\d+(?:\.\d+)?)px\*var\(--[a-z0-9-]+,\s*1\)\)\]$/

function classesToTraits(classString, context) {
  const traits = { size: null, weight: null, lineHeight: null }
  for (const cls of classString.split(/\s+/)) {
    let m
    if ((m = cls.match(/^text-\[(\d+(?:\.\d+)?)px\]$/))) {
      traits.size = Number(m[1])
    } else if ((m = cls.match(COUNTER_SCALED_PX))) {
      // ONE sanctioned calc shape: a declared px multiplied by a counter-scale
      // custom property that DEFAULTS TO 1. The census measures the declared
      // type scale, and `var(--x, 1)` resolves to the declared px wherever the
      // property is unset — which is everywhere outside the canvas subtree. So
      // the size this census cares about is unchanged, and the regex is narrow
      // enough that any OTHER calc/clamp/rem still falls through to the error
      // below. See src/canvas/utils/zoomLegibility.ts for why the canvas tokens
      // carry it. Deliberately NOT a general calc evaluator: a census that
      // guesses at arithmetic is worse than one that refuses it (trap 12).
      traits.size = Number(m[1])
    } else if ((m = cls.match(/^text-\[/))) {
      errors.push(`${context}: unsupported arbitrary text class "${cls}" (only [Npx] and [length:calc(Npx*var(--x,1))] handled)`)
    } else if ((m = cls.match(/^text-(xs|sm|base|lg|xl|\dxl)$/))) {
      if (!(m[1] in TW_SIZE_PX)) errors.push(`${context}: unknown text size "${cls}"`)
      else traits.size = TW_SIZE_PX[m[1]]
    } else if ((m = cls.match(/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/))) {
      traits.weight = TW_WEIGHT[m[1]]
    } else if ((m = cls.match(/^leading-(none|tight|snug|normal|relaxed|loose)$/))) {
      traits.lineHeight = TW_LEADING[m[1]]
    } else if ((m = cls.match(/^leading-\[(\d+(?:\.\d+)?)\]$/))) {
      traits.lineHeight = Number(m[1])
    } else if (/^(leading-|text-\d)/.test(cls)) {
      errors.push(`${context}: unhandled typographic class "${cls}"`)
    }
    // everything else (colour, family, tracking, sr-only, …) is not type-scale
  }
  return traits
}

// ---------------------------------------------------------------------------
// Mechanism 1 + 2 + 4: TS/TSX files
// ---------------------------------------------------------------------------
/**
 * ⚠ COMMENTS ARE NOT USAGE, AND THIS COUNTED THEM. `FloatingOlumiPanel.tsx:1352`
 * is a JSX comment explaining that compact mode swaps `typography.body` (16px)
 * for `typography.panelBody` — prose ABOUT a token, not a use of one. The census
 * reported a 16px size the panel does not render, which is the same class of
 * false positive `check-ds-compliance` already strips for (see its
 * `stripComments` note: a class written in a JSDoc block ships nothing).
 *
 * Deliberately line-preserving: the census reports file:line, so blanking must
 * not shift them.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, (mm, p1) => p1 + ' '.repeat(mm.length - p1.length)))
    .join('\n')
}

function scanTsx(file, tokens) {
  const src = stripComments(readFileSync(file, 'utf8'))

  // Fail loud on dynamically-composed size classes.
  for (const m of src.matchAll(/text-\$\{/g)) {
    errors.push(`${file}:${lineOf(src, m.index)}: template-interpolated text-\${…} class — census cannot see it`)
  }

  // 1. Raw tailwind utilities (named + arbitrary sizes, weights, leadings).
  for (const m of src.matchAll(/\btext-(xs|sm|base|lg|xl|\dxl)\b/g)) {
    record('size', TW_SIZE_PX[m[1]], 'tailwind', file, lineOf(src, m.index))
  }
  for (const m of src.matchAll(/\btext-\[(\d+(?:\.\d+)?)(px|rem)\]/g)) {
    const px = m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1])
    record('size', px, 'tailwind', file, lineOf(src, m.index))
  }
  for (const m of src.matchAll(/\bfont-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g)) {
    record('weight', TW_WEIGHT[m[1]], 'tailwind', file, lineOf(src, m.index))
  }
  for (const m of src.matchAll(/\bleading-(none|tight|snug|normal|relaxed|loose)\b/g)) {
    record('lineHeight', TW_LEADING[m[1]], 'tailwind', file, lineOf(src, m.index))
  }

  // 2. typography tokens: typography.X and typo('X')
  for (const m of src.matchAll(/\btypography\.(\w+)/g)) {
    resolveToken(m[1], file, lineOf(src, m.index), tokens)
  }
  for (const m of src.matchAll(/\btypo\(\s*['"](\w+)['"]/g)) {
    resolveToken(m[1], file, lineOf(src, m.index), tokens)
  }

  // 4. Inline style objects.
  for (const m of src.matchAll(/\bfontSize:\s*([^,}\n]+)/g)) {
    const raw = m[1].trim()
    const line = lineOf(src, m.index)
    let n
    if (/^\d+(\.\d+)?$/.test(raw)) n = Number(raw)
    else if ((n = raw.match(/^['"](\d+(?:\.\d+)?)px['"]$/))) n = Number(n[1])
    else {
      errors.push(`${file}:${line}: non-literal inline fontSize "${raw}" — census cannot resolve it`)
      continue
    }
    record('size', n, 'inline', file, line)
  }
  for (const m of src.matchAll(/\bfontWeight:\s*([^,}\n]+)/g)) {
    const raw = m[1].trim()
    const line = lineOf(src, m.index)
    if (/^\d+$/.test(raw)) record('weight', Number(raw), 'inline', file, line)
    else if (/^['"](normal|bold)['"]$/.test(raw)) record('weight', raw.includes('bold') ? 700 : 400, 'inline', file, line)
    else errors.push(`${file}:${line}: non-literal inline fontWeight "${raw}"`)
  }
  for (const m of src.matchAll(/\blineHeight:\s*([^,}\n]+)/g)) {
    const raw = m[1].trim()
    const line = lineOf(src, m.index)
    if (/^\d+(\.\d+)?$/.test(raw)) record('lineHeight', Number(raw), 'inline', file, line)
    else errors.push(`${file}:${line}: non-literal inline lineHeight "${raw}"`)
  }
}

function resolveToken(name, file, line, tokens) {
  if (name === 'screenReaderOnly') return
  const t = tokens[name]
  if (!t) {
    errors.push(`${path.relative(ROOT, file)}:${line}: typography token "${name}" not found in ${TYPOGRAPHY_TS}`)
    return
  }
  if (t.size !== null) record('size', t.size, `token(${name})`, file, line)
  if (t.weight !== null) record('weight', t.weight, `token(${name})`, file, line)
  if (t.lineHeight !== null) record('lineHeight', t.lineHeight, `token(${name})`, file, line)
}

// ---------------------------------------------------------------------------
// Mechanism 3: CSS files (raw declarations + --conv-type-* var indirection)
// ---------------------------------------------------------------------------
function scanCss(file) {
  const src = readFileSync(file, 'utf8')

  // Collect --conv-type-* definitions first so usages resolve.
  const varDefs = {}
  for (const m of src.matchAll(/(--conv-type-[\w-]+):\s*([^;]+);/g)) {
    varDefs[m[1]] = { raw: m[2].trim(), line: lineOf(src, m.index) }
  }

  if (/(^|[^-\w])font:\s/m.test(src)) {
    errors.push(`${file}: CSS \`font:\` shorthand found — census cannot decompose it, replace with longhand`)
  }

  const parseSize = (raw, line, mechanism) => {
    let m
    if (raw === 'inherit') return
    if ((m = raw.match(/^(\d+(?:\.\d+)?)px$/))) {
      record('size', Number(m[1]), mechanism, file, line)
    } else if ((m = raw.match(/^var\((--conv-type-[\w-]+)\)$/))) {
      const def = varDefs[m[1]]
      if (!def) errors.push(`${file}:${line}: ${m[1]} used but never defined`)
      else parseSize(def.raw, line, `cssvar(${m[1]})`)
    } else {
      errors.push(`${file}:${line}: unhandled font-size value "${raw}"`)
    }
  }
  const parseWeight = (raw, line, mechanism) => {
    let m
    if (raw === 'inherit') return
    if (/^\d+$/.test(raw)) record('weight', Number(raw), mechanism, file, line)
    else if ((m = raw.match(/^var\((--conv-type-[\w-]+)\)$/))) {
      const def = varDefs[m[1]]
      if (!def) errors.push(`${file}:${line}: ${m[1]} used but never defined`)
      else parseWeight(def.raw, line, `cssvar(${m[1]})`)
    } else errors.push(`${file}:${line}: unhandled font-weight value "${raw}"`)
  }
  const parseLine = (raw, line, mechanism) => {
    let m
    if (raw === 'inherit' || raw === 'normal') return
    if (/^\d+(\.\d+)?$/.test(raw)) record('lineHeight', Number(raw), mechanism, file, line)
    else if ((m = raw.match(/^var\((--conv-type-[\w-]+)\)$/))) {
      const def = varDefs[m[1]]
      if (!def) errors.push(`${file}:${line}: ${m[1]} used but never defined`)
      else parseLine(def.raw, line, `cssvar(${m[1]})`)
    } else if (/^\d+(\.\d+)?px$/.test(raw)) {
      record('lineHeight', raw, mechanism, file, line)
    } else errors.push(`${file}:${line}: unhandled line-height value "${raw}"`)
  }

  for (const m of src.matchAll(/font-size:\s*([^;]+);/g)) {
    parseSize(m[1].trim().replace(/\s*\/\*.*$/, ''), lineOf(src, m.index), 'css')
  }
  for (const m of src.matchAll(/font-weight:\s*([^;]+);/g)) {
    parseWeight(m[1].trim(), lineOf(src, m.index), 'css')
  }
  for (const m of src.matchAll(/line-height:\s*([^;]+);/g)) {
    parseLine(m[1].trim(), lineOf(src, m.index), 'css')
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const tokens = parseTypographyTokens()
const files = [
  ...SCOPE_DIRS.flatMap((d) => walk(path.join(ROOT, d))),
  ...SCOPE_FILES.map((f) => path.join(ROOT, f)),
]
for (const f of files) {
  if (f.endsWith('.css')) scanCss(f)
  else scanTsx(f, tokens)
}

// Var DEFINITIONS whose values fall outside the census would otherwise hide:
// definitions are only counted when used, and every use resolves through
// parseSize/parseWeight/parseLine above — an unused definition is dead weight,
// flag it so it cannot lie in wait.
for (const f of files.filter((f) => f.endsWith('.css'))) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/(--conv-type-[\w-]+):/g)) {
    const name = m[1]
    const uses = [...src.matchAll(new RegExp(`var\\(${name}\\)`, 'g'))].length
    if (uses === 0) errors.push(`${f}: ${name} defined but never used — remove it`)
  }
}

const distinct = (kind) => {
  const map = new Map()
  for (const h of hits.filter((h) => h.kind === kind)) {
    const k = String(h.value)
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(h)
  }
  return map
}

const sizes = distinct('size')
const weights = distinct('weight')
const lineHeights = distinct('lineHeight')

const summary = {
  errors,
  files: files.length,
  sizes: [...sizes.keys()].map(Number).sort((a, b) => a - b),
  weights: [...weights.keys()].map(Number).sort((a, b) => a - b),
  lineHeights: [...lineHeights.keys()].sort(),
  /*
   * Which MECHANISM produced each line-height. Exposed because the guard admits
   * `leading-none` for buttons and must refuse it for prose — an assertion that
   * only saw the VALUE could not tell those apart, and would have to widen the
   * whole rule to let one control through.
   */
  lineHeightMechanisms: Object.fromEntries(
    [...lineHeights.entries()].map(([lh, hs]) => [lh, [...new Set(hs.map((h) => h.mechanism))].sort()]),
  ),
  counts: { sizes: sizes.size, weights: weights.size, lineHeights: lineHeights.size },
  rawMechanismHits: {
    // raw = not token-/var-mediated; the sweep drives these to the pinned floor
    tailwindSize: hits.filter((h) => h.kind === 'size' && h.mechanism === 'tailwind').length,
    inlineSize: hits.filter((h) => h.kind === 'size' && h.mechanism === 'inline').length,
    inlineWeight: hits.filter((h) => h.kind === 'weight' && h.mechanism === 'inline').length,
    cssRawSize: hits.filter((h) => h.kind === 'size' && h.mechanism === 'css').length,
    cssRawWeight: hits.filter((h) => h.kind === 'weight' && h.mechanism === 'css').length,
  },
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ ...summary, hits }, null, 2))
} else {
  console.log(`Conversation-panel type census — ${files.length} files in scope\n`)
  for (const [label, map] of [['FONT SIZES (px)', sizes], ['FONT WEIGHTS', weights], ['LINE HEIGHTS', lineHeights]]) {
    console.log(`${label}: ${map.size} distinct`)
    for (const [value, list] of [...map.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
      const mechs = [...new Set(list.map((h) => h.mechanism))].join(', ')
      console.log(`  ${value}  (${list.length} hits via ${mechs})`)
      for (const h of list) console.log(`      ${h.file}:${h.line}  [${h.mechanism}]`)
    }
    console.log()
  }
  console.log('Raw (non-token) size hits:', JSON.stringify(summary.rawMechanismHits))
  if (errors.length) {
    console.error(`\nCENSUS ERRORS (${errors.length}):`)
    for (const e of errors) console.error(`  ${e}`)
  }
}

if (errors.length) process.exit(2)
