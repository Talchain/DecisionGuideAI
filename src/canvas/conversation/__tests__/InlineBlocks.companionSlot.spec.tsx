/**
 * ROADMAP 2.242 at the RENDER layer — the lens companion card's guaranteed
 * default-expanded slot, pinned where the user meets it.
 *
 * ## Why this file exists alongside phase3Pacing.companionSlot.spec.ts
 * The rule lives in `computePhase3Pacing`; the WIRING that makes it visible
 * lives in `InlineBlocks` (`pacing.collapsedIndices` -> `isBlockHidden` -> a
 * collapsed card returns `null` and is not in the DOM at all). Pinning only
 * the rule leaves the wired surface untested — a refactor that moved
 * InlineBlocks back to its own `slice(PHASE3_DEFAULT_EXPANDED)` would keep
 * every pure-function pin green while the card vanished again. Both ends are
 * pinned, and reverting EITHER goes red.
 *
 * ## Scope of the claim (platform trap 3)
 * jsdom proves PRESENCE, never layout. Every assertion here is about DOM
 * membership, DOM order, and the affordance's accessible name. Nothing here
 * claims the card is above the fold, on screen, or unobstructed — that is a
 * browser measurement and this file makes no such claim.
 *
 * The turn under test is a REAL captured staging payload driven through the
 * shipped parse -> extract -> compose chain, so the card set and the ranks
 * that order it are the producer's, not a hand-built shape.
 *
 * ⚠ ONE EXCEPTION, AND IT IS THE COMPANION ITSELF: CEE emits the exercise
 * block with NO `priority_rank` and appends it LAST in its own array. Its
 * position in the composed order is a UI derivation
 * (`EXERCISE_RANK_AFTER_REVIEW_CARDS`, ROADMAP 2.211 §2 — `max(review)+0.5`,
 * which hoists it above the coaching band). "Composed position 11" below is
 * therefore the UI's number, not the producer's; the producer's own
 * positional order would put it last, 16 of 16. Both are past the cap.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { InlineBlocks } from '../InlineBlocks'
import { parseV5Response } from '../../../v5/responseParser'
import { extractPhase3FromV5Response } from '../../../v5/extractPhase3FromV5Response'
import { composePhase3BridgedBlocks } from '../useConversation'
import { mapV5Blocks } from '../../../v5/blocks/mapV5Blocks'
import { isPhase3CardBlock } from '../phase3Pacing'
import type { ConversationBlock } from '../types'

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

const FIXTURES = resolve(__dirname, '../../../v5/__tests__/fixtures')

/** Real staging `/proxy/v5/turn` body (probe 2.154, 2026-07-31). */
const CAPTURE = JSON.parse(
  readFileSync(resolve(FIXTURES, 'cee-analysis-turn-probe2154-2026-07-31.json'), 'utf8'),
) as { blocks: Array<Record<string, unknown>> }

/**
 * Companion card A — the repo's long-standing schema-validated exercise
 * fixture. It carries `failure_scenario`, a field the CEE builder does NOT
 * emit on this block, so it exercises the adapter's WIDER tolerance rather
 * than the live producer shape. Kept deliberately (review amendment 3).
 */
const WIDE_SHAPE_EXERCISE = (
  JSON.parse(
    readFileSync(resolve(FIXTURES, 'phase3-evidence-exercise.bundle-shaped.json'), 'utf8'),
  ) as { blocks: Array<Record<string, unknown>> }
).blocks.find((b) => b.type === 'exercise' && b.exercise_kind === 'pre_mortem')!

/**
 * Companion card B — THE EXACT SHAPE CEE CAN ACTUALLY SEND.
 *
 * Reconstructed key-for-key from `buildPreMortemExerciseBlock`
 * (`olumi-assistants-service` tip `6766b540`,
 * `src/orchestrator-v5/compose/phase3-blocks.ts`): the candidate object is
 * `{...commonMetadata(...), type, exercise_kind, warning_signs?, mitigation?,
 * review_trigger?, target_refs}` — TWELVE keys when all three optional prose
 * fields are present, and NOT ONE OF THEM IS A RANK. There is no
 * `failure_scenario` and no `priority_rank`: the wire block carries neither.
 *
 * Why this second case exists: the "the card is real, not a stub" evidence
 * must be anchored on a shape the producer can send. `adaptTypedExerciseBlock`
 * fails closed on a content-less card, so the live shape's survival depends
 * on `warning_signs` / `mitigation` / `review_trigger` alone — which is
 * exactly what this fixture supplies and what the assertions below read.
 */
const CEE_SHAPE_EXERCISE: Record<string, unknown> = {
  // commonMetadata()
  block_id: 'a3f1c7d2-5b84-4e19-9c60-2f7a81d4b0e5',
  signal_id: 'exercise:pre_mortem::gh_2242_probe2154',
  created_at: '2026-07-31T10:12:44.000+00:00',
  source_handler: 'decision_review_enricher',
  graph_hash_at_generation: 'gh_2242_probe2154',
  freshness: 'fresh',
  // the builder's own fields
  type: 'exercise',
  exercise_kind: 'pre_mortem',
  warning_signs: [
    'Sprint burndown flattens for two consecutive weeks.',
    'The integration partner stops answering scheduling requests.',
  ],
  mitigation: 'Book a mid-point checkpoint with the integration partner before committing budget.',
  review_trigger: 'Reconvene if the integration partner misses the checkpoint.',
  target_refs: [{ id: 'fac_delivery_risk', label: 'Delivery risk', kind: 'factor' }],
}

async function compose(body: unknown): Promise<ConversationBlock[]> {
  const parsed = await parseV5Response(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  if (parsed.kind !== 'response') throw new Error(`parse failed: ${parsed.kind}`)
  const phase3 = extractPhase3FromV5Response(parsed.response)
  return composePhase3BridgedBlocks(
    true,
    phase3.rawBlocks,
    mapV5Blocks(parsed.response.blocks, parsed.response.suggested_actions),
  )
}

let asCaptured: ConversationBlock[]
let withCompanion: ConversationBlock[]
let withCeeShapedCompanion: ConversationBlock[]

beforeAll(async () => {
  asCaptured = await compose(CAPTURE)
  withCompanion = await compose({
    ...CAPTURE,
    blocks: [...CAPTURE.blocks, WIDE_SHAPE_EXERCISE],
  })
  withCeeShapedCompanion = await compose({
    ...CAPTURE,
    blocks: [...CAPTURE.blocks, CEE_SHAPE_EXERCISE],
  })
})

function renderedPhase3Testids(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll(
      '[data-testid="v5-review-card"], [data-testid="v5-coaching"], [data-testid="v5-evidence"], [data-testid="v5-exercise"]',
    ),
  ).map((el) => el.getAttribute('data-testid') ?? '')
}

describe('InlineBlocks — 2.242 lens companion card guaranteed slot', () => {
  it('CONTROL: the composed turn is the real flood — 15 phase-3 cards, companion at composed position 11', () => {
    // Trap 13: prove the harness sees a genuinely paced turn and that the
    // companion really is deep in the overflow, before asserting it renders.
    expect(asCaptured.filter(isPhase3CardBlock)).toHaveLength(15)
    expect(withCompanion.filter(isPhase3CardBlock)).toHaveLength(16)
    const phase3Only = withCompanion.filter(isPhase3CardBlock)
    expect(phase3Only.findIndex((b) => b.type === 'v5_exercise')).toBe(10) // 0-based -> 11th
  })

  it('WITHOUT the companion: nothing changes — 6 cards render, "Show 9 more", no exercise card', () => {
    const { container } = render(<InlineBlocks blocks={asCaptured} />)
    expect(renderedPhase3Testids(container)).toEqual([
      'v5-evidence', 'v5-evidence', 'v5-evidence',
      'v5-review-card', 'v5-coaching', 'v5-review-card',
    ])
    expect(screen.getByRole('button', { name: /show 9 more/i })).toBeInTheDocument()
    expect(screen.queryByTestId('v5-exercise')).not.toBeInTheDocument()
  })

  it('WITH the companion: it is IN THE DOM by default despite sitting at composed position 11', () => {
    const { container } = render(<InlineBlocks blocks={withCompanion} />)
    const exercise = screen.getByTestId('v5-exercise')
    expect(exercise).toBeInTheDocument()
    expect(exercise).toHaveAttribute('data-exercise-kind', 'pre_mortem')
    // Producer copy renders verbatim — the card is real, not a stub.
    expect(screen.getByTestId('v5-exercise-failure-scenario')).toHaveTextContent(
      /the migration stalls/i,
    )
    // Still exactly 6 default-expanded phase-3 cards: the companion took the
    // 6th slot, it did not add a seventh.
    expect(renderedPhase3Testids(container)).toHaveLength(6)
  })

  it('composed order is untouched: the companion renders in its own position, after the review cards', () => {
    const { container } = render(<InlineBlocks blocks={withCompanion} />)
    // The reservation un-collapses a card; it never moves one. The exercise
    // is therefore LAST among the rendered cards, exactly where composition
    // put it relative to the five ahead of it.
    expect(renderedPhase3Testids(container)).toEqual([
      'v5-evidence', 'v5-evidence', 'v5-evidence',
      'v5-review-card', 'v5-coaching', 'v5-exercise',
    ])
  })

  it('the cap and the Show-more control are preserved: one affordance, count unchanged at 10', () => {
    render(<InlineBlocks blocks={withCompanion} />)
    const toggles = screen.getAllByRole('button', { name: /show \d+ more coaching and review card/i })
    expect(toggles).toHaveLength(1)
    // 16 phase-3 cards - 6 expanded = 10 collapsed. The companion displaced
    // the 6th card into the collapsed group; it did not shrink it.
    expect(toggles[0]).toHaveAccessibleName('Show 10 more coaching and review cards')
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(/10 more coaching and review cards collapsed/i)).toBeInTheDocument()
  })

  it('Show-more still reveals everything, in composed order, with the companion back in its own place', () => {
    const { container } = render(<InlineBlocks blocks={withCompanion} />)
    fireEvent.click(screen.getByRole('button', { name: /show 10 more/i }))
    const all = renderedPhase3Testids(container)
    expect(all).toHaveLength(16)
    // 11th card overall — the companion's composed position, unchanged by
    // having been expanded while the rest were collapsed.
    expect(all[10]).toBe('v5-exercise')
    // …and it is still the only one.
    expect(all.filter((t) => t === 'v5-exercise')).toHaveLength(1)
  })

  // ── Review finding A, RULED AS INTENDED (amendment 2) ──────────────────
  it('FINDING A (intended): the promoted companion renders BELOW the Show-more affordance', () => {
    // The affordance sits at the FIRST collapsed card — composed position 6,
    // the card the reservation displaced. The companion stays at its own
    // composed position 11. So the reader meets `Show 10 more` first and the
    // companion after it.
    //
    // This is the ACCEPTED COST of the ruled design, not a defect: option (i)
    // forbids visual reordering of producer content, and moving the card up
    // next to the affordance would be exactly that. The alternative —
    // grouping the guaranteed card visually adjacent to the top — is a
    // separate product call, deliberately NOT taken here.
    //
    // Pinned so the trade-off is a decision on the record rather than an
    // accident: if a later change quietly reorders the card, this goes red.
    const { container } = render(<InlineBlocks blocks={withCompanion} />)
    const nodes = Array.from(
      container.querySelectorAll(
        '[data-testid="v5-exercise"], button[aria-label^="Show 10 more"]',
      ),
    )
    expect(nodes).toHaveLength(2)
    expect(nodes[0].tagName).toBe('BUTTON')
    expect(nodes[1]).toHaveAttribute('data-testid', 'v5-exercise')
    // DOM order, stated the other way round too, so the pin cannot pass by
    // one of the two selectors silently matching nothing.
    expect(
      nodes[0].compareDocumentPosition(nodes[1]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────
// The shape CEE can actually send (amendment 3)
// ─────────────────────────────────────────────────────────────────────────

describe('InlineBlocks — 2.242 with the LIVE CEE companion shape (12 keys, no rank, no failure_scenario)', () => {
  it('CONTROL: the twelve-key builder shape survives the adapter and lands at composed position 11', () => {
    // Trap 13 in its sharpest form: if the fixture did not survive
    // `adaptTypedExerciseBlock`, every assertion below would pass by
    // rendering nothing. Prove the card exists and is buried FIRST.
    expect(Object.keys(CEE_SHAPE_EXERCISE)).toHaveLength(12)
    expect(CEE_SHAPE_EXERCISE).not.toHaveProperty('priority_rank')
    expect(CEE_SHAPE_EXERCISE).not.toHaveProperty('failure_scenario')
    const phase3Only = withCeeShapedCompanion.filter(isPhase3CardBlock)
    expect(phase3Only).toHaveLength(16)
    expect(phase3Only.findIndex((b) => b.type === 'v5_exercise')).toBe(10)
  })

  it('renders by default, with the producer prose the live shape actually carries', () => {
    const { container } = render(<InlineBlocks blocks={withCeeShapedCompanion} />)
    expect(screen.getByTestId('v5-exercise')).toBeInTheDocument()
    // The live shape has no failure_scenario — its survival and its content
    // rest on warning_signs / mitigation / review_trigger alone.
    expect(screen.queryByTestId('v5-exercise-failure-scenario')).not.toBeInTheDocument()
    expect(screen.getByTestId('v5-exercise-warning-signs')).toHaveTextContent(
      /sprint burndown flattens/i,
    )
    expect(screen.getByTestId('v5-exercise-mitigation')).toHaveTextContent(
      /mid-point checkpoint/i,
    )
    expect(screen.getByTestId('v5-exercise-review-trigger')).toHaveTextContent(
      /misses the checkpoint/i,
    )
    expect(renderedPhase3Testids(container)).toEqual([
      'v5-evidence', 'v5-evidence', 'v5-evidence',
      'v5-review-card', 'v5-coaching', 'v5-exercise',
    ])
    expect(
      screen.getByRole('button', { name: /show 10 more coaching and review cards/i }),
    ).toBeInTheDocument()
  })
})
