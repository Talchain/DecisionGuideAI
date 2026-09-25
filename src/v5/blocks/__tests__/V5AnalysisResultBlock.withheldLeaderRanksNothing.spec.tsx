/**
 * ⭐⭐ UI-SEM-097 — A WITHHELD LEADER IS NOT RANKED BY WIN SHARE.
 *
 * ── THE SERVED DEFECT (final tuple UI `b017e3c2` · CEE `9417228`, #69 5827478637)
 * Pricing's explicit Run: `leader_claim { permitted: false, withheld_reason:
 * 'constraint_verdict_withheld' }`, `analysis_result.leading_option_id: null`,
 * and the reply said "No option can be put forward yet". The chat's result card
 * still printed the three options with their win shares in descending order —
 * an overall ranking, the one thing the producer had declined to state. AI
 * Quality measured it on 29 of 30 served explicit Runs (#69 5827505713).
 *
 * ── WHAT THIS PINS, on the REAL served response (not a hand-built block) ────
 *   · WITHHELD (this run named no leader) → no win-share row at all.
 *   · WITHHELD (the held report carries the producer's refusal) → no row, even
 *     on a block that does carry a leader id.
 *   · PERMITTED twins → the row renders, in the order the producer licensed.
 *   · DATA PRESERVED → the summary still renders; nothing is transformed.
 *
 * CLAIM TYPE: jsdom. The capture is the real `/agent/v1/turn` body
 * (`fixtures/openai-route-coaching-journey.e39f6e0.json`, C2 run), mapped by the
 * shipped `mapV5Blocks`. No model calls.
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

import { V5AnalysisResultBlock } from '../V5AnalysisResultBlock'
import { mapV5Blocks } from '../mapV5Blocks'
import { useCanvasStore } from '../../../canvas/store'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../../canvas/conversation/types'
import servedJourney from '../../../canvas/conversation/__tests__/fixtures/openai-route-coaching-journey.e39f6e0.json'

type ServedTurn = { turn: string; json: Record<string, unknown> }
const turns = (servedJourney as unknown as { turns: ServedTurn[] }).turns

/** The C2 explicit Run, exactly as served. */
const RUN = turns.find((t) => t.turn === 'C2 run') as ServedTurn

function servedResultBlock(): V5AnalysisResultBlockType {
  const blocks = mapV5Blocks(
    RUN.json.blocks as Parameters<typeof mapV5Blocks>[0],
    (RUN.json.suggested_actions ?? []) as Parameters<typeof mapV5Blocks>[1],
  )
  const found = blocks.find((b) => b.type === 'v5_analysis_result')
  if (!found) throw new Error('the served C2 run must carry an analysis_result block')
  return found as V5AnalysisResultBlockType
}

const ROW = 'v5-analysis-result-probabilities'

const initialResults = useCanvasStore.getState().results

function holdReportWithPermission(permitted: boolean): void {
  useCanvasStore.setState({
    results: {
      ...initialResults,
      report: {
        producer_leader_permission: permitted
          ? { permitted: true }
          : { permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: 'constraint_verdict_withheld' },
      },
    },
  } as never)
}

beforeEach(() => {
  useCanvasStore.setState({ results: initialResults } as never)
})

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ results: initialResults } as never)
})

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-VACUITY — the capture really is the withheld shape, and really ranks.
// ─────────────────────────────────────────────────────────────────────────────

describe('the served capture is the defect shape', () => {
  it('the turn withholds the leader claim for the constraint verdict', () => {
    const state = RUN.json.analysis_state as { leader_claim: { permitted: boolean; withheld_reason: string } }
    expect(state.leader_claim.permitted).toBe(false)
    expect(state.leader_claim.withheld_reason).toBe('constraint_verdict_withheld')
  })

  it('its analysis_result names no leader yet carries 2+ win shares', () => {
    const block = servedResultBlock()
    expect(block.leading_option_id).toBeNull()
    expect(Object.keys(block.win_probabilities ?? {}).length).toBeGreaterThanOrEqual(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// THE FIX
// ─────────────────────────────────────────────────────────────────────────────

describe('a withheld leader is not ranked by win share', () => {
  it('SERVED: the Run that named no leader shows no win-share row', () => {
    render(<V5AnalysisResultBlock block={servedResultBlock()} />)
    expect(screen.queryByTestId(ROW)).toBeNull()
    // No option's win share reaches the card as a percentage.
    for (const share of Object.values(servedResultBlock().win_probabilities ?? {})) {
      const pct = `${Math.round(share * 100)}%`
      expect(screen.queryByText(pct)).toBeNull()
    }
  })

  it('SERVED: the summary still renders, word for word (data preserved)', () => {
    render(<V5AnalysisResultBlock block={servedResultBlock()} />)
    expect(screen.getByTestId('v5-analysis-result-summary')).toHaveTextContent(
      servedResultBlock().summary,
    )
  })

  it('a whitespace-only leading_option_id names no one either: no row', () => {
    render(<V5AnalysisResultBlock block={{ ...servedResultBlock(), leading_option_id: '   ' }} />)
    expect(screen.queryByTestId(ROW)).toBeNull()
  })

  it('the HELD REPORT’s refusal withholds too, even on a block that names a leader', () => {
    const [rank1] = Object.entries(servedResultBlock().win_probabilities ?? {}).sort(([, a], [, b]) => b - a)[0]
    holdReportWithPermission(false)
    render(<V5AnalysisResultBlock block={{ ...servedResultBlock(), leading_option_id: rank1 }} />)
    expect(screen.queryByTestId(ROW)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLS — a permitted run is unchanged
// ─────────────────────────────────────────────────────────────────────────────

describe('PERMITTED controls keep the win-share row', () => {
  it('the same served block, with a leader named and no refusal held, shows every share (in canvas order: no leader is LICENSED here)', () => {
    // RE-PINNED (RC ruling #69 5829442152 §4). This was "largest first". The
    // served block is the producer's near tie (`is_tie: true`) and carries no
    // band, so the verdict licenses no leader. Such a card keeps EVERY number
    // ("the claim is withheld, never the numbers" still holds) and lists the
    // options in canvas order; this test's canvas has no options, so the order
    // is the wire's own. Largest-first is `unlicensedCanvasOrder.spec.tsx`'s
    // licensed control.
    const shares = servedResultBlock().win_probabilities ?? {}
    const [rank1] = Object.entries(shares).sort(([, a], [, b]) => b - a)[0]
    render(<V5AnalysisResultBlock block={{ ...servedResultBlock(), leading_option_id: rank1 }} />)
    const pills = within(screen.getByTestId(ROW)).getAllByRole('listitem')
    const wire = Object.keys(shares)
    expect(pills).toHaveLength(wire.length)
    wire.forEach((label, i) => expect(pills[i]).toHaveTextContent(label))
  })

  it('a held report that PERMITS does not withhold (the stamp only ever withholds)', () => {
    const [rank1] = Object.entries(servedResultBlock().win_probabilities ?? {}).sort(([, a], [, b]) => b - a)[0]
    holdReportWithPermission(true)
    render(<V5AnalysisResultBlock block={{ ...servedResultBlock(), leading_option_id: rank1 }} />)
    expect(screen.getByTestId(ROW)).toBeInTheDocument()
  })

  it('an EARLIER withheld run stays withheld after a later run permits (per-card, not the latest verdict)', () => {
    // The held report now belongs to a later, permitting run.
    holdReportWithPermission(true)
    render(<V5AnalysisResultBlock block={servedResultBlock()} />)
    expect(screen.queryByTestId(ROW)).toBeNull()
  })
})
