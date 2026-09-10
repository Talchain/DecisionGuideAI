import { typography } from '../../../../styles/typography'
import { useEdgeLabelMode } from '../../../store/edgeLabelMode'

/**
 * ⭐ THE BOARD'S CONNECTION-LABEL MODE: phrases or numbers.
 *
 * ⛔ EXTRACTED FROM `EdgePanel` SO IT CAN BE MOUNTED OUTSIDE THE AUTHORITY
 * FIELDSET, AND THAT IS THE WHOLE POINT OF THE MOVE.
 *
 * It first shipped inside `EdgePanel`, whose sole mount is wrapped by
 * `InspectorRouter`'s unconditional `<fieldset disabled data-authority>`. A
 * disabled fieldset natively inerts every form-associated descendant, `<button>`
 * included, so the control rendered and `setMode` was never reachable — the zero
 * it was written to close stayed open, and the panel's own spec could not see it
 * because that spec renders `EdgePanel` directly and therefore bypasses the
 * fence (trap 3b: bound to a surface the real render does not produce).
 *
 * ⭐ WHY OUTSIDE IS CORRECT HERE, RATHER THAN ADMITTING THE PANEL. This writes
 * NO model value. It sets how the canvas renders labels it already has, so it is
 * the same class as `Show technical detail`, which the authority guard's own
 * register already lists as a `presentation toggle`. The fence's notice says the
 * fields inside "are read-only for now"; a display preference does not belong
 * under that sentence. Contrast `factor-external`, which was admitted THROUGH
 * the fence instead, because `setPriorRange` reaches a durable carrier — two
 * different remedies because they answer two different questions.
 *
 * ⚠ It reads the store directly and takes no props, which is why the move is a
 * relocation rather than a rewrite: no state was lifted, no wiring changed.
 */
export function EdgeLabelModeToggle() {
  const mode = useEdgeLabelMode(state => state.mode)
  const setMode = useEdgeLabelMode(state => state.setMode)

  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`${typography.panelMeta} text-text-light`}>
        Connection labels on the board
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={mode === 'numeric'}
        aria-label="Show numbers on connection labels"
        data-testid="edge-label-mode-toggle"
        onClick={() => setMode(mode === 'numeric' ? 'human' : 'numeric')}
        className={`${typography.panelMeta} px-2 py-0.5 rounded border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-info ${
          mode === 'numeric'
            ? 'border-info text-info'
            : 'border-border text-text-light hover:bg-panel-hover'
        }`}
      >
        {mode === 'numeric' ? 'Numbers' : 'Phrases'}
      </button>
    </div>
  )
}
