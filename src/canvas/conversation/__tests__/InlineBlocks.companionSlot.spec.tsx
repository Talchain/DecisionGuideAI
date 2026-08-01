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
 * shipped parse -> extract -> compose chain, so the card set, the producer
 * ranks and the resulting order are the producer's, not a hand-built shape.
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

/** The producer's own pre-mortem exercise block, verbatim from the schema-validated fixture. */
const PRODUCER_EXERCISE = (
  JSON.parse(
    readFileSync(resolve(FIXTURES, 'phase3-evidence-exercise.bundle-shaped.json'), 'utf8'),
  ) as { blocks: Array<Record<string, unknown>> }
).blocks.find((b) => b.type === 'exercise' && b.exercise_kind === 'pre_mortem')!

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

beforeAll(async () => {
  asCaptured = await compose(CAPTURE)
  withCompanion = await compose({
    ...CAPTURE,
    blocks: [...CAPTURE.blocks, PRODUCER_EXERCISE],
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
  it('CONTROL: the composed turn is the real flood — 15 phase-3 cards, companion at producer position 11', () => {
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

  it('WITH the companion: it is IN THE DOM by default despite sitting at producer position 11', () => {
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

  it('producer order is untouched: the companion renders in its own position, after the review cards', () => {
    const { container } = render(<InlineBlocks blocks={withCompanion} />)
    // The reservation un-collapses a card; it never moves one. The exercise
    // is therefore LAST among the rendered cards, exactly where the producer
    // rank put it relative to the five ahead of it.
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

  it('Show-more still reveals everything, in producer order, with the companion back in its own place', () => {
    const { container } = render(<InlineBlocks blocks={withCompanion} />)
    fireEvent.click(screen.getByRole('button', { name: /show 10 more/i }))
    const all = renderedPhase3Testids(container)
    expect(all).toHaveLength(16)
    // 11th card overall — the companion's producer position, unchanged by
    // having been expanded while the rest were collapsed.
    expect(all[10]).toBe('v5-exercise')
    // …and it is still the only one.
    expect(all.filter((t) => t === 'v5-exercise')).toHaveLength(1)
  })
})
