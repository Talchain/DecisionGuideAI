/**
 * Opacity-modifier EMISSION guard.
 *
 * THE DEFECT: in Tailwind 3.4, an opacity modifier applied to a colour that is
 * declared as a bare `var(--x)` produces NO CSS AT ALL. Not a warning, not a
 * fallback rule — the utility simply does not exist in the stylesheet. Every
 * semantic colour in this design system was declared that way, so
 * `border-info/30` — the outlined-pill recipe CLAUDE.md documents as canonical
 * ("Pills: outlined only (`bg-transparent border-{colour}/30 text-text-body`)",
 * "Borders via opacity (`border-danger/30`), never extra shade tokens") — had
 * never emitted a single rule for any semantic colour, across ~353 files. Those
 * elements fell through to preflight's `border-color: #e5e7eb`, so the colour
 * channel that the three-channel system says carries "how it's doing" was
 * silently dropped product-wide.
 *
 * Verified at the DEPLOYED bytes before the fix (staging--olumi.netlify.app,
 * /assets/index-WhyMS66U.css):
 *     .bg-gray-400\/10{background-color:#9ca3af1a   <- positive control: emits
 *     .border-info\/30                              <- NO RULE
 * The fix is to declare each colour's CHANNELS as the source of truth
 * (`--info-rgb: 39 122 157; --info: rgb(var(--info-rgb))`) and hand Tailwind
 * `rgb(var(--info-rgb) / <alpha-value>)`.
 *
 * WHY THIS GUARD TESTS EMISSION RATHER THAN CONFIG SHAPE. A regex over
 * tailwind.config.js asserting "the value contains `<alpha-value>`" would be a
 * hand-maintained restatement of Tailwind's rules — the exact mirror class that
 * produced this defect (trap 12), and it would not have caught the original bug
 * either, because the original config was perfectly valid CSS. So this runs the
 * REAL Tailwind over the REAL config and asserts a rule comes out.
 *
 * BOTH controls are mandatory and both are here:
 *   · POSITIVE — a stock-palette utility (`bg-gray-400/10`) must emit, proving
 *     the harness can see a rule at all. Without it, "every class emitted"
 *     could mean "the compiler produced nothing and we compared empty sets"
 *     (trap 13).
 *   · NEGATIVE — the same colour re-declared in the OLD bare `var()` form must
 *     NOT emit. This is the guard's own mutation check, run on every CI pass
 *     rather than once by hand: if someone reverts brand.css and the config to
 *     the pre-fix shape, `emitsFor` provably goes empty for it.
 *
 * The class list is DERIVED by scanning src/ for opacity-modified utilities and
 * resolving each against the config's own colour tree. It is never a hand list,
 * so a colour used with a modifier tomorrow is covered tomorrow — including
 * sub-shades (`bg-warning-light/70`) and legacy aliases (`bg-carrot-500/10`).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve as resolvePath } from 'node:path'
import { tmpdir } from 'node:os'
import postcss from 'postcss'
import tailwind from 'tailwindcss'
import config from '../../tailwind.config.js'
import { stripComments } from '../helpers/stripSourceComments'

const SRC = resolvePath(__dirname, '../../src')

/** Utility prefixes that accept a colour + opacity modifier. */
const UTILITIES = [
  'bg', 'text', 'border', 'ring', 'ring-offset', 'fill', 'stroke', 'from', 'via', 'to',
  'divide', 'outline', 'shadow', 'accent', 'caret', 'decoration', 'placeholder',
]

/** `border-info/30`, `bg-info/[0.06]` — utility, colour path, alpha. */
const MODIFIED = new RegExp(
  `\\b(${UTILITIES.join('|')})-([a-zA-Z0-9-]+)\\/(\\[[^\\]]*\\]|\\d+)`,
  'g',
)

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|jsx|css)$/.test(p)) out.push(p)
  }
  return out
}

// The literal-aware comment stripper wired into `usedClasses` below now lives in
// the shared tests/helpers/stripSourceComments module, so this guard and the
// British-English copy guard cannot drift apart (see #386 and that module's
// header for the full rationale). Its behaviour is pinned by the two describe
// blocks at the foot of this file plus the shared module's own spec.

/** The config's colour key paths, flattened the way Tailwind names them. */
function colourKeys(): string[] {
  const colours = (config as { theme: { extend: { colors: Record<string, unknown> } } }).theme.extend.colors
  const keys: string[] = []
  for (const [k, v] of Object.entries(colours)) {
    if (typeof v === 'string') keys.push(k)
    else for (const sub of Object.keys(v as Record<string, unknown>)) {
      keys.push(sub === 'DEFAULT' ? k : `${k}-${sub}`)
    }
  }
  // Longest first, so `info-light` wins over `info` for `border-info-light/30`.
  return keys.sort((a, b) => b.length - a.length)
}

/**
 * Every opacity-modified utility in src/ whose colour resolves to a key this
 * config DECLARES. Classes naming a colour the config does not define (a
 * separate, pre-existing defect — `bg-banana-200/50` and friends) are out of
 * scope here: this guard is about declaration FORM, and a colour that does not
 * exist has no form to get wrong.
 */
function usedClasses(root: string = SRC): string[] {
  const keys = new Set(colourKeys())
  const found = new Set<string>()
  for (const file of walk(root)) {
    const text = stripComments(readFileSync(file, 'utf8'), file)
    for (const m of text.matchAll(MODIFIED)) {
      const [whole, , colour] = m
      if (keys.has(colour)) found.add(whole)
    }
  }
  return [...found].sort()
}

/** Compile a set of classes with Tailwind and return the selectors it emitted. */
async function emitsFor(classes: string[], colourOverride?: Record<string, unknown>): Promise<Set<string>> {
  const theme = colourOverride
    ? { ...config.theme, extend: { ...config.theme.extend, colors: { ...config.theme.extend.colors, ...colourOverride } } }
    : config.theme
  const result = await postcss([
    tailwind({
      ...config,
      theme,
      content: [{ raw: classes.join(' '), extension: 'html' }],
      corePlugins: { preflight: false },
    }),
  ]).process('@tailwind utilities;', { from: undefined })

  const selectors = new Set<string>()
  result.root.walkRules((rule) => {
    for (const sel of rule.selector.split(',')) selectors.add(sel.trim())
  })
  return selectors
}

/** The CSS selector Tailwind generates for a class (`/` and `.` are escaped). */
const selectorFor = (cls: string) => '.' + cls.replace(/[/.[\]]/g, (c) => '\\' + c)

/**
 * Did Tailwind emit a rule for this class?
 *
 * Not every utility produces a BARE class selector: `divide-*` emits
 * `.divide-x\/70 > :not([hidden]) ~ :not([hidden])`. An exact-match check
 * reported `divide-panel-border/70` as missing when it emits perfectly well —
 * a guard that cries wolf gets relaxed, so the match is prefix-based, bounded
 * by a combinator or whitespace so `.border-info\/3` cannot satisfy
 * `.border-info\/30`.
 */
const wasEmitted = (emitted: Set<string>, cls: string): boolean => {
  const sel = selectorFor(cls)
  for (const s of emitted) {
    if (s === sel) return true
    if (s.startsWith(sel) && /^[\s>+~:]/.test(s.slice(sel.length))) return true
  }
  return false
}

describe('semantic colours emit CSS when used with an opacity modifier', () => {
  let used: string[]
  let emitted: Set<string>

  beforeAll(async () => {
    used = usedClasses()
    emitted = await emitsFor([...used, 'bg-gray-400/10'])
  }, 60_000)

  it('the harness can SEE an emitted rule, and can see one go MISSING (both controls)', async () => {
    // POSITIVE. A stock-palette colour with a modifier must emit. This is the
    // exact utility whose presence in the deployed stylesheet proved the
    // semantic ones were absent for a reason specific to THEM.
    expect(emitted).toContain(selectorFor('bg-gray-400/10'))

    // The scan must actually be finding the code it asserts about. Floors sit
    // ~10% under the observed figure so a partial blinding is visible rather
    // than merely "still above a number".
    // Floor sits ~10% under the observed figure so a partial blinding is
    // visible, rather than one count under it. RE-BASELINED 118 -> 96 in this
    // change: the 132 `text-*/NN` call sites were swept to solid tokens (or
    // removed, where the token fails AA at full strength), which retired 22
    // distinct TEXT classes from the scan. The floor moved because the tree
    // moved, NOT to accommodate a failure — every remaining class still has to
    // emit, and the mutation control below still has to bite.
    expect(used.length, `${used.length} distinct modified classes found (was 96 when set)`)
      .toBeGreaterThanOrEqual(86)
    expect(used, 'the documented outlined-pill recipe must be in the scanned set')
      .toContain('border-info/30')

    // NEGATIVE — this guard's own mutation check, run every time rather than
    // once by hand. Re-declare `info` in the pre-fix bare-var() form and the
    // rule must VANISH. If this ever passes with the modifier still emitting,
    // the harness has stopped measuring emission and every assertion below is
    // vacuous.
    const reverted = await emitsFor(['border-info/30', 'bg-gray-400/10'], {
      info: { DEFAULT: 'var(--info)' },
    })
    expect(reverted, 'positive control must still emit under the reverted config')
      .toContain(selectorFor('bg-gray-400/10'))
    expect(
      reverted,
      'REVERTING the config to `var(--info)` must un-emit `border-info/30`. It did not, ' +
        'so this guard is no longer measuring what it claims to measure.',
    ).not.toContain(selectorFor('border-info/30'))
  }, 60_000)

  it('every opacity-modified semantic utility in src/ emits a rule', () => {
    const missing = used.filter((cls) => !wasEmitted(emitted, cls))
    expect(
      missing,
      `these utilities are used in src/ but Tailwind emits NO RULE for them, so the ` +
        `element silently keeps its inherited or preflight colour:\n` +
        missing.map((c) => `  ${c}`).join('\n') +
        `\n\nA colour can only take an opacity modifier if tailwind.config.js gives it ` +
        `channels — \`rgb(var(--x-rgb) / <alpha-value>)\` — backed by a \`--x-rgb\` triple ` +
        `in src/styles/brand.css. A bare \`var(--x)\` emits nothing at all.`,
    ).toEqual([])
  })

  it('the emitted rule actually carries the requested alpha, not a silent 1', async () => {
    // A rule that EXISTS but ignores the modifier would satisfy the test above
    // while rendering identically to the broken behaviour on screen. Assert the
    // alpha reaches the declaration, and that it is the channel form that made
    // it possible.
    const css = await postcss([
      tailwind({
        ...config,
        content: [{ raw: 'border-info/30 bg-danger/20', extension: 'html' }],
        corePlugins: { preflight: false },
      }),
    ]).process('@tailwind utilities;', { from: undefined })

    expect(css.css).toMatch(/border-color:\s*rgb\(var\(--info-rgb\)\s*\/\s*0?\.3\)/)
    expect(css.css).toMatch(/background-color:\s*rgb\(var\(--danger-rgb\)\s*\/\s*0?\.2\)/)
  }, 60_000)
})

/**
 * THE FOOTGUN. The scan reads raw file text, so a utility QUOTED IN A COMMENT is
 * pulled into the required set and compiled like a shipped class. `bg-info/4`
 * (4 is not a legal opacity step, so it emits NO rule) sat in ExpertBlock's
 * header comment and reddened origin/staging exactly this way (#385, healed only
 * by rewording the comment; the footgun itself remained). A token in a comment
 * renders nothing, so it is a non-defect; scanning comments also punishes authors
 * for documenting the very anti-pattern this guard teaches. So comments are
 * stripped from the INPUT TEXT before the scan; nothing else changes: every
 * surviving match still compiles against the real Tailwind and every emission
 * assertion above is untouched.
 */
describe('the scan ignores tokens that live only in comments (footgun #385)', () => {
  let dir: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'guard-strip-comments-'))
    // `bg-info/4`, the illegal step that emits nothing, appears ONLY in
    // comments, in all three forms the guard scans: a `//` line comment, a
    // `/* */` block comment, and a CSS `/* */` comment. Real, shipped utilities
    // (`border-info/30` as a className AND as a CSS `@apply`, `bg-info/5` as a
    // className) sit in genuine code and MUST survive the stripping.
    writeFileSync(
      join(dir, 'line.tsx'),
      '// documented anti-pattern: never ship bg-info/4, it emits no CSS\n' +
        'export const A = () => <div className="border-info/30" />\n',
    )
    writeFileSync(
      join(dir, 'block.tsx'),
      '/* the faint info tint bg-info/4 is illegal; the nearest legal step is bg-info/5 */\n' +
        'export const B = () => <div className="bg-info/5" />\n',
    )
    writeFileSync(
      join(dir, 'style.css'),
      '/* never author bg-info/4 in a stylesheet, 4 is not a scale step */\n' +
        '.pill { @apply border-info/30; }\n',
    )
  })

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('an illegal utility quoted ONLY in a comment is not scanned (the headline)', () => {
    // RED before stripping: the passthrough stub leaves `bg-info/4` in the text,
    // so the scan pulls it from the // , /* */ and CSS /* */ comments and the
    // required set contains a class that provably emits nothing.
    expect(
      usedClasses(dir),
      'bg-info/4 lives only in comments and renders nothing; the scan must ignore it',
    ).not.toContain('bg-info/4')
  })

  it('a REAL utility in genuine code survives stripping (className and CSS @apply)', () => {
    const used = usedClasses(dir)
    // The existing mutation control asserts `border-info/30` stays in the scanned
    // set; prove a real usage is not collateral of comment stripping.
    expect(used, 'a real border-info/30 (className and @apply) must still be scanned')
      .toContain('border-info/30')
    expect(used, 'a real bg-info/5 className must still be scanned')
      .toContain('bg-info/5')
  })
})

/**
 * LITERAL-SAFETY PINS. A naive line-comment regex strip eats real code: a URL in
 * a string, a class after content-['//'], a regex full of slashes. These pin the
 * tokeniser so a comment-opening sequence inside a string, template or regex
 * literal is treated as code, and a class inside a template interpolation is real
 * code. Each hostile class has its own case; swapping the tokeniser for the naive
 * stripper turns these RED (mutation-checked in the PR).
 */
describe('literal-aware stripping: comment markers inside string/template/regex are code', () => {
  const scan = (text: string, file = 'hostile.tsx'): Set<string> =>
    new Set([...stripComments(text, file).matchAll(MODIFIED)].map((m) => m[0]))

  it('`//` inside a string does not strip a real class later on the same line', () => {
    const src = "const u = 'https://cdn.example/x'; const c = 'border-info/30'"
    expect(scan(src)).toContain('border-info/30')
  })

  it('a class inside a template `${...}` interpolation survives', () => {
    const src = "const c = `p-2 ${cond ? 'bg-info/30' : ''}`"
    expect(scan(src)).toContain('bg-info/30')
  })

  it('`/*` and `*/` inside a string neither open nor close a comment', () => {
    const src = "const a = '/*'; const c = 'bg-danger/20'; const b = '*/'"
    expect(scan(src)).toContain('bg-danger/20')
  })

  it('`//` inside a regex literal is not a comment', () => {
    const src = "const re = /\\/\\//g; const c = 'text-info/40'"
    expect(scan(src)).toContain('text-info/40')
  })

  it("`content-['//']` keeps the class that follows it", () => {
    const src = '<div className="before:content-[\'//\'] border-info/30" />'
    expect(scan(src)).toContain('border-info/30')
  })

  it('a genuine `//` line comment IS still stripped', () => {
    const found = scan("const c = 'bg-info/5' // ship note: bg-info/4 is illegal")
    expect(found).toContain('bg-info/5')
    expect(found).not.toContain('bg-info/4')
  })

  it('a genuine `/* */` block comment IS still stripped', () => {
    const found = scan("const c = 'bg-info/5' /* avoid bg-info/4 here */")
    expect(found).toContain('bg-info/5')
    expect(found).not.toContain('bg-info/4')
  })
})
