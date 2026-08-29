/**
 * OUTCOME WITNESS — what a user actually reads on a blocked draft.
 *
 * This is deliberately NOT a field-level assertion. It drives a REAL captured
 * `analysis_ready` payload through the production pipeline the panel uses —
 * `validateBeforeRun` → `enrichAndSortBlockers` → `hydrateBlockerLabels` — and
 * pins the three things the user sees: the card TITLE, the card BODY, and
 * whether the destructive Retry Draft button renders.
 *
 * CAPTURE PROVENANCE: `POST /proxy/v5/turn` against deployed CEE build
 * `f18d941`, 2026-08-29, anonymous turn. Brief: an in-house-vs-agency delivery
 * speed decision. Response returned `analysis_ready.status: 'needs_user_input'`,
 * `may_run: false`, and the three `missing_value` blockers embedded below,
 * copied verbatim. This is the exact shape that failed link 4 in 20 of 23
 * fresh journeys.
 *
 * BEFORE this fix, every card read:
 *   title       "Agency delivery speed" is not connected
 *   body        This factor influences outcomes but no option directly affects it.
 *   actions     Connect it to an option / Remove if not relevant
 *   retry       Retry Draft button rendered
 * — of which the title and body were FALSE (the option→factor edge exists; only
 * the effect magnitude is missing) and the button was destructive (re-drafting
 * discards options added in chat) and futile (it cannot supply the magnitude).
 */
import { describe, it, expect } from 'vitest'
import { validateBeforeRun } from '../../../hooks/usePreRunValidation'
import { enrichAndSortBlockers, hydrateBlockerLabels } from '../blockerEnrichment'
import type { CEEAnalysisReady } from '../../../../adapters/cee/types'
import type { Node } from '@xyflow/react'

/** Verbatim from the captured response body. */
const WIRE_BLOCKERS = [
  {
    option_id: '5fdf255f',
    option_label: 'Outsource to an Agency',
    factor_id: 'a2af4a80',
    factor_label: 'Agency delivery speed',
    blocker_type: 'missing_value',
    message:
      'Factor "Agency delivery speed" is currently Moderate (0.5). What should option "Outsource to an Agency" set it to?',
    suggested_action: 'add_value',
  },
  {
    option_id: 'c020bd06',
    option_label: 'Keep the Current Team and Buy Tooling',
    factor_id: 'aafd0a92',
    factor_label: 'Tooling and automation level',
    blocker_type: 'missing_value',
    message:
      'Factor "Tooling and automation level" is currently Moderate (0.5). What should option "Keep the Current Team and Buy Tooling" set it to?',
    suggested_action: 'add_value',
  },
  {
    option_id: 'fb48249a',
    option_label: 'Hire Two Senior Engineers',
    factor_id: '0f70d1a2',
    factor_label: 'In-house engineering capacity',
    blocker_type: 'missing_value',
    message:
      'Factor "In-house engineering capacity" is currently Moderate (0.5). What should option "Hire Two Senior Engineers" set it to?',
    suggested_action: 'add_value',
  },
]

function factorNode(id: string, label: string): Node {
  return {
    id,
    type: 'custom',
    position: { x: 0, y: 0 },
    data: { label, kind: 'factor', category: 'controllable' },
  } as Node
}

const NODES: Node[] = [
  factorNode('a2af4a80', 'Agency delivery speed'),
  factorNode('aafd0a92', 'Tooling and automation level'),
  factorNode('0f70d1a2', 'In-house engineering capacity'),
  { id: '6c8845ea', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Delivery speed', kind: 'goal' } } as Node,
]

const NODES_BY_ID = new Map(
  NODES.map(n => [n.id, { label: (n.data as { label?: string }).label }]),
)

const WIRE_READY = {
  status: 'needs_user_input',
  may_run: false,
  goal_node_id: '6c8845ea',
  options: [
    { id: '5fdf255f', label: 'Outsource to an Agency', status: 'needs_encoding', interventions: {} },
    { id: 'c020bd06', label: 'Keep the Current Team and Buy Tooling', status: 'needs_encoding', interventions: {} },
    { id: 'fb48249a', label: 'Hire Two Senior Engineers', status: 'needs_encoding', interventions: {} },
  ],
  blockers: WIRE_BLOCKERS,
} as unknown as CEEAnalysisReady

/** The panel's real composition order. */
function renderCards() {
  const result = validateBeforeRun('6c8845ea', NODES, [], WIRE_READY)
  const ceeCards = hydrateBlockerLabels(
    enrichAndSortBlockers(result.blockers),
    NODES_BY_ID,
  ).filter(c => c.blocker.code === 'CEE_BLOCKER')
  return ceeCards
}

describe('OUTCOME — the blocked-draft card a user reads', () => {
  it('renders one card per unanswered option→factor pair', () => {
    expect(renderCards()).toHaveLength(3)
  })

  it("asks CEE's question, naming the option and the factor", () => {
    // Bind by IDENTITY (factor id), not by position or by a value predicate.
    const card = renderCards().find(c => c.blocker.affectedIds?.[0] === 'a2af4a80')
    expect(card).toBeDefined()
    expect(card!.display.description).toBe(
      'Factor "Agency delivery speed" is currently Moderate (0.5). What should option "Outsource to an Agency" set it to?',
    )
    expect(card!.display.title).toBe('"Agency delivery speed" needs an effect value')
  })

  it('states no false cause on any card', () => {
    for (const card of renderCards()) {
      expect(card.display.title).not.toContain('is not connected')
      expect(card.display.description).not.toContain('no option directly affects it')
      expect(card.display.suggestedActions).not.toContain('Connect it to an option')
      expect(card.display.suggestedActions).not.toContain('Remove if not relevant')
    }
  })

  it('offers no destructive Retry Draft button on any card', () => {
    for (const card of renderCards()) {
      // BlockersSection renders that button iff `display.supportsRetry`.
      expect(card.display.supportsRetry).toBe(false)
    }
  })

  it('points at the option the user must open, by id', () => {
    const card = renderCards().find(c => c.blocker.affectedIds?.[0] === 'aafd0a92')
    expect(card).toBeDefined()
    expect(card!.blocker.action?.type).toBe('configure_option')
    expect(card!.blocker.action?.optionId).toBe('c020bd06')
    expect(card!.display.suggestedActions).toEqual([
      'Configure "Keep the Current Team and Buy Tooling"',
    ])
  })
})
