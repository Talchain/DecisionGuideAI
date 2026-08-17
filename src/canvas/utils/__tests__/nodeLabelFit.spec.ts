/**
 * Node geometry and the canvas label scale are ONE decision.
 *
 * THE DEFECT THIS CLOSES (shipped and reverted-forward the same day, 17 Aug
 * 2026). `#758` gave canvas label text a counter-scale so it renders at its
 * DECLARED size instead of `declared x zoom` — the right fix for a real
 * legibility defect. It changed the FONT and left node geometry alone. At the
 * settle zoom the counter-scale is 2, so a title measure sized for 13px text
 * was holding 26px text, and `overflow-wrap: break-word` did what it is
 * specified to do: it split words mid-character.
 *
 * Measured in Chromium at the settle zoom, over the five shipped starters at
 * both harness viewports — 174 rendered node titles:
 *
 *     BEFORE   59 titles broke mid-word     "Stripe | Middle | ware | Extensi | on"
 *                                           "Engineeri | ng | Overload | ..."
 *     AFTER     0 titles broke mid-word
 *
 * WHAT THIS FILE CAN AND CANNOT PROVE. jsdom has no line boxes and no text
 * metrics, so no assertion here can show a word fitting. What it pins is the
 * DERIVATION — that the widths which exist to hold text are computed from the
 * same authority as the font scale, and therefore cannot drift apart again.
 * The fit itself is measured in a real browser by
 * `e2e/visual/nodeLabelFit.visual.spec.ts`, which is where a claim about what
 * a user sees belongs.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LABEL_LEGIBLE_ZOOM, MAX_LABEL_COUNTER_SCALE, labelCounterScale } from '../zoomLegibility'
import {
  NODE_CARD_MAX_W,
  NODE_CARD_PADDING_X,
  NODE_HEADER_GAP_PX,
  NODE_HEADER_ICON_PX,
  NODE_HEADER_RESERVE_PX,
  NODE_LAYOUT_MIN_W,
  NODE_SINGLE_ROW_FAIR_SHARE_W,
  NODE_TITLE_MIN_MEASURE_PX,
  NODE_TITLE_WIDEST_WORD_PX,
} from '../nodeLayoutConstants'

/**
 * MEASURED EVIDENCE, recorded here so the geometry is bound to a real
 * measurement rather than to itself.
 *
 * Chromium, Inter 600 at the DECLARED node-title size of 13px (DS v5 §2.3),
 * against the real loaded font inside the running product, 17 Aug 2026:
 *
 *     Cannibalization  96.06px      Concentration  88.13px
 *     International    78.02px      Engineering    75.13px
 *     Localisation     75.86px      Middleware     70.80px
 *
 * "Cannibalization" is the widest single word in the product's own content —
 * a corpus from outside this change's author. `WIDEST_WORD` names it so the
 * completeness check below can prove the measurement was taken on the right
 * word, and re-RED if a starter ever introduces a longer one.
 */
const WIDEST_WORD = 'Cannibalization'
const WIDEST_WORD_PX_AT_13 = 96.06

const STARTER_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../starters/data')

/** Every node label the shipped starters contain. Derived, never hand-listed. */
function starterLabels(): string[] {
  const out: string[] = []
  for (const file of readdirSync(STARTER_DIR).filter((f) => f.endsWith('.draft.json'))) {
    const parsed = JSON.parse(readFileSync(join(STARTER_DIR, file), 'utf8')) as {
      nodes?: Array<{ data?: { label?: unknown }; label?: unknown }>
    }
    for (const node of parsed.nodes ?? []) {
      const label = (node.data?.label ?? node.label) as unknown
      if (typeof label === 'string' && label) out.push(label)
    }
  }
  return out
}

/**
 * The longest run of characters that has to fit a line box as one unit. A
 * hyphen is a legal break point, so "Snowflake-Native" is two units, not one.
 */
function longestUnbreakableRun(labels: string[]): string {
  let longest = ''
  for (const label of labels) {
    for (const run of label.split(/[\s-]+/)) {
      if (run.length > longest.length) longest = run
    }
  }
  return longest
}

describe('the label scale is the geometry authority', () => {
  it('the maximum counter-scale is DERIVED from the legibility floor, not restated', () => {
    // Not a tautology: it asserts the bound is the value AT the floor, which is
    // what makes the settle zoom the worst case. A cap moved off the floor
    // (e.g. hardcoded 2 while the floor became 0.4) fails here.
    expect(MAX_LABEL_COUNTER_SCALE).toBe(labelCounterScale(LABEL_LEGIBLE_ZOOM))
    expect(MAX_LABEL_COUNTER_SCALE).toBe(1 / LABEL_LEGIBLE_ZOOM)
  })

  it('no zoom in the legible band asks for more counter-scale than the geometry is built for', () => {
    for (let zoom = LABEL_LEGIBLE_ZOOM; zoom <= 2; zoom += 0.01) {
      expect(labelCounterScale(zoom)).toBeLessThanOrEqual(MAX_LABEL_COUNTER_SCALE)
    }
    // …including below the floor, where the scale is capped rather than growing.
    expect(labelCounterScale(0.05)).toBeLessThanOrEqual(MAX_LABEL_COUNTER_SCALE)
  })

  it('the title measure carries the scale — this is the coupling #758 was missing', () => {
    expect(NODE_TITLE_MIN_MEASURE_PX).toBe(NODE_TITLE_WIDEST_WORD_PX * MAX_LABEL_COUNTER_SCALE)
  })

  it('the card floor is the title measure plus what the header row takes first', () => {
    expect(NODE_HEADER_RESERVE_PX).toBe(NODE_HEADER_ICON_PX + NODE_HEADER_GAP_PX)
    expect(NODE_LAYOUT_MIN_W).toBe(
      NODE_TITLE_MIN_MEASURE_PX + NODE_HEADER_RESERVE_PX + NODE_CARD_PADDING_X,
    )
  })
})

describe('the derived geometry actually holds the product’s own words', () => {
  it('the measure fits the widest word in the shipped starters at the largest scale', () => {
    // The load-bearing assertion. Everything above proves the numbers agree
    // with each other; this one proves they agree with a MEASUREMENT.
    expect(NODE_TITLE_MIN_MEASURE_PX).toBeGreaterThanOrEqual(
      WIDEST_WORD_PX_AT_13 * MAX_LABEL_COUNTER_SCALE,
    )
  })

  it('the widest word measured really is the widest word the starters contain', () => {
    // Derived from the starter files, so a new starter carrying a longer word
    // REDs here and forces a re-measurement, rather than silently invalidating
    // the constant above (CLAUDE.md trap 12: a list nobody re-derives drifts).
    const labels = starterLabels()
    expect(labels.length).toBeGreaterThan(80)
    const longest = longestUnbreakableRun(labels)
    expect(
      longest.length,
      `"${longest}" is now the longest unbreakable run in the starters, but the ` +
        `measurement behind NODE_TITLE_WIDEST_WORD_PX was taken on "${WIDEST_WORD}". Re-measure.`,
    ).toBeLessThanOrEqual(WIDEST_WORD.length)
  })

  it('the maximum card still affords the measure — the cap does not scale, so it is GUARDED', () => {
    // `NODE_CARD_MAX_W` is a viewport constraint, not a text measure, so it
    // deliberately does not follow the scale. That is only safe while it still
    // affords the floor. Lower `LABEL_LEGIBLE_ZOOM` far enough and this REDs
    // instead of silently reproducing #758's defect on wide cards.
    expect(NODE_CARD_MAX_W - NODE_CARD_PADDING_X - NODE_HEADER_RESERVE_PX).toBeGreaterThanOrEqual(
      NODE_TITLE_MIN_MEASURE_PX,
    )
  })
})

describe('the twin: nothing was widened by hand, and the layout policy did not move', () => {
  it('at counter-scale 1 the same derivation reproduces the shipped geometry', () => {
    // The opposite-direction twin. It is not enough that long labels now fit;
    // the change must be the SCALE COUPLING and nothing else. Evaluate the same
    // formula at scale 1 and it must land on the pre-#758 geometry (140px),
    // give or take the 4px the old hand-set measure was under-derived by.
    const measureAt1x = NODE_TITLE_WIDEST_WORD_PX * 1
    const cardAt1x = measureAt1x + NODE_HEADER_RESERVE_PX + NODE_CARD_PADDING_X
    expect(cardAt1x).toBeLessThanOrEqual(145)
    expect(cardAt1x).toBeGreaterThanOrEqual(140)

    // …and only the TEXT measure carries the scale. The icon, its gap and the
    // card padding are not text and must NOT be inflated: doing so would widen
    // every card for no legibility gain. No hand-added slack anywhere else.
    expect(NODE_LAYOUT_MIN_W).toBe(
      measureAt1x * MAX_LABEL_COUNTER_SCALE + NODE_HEADER_RESERVE_PX + NODE_CARD_PADDING_X,
    )
  })

  it('the row-split policy is NOT the card floor, so the label scale cannot move a tier between branches', () => {
    // Measured 17 Aug 2026: fusing these two flipped two starters' factor tiers
    // into multi-row splitting and dragged the pre-existing same-row overlap
    // defect with them (overlap area 4,554 -> 115,988 px² on
    // headcount-allocation, 5,589 -> 140,396 px² on pricing-model). Decoupled,
    // both are byte-identical to before. This asserts they stay decoupled.
    expect(NODE_SINGLE_ROW_FAIR_SHARE_W).toBe(140)
    expect(NODE_SINGLE_ROW_FAIR_SHARE_W).not.toBe(NODE_LAYOUT_MIN_W)
  })

  it('a short label cannot be made to occupy the maximum card', () => {
    // Density twin: the floor grew, the CAP did not, so a graph whose tier
    // compresses still packs at the floor rather than being promoted to 320px
    // cards full of whitespace.
    expect(NODE_LAYOUT_MIN_W).toBeLessThan(NODE_CARD_MAX_W)
  })
})
