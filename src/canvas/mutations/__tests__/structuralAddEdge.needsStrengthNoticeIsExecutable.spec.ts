import { describe, expect, it } from 'vitest'

import { USER_EDGE_DEFAULTS } from '../../domain/edges'
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
    /**
     * ⭐⭐ REPAIRED 2026-09-18 BY THE EDGE-STRENGTH UNLOCK LANE, AND THE OLD
     * ASSERTION'S OWN PROSE PREDICTED THIS EXACT REPAIR.
     *
     * It read `expect(CANONICAL_EDIT_AUTHORITY.preAnalysisEdgeStrength)
     * .toBe('disabled')`, and the paragraph above it already said what a flip
     * would and would not mean: *"Flipping this key would NOT falsify the
     * notice's conclusion ... It falsifies the REASON."* That is precisely what
     * happened. The key is now `'server_graph'` and the pre-analysis picker
     * genuinely emits `edge_strength_edit`, so the old sentence — "the handler
     * is `undefined`, so the picker receives nothing" — has stopped being true.
     *
     * ⛔ THE PRECONDITION ITSELF IS UNCHANGED AND STILL HOLDS, FOR A BETTER
     * REASON. That lane did not merely flip a flag: the picker is now gated PER
     * EDGE on `edgeStrengthEditIsAssertable`, the same question `EdgePanel`
     * asks, so a freshly drawn link — which has no server-stated strength —
     * receives no handler and renders no pills. The second writer is still not
     * live on THIS link.
     *
     * ⭐ AND THE ASSERTION IS NOW BOUND TO THE RIGHT OBJECT. The old form was a
     * claim about a SURFACE-WIDE FLAG, which could flip for reasons having
     * nothing to do with drawn links — as it just did. This asks the question
     * the notice actually depends on, about the very edge the notice is about,
     * so it stays RED-able if the picker is ever pointed at a strength-less
     * link and cannot go green by an unrelated flag moving.
     *
     * ⚠ The prose above still cites `PreAnalysisPanel.tsx:1279` and `:676`.
     * Both line numbers are stale after that lane's edit; the mechanism it
     * describes — one local `updateEdgeData`, gated surface-wide — is the
     * BEFORE state, kept because it is what this assertion was written against.
     */
    expect(edgeStrengthEditIsAssertable(drawnEdge as never)).toBe(false)
  })

  it('PRECONDITION 2 — and that same link cannot reach the strength control at all', () => {
    // `EdgePanel.tsx` renders `disabled={!strengthReachesTheModel}` from this
    // exact predicate. Asked of the emitter, never re-derived, so this cannot
    // drift from what the panel does.
    expect(edgeStrengthEditIsAssertable(drawnEdge as never)).toBe(false)
  })

  it('THEREFORE the notice must not tell the user to set the strength themselves', () => {
    expect(STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE).not.toMatch(/set (its|the|a) strength/i)
  })

  it('and it must still say where the link actually is, so the user is not left guessing', () => {
    expect(STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE).toMatch(/canvas only/i)
  })

  /**
   * ⭐ THE ROUTE IT NAMES IS **WIRE-WITNESSED** — held, confirmed, applied, and
   * a cold re-read at 17 -> 18 edges on the deployed build.
   *
   * ⚠ BUT THE ASSERTION BELOW IS UNCHANGED, AND THE REASON IT SURVIVES IS THE
   * WHOLE POINT: the witness is **n=1** — one pair, one phrasing, one build —
   * and a second lane's run of a different request shape landed **1 of 4**.
   * **Existence is witnessed; RELIABILITY is unmeasured.** A sentence may name a
   * route it can reach and still must not promise an outcome it cannot rate.
   *
   * ⛔ THIS COMMENT AND THIS TEST'S NAME PREVIOUSLY SAID THE ROUTE WAS "NOT
   * WIRE-WITNESSED" AND CITED A ZERO-OPS RUN. **Both were superseded.** Fixed
   * here rather than at merge because a PR written to stop false statements
   * shipping must not ship a false rung in its own comments.
   */
  it('names the route without promising the outcome, because reliability is unmeasured', () => {
    expect(STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE).toMatch(/ask olumi/i)
    expect(STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE).not.toMatch(
      /will be saved|and it will|saves it|then it('s| is) saved/i,
    )
  })
})
