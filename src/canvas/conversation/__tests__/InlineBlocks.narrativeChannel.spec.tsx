/**
 * Olumi copy assembly — THE NARRATIVE CHANNEL, and full-label rendering.
 *
 * ## UX gate 2026-08-18, point 4 (deployed `4d1e650b`, fresh guest)
 *
 * Two defects were recorded against "Olumi conversation copy assembly". This
 * file pins the one that is genuinely the UI's, and pins the UI's half of the
 * one that is not.
 *
 * ### (b) "One paragraph renders verbatim twice" — THIS IS OURS
 *
 * Root cause, derived at the producer's own bytes rather than at the render
 * site: CEE's `decision_review_enricher` emits ONE piece of content on TWO
 * channels of the same turn —
 *
 *   · `analysis_result.enrichment.decision_review.narrative_summary`
 *   · a `review_card` with `card_kind: "narrative"`, title "How the analysis
 *     reads", whose `body` is the SAME STRING, byte for byte
 *
 * — and the UI renders both. Measured across every analysis-turn capture in
 * this repo that carries `narrative_summary` (8 payloads, 2026-07-31 →
 * 2026-08-17): the narrative card is present in 8/8, exactly one per turn,
 * body byte-identical in 8/8. `readiness_rationale` is duplicated in 0/8 —
 * that contrast is what proves the measurement discriminates rather than
 * agreeing with itself (platform trap 13e).
 *
 * ⚠ THE FIX IS NOT STRING-EQUALITY DE-DUPLICATION AT THE RENDER SITE, and
 * that is deliberate. A string filter would suppress a LEGITIMATELY repeated
 * sentence later, and it would hide the composer defect instead of resolving
 * it. `messageComposition.ts` already refuses to de-duplicate a text against
 * itself for exactly this reason. What is resolved here is the CHANNEL: when
 * the turn delivers the narrative as a typed, titled card, the untyped copy
 * inside the analysis-result card does not render. One content, one surface.
 *
 * This also REPAIRS A STALE PREMISE rather than overriding a live rule.
 * `V5AnalysisResultBlock`'s docblock justified rendering these fields as "the
 * fields no other wire block delivers" (ROADMAP 2.154). For
 * `narrative_summary` that premise is measurably false: another wire block
 * does deliver it, as a first-class ranked card. The analysis-result copy is
 * the accidental second reader.
 *
 * ### (a) "The opening sentence quotes a goal truncated mid-phrase" — NOT OURS
 *
 * Derived, not assumed. The gate's truncated strings arrive ALREADY TRUNCATED
 * on the wire: in `acceptance-2026-08-17-j1r1-t1.json` the producer's
 * `assistant_text` carries `"• diversify fast by buying a small M&E"` while
 * the SAME payload carries the full 75-character label intact at
 * `draft_graph.nodes[12].label`, `analysis_ready.options[1].label` and three
 * more sites. The UI product source composes no such sentence at all: a
 * case-insensitive sweep for `built a first decision model` / `decision model
 * for` over every `.ts` / `.tsx` file under `src` hits ONLY fixtures and
 * specs — never product
 * code, with the fixture hits standing as the probe's positive control.
 *
 * So the UI cannot fix (a) without inventing text the user never wrote. What
 * the UI CAN be held to — and is, below — is the other half of that contract:
 * **whatever label it is given, it renders in full and unaltered.** The two
 * cases are opposite-direction twins drawn from ONE real capture:
 *
 *   TWIN A  a 183-char label with BALANCED brackets  → renders in full
 *   TWIN B  a 102-char label the producer already cut inside an UNCLOSED
 *           bracket → renders VERBATIM: not cut further, and not silently
 *           repaired either
 *
 * Twin B is the one that matters for the lead question. Masking the
 * producer's malformation would be the same defect class wearing a fix's
 * clothes — "the product misquotes the user's own model back to them". The UI
 * must show what it was given, so the upstream defect stays visible to the
 * lane that owns it.
 *
 * ## Fixture provenance and state-class
 *
 * Every string asserted here is a PRODUCER string, read at run time out of the
 * append-only capture corpus (`src/lib/coherence/__tests__/fixtures/captures/`,
 * see its `PROVENANCE.md`) — never a sentence composed by this spec. A
 * self-authored fixture encodes the author's model of the producer rather than
 * the producer (platform trap 16-inverse). The captures are `fresh` and
 * `seeded` wire recordings; no capture is edited by this file.
 *
 * The one string NOT from the corpus is the UX gate's own recorded goal label,
 * quoted verbatim from `UX-GATE-2026-08-18.md`. It is a producer string
 * recorded at the deployed build; only its PLACEMENT in a card body is this
 * spec's, and that is stated rather than implied.
 *
 * Assertions bind to their object by identity — the exact producer string, and
 * the block that carries it — never by a value predicate another block could
 * satisfy (platform trap 19).
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { InlineBlocks } from '../InlineBlocks'
import type {
  ConversationBlock,
  V5AnalysisResultBlock as V5AnalysisResultBlockType,
  V5ReviewCardBlock,
} from '../types'

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

const CAPTURE_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  'lib',
  'coherence',
  '__tests__',
  'fixtures',
  'captures',
)

interface RawCapture {
  blocks: Array<Record<string, unknown>>
}

function loadCapture(file: string): RawCapture {
  return JSON.parse(readFileSync(join(CAPTURE_DIR, file), 'utf8')) as RawCapture
}

/**
 * Lift the turn's `analysis_result` and its narrative `review_card` into the
 * UI's own block union, copying fields VERBATIM — the same copy `mapV5Blocks`
 * performs for these two wire types. Nothing is reshaped, so the bytes under
 * test are the producer's.
 */
function liftCapture(file: string): {
  blocks: ConversationBlock[]
  narrativeSummary: string
  narrativeCardBody: string
  winProbabilityLabels: string[]
} {
  const raw = loadCapture(file)
  const rawResult = raw.blocks.find((b) => b.type === 'analysis_result')
  const rawNarrative = raw.blocks.find(
    (b) => b.type === 'review_card' && b.card_kind === 'narrative',
  )
  if (!rawResult) throw new Error(`${file}: no analysis_result block`)
  if (!rawNarrative) throw new Error(`${file}: no narrative review_card`)

  const enrichment = rawResult.enrichment as Record<string, unknown>
  const decisionReview = enrichment.decision_review as Record<string, unknown>
  const narrativeSummary = decisionReview.narrative_summary as string
  const winProbabilities = rawResult.win_probabilities as Record<string, number>

  const resultBlock: V5AnalysisResultBlockType = {
    type: 'v5_analysis_result',
    summary: rawResult.summary as string,
    leading_option_id: (rawResult.leading_option_id as string | null) ?? null,
    win_probabilities: winProbabilities,
    enrichment,
  }
  const narrativeCard: V5ReviewCardBlock = {
    type: 'v5_review_card',
    block_id: rawNarrative.block_id as string,
    title: rawNarrative.title as string,
    body: rawNarrative.body as string,
    severity: rawNarrative.severity as V5ReviewCardBlock['severity'],
    card_kind: rawNarrative.card_kind as V5ReviewCardBlock['card_kind'],
    target_refs: (rawNarrative.target_refs ?? []) as V5ReviewCardBlock['target_refs'],
    priority_rank: rawNarrative.priority_rank as number,
    freshness: rawNarrative.freshness as V5ReviewCardBlock['freshness'],
  }

  return {
    blocks: [resultBlock, narrativeCard],
    narrativeSummary,
    narrativeCardBody: rawNarrative.body as string,
    winProbabilityLabels: Object.keys(winProbabilities),
  }
}

/** Whitespace-normalised occurrence count of `needle` in `haystack`. */
function countOccurrences(haystack: string, needle: string): number {
  const h = haystack.replace(/\s+/g, ' ')
  const n = needle.replace(/\s+/g, ' ').trim()
  if (n.length === 0) throw new Error('needle is empty — the probe would be vacuous')
  let count = 0
  let from = 0
  for (;;) {
    const at = h.indexOf(n, from)
    if (at === -1) return count
    count++
    from = at + n.length
  }
}

const CAPTURES = [
  'w998-2026-08-16-a1-turn3.json',
  'seeded-2026-08-17-w2d-analysis-turn.json',
] as const

describe('Olumi copy assembly — the narrative channel renders once', () => {
  /**
   * THE PRECONDITION THIS ROUTING RESTS ON, PINNED IN-TEST.
   *
   * The channel fix is sound only because the typed card genuinely carries the
   * narrative. If CEE ever makes the two channels diverge, this REDs and a
   * human adjudicates — rather than the routing silently dropping prose the
   * card no longer restates. A guard whose precondition nothing pins is a
   * guard that can quietly stop discriminating (platform trap 13b).
   */
  it.each(CAPTURES)(
    '%s: the producer emits the narrative on BOTH channels, byte-identical',
    (file) => {
      const { narrativeSummary, narrativeCardBody } = liftCapture(file)
      expect(narrativeSummary.length).toBeGreaterThan(0)
      expect(narrativeCardBody).toBe(narrativeSummary)
    },
  )

  it.each(CAPTURES)(
    '%s: the narrative paragraph renders EXACTLY ONCE in the turn',
    (file) => {
      const { blocks, narrativeSummary } = liftCapture(file)
      const { container } = render(<InlineBlocks blocks={blocks} turnId="t-narrative" />)
      expect(countOccurrences(container.textContent ?? '', narrativeSummary)).toBe(1)
    },
  )

  it.each(CAPTURES)(
    '%s: the surviving copy is the TITLED card, not the untyped one',
    (file) => {
      const { blocks, narrativeSummary } = liftCapture(file)
      const { container } = render(<InlineBlocks blocks={blocks} turnId="t-narrative" />)

      // The untyped copy inside the analysis-result card is the one withheld…
      const untyped = container.querySelector(
        '[data-testid="v5-analysis-result-narrative-summary"]',
      )
      expect(untyped).toBeNull()

      // …and the narrative survives under its own heading, so nothing is lost.
      expect(container.textContent).toContain('How the analysis reads')
      expect(container.textContent).toContain(narrativeSummary)
    },
  )

  /**
   * THE OPPOSITE-DIRECTION TWIN, and the one that stops this fix becoming a
   * content-loss defect. A turn whose producer sent `narrative_summary` with
   * NO narrative card must still show the narrative. Absence of the card may
   * only ever cost a duplicate — never a paragraph.
   */
  it.each(CAPTURES)(
    '%s: with NO narrative card, the analysis-result copy still renders',
    (file) => {
      const { blocks, narrativeSummary } = liftCapture(file)
      const withoutCard = blocks.filter((b) => b.type !== 'v5_review_card')
      expect(withoutCard).toHaveLength(1)

      const { container } = render(
        <InlineBlocks blocks={withoutCard} turnId="t-no-card" />,
      )
      expect(countOccurrences(container.textContent ?? '', narrativeSummary)).toBe(1)
      expect(
        container.querySelector('[data-testid="v5-analysis-result-narrative-summary"]'),
      ).not.toBeNull()
    },
  )

  /**
   * THE NARROWNESS TWIN. Only the narrative channel is routed. The other
   * `decision_review` prose fields are NOT duplicated by any card (measured
   * 0/8) and must keep rendering in the analysis-result card exactly as
   * before, card present or not.
   */
  it.each(CAPTURES)('%s: readiness_rationale is untouched by the routing', (file) => {
    const raw = loadCapture(file)
    const rawResult = raw.blocks.find((b) => b.type === 'analysis_result')!
    const decisionReview = (rawResult.enrichment as Record<string, unknown>)
      .decision_review as Record<string, unknown>
    const readiness = decisionReview.readiness_rationale
    expect(typeof readiness).toBe('string')
    expect((readiness as string).length).toBeGreaterThan(0)

    const { blocks } = liftCapture(file)
    const { container } = render(<InlineBlocks blocks={blocks} turnId="t-narrow" />)
    expect(container.textContent).toContain(readiness as string)
  })
})

describe('Olumi copy assembly — a label is rendered in full, never cut', () => {
  const W998 = 'w998-2026-08-16-a1-turn3.json'

  /** TWIN A — long label, BALANCED brackets. Verbatim producer bytes. */
  const BALANCED_LABEL =
    'building the analytics add-on customers keep asking for (two quarters of ' +
    'engineering time, roughly £250k in payroll, might lift retention from 88% ' +
    'to 92% and support a 10% price rise)'

  /**
   * TWIN B — long label the PRODUCER already cut mid-phrase inside an UNCLOSED
   * bracket. This is the gate's own defect shape, on the wire.
   */
  const UNBALANCED_LABEL =
    'expanding into the German market (probably £400k up front for localisation, ' +
    'sales hires and compliance'

  /**
   * The UX gate's recorded goal label, quoted verbatim from
   * `UX-GATE-2026-08-18.md` — in the 85–101 character band the gate recorded,
   * the length class that was being cut on the deployed build. Its placement
   * in a card body is this spec's; the string is the product's.
   */
  const UX_GATE_GOAL_LABEL =
    'Several of our largest enterprise customers are asking for a self-hosted deployment option'

  it('the capture really carries both twins, and they differ in bracket balance', () => {
    const { winProbabilityLabels } = liftCapture(W998)
    expect(winProbabilityLabels).toContain(BALANCED_LABEL)
    expect(winProbabilityLabels).toContain(UNBALANCED_LABEL)

    // The discrimination this pair exists to make.
    const balance = (s: string) =>
      s.split('(').length - 1 === s.split(')').length - 1
    expect(balance(BALANCED_LABEL)).toBe(true)
    expect(balance(UNBALANCED_LABEL)).toBe(false)
  })

  it('TWIN A: a 183-char balanced-bracket label renders in full', () => {
    const { blocks } = liftCapture(W998)
    const { container } = render(<InlineBlocks blocks={blocks} turnId="t-twin-a" />)
    const text = container.textContent ?? ''

    expect(text).toContain(BALANCED_LABEL)
    // Bound by identity: the label's own closing bracket, not merely "some" text.
    expect(text).toContain('support a 10% price rise)')
    expect(text).not.toContain('building the analytics add-on customers keep asking for…')
  })

  it('TWIN B: a producer-truncated label renders verbatim — not cut further, not repaired', () => {
    const { blocks } = liftCapture(W998)
    const { container } = render(<InlineBlocks blocks={blocks} turnId="t-twin-b" />)
    const text = container.textContent ?? ''

    // Rendered in full, exactly as received…
    expect(text).toContain(UNBALANCED_LABEL)
    // …with the producer's own unclosed bracket still visible. The UI must not
    // hide an upstream defect by "closing" it — that would be the product
    // misquoting the user's model back to them, which is the class being fixed.
    expect(text).not.toContain(`${UNBALANCED_LABEL})`)
    // …and the UI adds no ellipsis of its own to this label.
    expect(text).not.toContain('sales hires and compliance…')
    expect(text).not.toContain('sales hires and compliance...')
  })

  it('a 91-char label in a card body renders in full, with no character cap', () => {
    const card: V5ReviewCardBlock = {
      type: 'v5_review_card',
      block_id: 'rc_goal_label',
      title: 'How the analysis reads',
      body: `I've built a first decision model for "${UX_GATE_GOAL_LABEL}".`,
      severity: 'info',
      card_kind: 'narrative',
      target_refs: [],
      priority_rank: 10,
      freshness: 'fresh',
    }
    const { container } = render(<InlineBlocks blocks={[card]} turnId="t-long-label" />)
    const text = container.textContent ?? ''

    // The gate recorded the drafted goal label at 85–101 characters; this one
    // is in that band, which is the length class that was being cut.
    expect(UX_GATE_GOAL_LABEL.length).toBeGreaterThanOrEqual(85)
    expect(UX_GATE_GOAL_LABEL.length).toBeLessThanOrEqual(101)
    expect(text).toContain(UX_GATE_GOAL_LABEL)
    // Balanced quotes around the label — the gate's acceptance condition.
    expect(text).toContain(`"${UX_GATE_GOAL_LABEL}"`)
    // The gate's exact broken rendering must not reappear.
    expect(text).not.toContain(
      'Several of our largest enterprise customers are asking for a self-hosted".',
    )
  })
})
