/**
 * `--text-light` WCAG 1.4.3 text-contrast pin.
 *
 * THE DEFECT THIS EXISTS FOR: `--text-light` shipped as #908D8D, which is
 * not a legal TEXT colour at any size — 3.26:1 on `--bg-panel` and 2.90:1 on
 * `--bg-canvas`, against SC 1.4.3's 4.5:1 bar. It was used at ~785 live,
 * user-visible sites across ~190 files, and NONE qualified for the large-text
 * exemption (>=24px, or >=18.66px bold — the largest muted site in the tree
 * is 20px and not bold), so font size could not rescue a single one of them.
 * Nothing in the suite could see it: the css-var guard asks whether a token
 * is DEFINED and whether its hardcoded fallbacks AGREE, never what the value
 * MEASURES. A token can be perfectly self-consistent and still illegal.
 *
 * So this asserts the MEASUREMENT, not the spelling. Both sides are DERIVED
 * from brand.css — the foreground and both grounds are parsed out of the same
 * file the product renders from — because a hardcoded copy of the new hex
 * would pass forever regardless of what the token actually says, which is this
 * repo's dominant defect class (trap 12: the hand-maintained mirror). Retint
 * `--text-light` lighter, or darken `--bg-canvas`, and this goes red with the
 * actual figure.
 *
 * GROUNDS. Two, and both are real surfaces this token is painted on:
 *   · `--bg-panel`  #FEFEFE — panels, cards, inspector, results, node fills.
 *   · `--bg-canvas` #F4F0EA — the <body> behind the react-flow canvas.
 *     Established in a live browser by the GhostOptionNode lane, not assumed:
 *     every ancestor from `.react-flow__node` up through `__viewport`,
 *     `__pane` and `.react-flow` is rgba(0,0,0,0) (xyflow sets
 *     `--xy-background-color-default: transparent`), so the first opaque
 *     ancestor is <body>. Accumulated opacity through that chain is 1.0 and
 *     every filter is `none`, so raw contrast IS effective contrast.
 *   · `--bg-panel-hover` #FEF9F3 is asserted too — it replaces the panel
 *     ground on hover, so muted text has to survive it as a third surface.
 *
 * WHAT THIS DELIBERATELY DOES NOT COVER: sites where an ancestor `opacity`
 * suppresses the text (11 known live sites at opacity-50/60/70 measure
 * 1.9-2.8:1 even after the retint). A colour token cannot fix those — they
 * need the opacity removed — and pretending this guard covers them would be
 * the more dangerous failure. See the retint PR body for the list.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** SC 1.4.3 — normal-size text. Large text (>=24px / >=18.66px bold) may use 3:1. */
const WCAG_TEXT_MIN = 4.5

const BRAND_CSS_PATH = join(__dirname, '../../src/styles/brand.css')
const brandCss = readFileSync(BRAND_CSS_PATH, 'utf-8')

/**
 * WCAG 2.x relative luminance + contrast ratio.
 * Lifted verbatim from src/canvas/nodes/__tests__/GhostOptionNode.contrast.spec.ts
 * so both a11y guards measure with ONE implementation, not two that can drift.
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

/** Declared value of a `--token` at :root in brand.css. Throws rather than defaulting. */
function declared(token: string): string {
  const m = brandCss.match(new RegExp(`^\\s*${token}:\\s*(#[0-9A-Fa-f]{3,8})\\s*;`, 'm'))
  if (!m) throw new Error(`${token} is not declared with a literal hex in src/styles/brand.css`)
  return m[1]
}

/** Every ground `--text-light` is painted on as TEXT, worst case included. */
const GROUNDS = ['--bg-panel', '--bg-canvas', '--bg-panel-hover'] as const

describe('--text-light is a legal text colour (WCAG SC 1.4.3)', () => {
  it('the maths can SEE a failure it is asserting the absence of (positive control)', () => {
    // Without this, every assertion below could be passing because the
    // implementation is broken rather than because the token is compliant
    // (trap 13: an absence assertion must first prove it can see a presence).

    // 1. The KNOWN-BAD historical value must FAIL on both real grounds.
    //    These are the figures committed in GhostOptionNode.tsx's own comment.
    expect(contrast('#908D8D', declared('--bg-panel'))).toBeCloseTo(3.26, 2)
    expect(contrast('#908D8D', declared('--bg-canvas'))).toBeCloseTo(2.9, 2)
    expect(contrast('#908D8D', declared('--bg-panel'))).toBeLessThan(WCAG_TEXT_MIN)

    // 2. A known-good pairing must PASS — proves the function is not simply
    //    returning something small for everything.
    expect(contrast(declared('--text-body'), declared('--bg-panel'))).toBeCloseTo(10.45, 2)

    // 3. The parser must actually be reading brand.css, not silently
    //    defaulting: an undeclared token throws rather than returning a value.
    expect(() => declared('--token-that-does-not-exist')).toThrow()
  })

  it.each(GROUNDS)('clears 4.5:1 on %s', (ground) => {
    const fg = declared('--text-light')
    const bg = declared(ground)
    const ratio = contrast(fg, bg)
    expect(
      ratio,
      `--text-light ${fg} on ${ground} ${bg} measures ${ratio.toFixed(2)}:1, ` +
        `below SC 1.4.3's ${WCAG_TEXT_MIN}:1 for normal-size text. None of this token's ` +
        `live sites qualify for the large-text exemption (>=24px, or >=18.66px bold), ` +
        `so there is no size at which this is legal. Darken --text-light, or lighten ${ground}.`,
    ).toBeGreaterThanOrEqual(WCAG_TEXT_MIN)
  })

  it('stays the LIGHTEST compliant value — it must not be over-darkened either', () => {
    // The token's job is to read as muted. Compliance was bought with the
    // smallest darkening that clears the bar, and this records that intent so
    // a later "make it safer" nudge is a deliberate decision, not a drift.
    // --bg-canvas is the binding ground; one step lighter must FAIL there.
    const fg = declared('--text-light')
    const canvas = declared('--bg-canvas')
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(fg.replace('#', '').slice(i, i + 2), 16))
    const oneStepLighter = `#${[r + 1, g + 1, b + 1]
      .map((n) => Math.min(255, n).toString(16).padStart(2, '0'))
      .join('')}`
    expect(
      contrast(oneStepLighter, canvas),
      `--text-light ${fg} is darker than it needs to be: ${oneStepLighter} also clears ` +
        `4.5:1 on --bg-canvas. Use the lighter value — this token is meant to be quiet.`,
    ).toBeLessThan(WCAG_TEXT_MIN)
  })

  it('white text on a --text-light FILL also clears 4.5:1 (.priorityBadgeLow)', () => {
    // The token is used as a BACKGROUND in 18 places. Exactly one carries
    // text: .priorityBadgeLow in Conversation.module.css, which composes
    // .priorityBadge's `color: var(--text-on-color)`. Darkening the fill can
    // only help white text — but "can only help" is an argument, not a
    // measurement, and this pairing was failing (3.29:1) before the retint
    // with nobody watching it.
    const ratio = contrast(declared('--text-on-color'), declared('--text-light'))
    expect(
      ratio,
      `--text-on-color on a --text-light fill measures ${ratio.toFixed(2)}:1 — ` +
        `.priorityBadgeLow renders white text on this token.`,
    ).toBeGreaterThanOrEqual(WCAG_TEXT_MIN)
  })

  it('stays visually distinct from --text-body, or the hierarchy collapses', () => {
    // Compliance is bought by darkening muted text TOWARDS body text, so the
    // cost of this fix is the muted/body distinction. Guarded so a future
    // "just darken it a bit more" cannot quietly erase the hierarchy.
    // Threshold is luminance-ratio based (a proxy, deliberately loose) —
    // the ΔE2000 figure is in the PR body; this only catches collapse.
    const light = luminance(declared('--text-light'))
    const body = luminance(declared('--text-body'))
    expect(
      light / body,
      `--text-light and --text-body are now within 1.5x luminance of each other — ` +
        `muted text has stopped reading as muted. Reach for a lighter --text-light, ` +
        `or accept that the palette needs a third rung.`,
    ).toBeGreaterThan(1.5)
  })
})
