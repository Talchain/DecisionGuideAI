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
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { InlineBlocks } from '../InlineBlocks'
import { MAX_POINTS, NARRATIVE_REVIEW_CARD_KIND } from '../messageComposition'
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

const SRC_ROOT = join(__dirname, '..', '..', '..')

/**
 * The corpus is DERIVED, not hand-listed — and it spans TWO directories.
 *
 * An earlier version of this spec hardcoded two filenames from ONE directory
 * while the measurement behind the fix had a denominator of eight spanning
 * two. Six real payloads carrying the field were therefore exercised by no
 * test at all: a hand-maintained mirror of a corpus, which is the defect class
 * this platform pays for most often (trap 12).
 *
 * Discovery selects exactly the turns the routing is about: an analysis-result
 * block carrying `narrative_summary`, plus a narrative review card. Because a
 * derived list can silently shrink to nothing and still look green, the count
 * is asserted against a FLOOR below (trap 12d: derivation proves agreement,
 * never completeness).
 */
const CAPTURE_DIRS = [
  join(SRC_ROOT, 'lib', 'coherence', '__tests__', 'fixtures', 'captures'),
  join(SRC_ROOT, 'v5', '__tests__', 'fixtures'),
]

/** The number of qualifying payloads measured at 2026-08-18. Never fewer. */
const CORPUS_FLOOR = 8

interface RawCapture {
  blocks: Array<Record<string, unknown>>
}

function readBlocks(raw: unknown): Array<Record<string, unknown>> | null {
  if (typeof raw !== 'object' || raw === null) return null
  const top = (raw as { blocks?: unknown }).blocks
  if (Array.isArray(top)) return top as Array<Record<string, unknown>>
  const payload = (raw as { payload?: unknown }).payload
  if (typeof payload === 'object' && payload !== null) {
    const nested = (payload as { blocks?: unknown }).blocks
    if (Array.isArray(nested)) return nested as Array<Record<string, unknown>>
  }
  return null
}

function narrativeSummaryOf(blocks: Array<Record<string, unknown>>): string | null {
  for (const b of blocks) {
    if (b.type !== 'analysis_result' && b.type !== 'v5_analysis_result') continue
    const enrichment = b.enrichment as Record<string, unknown> | undefined
    const review = enrichment?.decision_review as Record<string, unknown> | undefined
    const summary = review?.narrative_summary
    if (typeof summary === 'string' && summary.trim().length > 0) return summary
  }
  return null
}

function discoverCaptures(): string[] {
  const found: string[] = []
  for (const dir of CAPTURE_DIRS) {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.json')) continue
      const path = join(dir, name)
      let parsed: unknown
      try {
        parsed = JSON.parse(readFileSync(path, 'utf8'))
      } catch {
        continue
      }
      const blocks = readBlocks(parsed)
      if (!blocks) continue
      if (narrativeSummaryOf(blocks) === null) continue
      const hasNarrativeCard = blocks.some(
        (b) => b.type === 'review_card' && b.card_kind === 'narrative',
      )
      if (hasNarrativeCard) found.push(path)
    }
  }
  return found.sort()
}

const CAPTURES = discoverCaptures()

/** Short, readable name for `it.each` output. */
const nameOf = (path: string): string => path.split('/').slice(-1)[0]

function captureByName(name: string): string {
  const hit = CAPTURES.find((p) => nameOf(p) === name)
  if (!hit) throw new Error(`capture ${name} not in the derived corpus`)
  return hit
}

function loadCapture(path: string): RawCapture {
  return JSON.parse(readFileSync(path, 'utf8')) as RawCapture
}

function liftReviewCard(rawCard: Record<string, unknown>): V5ReviewCardBlock {
  return {
    type: 'v5_review_card',
    block_id: rawCard.block_id as string,
    title: rawCard.title as string,
    body: rawCard.body as string,
    severity: rawCard.severity as V5ReviewCardBlock['severity'],
    card_kind: rawCard.card_kind as V5ReviewCardBlock['card_kind'],
    target_refs: (rawCard.target_refs ?? []) as V5ReviewCardBlock['target_refs'],
    priority_rank: rawCard.priority_rank as number,
    freshness: rawCard.freshness as V5ReviewCardBlock['freshness'],
  }
}

/**
 * Lift the turn's `analysis_result` and ALL of its review cards into the UI's
 * own block union, copying fields VERBATIM — the same copy `mapV5Blocks`
 * performs for these wire types. The bytes under test are the producer's.
 *
 * ⚠⚠ ALL THE CARDS, NOT JUST THE NARRATIVE ONE, AND THAT IS THE WHOLE POINT.
 *
 * The first version of this helper reduced a 15-block capture to TWO blocks.
 * Every byte it kept was the producer's, so the docblock's "nothing is
 * reshaped" was true of the BYTES — and false of the TURN SHAPE. With two
 * blocks the composition cap (`MAX_POINTS`) is never reached, so the suite was
 * structurally incapable of observing what happens when the narrative card is
 * DEMOTED. That is the corpus-excludes-the-class trap: the reduction removed
 * exactly the pressure that turns a suppression into a deletion, and it hid a
 * real content-loss defect through a full green suite and a six-mutant kit.
 *
 * Real turns carry 4–7 review cards against a cap of 3, so keeping them all
 * means the cap is genuinely exercised on every capture.
 */
function liftCapture(file: string): {
  blocks: ConversationBlock[]
  narrativeSummary: string
  narrativeCardBody: string
  narrativeCardKind: unknown
  winProbabilityLabels: string[]
  reviewCardCount: number
} {
  const raw = loadCapture(file)
  const rawResult = raw.blocks.find((b) => b.type === 'analysis_result')
  const rawCards = raw.blocks.filter((b) => b.type === 'review_card')
  const rawNarrative = rawCards.find((b) => b.card_kind === 'narrative')
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

  return {
    // Producer order preserved: the analysis result, then the cards as sent.
    blocks: [resultBlock, ...rawCards.map(liftReviewCard)],
    narrativeSummary,
    narrativeCardBody: rawNarrative.body as string,
    narrativeCardKind: rawNarrative.card_kind,
    winProbabilityLabels: Object.keys(winProbabilities),
    reviewCardCount: rawCards.length,
  }
}

/**
 * The same turn with the narrative card moved PAST the point cap, changing
 * nothing but ORDER. This is the shape a CEE re-rank would produce.
 */
function withNarrativeDemoted(blocks: ConversationBlock[]): ConversationBlock[] {
  const narrative = blocks.find(
    (b) => b.type === 'v5_review_card' && b.card_kind === 'narrative',
  )
  if (!narrative) throw new Error('no narrative card to demote — probe is vacuous')
  const rest = blocks.filter((b) => b !== narrative)
  const others = rest.filter((b) => b.type === 'v5_review_card')
  if (others.length < MAX_POINTS) {
    throw new Error(
      `capture has only ${others.length} sibling cards; need >= ${MAX_POINTS} to demote`,
    )
  }
  // Insert after enough candidates that the narrative falls outside the cap.
  const head = rest.slice(0, rest.indexOf(others[MAX_POINTS - 1]) + 1)
  const tail = rest.slice(head.length)
  return [...head, narrative, ...tail]
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
  it('the derived corpus reaches its floor and spans both capture directories', () => {
    // A derived list that silently shrinks to nothing still runs green. The
    // floor is what makes the derivation fail loud instead (trap 12d).
    expect(CAPTURES.length).toBeGreaterThanOrEqual(CORPUS_FLOOR)
    const dirs = new Set(CAPTURES.map((p) => p.split('/').slice(0, -1).join('/')))
    expect(dirs.size).toBe(CAPTURE_DIRS.length)
  })

  /**
   * F3 — `NARRATIVE_REVIEW_CARD_KIND` is a hand-maintained mirror of CEE's
   * vocabulary that the type system cannot check. This is the derived guard
   * that REDs if the producer renames the kind out from under it.
   */
  it.each(CAPTURES.map((p) => [nameOf(p), p] as const))(
    '%s: the producer still calls the narrative card by the kind the code matches',
    (_name, file) => {
      expect(liftCapture(file).narrativeCardKind).toBe(NARRATIVE_REVIEW_CARD_KIND)
    },
  )

  it.each(CAPTURES.map((p) => [nameOf(p), p] as const))(
    '%s: the producer emits the narrative on BOTH channels, byte-identical',
    (_name, file) => {
      const { narrativeSummary, narrativeCardBody } = liftCapture(file)
      expect(narrativeSummary.length).toBeGreaterThan(0)
      expect(narrativeCardBody).toBe(narrativeSummary)
    },
  )

  it.each(CAPTURES.map((p) => [nameOf(p), p] as const))(
    '%s: the narrative paragraph renders EXACTLY ONCE in the turn',
    (_name, file) => {
      const { blocks, narrativeSummary } = liftCapture(file)
      const { container } = render(<InlineBlocks blocks={blocks} turnId="t-narrative" />)
      expect(countOccurrences(container.textContent ?? '', narrativeSummary)).toBe(1)
    },
  )

  it.each(CAPTURES.map((p) => [nameOf(p), p] as const))(
    '%s: the surviving copy is the TITLED card, not the untyped one',
    (_name, file) => {
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
  it.each(CAPTURES.map((p) => [nameOf(p), p] as const))(
    '%s: with NO narrative card, the analysis-result copy still renders',
    (_name, file) => {
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
  it.each(CAPTURES.map((p) => [nameOf(p), p] as const))('%s: readiness_rationale is untouched by the routing', (_name, file) => {
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

  /**
   * ⭐⭐ F1 — THE DEMOTION CASE. The defect this suite could not previously see.
   *
   * The routing predicate first read the WHOLE block list, so a narrative card
   * demoted into the CLOSED disclosure still suppressed the untyped copy: the
   * analysis card withheld the paragraph and the disclosure hid the card, so
   * the narrative was NOWHERE. Nothing but the card's ORDER changes here —
   * every byte is still the producer's.
   *
   * The turn stayed correct on real traffic only because CEE assigns the
   * narrative card `priority_rank: 10`, the minimum in all 8 captures. That is
   * a producer-owned fact mirrored nowhere in the UI; this test is what stands
   * in for it, so a re-rank upstream REDs here instead of deleting a paragraph
   * in front of a customer.
   */
  it.each(CAPTURES.map((p) => [nameOf(p), p] as const))(
    '%s: the turn really does exceed the point cap (the pressure is real)',
    (_name, file) => {
      expect(liftCapture(file).reviewCardCount).toBeGreaterThan(MAX_POINTS)
    },
  )

  it.each(CAPTURES.map((p) => [nameOf(p), p] as const))(
    '%s: DEMOTED into the closed disclosure, the narrative still renders exactly once',
    (_name, file) => {
      const { blocks, narrativeSummary } = liftCapture(file)
      const demoted = withNarrativeDemoted(blocks)
      // Same blocks, same bytes — order only.
      expect(demoted).toHaveLength(blocks.length)

      const { container } = render(<InlineBlocks blocks={demoted} turnId="t-demoted" />)
      expect(countOccurrences(container.textContent ?? '', narrativeSummary)).toBe(1)
      // …and it is the analysis-result copy that carries it, because the card
      // the user would have read is collapsed out of view.
      expect(
        container.querySelector('[data-testid="v5-analysis-result-narrative-summary"]'),
      ).not.toBeNull()
    },
  )
})

describe('Olumi copy assembly — a label is rendered in full, never cut', () => {
  const W998 = captureByName('w998-2026-08-16-a1-turn3.json')

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

  /**
   * ⚠ BOUND TO THE PILL, NOT TO THE WHOLE CARD — and the first version of
   * these two tests was NOT, which is why this comment exists.
   *
   * Written first as `expect(container.textContent).toContain(LABEL)`, both
   * twins SURVIVED a mutant that truncated the pill to `optionKey.slice(0, 40)`
   * — 14/14 green while the very defect they exist to catch was live. The
   * labels also appear in `enrichment.option_comparison`, which other parts of
   * this card read, so the assertions were passing on a DIFFERENT OBJECT than
   * the one under test (platform trap 19: bind by identity, never by a value
   * predicate another object could satisfy).
   *
   * They now bind to the option pill itself — the `role="listitem"` inside
   * `v5-analysis-result-probabilities` whose text STARTS with the label — and
   * the same truncating mutant now REDs both.
   */
  function optionPillTexts(container: HTMLElement): string[] {
    const list = container.querySelector(
      '[data-testid="v5-analysis-result-probabilities"]',
    )
    if (!list) throw new Error('no probability pill list rendered — probe is vacuous')
    const pills = Array.from(list.querySelectorAll('[role="listitem"]'))
    if (pills.length === 0) throw new Error('pill list is empty — probe is vacuous')
    return pills.map((p) => p.textContent ?? '')
  }

  it('TWIN A: a 183-char balanced-bracket label renders in full, in its own pill', () => {
    const { blocks } = liftCapture(W998)
    const { container } = render(<InlineBlocks blocks={blocks} turnId="t-twin-a" />)
    const pills = optionPillTexts(container)

    // Exactly one pill carries this option, and it carries the WHOLE label —
    // closing bracket included.
    const matching = pills.filter((t) => t.startsWith(BALANCED_LABEL))
    expect(matching).toHaveLength(1)
    expect(matching[0]).toContain('support a 10% price rise)')
    expect(matching[0]).not.toContain('…')
  })

  it('TWIN B: a producer-truncated label renders verbatim — not cut further, not repaired', () => {
    const { blocks } = liftCapture(W998)
    const { container } = render(<InlineBlocks blocks={blocks} turnId="t-twin-b" />)
    const pills = optionPillTexts(container)

    // Rendered in full, exactly as received…
    const matching = pills.filter((t) => t.startsWith(UNBALANCED_LABEL))
    expect(matching).toHaveLength(1)
    // …with the producer's own unclosed bracket still visible. The UI must not
    // hide an upstream defect by "closing" it — that would be the product
    // misquoting the user's model back to them, which is the class being fixed.
    expect(matching[0]).not.toContain(`${UNBALANCED_LABEL})`)
    // …and the UI adds no ellipsis of its own to this label.
    expect(matching[0]).not.toContain('…')
    expect(matching[0]).not.toContain('...')
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
