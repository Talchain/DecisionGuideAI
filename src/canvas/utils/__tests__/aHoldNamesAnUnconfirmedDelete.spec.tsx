/**
 * ⭐⭐ A HOLD NAMES AN UNCONFIRMED DELETE — the delete twin of
 * `aHoldSaysItsOperativeCause.spec.tsx`.
 *
 * ## The gap (hold-names-cause rebased onto #1905)
 *
 * #1905 residual 1 (`2910f2f7`) made a delete whose turn ended ambiguously (an
 * untyped 500, a transport loss) hold registration while the deletion is still
 * on the canvas (`unconfirmedStructuralDelete.ts`, cause
 * `unresolved_structural_edit`). hold-names-cause names rename, add, value and
 * in-delivery holds, but not this one: on a saved example the hold still said
 * "Analysis is held on a saved example. Re-draft it live to run one." A
 * re-draft REPLACES the model, so it would discard the user's unconfirmed delete
 * without a word.
 *
 * ## What this pins
 *
 *  1. The sentence names the deleted element, in the PROPOSED copy:
 *     "Olumi couldn't confirm that {label} was removed from the saved model, so
 *     analysis is waiting until it is settled. Would you like to ask Olumi to
 *     remove it?" A link is named "the link from {A} to {B}".
 *  1b. ITS ONE EXIT IS ONE THE USER CAN TAKE (Panel #1917 F1). The element is
 *     not on the canvas, so "remove it again" names nothing to select, and Undo
 *     is switched off on the canvas (`canvasSemanticMutations: 'disabled'`). The
 *     chat box is always on screen, and a later applied turn releases the hold
 *     whichever way CEE answers — proven through the real dispatcher in
 *     `oneWriterRegistration.spec.tsx` §13.
 *  2. The name comes from the DELETE RECORD. Once the delete is applied the
 *     element is not on the canvas, so the canvas cannot supply it; the intent's
 *     `restore` payload holds it at delete time.
 *  3. A delete of several elements names none of them rather than picking one.
 *  4. The sentence is registered as composed copy: the footer's CEE-text vet
 *     must not rewrite the user's label ("Edge...").
 *  5. REACTIVITY: the delete register is module state. Recording or settling a
 *     delete is not a store write, so a surface must re-render on it.
 *  6. CONTROLS: another scenario's delete, a reverted delete, an undone delete
 *     and an acknowledged model all leave the shipped behaviour unchanged.
 *
 * Every surface (legacy footer, gate reason, run chip, banner, parity, the V3
 * footer and the Model-tab bar) is swept for the two delete causes by the
 * shared fixture's `HOLD_CAUSES` (`registration/__tests__/helpers/editHoldCauses.ts`).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

import * as held from '../analysisHeldOnInjectedModel'
import { ANALYSIS_HELD_NOTICE } from '../analysisHeldOnInjectedModel'
import { vetBlockedReason } from '../vetBlockedReason'
import { NodeChip } from '../../nodes/shared/NodeChip'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { editDeliveryHold } from '../../registration/editDeliveryHold'
import { settleStructuralDeleteAttempt } from '../../conversation/unconfirmedStructuralDelete'
import {
  DELETED_ID,
  DELETED_LABEL,
  LINK_NAME,
  SCENARIO,
  acknowledgeCurrentGraph,
  applyDeleteToStore,
  arrangeHoldCause,
  captureDelete,
  resetEditHoldRegisters,
  seedHeldCanvas,
} from '../../registration/__tests__/helpers/editHoldCauses'

const REDRAFT = /re-?draft/i

/** The PROPOSED sentence (for Experience Design sign-off), verbatim. */
const deleteSentence = (named: string) =>
  `Olumi couldn't confirm that ${named} was removed from the saved model, so analysis is waiting until it is settled. ` +
  'Would you like to ask Olumi to remove it? If Olumi finds it already gone, reload this decision to see the saved model.'

/**
 * Exits the canvas cannot take while this hold stands (Panel #1917 F1): the
 * element is gone, so there is nothing to remove "again", and Undo is disabled
 * on the canvas (`mutationAuthority.ts` `canvasSemanticMutations`).
 */
const UNREACHABLE_EXIT = /remove it again|\bundo\b/i

function seedCanonicalRunPath() {
  try { localStorage.setItem('feature.v5CanonicalAnalysis', '1') } catch { /* jsdom quirk */ }
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
}

const state = () => useCanvasStore.getState() as never

function sharedSentence(): string | null {
  return held.heldReason(state())?.sentence ?? null
}

function renderRunChip() {
  return render(
    <ToastProvider>
      <NodeChip chipId="decision_run_analysis" actionType="run_analysis" label="Run analysis" message="Run the analysis now" />
    </ToastProvider>,
  )
}
const runChip = () => screen.getByRole('button', { name: 'Run analysis' })

beforeEach(() => {
  seedCanonicalRunPath()
  resetEditHoldRegisters()
  seedHeldCanvas()
})

afterEach(() => {
  cleanup()
  resetEditHoldRegisters()
  vi.unstubAllEnvs()
  try { localStorage.removeItem('feature.v5CanonicalAnalysis') } catch { /* jsdom quirk */ }
})

describe('PRECONDITIONS — the state #1905 holds on, and the name is not on the canvas', () => {
  it('node delete: held on the saved example, the delete holds, and no canvas node carries the deleted name', () => {
    arrangeHoldCause('unresolved_delete')
    expect(held.analysisHeldOn(state())).toBe('starter')
    expect(editDeliveryHold(state())).toBe('unresolved_structural_edit')
    const { nodes } = useCanvasStore.getState()
    expect(nodes.some((n) => n.id === DELETED_ID)).toBe(false)
    expect(nodes.some((n) => (n.data as { label?: unknown }).label === DELETED_LABEL)).toBe(false)
  })

  it('the node delete also took its incident link, and the restore payload holds the node', () => {
    const intent = captureDelete([DELETED_ID])
    expect(intent.claimedNodeIds).toEqual([DELETED_ID])
    expect(intent.claimedEdgeIds).toEqual(['e_reseller'])
    expect(intent.restore.nodes.map((n) => (n.data as { label?: unknown }).label)).toEqual([DELETED_LABEL])
  })

  it('link delete: held, the delete holds, the link is gone and both of its ends are still on the canvas', () => {
    arrangeHoldCause('unresolved_delete_link')
    expect(held.analysisHeldOn(state())).toBe('starter')
    expect(editDeliveryHold(state())).toBe('unresolved_structural_edit')
    const { nodes, edges } = useCanvasStore.getState()
    expect(edges.some((e) => e.id === 'e1')).toBe(false)
    expect(nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['fac_adoption', 'goal_1']))
  })
})

describe('the shared authority names the deleted element', () => {
  it('a node delete: the node, by the name the delete record kept', () => {
    arrangeHoldCause('unresolved_delete')
    const reason = held.heldReason(state())
    expect(reason?.sentence).toBe(deleteSentence(DELETED_LABEL))
    expect(reason?.kind).toBe('unconfirmed_delete')
  })

  it('a link deleted on its own: "the link from {A} to {B}"', () => {
    arrangeHoldCause('unresolved_delete_link')
    expect(sharedSentence()).toBe(deleteSentence(LINK_NAME))
  })

  it('a delete of several nodes names none of them rather than picking one', () => {
    const intent = captureDelete([DELETED_ID, 'opt_b'])
    applyDeleteToStore(intent)
    settleStructuralDeleteAttempt(intent, SCENARIO, 'unconfirmed')
    expect(sharedSentence()).toBe(deleteSentence('what you deleted'))
  })

  it.each([
    ['a node', 'unresolved_delete'],
    ['a link', 'unresolved_delete_link'],
  ] as const)('F1: %s — the one exit named is the chat, never one the canvas cannot take', (_what, cause) => {
    arrangeHoldCause(cause)
    const s = sharedSentence() as string
    expect(s.endsWith(' Would you like to ask Olumi to remove it? If Olumi finds it already gone, reload this decision to see the saved model.')).toBe(true)
    expect(s).not.toMatch(UNREACHABLE_EXIT)
  })

  it('F1: several elements — the same exit, and no unreachable one', () => {
    const intent = captureDelete([DELETED_ID, 'opt_b'])
    applyDeleteToStore(intent)
    settleStructuralDeleteAttempt(intent, SCENARIO, 'unconfirmed')
    const s = sharedSentence() as string
    expect(s.endsWith(' Would you like to ask Olumi to remove it? If Olumi finds it already gone, reload this decision to see the saved model.')).toBe(true)
    expect(s).not.toMatch(UNREACHABLE_EXIT)
  })

  it.each(['unresolved_delete', 'unresolved_delete_link'] as const)('%s: never offers re-draft or blames the example', (cause) => {
    arrangeHoldCause(cause)
    const s = sharedSentence() as string
    expect(s).not.toMatch(REDRAFT)
    expect(s).not.toContain('saved example')
  })

  it('registered as composed copy: the footer vet keeps the user’s own label ("Edge ...")', () => {
    arrangeHoldCause('unresolved_delete')
    const s = sharedSentence() as string
    expect(s).toBe(deleteSentence(DELETED_LABEL))
    expect(vetBlockedReason(s)).toBe(s)
  })
})

describe('REACTIVITY — recording or settling a delete moves the surfaces without a store write', () => {
  it('the run chip names the delete once it is recorded unconfirmed, and lets go once a delete is proven', () => {
    // The post-delete canvas, with nothing recorded yet: the example is the cause.
    const intent = captureDelete([DELETED_ID])
    applyDeleteToStore(intent)
    renderRunChip()
    expect(runChip()).toHaveAttribute('title', ANALYSIS_HELD_NOTICE.starter)

    // The untyped 500 records the attempt. That is module state, not the store.
    act(() => settleStructuralDeleteAttempt(intent, SCENARIO, 'unconfirmed'))
    expect(runChip()).toHaveAttribute('title', deleteSentence(DELETED_LABEL))

    // A later proven delete of the same node supersedes the record.
    act(() => settleStructuralDeleteAttempt(intent, SCENARIO, 'proven'))
    expect(runChip()).toHaveAttribute('title', ANALYSIS_HELD_NOTICE.starter)
  })
})

describe('CONTROLS — nothing else moves', () => {
  it('a delete recorded in ANOTHER scenario: the saved-example sentence, unchanged', () => {
    const intent = captureDelete([DELETED_ID])
    applyDeleteToStore(intent)
    settleStructuralDeleteAttempt(intent, 'another-scenario', 'unconfirmed')
    expect(editDeliveryHold(state())).toBeNull()
    expect(sharedSentence()).toBe(ANALYSIS_HELD_NOTICE.starter)
  })

  it('a REVERTED delete records nothing: the saved-example sentence, unchanged', () => {
    const intent = captureDelete([DELETED_ID])
    settleStructuralDeleteAttempt(intent, SCENARIO, 'reverted')
    expect(sharedSentence()).toBe(ANALYSIS_HELD_NOTICE.starter)
  })

  it('the deleted node back on the canvas (undo): the delete hold lets go, so the example is the cause again', () => {
    arrangeHoldCause('unresolved_delete')
    seedHeldCanvas({ withDeletedNode: true })
    expect(editDeliveryHold(state())).toBeNull()
    expect(sharedSentence()).toBe(ANALYSIS_HELD_NOTICE.starter)
  })

  it.each(['unresolved_delete', 'unresolved_delete_link'] as const)('model ACKNOWLEDGED + %s: no hold, no sentence', (cause) => {
    arrangeHoldCause(cause)
    acknowledgeCurrentGraph()
    expect(held.heldReason(state())).toBeNull()
  })
})
