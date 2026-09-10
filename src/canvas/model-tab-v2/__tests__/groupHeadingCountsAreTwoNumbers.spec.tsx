/**
 * ⭐⭐ THE OUTLINE'S GROUP HEADING RAN TWO COUNTS TOGETHER INTO ONE NUMBER.
 *
 * Measured on the DEPLOYED build `14276d5b` (guest, restored model, completed
 * run), reading the live accessible names off the real DOM:
 *
 *     "▸ Goal22 with no value yet"              ← 2 elements, 2 unset
 *     "▸ Factors53 with no value yet"           ← 5 elements, 3 unset
 *     "▸ Outcomes & risks55 with no value yet"  ← 5 elements, 5 unset
 *     "▸ Relationships13"                       ← a GENUINE 13
 *
 * The heading renders the total and the unset summary as two adjacent `<span>`s
 * with no text node between them, so accessible-name computation concatenates
 * them with nothing in between and a screen-reader user hears "fifty-three".
 *
 * ⚠⚠ THE SHARPEST PART IS THE LAST LINE. `Relationships13` is a real
 * two-digit count. A listener cannot tell it from a fabricated one, because
 * both are spelled the same way — so the defect does not corrupt one number, it
 * makes every number on the surface unreliable. That is the difference between
 * a wrong figure and an untrustworthy surface, and it is why this is worth a
 * pinned test rather than a tidy-up.
 *
 * ── AND THE VISUAL HALF, measured with `getComputedStyle` on the same build ──
 * Both spans rendered at `11px`, weight `600`, colour `rgb(110, 107, 107)`,
 * separated by exactly `8px` — the SAME gap that separates the title from the
 * first count. Byte-identical treatment for "how many there are" and "how many
 * are incomplete", with the boundary between them spaced like the boundary
 * inside them. `ModelStrip` on the Reasoning tab already renders this same fact
 * in `text-warning`; one fact, two tabs, two treatments.
 *
 * ⚠ WHAT THIS FILE DOES NOT CLAIM. jsdom performs no layout, so it asserts the
 * accessible NAME (computable from the DOM) and the CLASS that carries the
 * tone. It makes no claim about rendered pixels — the 8px and the colours above
 * are browser measurements, recorded here as the provenance of the fix, not
 * re-asserted by it.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// @ts-expect-error TS7016 — the root Tailwind config ships no declaration
// file; the shape this guard reads is asserted in the positive control below.
import tailwindConfig from '../../../../tailwind.config.js'
import { resolveTokenHex } from '../../../styles/channelTriple.mjs'

vi.mock('../../store', () => ({ useCanvasStore: (sel: (s: unknown) => unknown) => sel({ nodes: [] }) }))

import { ModelOutline } from '../ModelOutline'
import type { ModelRow } from '../types'

/** A row that HAS a value — counted in the total, never in the unset summary. */
const set = (id: string, label: string): ModelRow => ({
  id,
  kind: 'factor',
  group: 'factors',
  label,
  primaryValue: '60,000',
  provenanceSource: 'user',
  attention: [],
  editable: true,
})

/** A row with nothing stated — `primaryValue === null` is the projection's own
 *  definition of "nothing is stated", and the summary reads that same field. */
const unset = (id: string, label: string): ModelRow => ({
  id,
  kind: 'factor',
  group: 'factors',
  label,
  primaryValue: null,
  // ⚠ NO PROVENANCE, DELIBERATELY. `unsetSummary` buckets an unset row with
  // USER provenance under "you set N" — a real clause, but a different one from
  // the "N with no value yet" the deployed heading showed. A fixture that
  // reached the wrong bucket would test a sentence the defect was not about.
  attention: ['no-value'],
  editable: true,
})

const renderOutline = (rows: ModelRow[]) =>
  render(<ModelOutline rows={rows} tier="plain" filter="" />)

const heading = (group: string) => screen.getByTestId(`model-group-v2-${group}-toggle`)

describe('THE FIXTURE REPRODUCES THE DEPLOYED SHAPE (precondition)', () => {
  /**
   * ⚠ PINNED IN-TEST. Every assertion below is about a heading carrying BOTH a
   * total and an unset summary. A fixture that produced only one of them would
   * make the whole file pass while measuring a state the defect cannot occur in
   * (trap 13b) — which is exactly how a mutant survived the sibling repair on
   * `ModelStrip` earlier tonight.
   */
  it('the group renders a total AND an unset summary', () => {
    renderOutline([set('f1', 'Annual cost'), unset('f2', 'Lead time'), unset('f3', 'Churn')])
    expect(heading('factors')).toHaveTextContent('Factors')
    expect(screen.getByTestId('model-group-v2-factors-unknown-summary')).toBeInTheDocument()
  })
})

describe('the accessible name keeps the two counts apart', () => {
  it('⭐ names the total and the unset count as separate figures', () => {
    renderOutline([set('f1', 'Annual cost'), unset('f2', 'Lead time'), unset('f3', 'Churn')])

    const name = heading('factors').getAttribute('aria-label') ?? ''
    // The deployed defect: "Factors53 with no value yet".
    expect(name).not.toMatch(/Factors\s*53/)
    // 3 elements, 2 of them unset — two figures a listener can tell apart.
    expect(name).toContain('3 elements')
    // Two separate figures in the name, and the second is the summary's own.
    const summary = screen.getByTestId('model-group-v2-factors-unknown-summary').textContent ?? ''
    expect(summary).toContain('2')
    expect(name).toContain(`, ${summary}`)
  })

  it('⭐ a genuine two-digit count is not spelled like a concatenation — the twin', () => {
    // The case that makes the defect corrosive rather than merely wrong: a real
    // 13 and a fabricated 13 read identically. With the total labelled, they
    // cannot be confused in either direction.
    const rows = Array.from({ length: 13 }, (_, i) => set(`f${i}`, `Factor ${i}`))
    renderOutline(rows)

    const name = heading('factors').getAttribute('aria-label') ?? ''
    expect(name).toContain('13 elements')
    expect(name).not.toContain('with no value yet')
  })

  it('keeps label-in-name: the visible title is inside the accessible name', () => {
    // WCAG 2.5.3 — a voice user must be able to say what they can see.
    renderOutline([unset('f1', 'Lead time')])
    expect(heading('factors').getAttribute('aria-label')).toContain('Factors')
  })

  it('singular for one element, because "1 elements" is its own small lie', () => {
    renderOutline([set('f1', 'Annual cost')])
    const name = heading('factors').getAttribute('aria-label') ?? ''
    expect(name).toContain('1 element')
    expect(name).not.toContain('1 elements')
  })

  it('⛔ says nothing about unset rows when there are none', () => {
    // A permanent "0 with no value yet" would be chrome that always renders and
    // states nothing — the rule `unsetSummary` already follows for the visible
    // span, applied to the name so the two cannot disagree.
    renderOutline([set('f1', 'Annual cost'), set('f2', 'Lead time')])
    const name = heading('factors').getAttribute('aria-label') ?? ''
    expect(name).toContain('2 elements')
    expect(name).not.toContain('no value yet')
    expect(screen.queryByTestId('model-group-v2-factors-unknown-summary')).toBeNull()
  })
})

describe('the name QUOTES the summary sentence rather than paraphrasing it', () => {
  it('⭐ the accessible name ends with exactly the rendered span text', () => {
    /**
     * ⚠ THE POINT OF THIS CASE. `unsetSummary`'s wording took four attempts to
     * make true — three earlier heads each characterised a heterogeneous
     * population with an adjective that was false for a class their corpus
     * excluded. A second phrasing composed here would be a fifth attempt,
     * unreviewed, and would drift from the span beside it. So the name must
     * carry the SPAN'S OWN STRING, and this asserts that rather than asserting
     * any particular words.
     */
    renderOutline([set('f1', 'Annual cost'), unset('f2', 'Lead time')])

    const rendered = screen.getByTestId('model-group-v2-factors-unknown-summary').textContent ?? ''
    expect(rendered.length).toBeGreaterThan(0)
    expect(heading('factors').getAttribute('aria-label')).toContain(rendered)
  })
})

/**
 * ⛔ THE COLOUR CHANGE THIS FILE ORIGINALLY PINNED WAS REVERTED — it failed the
 * very rule the rest of this PR exists to serve.
 *
 * The first head painted this span `text-warning` so the two counts could be
 * told apart. Computed from the tokens themselves — `--warning-rgb: 255 166 86`
 * -> `#FFA656`, `--bg-panel` -> `#FEFEFE` — by the WCAG 2.x relative-luminance
 * formula, NOT from the comments beside them:
 *
 *     text-warning    #FFA656 on --bg-panel       #FEFEFE : 1.92:1   FAIL
 *     text-warning    #FFA656 on --bg-panel-hover #FEF9F3 : 1.85:1   FAIL
 *     text-text-light #6E6B6B on --bg-panel       #FEFEFE : 5.23:1   pass
 *     text-text-light #6E6B6B on --bg-panel-hover #FEF9F3 : 5.04:1   pass
 *                                                   floor : 4.5:1  (SC 1.4.3)
 *
 * At `typography.panelMeta` the large-text exemption cannot apply (that needs
 * >=24px, or >=18.66px bold), so 1.92:1 is a straight SC 1.4.3 failure. The
 * count this PR just made ANNOUNCEABLE would have become UNREADABLE — same
 * element, same commit.
 *
 * ⚠ AND NO AMBER WOULD HAVE WORKED. Sweeping every `--*-rgb` token DECLARED in
 * `brand.css` (18, enumerated from the file rather than listed by hand), exactly
 * three clear 4.5:1 on BOTH panel grounds: `--text-header` 15.01/14.46,
 * `--text-light` 5.23/5.04, `--info` 4.78/4.60. Every warning, danger and goal
 * token fails. "Swap it for a darker amber" had no honest answer inside the
 * palette, so the smallest true change was to drop the colour and land the
 * naming fix alone.
 *
 * ⭐ WHAT IS STILL UNSOLVED, SAID PLAINLY SO IT IS NOT MISTAKEN FOR SOLVED. To a
 * SIGHTED reader the two counts are once again byte-identical. That finding is
 * real and is NOT closed here. `ModelStrip` carries the tone in a tinted pill
 * (`bg-warning/10` + ring + `NoValueMark`), which changes the GROUND and is why
 * it passes where bare 11px text cannot. Adopting that treatment is a design
 * change with its own review, not a hunk riding along inside a naming fix.
 */
describe('the unset summary is a legal text colour (WCAG SC 1.4.3)', () => {
  const WCAG_TEXT_MIN = 4.5

  /** Both panel grounds this heading is painted on. */
  const GROUNDS = ['--bg-panel', '--bg-panel-hover'] as const

  const brandCss = readFileSync(join(__dirname, '../../../styles/brand.css'), 'utf-8')

  /**
   * WCAG 2.x relative luminance + contrast ratio. Same implementation as
   * `tests/ci-guards/text-light-contrast.spec.ts`, so the two a11y guards
   * cannot drift into measuring differently.
   */
  function luminance(hex: string): number {
    const h = hex.replace('#', '')
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
    const [r, g, b] = [0, 2, 4].map((i) => {
      const v = parseInt(full.slice(i, i + 2), 16) / 255
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }

  /** Declared colour of a `--token` in brand.css. Throws rather than defaulting. */
  function declared(token: string): string {
    const hex = resolveTokenHex(brandCss, token)
    if (!hex) throw new Error(`${token} does not resolve to a literal colour in brand.css`)
    return hex
  }

  /**
   * ⭐ THE CLASS -> TOKEN STEP IS DERIVED FROM `tailwind.config.js`, NOT MIRRORED.
   * A hand-written map of `text-warning -> --warning` would be one more list
   * somebody has to remember to update, and it would go quietly stale the first
   * time a colour was re-pointed. Walking the real config means this guard
   * measures the colour the BUILD emits.
   */
  function tokenForTextClass(cls: string): string {
    const colours = (tailwindConfig as { theme: { extend: { colors: Record<string, unknown> } } })
      .theme.extend.colors
    const parts = cls.replace(/^text-/, '').split('-')
    // Longest group name first: `text-text-light` is colours.text.light, while
    // `text-warning` is colours.warning.DEFAULT.
    for (let i = parts.length; i >= 1; i--) {
      const entry = colours[parts.slice(0, i).join('-')]
      if (entry == null) continue
      const shade = parts.slice(i).join('-') || 'DEFAULT'
      const value = typeof entry === 'string' ? entry : (entry as Record<string, unknown>)[shade]
      if (typeof value !== 'string') continue
      const ref = value.match(/var\((--[a-z0-9-]+)\)/i)
      if (!ref) continue
      return ref[1].replace(/-rgb$/, '')
    }
    throw new Error(`no Tailwind colour entry resolves the class "${cls}"`)
  }

  /** The colour-bearing class actually rendered on the summary span. */
  function renderedTextClass(): string {
    renderOutline([set('f1', 'Annual cost'), unset('f2', 'Lead time')])
    const summary = screen.getByTestId('model-group-v2-factors-unknown-summary')
    const classes = summary.className.split(/\s+/).filter((c) => /^text-[a-z]/.test(c))
    // ⚠ PRECONDITION PINNED IN-TEST. If the span ever stops carrying exactly one
    // colour class — hardcoded style, two competing classes, none at all — this
    // guard must RED rather than silently measure nothing (trap 13b: a guard
    // whose discrimination rests on an unpinned fixture).
    expect(classes).toHaveLength(1)
    return classes[0]
  }

  it('the maths can SEE a failure it is asserting the absence of (positive control)', () => {
    // 1. The KNOWN-BAD value — the colour this PR's first head shipped — must
    //    FAIL on both grounds, to the second decimal.
    expect(contrast('#FFA656', declared('--bg-panel'))).toBeCloseTo(1.92, 2)
    expect(contrast('#FFA656', declared('--bg-panel-hover'))).toBeCloseTo(1.85, 2)
    expect(contrast('#FFA656', declared('--bg-panel'))).toBeLessThan(WCAG_TEXT_MIN)

    // 2. A known-good pairing must PASS, or the function is just returning
    //    something small for everything.
    expect(contrast('#6E6B6B', declared('--bg-panel'))).toBeCloseTo(5.23, 2)

    // 3. Spec anchors, so a broken formula cannot agree with itself.
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 4)
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 4)

    // 4. The parser is really reading brand.css, not defaulting.
    expect(() => declared('--token-that-does-not-exist')).toThrow()

    // 5. The class->token walk discriminates: two different classes must not
    //    resolve to the same token, or the resolver is not resolving.
    expect(tokenForTextClass('text-warning')).toBe('--warning')
    expect(tokenForTextClass('text-text-light')).toBe('--text-light')
    expect(declared('--warning')).toBe('#FFA656')
  })

  it.each(GROUNDS)('⭐ the rendered colour clears 4.5:1 on %s', (ground) => {
    const cls = renderedTextClass()
    const fg = declared(tokenForTextClass(cls))
    const ratio = contrast(fg, declared(ground))

    expect(
      ratio,
      `the unset-summary span renders "${cls}" (${fg}), which is ${ratio.toFixed(
        2,
      )}:1 on ${ground} — SC 1.4.3 needs ${WCAG_TEXT_MIN}:1 for text under 18.66px`,
    ).toBeGreaterThanOrEqual(WCAG_TEXT_MIN)
  })
})
