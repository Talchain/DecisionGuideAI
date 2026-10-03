import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { USER_EDGE_DEFAULTS } from '../../domain/edges'
import { InspectorRouter } from '../../ui/inspector-v2/InspectorRouter'
import { useCanvasStore } from '../../store'
import {
  resolveEdgeSignedStrengthDisplay,
  resolveEdgeDirectionDisplay,
} from '../../domain/edgeValueProvenance'
import { edgeStrengthEditIsAssertable } from '../../conversation/edgeStrengthEdit'
import { CANONICAL_EDIT_AUTHORITY } from '../mutationAuthority'
import {
  STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE,
  captureStructuralAddEdge,
} from '../structuralAddEdge'

vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

/**
 * ⭐⭐⭐ A NOTICE IS TESTED FOR TWO DIFFERENT PROPERTIES AND ONLY ONE OF THEM
 * USED TO BE CHECKED HERE.
 *
 * #1539 shipped this notice saying *"Set its strength to save it to the model"*.
 * Its review — mine — verified the sentence was TRUTHFUL ABOUT A STATE (the link
 * really does stay on the canvas) and WITNESSED on a real build. It never asked
 * whether the ACTION it instructs is EXECUTABLE, and it is not: the only writer
 * of `weight`/`weightSource` is `EdgePanel.setStrength`, which renders
 * `disabled` unless `edgeStrengthEditIsAssertable` holds — and that asks for a
 * strength THE SERVER HOLDS, which is exactly what a freshly drawn link has not
 * got. Both sentences shipped in one bundle: the toast said *set its strength*,
 * the inspector said *no strength on record*, with the control greyed.
 *
 * **Truthfulness about a state and executability of an action are two different
 * properties of one string.** This spec pins the second.
 *
 * ⭐ AND IT IS THE INTERLOCK WITH THE CONTRACT FIX. The moment a
 * `structural_add_edge` arm accepts a strength-less link, precondition 2 below
 * goes RED — forcing whoever closes the contract gap to revisit this copy
 * rather than letting the sentence become true by accident. *A wrong claim that
 * later comes true through somebody else's unrelated change is worse than one
 * that stays wrong, because nobody ever learns it was wrong.*
 */
describe('STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE instructs nothing the product refuses', () => {
  /** Exactly what `onConnect` builds: `USER_EDGE_DEFAULTS`, no provenance stamps. */
  const drawnEdge = {
    id: 'e-drawn',
    source: '2891dabb',
    target: 'c12af5de',
    data: { ...USER_EDGE_DEFAULTS },
  }

  it('PRECONDITION 1 — this notice belongs to a drawn link, whose capture stands down as strength_not_stated', () => {
    const result = captureStructuralAddEdge({
      edgesAfter: [drawnEdge],
      edgeId: drawnEdge.id,
      baseGraphHash: 'srv-hash',
      externalMutationActive: false,
      resolveSignedStrength: (data) =>
        resolveEdgeSignedStrengthDisplay(data as Record<string, unknown> | undefined),
      resolveDirection: (data) =>
        resolveEdgeDirectionDisplay(data as Record<string, unknown> | undefined),
      makeId: () => 'intent-1',
    })

    expect(result.ok).toBe(false)
    // Bound by IDENTITY of the reason, never by "some refusal happened": a
    // different stand-down would be a different notice.
    expect(result.ok === false && result.reason).toBe('strength_not_stated')
  })

  /**
   * ⛔⛔ PRECONDITION 2b — THE SECOND WRITER, FOUND BY THE REVIEWER WHEN I ASKED
   * THEM TO ATTACK MY "ONLY WRITER" CLAIM. IT WAS FALSE AS I WORDED IT.
   *
   * `PreAnalysisPanel.tsx:1279` ALSO writes `weight`/`weightSource: 'user'` —
   * the KeyRelationships Weakly/Moderately/Strongly picker, whose own comment
   * says it *"Mirrors `useInspectorMutations.setStrength`"*. It carries no
   * `edgeStrengthEditIsAssertable`, no `hasServerGraphAuthority` and no
   * `disabled`, and its "top 3 edges by connectivity" selection makes a freshly
   * drawn edge eligible BY CONSTRUCTION — a new edge adds degree to both
   * endpoints.
   *
   * It writes nothing today for an entirely different reason:
   * `PreAnalysisPanel.tsx:676` gates the handler on
   * `hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.preAnalysisEdgeStrength)`,
   * and that key reads `'disabled'`, so `onUpdateEdgeStrength` is `undefined`
   * and the picker receives no handler at all.
   *
   * ⭐ SO THE PREMISE HOLDS BY **REACHABILITY**, NEVER BY **UNIQUENESS** — and
   * the original PR proved it by the wrong route (an `rg` sweep plus a file's
   * own claim about itself). The answer was in the authority table. This is
   * recorded in the test rather than only in prose because the next person
   * greps, finds two writers, and must be able to tell whether I knew.
   *
   * ⭐ AND THE TWO GATES ANSWER DIFFERENT QUESTIONS (trap 21, one surface over):
   * `EdgePanel`'s is PER-EDGE — *does the server hold a strength for THIS
   * link?* — while this one is PER-CARRIER — *does this canvas own a server
   * graph at all?* Precondition 2 binds the first and is structurally blind to
   * the second, which is exactly why this assertion is separate.
   *
   * ⚠ WHAT IT DOES AND DOES NOT GUARD, STATED SO IT IS NOT READ AS MORE.
   * Flipping this key would NOT falsify the notice's conclusion: a
   * KeyRelationships write is a LOCAL `updateEdgeData`, and capture happens only
   * inside `addEdge`, so the link still never reaches the model. **It falsifies
   * the REASON** — "a link that has no strength" stops being true of a drawn
   * link while "Olumi can't save it" stays true. A true sentence with a dead
   * reason is the failure mode this whole spec exists to catch.
   */
  it('PRECONDITION 2b — and no SECOND strength writer is live on that link either', () => {
    expect(CANONICAL_EDIT_AUTHORITY.preAnalysisEdgeStrength).toBe('disabled')
  })

  it('PRECONDITION 2 — and that same link cannot reach the strength control at all', () => {
    // `EdgePanel.tsx` renders `disabled={!strengthReachesTheModel}` from this
    // exact predicate. Asked of the emitter, never re-derived, so this cannot
    // drift from what the panel does.
    expect(edgeStrengthEditIsAssertable(drawnEdge as never)).toBe(false)
  })

  /**
   * ⭐⭐ PRECONDITION 3 — ADDED 27 Sep 2026 (canvas audit edit-structure/F3), AND
   * IT IS WHY THE "THEREFORE" BELOW WAS INVERTED RATHER THAN KEPT.
   *
   * Preconditions 2 and 2b are still true and still pinned: the EDIT control is
   * fenced for a drawn link. But the old conclusion ("so the notice must not
   * say set its strength") silently assumed that fence was the ONLY strength
   * control. It is not any more. The stand-down receipt gave this population
   * its OWN control — `EdgePanel`'s add-control, `edge-state-strength-for-save`,
   * rendered INSTEAD of the fenced fieldset — and its band re-runs the capture
   * and sends `structural_add_edge` with the person's magnitude (served:
   * Moderate → 200, the link survived a reload). The old pin kept the toast
   * pointing at the chat while that control sat one double-click away: the
   * disclosure defect F3 measured.
   *
   * Bound by identity THROUGH `InspectorRouter`, on exactly the edge `addEdge`
   * leaves behind — so withdrawing the control turns this RED, and with it the
   * licence for the sentence.
   */
  it('PRECONDITION 3 — the drawn link DOES get a strength control: the add-control, rendered by identity', () => {
    useCanvasStore.setState({
      nodes: [
        { id: drawnEdge.source, type: 'factor', data: { label: 'Marketing' }, position: { x: 0, y: 0 } },
        { id: drawnEdge.target, type: 'goal', data: { label: 'Revenue' }, position: { x: 0, y: 0 } },
      ] as never[],
      edges: [{ ...drawnEdge, data: { ...drawnEdge.data, structuralAddStandDown: 'strength_not_stated' } }] as never[],
      results: { status: 'idle' },
      selection: { nodeIds: new Set(), edgeIds: new Set([drawnEdge.id]), anchorPosition: null },
      goalThreshold: null,
      confirmedNodeIds: new Set(),
      _internal: {},
    } as never)
    render(<InspectorRouter nodeId={null} edgeId={drawnEdge.id} onClose={vi.fn()} />)
    expect(screen.getByTestId('edge-state-strength-for-save')).toBeTruthy()
  })

  it('THEREFORE the notice names that move: set its strength, in the link panel', () => {
    expect(STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE).toMatch(/set its strength/i)
    expect(STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE).toMatch(/link panel/i)
  })

  it('and it must still say where the link actually is, so the user is not left guessing', () => {
    expect(STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE).toMatch(/canvas only/i)
  })

  /**
   * ⛔ REWRITTEN 27 Sep 2026 (edit-structure/F3). This case read "names the
   * route without promising the outcome" and pinned `/ask olumi/` — the chat
   * route, which is real (wire-witnessed n=1) but is no longer the move the
   * sentence names now that a one-click control states the strength. What it
   * protected is kept: no promised outcome. The add-control's sender has no
   * revert lifecycle, so the sentence says the link is SENT, never SAVED.
   */
  it('promises no outcome: it says "sends", never "saved"', () => {
    expect(STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE).toMatch(/sends it to the model/i)
    expect(STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE).not.toMatch(
      /will be saved|and it will|saves it|then it('s| is) saved/i,
    )
  })
})
