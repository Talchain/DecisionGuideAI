/**
 * currentModelKey — WHICH MODEL IS ON THE CANVAS RIGHT NOW, spelled once.
 *
 * The camera claim (`userCameraClaim.ts`) is keyed to a model: the user frames
 * a particular graph, and only the arrival of a DIFFERENT graph entitles the
 * product to take that frame back. Every site that takes or tests a claim must
 * therefore derive the identity the same way, or two of them will silently
 * disagree about whether the model changed — which is the defect this module
 * exists to make impossible to reintroduce (CLAUDE.md trap 12: derive, never
 * mirror).
 *
 * ⚠ THE IDENTITY IS STRUCTURAL, AND THAT IS THE POINT. `getGraphIdentityKey`
 * hashes the sorted node and edge ids, so it changes when the user adds,
 * deletes or pastes — and does NOT change when a layout merely recomputes
 * positions. That is exactly the distinction the claim needs: a corrective
 * re-layout of the model already on screen is not a new model, and must not
 * cost the user the view they asked for.
 *
 * ⚠ WHY THIS IS NOT IN `userCameraClaim.ts`. That module is deliberately
 * store-free — it holds a fact about the live camera, not about the model, and
 * its own header records why that state must never become persistable,
 * undoable or serialisable. Reading the store to STAMP a claim is a different
 * job from HOLDING one, so it lives here and the claim takes the key as an
 * argument.
 */
import { useCanvasStore } from '../store'
import { getGraphIdentityKey } from './graphNeedsInitialLayout'

/** The identity of the model currently on the canvas. */
export function currentModelKey(): string {
  const s = useCanvasStore.getState()
  return getGraphIdentityKey(s.currentScenarioId, s.nodes, s.edges)
}
