import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * ⭐⭐⭐ RULE 5, ENFORCED BY MEASUREMENT RATHER THAN BY A LIST OF ALLOWED CLASSES.
 *
 * The node design system states rule 5 as:
 *
 * > **Kind colour on the full border, the bars and the glyphs — never on small
 * > text.** *Measured on this palette, no semantic colour clears 3:1 on either
 * > panel ground, so text stays #262626 or #6E6B6B.*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔⛔ THE RULE'S OWN PREMISE IS FALSE, AND THIS FILE IS WHERE THAT IS RECORDED
 * ─────────────────────────────────────────────────────────────────────────────
 * *"No semantic colour clears 3:1"* was generalised from two tokens that had
 * actually been measured — `NodeProvenanceMark` records `text-warning` at
 * **1.92:1** and `text-success` at **2.02:1** against `--bg-panel` #FEFEFE — to
 * every semantic colour, without measuring the third.
 *
 * `--info` (#277A9D) clears **4.78:1** on `--bg-panel`, **4.60:1** on
 * `--bg-panel-hover` and **4.25:1** on `--bg-canvas`. Not merely above 3:1 —
 * above **4.5:1**, the SC 1.4.3 threshold for normal text. And it does so
 * deliberately: `styles/brand.css:151-158` records the derivation, including
 * rejecting `#2B7FA2` because it computed to 4.47:1 on the ground the text is
 * actually painted on — *"a 0.03 miss that measuring against white cannot see."*
 * `--info` is aliased by `--link-color`; it is the surface's designated link
 * colour precisely because it passes.
 *
 * ⇒ A guard that banned "semantic colour on text" outright would red on **19
 * live `text-info` sites** whose contrast is fine, and the only way to keep it
 * green would be an exemption list — the hand-maintained mirror this estate
 * keeps paying for. **So the guard measures instead of listing.**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ WHAT IS DERIVED, AND — THE HONEST HALF — WHAT IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 * **Derived, with zero exemptions:** which tokens may paint text. The ratios are
 * computed here from the raw channel values in `styles/brand.css` against the
 * three grounds the node surface paints on. Nothing is copied; if anyone
 * lightens `--info` or darkens `--warning`, the permitted set moves and the
 * first test below REDs with the new numbers.
 *
 * **NOT derivable, and stated rather than faked:** whether a given mark's
 * meaning survives its colour being removed. WCAG exempts a decorative graphic
 * from SC 1.4.11, and this surface has two legitimate cases — an `ArrowUp` /
 * `ArrowDown` in `EdgePills` whose DIRECTION is the arrow's shape, and the kind
 * marks whose OUTLINE differs per kind (square / circle / triangle). The guard
 * therefore exempts elements that declare `aria-hidden`, which is a **rule about
 * the element**, not a list of file:line pairs. An author who wants the
 * exemption must make the same declaration to a screen reader that they are
 * making to this guard, which is the right price.
 */

const NODES_DIR = join(__dirname, '..')
const BRAND_CSS = join(__dirname, '../../../styles/brand.css')

// ── contrast, computed, never quoted ────────────────────────────────────────
type RGB = readonly [number, number, number]
const channel = (c: number) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}
const luminance = ([r, g, b]: RGB) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** `--name-rgb: 39 122 157;` → [39,122,157]. Read, never restated. */
function readTriple(css: string, name: string): RGB {
  const m = css.match(new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*;`))
  if (!m) throw new Error(`brand.css does not define --${name}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])] as const
}
function readHex(css: string, name: string): RGB {
  const m = css.match(new RegExp(`--${name}:\\s*#([0-9A-Fa-f]{6})\\s*;`))
  if (!m) throw new Error(`brand.css does not define --${name} as a hex`)
  const h = m[1]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] as const
}

/** Every semantic family a `text-*` class can name. */
const SEMANTIC = ['info', 'warning', 'success', 'danger', 'goal', 'option', 'factor'] as const

/** SC 1.4.3, normal text. Canvas type runs 7–14px — never the 18.66px large-text tier. */
const TEXT_THRESHOLD = 4.5
/** SC 1.4.11, a graphic that carries meaning. */
const GRAPHIC_THRESHOLD = 3

/**
 * ⚠⚠ THE GROUND SET IS A DECISION, AND GETTING IT WRONG IS THE FAILURE MODE
 * `brand.css` ITSELF RECORDS.
 *
 * The first cut of this guard gated on three grounds including `--bg-canvas`
 * (#F4F0EA) — and it RED on nineteen healthy `text-info` sites, because `--info`
 * measures **4.25:1** there. That is the right answer to the wrong question:
 * `--bg-canvas` is what shows BETWEEN cards. A node card paints its own fill,
 * and text inside it sits on that fill, never on the canvas.
 *
 * `brand.css:151-158` had already settled this and names the correct pair —
 * *"MEASURE AGAINST THE GROUND THE TEXT IS PAINTED ON, NOT AGAINST WHITE"* — and
 * calls `--bg-panel-hover` **"the binding ground"**, because it is the darker of
 * the two and therefore the one that decides. Adding a ground the text never
 * touches is the same error as measuring against white, pointed the other way.
 *
 * ⚠ ONE CASE IS DELIBERATELY OUT OF SCOPE AND SAID SO RATHER THAN ASSUMED AWAY:
 * `BaseNode` swaps the card fill to the kind tint (`colors.bg`, a `--*-light`)
 * when `lodBodyHidden` — which is `zoom < 0.5`, the rung at which the body is not
 * rendered at all. There is no body text on that ground to measure, so it is not
 * in the gate. If a tinted fill ever reaches a rung that renders text, this
 * comment is the thing that should stop being true, and the grounds must grow.
 */
function palette() {
  const css = readFileSync(BRAND_CSS, 'utf8')
  const grounds: Record<string, RGB> = {
    '--bg-panel': readTriple(css, 'bg-panel-rgb'),
    // The binding ground: darker of the two, so it decides every verdict below.
    '--bg-panel-hover': readTriple(css, 'bg-panel-hover-rgb'),
  }
  const tokens = Object.fromEntries(SEMANTIC.map(n => [n, readTriple(css, `${n}-rgb`)])) as Record<string, RGB>
  return { grounds, tokens }
}

/** Tokens clearing `threshold` against EVERY ground the node surface paints on. */
function clearing(threshold: number): string[] {
  const { grounds, tokens } = palette()
  return SEMANTIC.filter(name =>
    Object.values(grounds).every(bg => contrast(tokens[name], bg) >= threshold),
  )
}

// ── source scan ─────────────────────────────────────────────────────────────
/** Blank comment bodies IN PLACE, so reported line numbers are the file's own. */
function blankComments(src: string): string {
  /*
   * ⚠ A SCANNER, NOT A REGEX — AND IT TRACKS STRING LITERALS, WHICH IS THE PART
   * MY FIRST TWO ATTEMPTS BOTH GOT WRONG.
   *
   * Attempt 1 was `src.replace(/\/\*[\s\S]*?\*\//g, '')`. A `/*` inside a
   * string literal opens a comment as far as that regex is concerned, so
   * everything to the next close is blanked — including any real `border-t` in
   * between. A FALSE NEGATIVE: the guard goes quiet about a live violation and
   * nothing about the run looks different. It also collapsed lines, so every
   * reported line number was wrong.
   *
   * Attempt 2 was character-by-character and fixed the line numbers — and was
   * EXACTLY AS BLIND to string literals, because I had diagnosed the regex as
   * the problem when the problem was not tracking quotes. Its own control test
   * caught it, which is the only reason this note is here rather than a third
   * silent hole. *A fix aimed at the mechanism you happened to notice is not a
   * fix for the defect.*
   *
   * This tracks `'`, `"` and backtick strings (with escapes) and blanks only
   * genuine comment bodies, newline-for-newline so line numbers are the file's.
   */
  let out = ''
  let i = 0
  let mode: 'code' | 'block' | 'line' | 'str' = 'code'
  let quote = ''
  while (i < src.length) {
    const ch = src[i]
    if (mode === 'code') {
      if (src.startsWith('/*', i)) { mode = 'block'; out += '  '; i += 2; continue }
      if (src.startsWith('//', i)) { mode = 'line'; out += '  '; i += 2; continue }
      if (ch === "'" || ch === '"' || ch === '`') { mode = 'str'; quote = ch }
      out += ch; i += 1; continue
    }
    if (mode === 'str') {
      // A backslash escapes the next character, including the closing quote.
      if (ch === '\\') { out += src.slice(i, i + 2); i += 2; continue }
      if (ch === quote) { mode = 'code'; quote = '' }
      out += ch; i += 1; continue
    }
    if (mode === 'block') {
      if (src.startsWith('*/', i)) { mode = 'code'; out += '  '; i += 2; continue }
      out += ch === '\n' ? '\n' : ' '; i += 1; continue
    }
    // line comment
    if (ch === '\n') { mode = 'code'; out += '\n'; i += 1; continue }
    out += ' '; i += 1
  }
  return out
}

function tsxFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue
      out.push(...tsxFiles(full))
      continue
    }
    if (entry.endsWith('.tsx') && !/\.spec\.|\.test\./.test(entry)) out.push(full)
  }
  return out
}

/**
 * The JSX element a match sits inside: from the nearest unclosed `<` before the
 * match to the `>` that closes that opening tag. Used only to ask whether the
 * element declares `aria-hidden` — a structural question, not a parse.
 */
function enclosingTag(code: string, at: number): string {
  const open = code.lastIndexOf('<', at)
  if (open === -1) return ''
  let depth = 0
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++
    else if (code[i] === '}') depth--
    else if (code[i] === '>' && depth === 0) return code.slice(open, i + 1)
  }
  return code.slice(open)
}

const TOKEN_RE = (names: string[]) =>
  new RegExp(`\\btext-(${names.join('|')})(?:-(?:light|hover|active|disabled|\\d{2,3}))?(?:/\\d{1,3})?\\b`, 'g')


/**
 * ⭐⭐ THE SAME SCOPE HOLE THE RULE-1 GUARD CLOSES, CLOSED HERE TOO — found by
 * asking *"what would have to be true for my guard to pass while the property
 * fails?"* A card may render a component that does not live in this directory,
 * and ~24 semantic text tokens sit elsewhere in `src/canvas`.
 *
 * Measured at this tip the node surface renders three such components — two
 * `Tooltip`s and `DataBar` — and all three are clean, so the hole is real and
 * currently EMPTY: it would have stayed green through the first violation that
 * walked into it. The set is derived from the cards' own imports rather than
 * listed, so a fourth cannot arrive unswept.
 */
function renderedFromOutside(nodeFiles: string[]): string[] {
  const out = new Set<string>()
  const IMPORT = /import\s+(?:\{([^}]*)\}|(\w+))\s+from\s+'((?:\.\.\/){2,}[^']+)'/g
  for (const file of nodeFiles) {
    const src = readFileSync(file, 'utf8')
    let m: RegExpExecArray | null
    while ((m = IMPORT.exec(src)) !== null) {
      const spec = m[3]
      if (!/\/(components|ui|panels)\//.test(spec)) continue
      const names = (m[1] ?? m[2] ?? '').split(',').map(n => n.trim()).filter(Boolean)
      if (!names.some(n => /^[A-Z]/.test(n) && !n.startsWith('type '))) continue
      for (const ext of ['.tsx', '.ts']) {
        const resolved = join(dirname(file), spec + ext)
        if (existsSync(resolved)) { out.add(resolved); break }
      }
    }
  }
  return [...out].sort()
}

describe('node design system — rule 5, measured', () => {
  it('reads the palette and reproduces the two figures already recorded in the tree', () => {
    const { grounds, tokens } = palette()
    // POSITIVE CONTROL on the instrument itself: `NodeProvenanceMark`'s docblock
    // records warning at 1.92:1 and success at 2.02:1 against --bg-panel. If this
    // calculator disagrees with a figure the codebase already committed to, the
    // calculator is wrong and every number below is unreadable.
    expect(contrast(tokens.warning, grounds['--bg-panel'])).toBeCloseTo(1.92, 2)
    expect(contrast(tokens.success, grounds['--bg-panel'])).toBeCloseTo(2.02, 2)
    // And brand.css:151-158 records --info at 4.78 / 4.60 on the two panel grounds.
    expect(contrast(tokens.info, grounds['--bg-panel'])).toBeCloseTo(4.78, 2)
    expect(contrast(tokens.info, grounds['--bg-panel-hover'])).toBeCloseTo(4.60, 2)
    // And the ground that is deliberately NOT gated on, measured so the choice is
    // visible rather than implicit: --info reads 4.25:1 on --bg-canvas, which is
    // why including it would have banned the surface's own link colour.
    expect(contrast(tokens.info, readHex(readFileSync(BRAND_CSS, 'utf8'), 'bg-canvas'))).toBeCloseTo(4.25, 2)
  })

  it('⛔ REFUTES the rule as written: exactly one semantic token clears 4.5:1 on every ground', () => {
    /*
     * The rule says "no semantic colour clears 3:1 on either panel ground".
     * This asserts what is actually true, so the day someone re-lightens --info
     * — the surface's own link colour — this REDs and names it, instead of
     * nineteen call sites quietly dropping below SC 1.4.3.
     */
    expect(clearing(TEXT_THRESHOLD)).toEqual(['info'])
    // And the rule's own 3:1 claim, tested rather than repeated:
    expect(clearing(GRAPHIC_THRESHOLD)).toEqual(['info'])
  })

  it('the comment scanner preserves line numbers and does not eat string literals', () => {
    for (const f of tsxFiles(NODES_DIR)) {
      const raw = readFileSync(f, 'utf8')
      expect(blankComments(raw).split('\n').length, `line drift in ${f}`).toBe(raw.split('\n').length)
    }
    const tricky = 'const a = "/*"\nconst b = <div className="text-warning" />\nconst c = "*/"'
    expect(blankComments(tricky)).toContain('text-warning')
  })

  it('no node component paints TEXT in a semantic colour that fails 4.5:1', () => {
    const banned = SEMANTIC.filter(n => !clearing(TEXT_THRESHOLD).includes(n))
    // Contrast control: the banned set must be non-empty, or this test is vacuous.
    expect(banned.length).toBeGreaterThan(0)

    const files = tsxFiles(NODES_DIR)
    // Reachability: the sweep must reach the six kinds AND the shared directory.
    expect(files.length).toBeGreaterThan(15)
    for (const kind of ['DecisionNode.tsx', 'OptionNode.tsx', 'FactorNode.tsx', 'OutcomeNode.tsx', 'RiskNode.tsx', 'GoalNode.tsx']) {
      expect(files.some(f => f.endsWith(kind)), `sweep did not reach ${kind}`).toBe(true)
    }

    const hits: string[] = []
    let exempted = 0
    for (const file of files) {
      const raw = readFileSync(file, 'utf8')
      const code = blankComments(raw)
      const rel = file.slice(file.indexOf('src/'))
      const rawLines = raw.split('\n')
      const re = TOKEN_RE(banned)
      let m: RegExpExecArray | null
      while ((m = re.exec(code)) !== null) {
        const tag = enclosingTag(code, m.index)
        // Structural exemption, not a list: a mark declared decorative to a
        // screen reader is decorative to WCAG too.
        if (/aria-hidden/.test(tag)) { exempted++; continue }
        const line = code.slice(0, m.index).split('\n').length
        hits.push(`${rel}:${line}  ${m[0]}  — ${rawLines[line - 1].trim().slice(0, 110)}`)
      }
    }

    /*
     * ⚠ The exemption count is asserted NON-ZERO on purpose. If a refactor ever
     * made `enclosingTag` stop matching, every element would look non-exempt and
     * this test would red loudly — but if it made it match EVERYTHING, the test
     * would pass while checking nothing. A guard that cannot distinguish is
     * indistinguishable from a guard that found nothing.
     */
    // ⭐ LOCKED CANVAS DESIGN (23 Sep 2026): the only live exemptions were
    // `EdgePills`' green/rose arrows, which MT-19 made NEUTRAL ink (a green ↑
    // into a risk read as good news). With no semantic-coloured decorative mark
    // left, `exempted` is legitimately 0 — so discrimination is proven on a
    // PLANTED pair instead: the same tag scan must exempt an aria-hidden mark
    // and must NOT exempt a visible one. The property the old control stood
    // for is kept; only its witness moved from the corpus to a fixture.
    const planted = 'const a = <span aria-hidden="true" className="text-warning" />\nconst b = <span className="text-warning">x</span>'
    const plantedCode = blankComments(planted)
    const plantedTags = [...plantedCode.matchAll(TOKEN_RE(banned))].map(m => enclosingTag(plantedCode, m.index ?? 0))
    expect(plantedTags.filter(t => /aria-hidden/.test(t)).length, 'the aria-hidden exemption cannot fire').toBe(1)
    expect(plantedTags.filter(t => !/aria-hidden/.test(t)).length, 'the scan exempts everything').toBe(1)
    void exempted

    expect(
      hits,
      'Rule 5: these tokens fail SC 1.4.3 (4.5:1) on every ground this surface paints.\n' +
        'Use text-text-body / text-text-light and put the hue on the border, as StatusPill and\n' +
        'EvidenceGapBadge do — or mark the element aria-hidden if its meaning is carried by shape.\n' +
        hits.join('\n'),
    ).toEqual([])
  })

  it('the kind-colour registry keeps its .text field out of the node cards', () => {
    /*
     * `nodes/colors.ts` maps each kind to `text: 'text-<kind>'`, and six of those
     * seven tokens fail 4.5:1. They are not violations HERE because nothing in
     * this directory reads the field: `BaseNode` consumes `.border`, `.bg` and
     * `.selected` only. Its one consumer estate-wide is
     * `components/results/analysisNew/nodeMarks.tsx`, where it colours an
     * `aria-hidden` SVG whose PATH differs per kind — shape carries the meaning,
     * which is rule 5's own construction.
     *
     * Asserting the absence keeps that true by derivation instead of by memory:
     * the day a card starts painting text with the kind hue, this REDs.
     */
    const consumers = tsxFiles(NODES_DIR).filter(f =>
      /nodeColors\s*(\[[^\]]+\]|\.[a-z]+)\s*\.text\b/.test(blankComments(readFileSync(f, 'utf8'))),
    )
    expect(consumers).toEqual([])
    // Contrast control: the registry IS imported here, so a zero above is an
    // absence of the .text READ, not an absence of the import.
    const importers = tsxFiles(NODES_DIR).filter(f => /from '\.\/colors'/.test(readFileSync(f, 'utf8')))
    expect(importers.length).toBeGreaterThan(0)
  })

  it('and it follows the card into every component the card renders from outside', () => {
    const banned = SEMANTIC.filter(n => !clearing(TEXT_THRESHOLD).includes(n))
    const outside = renderedFromOutside(tsxFiles(NODES_DIR))
    expect(outside.length, 'the import derivation found nothing — it is not discriminating').toBeGreaterThan(0)

    const hits: string[] = []
    for (const file of outside) {
      const code = blankComments(readFileSync(file, 'utf8'))
      const rel = file.slice(file.indexOf('src/'))
      const re = TOKEN_RE(banned)
      let m: RegExpExecArray | null
      while ((m = re.exec(code)) !== null) {
        if (/aria-hidden/.test(enclosingTag(code, m.index))) continue
        hits.push(`${rel}:${code.slice(0, m.index).split('\n').length}  ${m[0]}`)
      }
    }
    expect(hits, 'Rule 5 reaches components a card renders, wherever they live.\n' + hits.join('\n')).toEqual([])
  })
})
