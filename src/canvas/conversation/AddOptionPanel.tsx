/**
 * AddOptionPanel — the surface that turns "add an option called X" into the
 * typed `add_option` chip CEE's zero-LLM transaction consumes.
 *
 * It is a REQUEST BUILDER, not a receipt. It renders no outcome, no success
 * state and no post-send confirmation: once the chip is dispatched the panel is
 * gone and the only account of what happened is CEE's own hold/confirm copy,
 * which names every operation. `NO_OUTCOME_CLAIM_VOCABULARY` and its spec pin
 * that rule mechanically.
 *
 * The user's typed message is never lost. "Send as a message instead" hands the
 * original text to the ordinary free-text lane, byte-identical to what would
 * have happened had this panel not opened.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'

import { typography } from '../../styles/typography'
import { formatValueWithUnit } from '../utils/formatValueWithUnit'
import { MAX_ADD_OPTION_INTERVENTIONS } from '../../v5/chipParameters'
import { ADD_OPTION_REFUSAL_COPY } from './addOptionRequest'
import type { AddOptionChange, AddOptionFactorTarget } from './addOptionRequest'

export interface AddOptionPanelProps {
  /** Label extracted from the user's message — a prefill, always editable. */
  readonly initialLabel: string
  /** Label of the decision this option will sit under, for orientation. */
  readonly decisionLabel: string | null
  readonly factors: readonly AddOptionFactorTarget[]
  /** Refusal text to show, e.g. from `describeAddOptionRefusal`. */
  readonly refusal?: string | null
  readonly busy?: boolean
  readonly onSubmit: (label: string, changes: readonly AddOptionChange[]) => void
  /** Send the user's original message down the ordinary free-text lane. */
  readonly onSendAsMessage: () => void
  readonly onCancel: () => void
}

interface RowState {
  readonly checked: boolean
  readonly text: string
}

function initialRowState(factor: AddOptionFactorTarget): RowState {
  return {
    checked: false,
    text: factor.currentRaw != null ? String(factor.currentRaw) : '',
  }
}

const INPUT_CLASS =
  'w-28 rounded-md border border-panel-border bg-panel px-2 py-1 text-text-body outline-none focus:border-info disabled:opacity-50'

export function AddOptionPanel({
  initialLabel,
  decisionLabel,
  factors,
  refusal,
  busy = false,
  onSubmit,
  onSendAsMessage,
  onCancel,
}: AddOptionPanelProps) {
  const [label, setLabel] = useState(initialLabel)
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(factors.map((f) => [f.id, initialRowState(f)])),
  )
  const labelRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    labelRef.current?.focus()
    labelRef.current?.select()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const toggleRow = useCallback((id: string) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], checked: !prev[id]?.checked } }))
  }, [])

  const setRowText = useCallback((id: string, text: string) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], text } }))
  }, [])

  const checkedIds = useMemo(
    () => factors.filter((f) => rows[f.id]?.checked).map((f) => f.id),
    [factors, rows],
  )

  /**
   * A ticked factor with an unparseable number is REFUSED here rather than
   * dropped, defaulted or coerced — the builder's no-silent-defaulting rule,
   * enforced at the surface so the user sees which row is at fault.
   */
  const invalidIds = useMemo(
    () =>
      checkedIds.filter((id) => {
        const parsed = Number.parseFloat(rows[id]?.text ?? '')
        return !Number.isFinite(parsed)
      }),
    [checkedIds, rows],
  )

  const overCap = checkedIds.length > MAX_ADD_OPTION_INTERVENTIONS
  const canSubmit = label.trim().length > 0 && invalidIds.length === 0 && !overCap && !busy

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return
    const changes: AddOptionChange[] = checkedIds.map((id) => ({
      factorId: id,
      rawValue: Number.parseFloat(rows[id]?.text ?? ''),
    }))
    onSubmit(label.trim(), changes)
  }, [canSubmit, checkedIds, rows, label, onSubmit])

  const handleBackdrop = useCallback(
    (e: ReactMouseEvent) => {
      if (e.target === e.currentTarget) onCancel()
    },
    [onCancel],
  )

  const handleLabelKey = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  return (
    <div
      className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-option-title"
      data-testid="add-option-panel"
    >
      <div className="bg-panel rounded-lg shadow-panel p-6 w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100vh-4rem)] overflow-y-auto">
        <h3 id="add-option-title" className={`${typography.panelHeader} text-text-header mb-1`}>
          Add an option
        </h3>
        <p className={`${typography.panelBody} text-text-light mb-4`}>
          {decisionLabel
            ? `A new option under "${decisionLabel}". Nothing changes on your canvas yet.`
            : 'Nothing changes on your canvas yet.'}
        </p>

        <label className={`${typography.panelHeader} text-text-header block mb-1`} htmlFor="add-option-label">
          Name
        </label>
        <input
          id="add-option-label"
          ref={labelRef}
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={handleLabelKey}
          disabled={busy}
          data-testid="add-option-label-input"
          className={`${typography.bodySmall} w-full rounded-md border border-panel-border bg-panel px-3 py-2 text-text-body outline-none focus:border-info mb-5`}
        />

        {factors.length > 0 && (
          <>
            <p className={`${typography.panelHeader} text-text-header mb-1`}>What this option changes</p>
            <p className={`${typography.panelBody} text-text-light mb-3`}>
              Optional. Tick a factor and give it the value this option would produce — up to{' '}
              {MAX_ADD_OPTION_INTERVENTIONS}.
            </p>
            <ul className="mb-5 space-y-2" data-testid="add-option-factor-list">
              {factors.map((factor) => {
                const row = rows[factor.id] ?? { checked: false, text: '' }
                const invalid = row.checked && invalidIds.includes(factor.id)
                return (
                  <li key={factor.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`add-option-factor-${factor.id}`}
                      checked={row.checked}
                      onChange={() => toggleRow(factor.id)}
                      disabled={busy}
                      className="flex-none"
                    />
                    <label
                      htmlFor={`add-option-factor-${factor.id}`}
                      className={`${typography.panelBody} text-text-body flex-1 min-w-0`}
                    >
                      <span className="block truncate">{factor.label}</span>
                      {factor.currentRaw != null && (
                        <span className={`${typography.panelMeta} text-text-light`}>
                          now {formatValueWithUnit(factor.currentRaw, factor.unit)}
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      step="any"
                      aria-label={`New value for ${factor.label}`}
                      value={row.text}
                      onChange={(e) => setRowText(factor.id, e.target.value)}
                      disabled={busy || !row.checked}
                      data-testid={`add-option-value-${factor.id}`}
                      className={`${typography.bodySmall} ${INPUT_CLASS} ${
                        invalid ? 'border-danger' : ''
                      }`}
                    />
                    <span className={`${typography.panelMeta} text-text-light w-16 flex-none`}>
                      {factor.unit ?? (factor.cap ? '' : '0–1')}
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {overCap && (
          <p className={`${typography.panelBody} text-danger mb-3`} data-testid="add-option-over-cap">
            {ADD_OPTION_REFUSAL_COPY.overCap(MAX_ADD_OPTION_INTERVENTIONS)} Untick{' '}
            {checkedIds.length - MAX_ADD_OPTION_INTERVENTIONS} of them.
          </p>
        )}
        {invalidIds.length > 0 && (
          <p className={`${typography.panelBody} text-danger mb-3`} data-testid="add-option-invalid">
            {ADD_OPTION_REFUSAL_COPY.factorNeedsNumber}
          </p>
        )}
        {refusal && (
          <p className={`${typography.panelBody} text-danger mb-3`} data-testid="add-option-refusal">
            {refusal}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={onSendAsMessage}
            disabled={busy}
            data-testid="add-option-send-as-message"
            className={`${typography.panelBody} text-text-light underline underline-offset-2 hover:text-text-body disabled:opacity-50`}
          >
            Send as a message instead
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              data-testid="add-option-cancel"
              className={`px-4 py-2 ${typography.bodySmall} text-text-body bg-panel-hover rounded-lg hover:bg-panel-border disabled:opacity-50`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              data-testid="add-option-submit"
              className={`px-4 py-2 ${typography.panelHeader} text-text-on-color bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50`}
            >
              Ask Olumi to add it
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
