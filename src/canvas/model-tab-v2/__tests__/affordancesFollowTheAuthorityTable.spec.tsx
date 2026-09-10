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
 * WHAT THIS GUARD IS, PRECISELY. It is a DERIVATION **AND** A PIN, and it needs
 * both. The derivation computes each expectation from the imported authority
 * table at run time, so the SURFACE cannot drift from the TABLE. The pin,
 * `FACTOR_CONFIRMATION_GRANTED_TODAY`, is a hand-written literal recording what
 * the table SAYS today, so the table cannot move without reddening this file.
 *
 * ⚠⚠ THIS FILE FIRST SHIPPED CLAIMING TO BE A PURE DERIVATION AND THEREFORE TO
 * RED "IN BOTH DIRECTIONS". THAT WAS MEASURED FALSE, TWICE. One seat flipped
 * `modelFactorConfirmation` to `'server_graph'` and both derived cases stayed
 * GREEN; a second reached the same result structurally, from the source alone.
 * The cause was the SHAPE of the comparison, not a careless expectation: the
 * expectation's `granted` and the panel's `FACTOR_CONFIRMATION_CONNECTED` were
 * the same function over the same key, so a flip moved both sides at once. Only
 * the direction actually tested was ever real, which is a surface wired without
 * its key.
 *
 * ⚠ AND THE ABSENCES WERE VACUOUS AT REST. With the capability withheld,
 * `expect(queryByTestId(X) !== null).toBe(false)` holds for any X: a seat
 * substituted ids that never existed and the file stayed 5 passed / 5. The two
 * affordance ids are therefore pinned at their SOURCE, because a value
 * assertion cannot prove a reference.
 *
 * ⚠ SCOPE, AND IT IS NARROWER THAN THIS FILE ONCE CLAIMED. It asserts the
 * SURFACE agrees with the TABLE, and that the table still reads as recorded. It
 * does not assert the table is RIGHT — that is `mutationAuthority.ts`'s own
 * question (trap 21: write down the question each authority answers). Nor does
 * it bind the panel's PROSE: the corrected sentences live in a file-level JSDoc
 * block, and this directory's source scanners strip comments by design, so no
 * guard here can stop that prose rotting again. Any claim to the contrary,
 * including the panel header's own, overstates what a comment can be held to.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments } from '../../../../tests/helpers/stripSourceComments'
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

const V2_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const PANEL_SRC = join(V2_DIR, 'ModelTabV2Panel.tsx')
const ROW_SRC = join(V2_DIR, 'ModelRowView.tsx')

/**
 * ⭐⭐ THE LITERAL POSTURE — and it is the whole repair for the first blocking
 * finding, so it is worth saying why a derivation could not do this job.
 *
 * This file's header claimed the guard "REDs in BOTH directions". Two seats
 * measured that false, one by flipping the key and one structurally from the
 * source alone. The reason is not a bad expectation, it is the SHAPE of the
 * comparison: the expectation's `granted` and the panel's own
 * `FACTOR_CONFIRMATION_CONNECTED` were `hasServerGraphAuthority` over the SAME
 * key. Flip `modelFactorConfirmation` and both sides move together, so the
 * comparison stays true and nothing REDs. A guard agreeing with itself.
 *
 * ⚠ THE DERIVATION IS NOT REMOVED, BECAUSE IT ANSWERS A DIFFERENT QUESTION
 * (trap 12d, and trap 21 on naming the question each authority answers):
 *
 *   the DERIVATION asks — does the SURFACE agree with the TABLE?
 *   this LITERAL asks  — is the TABLE still what this file was written against?
 *
 * Derivation stops the surface drifting from the table; only a hand-written
 * pin notices the table itself moving. Neither supersedes the other, so both
 * are asserted below, against each other.
 *
 * WHEN THIS REDS, THAT IS THE MECHANISM WORKING. Enabling factor confirmation
 * is a legitimate future change. It must come here, flip this constant, and
 * re-read the header prose in the same commit, which is exactly the step whose
 * absence let that prose rot twice.
 */
// Annotated `boolean`, not left to infer the literal type `false`: the message
// ternary below must stay a genuine condition rather than being narrowed to one
// arm, so the assertion reports correctly whichever way this is set.
const FACTOR_CONFIRMATION_GRANTED_TODAY: boolean = false

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

  it('⚠ THE TABLE ITSELF is what this file was written against', () => {
    // The literal posture pin. Without it, every expectation below is computed
    // from the same key the surface reads, so a key flip moves both sides and
    // reds nothing. See the note on FACTOR_CONFIRMATION_GRANTED_TODAY.
    expect(CANONICAL_EDIT_AUTHORITY.modelFactorConfirmation).toBe('disabled')
    expect(hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.modelFactorConfirmation)).toBe(
      FACTOR_CONFIRMATION_GRANTED_TODAY,
    )
  })

  it('⭐ the factor-confirmation affordances render IFF the table grants it', () => {
    const granted = hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.modelFactorConfirmation)
    renderPanel()

    // THE DERIVATION, KEPT — surface must agree with table. It is now compared
    // against the LITERAL rather than standing on its own, so a key flip REDs
    // here instead of moving both sides of the comparison together.
    expect(granted).toBe(FACTOR_CONFIRMATION_GRANTED_TODAY)

    const chip = screen.queryByTestId(`model-row-v2-${FACTOR_ID}-confirm-as-is`)
    expect(
      chip !== null,
      FACTOR_CONFIRMATION_GRANTED_TODAY
        ? 'modelFactorConfirmation is server_graph, so the row Confirm chip MUST render'
        : 'modelFactorConfirmation is not server_graph, so the row Confirm chip must NOT render',
    ).toBe(FACTOR_CONFIRMATION_GRANTED_TODAY)
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
    expect(granted).toBe(FACTOR_CONFIRMATION_GRANTED_TODAY)

    const queueChip = screen.queryByTestId('model-tab-v2-chip-confirm-estimates')
    expect(queueChip !== null).toBe(FACTOR_CONFIRMATION_GRANTED_TODAY)
  })

  /**
   * ⭐⭐ THE ABSENCES ABOVE ARE NOT VACUOUS — the second blocking finding.
   *
   * While the table withholds this capability, `granted` is false, so
   * `expect(queryByTestId(X) !== null).toBe(false)` passes for EVERY value of
   * X, including an id that never existed. That is not hypothetical: a seat
   * replaced both queried testids with fabricated ones and the file stayed
   * 5 passed / 5. So a rename of either affordance is invisible here, and the
   * comment at the repair-queue case records that this file has ALREADY
   * shipped exactly that defect once (a wrong testid that passed anyway).
   *
   * The render-time positive control cannot close this: it asserts the panel
   * and the subject row, neither of which is one of the two affordance ids.
   *
   * So the ids are pinned at their SOURCE instead. A value assertion cannot
   * prove a reference — it passes on a byte-identical copy — and coupling to a
   * render site needs a guard that reads that site. Rename either `data-testid`
   * and this REDs, while the panel stays compiled out and unrenderable.
   *
   * ⚠ `stripComments`, NOT `blankNonCode`: both ids live INSIDE a string or
   * template literal, which `blankNonCode` erases, so it would read text with
   * the target already blanked and certify a clean sweep by testing nothing.
   * That exact defect shipped twice in this directory's sibling source scan.
   */
  it('⭐ the queried testids are REAL render sites, so a rename has somewhere to RED', () => {
    const rowRaw = readFileSync(ROW_SRC, 'utf8')
    const rowCode = stripComments(rowRaw, ROW_SRC)
    const panelCode = stripComments(readFileSync(PANEL_SRC, 'utf8'), PANEL_SRC)

    expect(rowCode).toContain('data-testid={`model-row-v2-${row.id}-confirm-as-is`}')
    expect(panelCode).toContain('data-testid="model-tab-v2-chip-confirm-estimates"')

    // CONTRAST CONTROL — the matcher discriminates rather than matching anything.
    expect(rowCode).not.toContain('data-testid={`model-row-v2-${row.id}-confirm-as-was`}')
    expect(panelCode).not.toContain('data-testid="model-tab-v2-chip-confirm-guesses"')

    // ⭐ AND THE PIPELINE CONTROL, through the SAME helper the claims above use.
    // `ModelRowView` names this id in PROSE as well as at the render site, so
    // without a working stripper a comment could be what satisfies this test.
    // Present in the raw file, absent once comments are blanked.
    expect(rowRaw).toContain('NOT `-confirm`')
    expect(rowCode).not.toContain('NOT `-confirm`')
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
