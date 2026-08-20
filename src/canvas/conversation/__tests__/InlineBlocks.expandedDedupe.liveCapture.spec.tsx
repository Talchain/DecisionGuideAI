/**
 * THE SAME FIX, AGAINST REAL PRODUCER BYTES — not a fixture this lane wrote.
 *
 * ## Why this file exists alongside the unit spec
 *
 * `InlineBlocks.expandedDedupe.spec.tsx` proves the mechanism with fixtures
 * this lane authored, and a fixture you wrote yourself silently encodes your
 * model of the producer rather than the producer (platform trap 16). The
 * duplicate SHAPE has to come from outside the author's head (trap 22).
 *
 * ## What the corpus actually says
 *
 * Measured across the 12 live CEE analysis-turn captures committed to this
 * repo (`src/v5/__tests__/fixtures`, `src/lib/coherence/.../captures`), using
 * `renderSegmentKey`'s own normalisation:
 *
 *   · 9 of 12 turns carry cross-block VERBATIM duplicate prose — 31 pairs.
 *   · Every pair is one of exactly TWO shapes:
 *         review_card.body   ==  coaching.body          (25)
 *         review_card.body   ==  evidence.evidence_gap   (6)
 *   · ⚠ ALL 31 are invisible in the collapsed view and visible once the
 *     disclosure opens — 0 collapsed / 31 expanded.
 *
 * That last line is the witnessed defect exactly: "0 duplicate paragraphs in
 * the default collapsed view, 3 verbatim duplicate pairs once expanded". The
 * cause is structural rather than coincidental — CEE emits an assumption as a
 * `review_card` and again as the `coaching` card that acts on it, and with
 * MAX_POINTS = 3 against the 11–19 blocks these turns carry, the second member
 * of every pair is always demoted.
 *
 * ⚠ SCOPE, stated narrowly: these captures are dated 31 Jul – 17 Aug and the
 * witness was 19–20 Aug. This corpus proves the SHAPE is real, reproducible
 * and producer-owned. It does NOT prove these are the three pairs that were
 * witnessed — that would need the 19/20 Aug turn payload, which this repo does
 * not hold.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import { renderSegmentKey } from '../messageComposition'
import {
  adaptTypedReviewCardBlock,
  adaptTypedCoachingBlock,
  adaptTypedEvidenceBlock,
  adaptTypedExerciseBlock,
} from '../../../v5/phase3TypedBlocks'
import type { ConversationBlock } from '../types'

import walkA from '../../../v5/__tests__/fixtures/live-analysis-turn-walkA-2026-08-04.json'
import trimmed from '../../../v5/__tests__/fixtures/cee-response-b82c89dd-trimmed.json'
import noCritiques from '../../../v5/__tests__/fixtures/live-analysis-turn-no-critiques-2026-08-08.json'

vi.mock('../../store', () => {
  const mockState = {
    nodes: [] as Array<{ id: string }>,
    selectNodeWithoutHistory: vi.fn(),
    selectNodes: vi.fn(),
    setShowInspectorPanel: vi.fn(),
    setHighlightedNodes: vi.fn(),
    setHighlightedEdges: vi.fn(),
  }
  return {
    useCanvasStore: Object.assign(
      (selector: (s: unknown) => unknown) => selector(mockState),
      { getState: () => mockState },
    ),
  }
})

/**
 * The capture's raw wire blocks, through the PRODUCT's OWN adapters. Using the
 * real `adaptTyped*Block` functions rather than hand-shaping the JSON is what
 * keeps this a statement about the wire.
 */
function adaptCapture(capture: { blocks?: unknown }): ConversationBlock[] {
  const raw = Array.isArray(capture.blocks) ? capture.blocks : []
  const out: ConversationBlock[] = []
  for (const b of raw) {
    const adapted =
      adaptTypedReviewCardBlock(b)
      ?? adaptTypedCoachingBlock(b)
      ?? adaptTypedEvidenceBlock(b)
      ?? adaptTypedExerciseBlock(b)
    if (adapted) out.push(adapted as ConversationBlock)
  }
  return out
}

/**
 * The elements that render PRODUCER PROSE, bound by their own testids.
 *
 * ⚠⚠ THIS SELECTOR IS THE LOAD-BEARING PART, AND THE FIRST VERSION OF IT WAS
 * WRONG IN A WAY ONLY THE REAL CAPTURES COULD SHOW. Selecting every `<p>`
 * inside a block reported 4–6 "duplicates" per turn that are not duplicates at
 * all: they are the UI's OWN per-card vocabulary inside each coaching card's
 * "Why this, and how sure" disclosure —
 *
 *     "Raised by the decision review"                        (source)
 *     "An assumption worth checking"                         (kind)
 *     "This suggestion is not linked to a cited …claim."      (grounding)
 *     "We can't confirm whether your model has changed …"     (currency)
 *
 * Those SHOULD appear once per card, exactly as a column header repeats on
 * every row. Suppressing the second one would leave five cards silent about
 * their own grounding and currency while the first one spoke — a card lying by
 * omission about its provenance, which is far worse than a repeat.
 *
 * So the measurement is scoped to the fields the producer wrote. This is also
 * the empirical case for the accessor being deliberately partial: a rule that
 * deduped "any repeated paragraph" would have deduped the product's own voice.
 */
const PROSE_TESTIDS = [
  'v5-review-card-body',
  'v5-coaching-body',
  'bias-signal-card-body',
  'v5-evidence-gap',
  'v5-evidence-technique',
  'v5-evidence-impact',
  'v5-exercise-failure-scenario',
  'v5-exercise-mitigation',
  'v5-exercise-reference-class',
  'v5-exercise-counter-case',
  'v5-exercise-review-trigger',
] as const

function renderedSegmentKeys(): string[] {
  const sel = PROSE_TESTIDS.map((t) => `[data-testid="${t}"]`).join(',')
  const keys: string[] = []
  document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
    const k = renderSegmentKey(el.textContent ?? '')
    if (k.length > 0) keys.push(k)
  })
  return keys
}

function duplicateKeys(): string[] {
  const counts = new Map<string, number>()
  for (const k of renderedSegmentKeys()) counts.set(k, (counts.get(k) ?? 0) + 1)
  return [...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k)
}

/** Cross-block duplicates present in the RAW capture, before any rendering. */
function rawDuplicateCount(blocks: ConversationBlock[]): number {
  const fields: Record<string, readonly string[]> = {
    v5_review_card: ['body'],
    v5_coaching: ['body'],
    v5_evidence: ['evidence_gap', 'suggested_technique', 'impact_if_gathered'],
    v5_exercise: ['failure_scenario', 'mitigation', 'reference_class', 'counter_case'],
  }
  const seen = new Map<string, number>()
  let dupes = 0
  blocks.forEach((b, i) => {
    for (const f of fields[b.type] ?? []) {
      const v = (b as unknown as Record<string, unknown>)[f]
      if (typeof v !== 'string' || v.trim().length === 0) continue
      const k = renderSegmentKey(v)
      const prior = seen.get(k)
      if (prior !== undefined && prior !== i) dupes++
      else if (prior === undefined) seen.set(k, i)
    }
  })
  return dupes
}

const CAPTURES: ReadonlyArray<readonly [string, { blocks?: unknown }]> = [
  ['live-analysis-turn-walkA-2026-08-04', walkA],
  ['cee-response-b82c89dd-trimmed', trimmed],
  ['live-analysis-turn-no-critiques-2026-08-08', noCritiques],
]

describe.each(CAPTURES)('live CEE capture %s', (_name, capture) => {
  /**
   * PIN THE PRECONDITION IN-TEST (platform trap 13b). Without this, a capture
   * that stopped carrying duplicates — or an adapter change that dropped the
   * blocks — would leave the assertions below passing while testing nothing,
   * and the guard would quietly stop discriminating.
   */
  it('the capture really does carry cross-block duplicate prose', () => {
    const blocks = adaptCapture(capture)
    expect(blocks.length).toBeGreaterThanOrEqual(8)
    expect(rawDuplicateCount(blocks)).toBeGreaterThan(0)
  })

  it('renders no duplicate paragraph once the disclosure is OPEN', () => {
    render(<InlineBlocks blocks={adaptCapture(capture)} />)
    fireEvent.click(screen.getByTestId('block-detail-toggle'))
    expect(screen.getByTestId('block-detail-body')).toBeInTheDocument()
    // The whole point of the lane: expanded is now as clean as collapsed.
    expect(duplicateKeys()).toEqual([])
  })

  it('the collapsed view stays clean — it already was', () => {
    render(<InlineBlocks blocks={adaptCapture(capture)} />)
    expect(duplicateKeys()).toEqual([])
  })

  it('OPPOSITE DIRECTION — expanding REVEALS strictly more prose, never less', () => {
    const { unmount } = render(<InlineBlocks blocks={adaptCapture(capture)} />)
    const collapsed = new Set(renderedSegmentKeys())
    fireEvent.click(screen.getByTestId('block-detail-toggle'))
    const expanded = new Set(renderedSegmentKeys())
    // Nothing the user could already read disappears when the disclosure opens
    // — suppression must never reach back up into a higher tier.
    for (const k of collapsed) expect(expanded.has(k)).toBe(true)
    expect(expanded.size).toBeGreaterThan(collapsed.size)
    unmount()
  })
})
