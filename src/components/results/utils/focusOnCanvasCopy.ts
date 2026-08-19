/**
 * ⭐⭐ THE ONE LABEL FOR THE `onFocusNode` CHIP ON A RESULTS CARD — and the one
 * testid family that binds a test to it.
 *
 * ## What it supersedes, and why the old label was FALSE
 *
 * `OptionCards.tsx` rendered a chip labelled **"Edit interventions"** whose
 * `onClick` was `onFocusNode(option.id)`. That handler edits nothing. Traced at
 * this tip, on the path this card is actually mounted through:
 *
 *   `OutputsDock.tsx:3182` passes `onFocusNode={handleFocusResultNode}`, and
 *   `handleFocusResultNode` (`OutputsDock.tsx:1415-1422`) does exactly three
 *   things — `focusExistingTarget(nodeId, 'node')` (a fail-closed camera move),
 *   `setHighlightedNodes([nodeId])`, and a 3-second timer that clears the
 *   highlight. It moves the camera and flashes the node. It opens no editor and
 *   writes no value.
 *
 * The estate has a DEDICATED helper for actually opening the inspector
 * (`canvas/nodes/shared/openNodeInspector.ts`) and this path does not call it —
 * which is the clearest evidence that focusing and editing are two different
 * operations here, not two names for one.
 *
 * ## Why this is a CONVERGENCE and not a reword
 *
 * The identical handler ALREADY had an honest label one file away.
 * `NotAnalysedOptionCard.tsx` renders the same `onFocusNode(option.id)` chip as
 * **"Show on canvas"** under testid `not-analysed-focus-<id>`. So the estate
 * held two labels for one behaviour, and the wrong one was the one that
 * promised editing. Per Paul's convergence rule the fix is to name the owner
 * and delete the competing spelling, not to add a third: both call sites now
 * read their label from here.
 *
 * ⚠ "Edit interventions" is NOT retired as a phrase — it is retired FROM THIS
 * HANDLER. `canvas/ui/NodeInspector.tsx:848` uses it for a control that really
 * does open the intervention editor (`setShowMappingForm(true)` →
 * `UserMappingForm`), which is the honest use of those words. Leaving one true
 * spelling and one false one is exactly how a label stops meaning anything.
 *
 * ## Deliberately precise, not vague
 *
 * "Show on canvas" states the whole of what happens. It is not a softened
 * version of an editing promise — it is a different, complete and true claim,
 * and it was already this estate's own wording for this exact handler.
 */

/** The user-facing label for the `onFocusNode` chip on any results card. */
export const FOCUS_ON_CANVAS_LABEL = 'Show on canvas'

/**
 * Testid for the focus chip on a given option's card.
 *
 * Kept beside the label so a spec can bind to the control by IDENTITY rather
 * than by matching its text — the text is the thing under change, and a
 * text-bound assertion would pass on any reword, including another false one
 * (CLAUDE.md trap 19).
 */
export function focusOnCanvasTestId(optionId: string): string {
  return `option-focus-on-canvas-${optionId}`
}
