/**
 * ⭐⭐ THE PANEL'S EDIT AFFORDANCES MUST FOLLOW `CANONICAL_EDIT_AUTHORITY`, AND
 * THE PANEL'S HEADER MUST NOT SAY OTHERWISE.
 *
 * WHY THIS EXISTS — two claims in that header were measurably FALSE at
 * `3b2df4ce`, and they misled a live audit of this surface before they were
 * caught:
 *
 *   "EDIT COVERAGE AT THIS TIP …
 *      · FACTOR CONFIRMATION — the row's Confirm chip, stamping `user_confirmed`."
 *
 *     FALSE. `CANONICAL_EDIT_AUTHORITY.modelFactorConfirmation` is `'disabled'`,
 *     so `FACTOR_CONFIRMATION_CONNECTED` is `false` and the chip (`:1093`), the
 *     "N to verify" attention chip (`:1022`) and the whole `RepairQueueList`
 *     branch (`:1033`) are COMPILED OUT. The `proposeFactorConfirmation` code
 *     and its dispatcher are live and unreachable.
 *
 *   "The last two are LOCAL COMMITS with no wire carrier."
 *
 *     FALSE for option interventions. `modelOptionIntervention` is
 *     `'server_graph'`; `proposeOptionIntervention` builds a real
 *     `option_intervention_edit` and REFUSES rather than writing locally.
 *
 * ⚠ A HEADER THAT ADVERTISES A COMPILED-OUT CAPABILITY IS WORSE THAN NO HEADER.
 * It is the estate's dominant defect — the hand-maintained mirror — in the one
 * place a new lane reads first to learn what a surface can do. Both sentences
 * drifted the same way: a key flipped in `mutationAuthority.ts` and the prose
 * describing its consequence here did not move, because nothing made it.
 *
 * WHAT THIS GUARD IS, PRECISELY. It is a DERIVATION, not a pin: every
 * expectation below is computed from the imported authority table at run time,
 * so there is no literal here to go stale. It therefore REDs in BOTH directions
 * — when a key is flipped ON and the surface is not wired, and when a surface is
 * wired without its key. That is the mechanism the prose never had.
 *
 * ⚠ SCOPE. This asserts the SURFACE agrees with the TABLE. It does not assert
 * the table is right — that is `mutationAuthority.ts`'s own question, and a
 * different one (trap 21: write down the question each authority answers).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { Node, Edge } from '@xyflow/react'

vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }) }
})
vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

import { ModelTabV2Panel } from '../ModelTabV2Panel'
import {
  CANONICAL_EDIT_AUTHORITY,
  hasServerGraphAuthority,
} from '../../mutations/mutationAuthority'
import { openOutlineGroups } from './openOutlineGroups'

/** An AI-estimated factor value nobody has ratified — the confirm chip's subject. */
const FACTOR_ID = 'fac_unconfirmed'

const NODES = [
  { id: 'goal_x', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Grow ARR', kind: 'goal' } },
  {
    id: FACTOR_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Sales rep adoption',
      kind: 'factor',
      category: 'observable',
      observed_state: { value: 0.6, source: 'cee_inference' },
    },
  },
] as unknown as Node[]

function renderPanel() {
  render(<ModelTabV2Panel nodes={NODES} edges={[] as Edge[]} goalThreshold={null} />)
  openOutlineGroups()
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('the surface agrees with the authority table', () => {
  it('POSITIVE CONTROL: the panel and the subject row really rendered', () => {
    // Every assertion below is about the PRESENCE OR ABSENCE of an affordance.
    // Without this, an absence would be indistinguishable from a panel that
    // rendered nothing at all (trap 13).
    renderPanel()
    expect(screen.getByTestId('model-tab-v2-panel')).toBeInTheDocument()
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}`)).toBeInTheDocument()
  })

  it('⭐ the factor-confirmation affordances render IFF the table grants it', () => {
    const granted = hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.modelFactorConfirmation)
    renderPanel()

    // DERIVED, never a literal: flipping the key in `mutationAuthority.ts`
    // changes what this expects, so wiring and authority cannot drift apart in
    // either direction.
    const chip = screen.queryByTestId(`model-row-v2-${FACTOR_ID}-confirm-as-is`)
    expect(
      chip !== null,
      granted
        ? 'modelFactorConfirmation is server_graph, so the row Confirm chip MUST render'
        : 'modelFactorConfirmation is not server_graph, so the row Confirm chip must NOT render',
    ).toBe(granted)
  })

  it('⭐ the repair-queue entry point renders IFF the table grants it', () => {
    const granted = hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.modelFactorConfirmation)
    renderPanel()

    // ⚠ THE TESTID HERE WAS WRONG IN THE FIRST DRAFT
    // (`model-tab-v2-attention-confirm-estimates`), and the case PASSED anyway:
    // `queryByTestId` returned null, `granted` is false at this tip, and
    // false === false. A guard agreeing with itself — caught by reading the
    // source for the real testid, never by the green. The mutation below is what
    // now proves it discriminates.
    //
    // The same key gates a second, separate affordance. Asserting only the chip
    // would leave this one free to drift — the "member added in SOME of its
    // declaration sites and not all" defect this directory keeps hitting.
    const queueChip = screen.queryByTestId('model-tab-v2-chip-confirm-estimates')
    expect(queueChip !== null).toBe(granted)
  })

  it('⚠ the two keys are DISTINCT, and this file must not conflate them', () => {
    // The header's false sentence lumped factor confirmation and option
    // interventions together as "the last two … LOCAL COMMITS". They are two
    // keys with two answers, and at this tip they DISAGREE — which is exactly
    // the state a single sentence about "the last two" cannot express.
    expect(CANONICAL_EDIT_AUTHORITY.modelFactorConfirmation)
      .not.toBe(CANONICAL_EDIT_AUTHORITY.modelOptionIntervention)
  })

  it('⚠ option interventions are SERVER-BACKED, not a local commit', () => {
    // Pinned as its own case because the header asserted the opposite in words.
    // If this key is ever returned to 'disabled', this REDs and whoever does it
    // must say so here rather than leaving the prose to rot again.
    expect(hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.modelOptionIntervention)).toBe(true)
  })
})
