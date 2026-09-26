/**
 * SetValuePopover — inline numeric input for "Custom…" set value action.
 *
 * Anchored near the context menu position. Confirms via Enter or button click.
 *
 * ⭐⭐ IT COMMITS THROUGH THE CARD'S WRITER, SO IT SPEAKS THE CARD'S SCALE
 * (26 Sep 2026). `onConfirm` proposes through `useModelEditAuthority
 * .proposeFactorValue`, which reads the typed number in the scale the card's
 * field SHOWS — `resolveValueInputSeed`, the one rule every sibling editor
 * seeds from. So this field is seeded from that rule too, and says only what is
 * true in that scale:
 *   · the unit is shown only when the field IS in user units;
 *   · the range hint is shown only when the range (model scale) is in the
 *     field's scale (`modelScaleValueIsTheTypedScale`). A "Range: 0.1–0.5" beside
 *     a £ field invites typing 0.5 and sending £0.50 — the P0 recorded in
 *     `FactorNode.inlineEditorSeedsTheCommitScale.spec.tsx`.
 *
 * ⛔ A REFUSAL KEEPS IT OPEN, as the card's field stays open: `not_encodable`
 * and `local_only` are said here, in the card's words, never read as a save.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { typography } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { modelScaleValueIsTheTypedScale, resolveValueInputSeed } from '../conversation/factorValueEdit'
import { VALUE_COMMIT_SETTLEMENT_COPY, VALUE_NOT_ENCODABLE_COPY } from '../conversation/valueCommitSettlement'
import { getNodeRange, type MenuValueCommitOutcome } from './actions'

interface SetValuePopoverProps {
  nodeId: string
  anchorPos: { x: number; y: number }
  /** Proposes through the card's writer and returns ITS outcome. */
  onConfirm: (nodeId: string, value: number) => MenuValueCommitOutcome
  onClose: () => void
}

function getNodeMeta(nodeId: string) {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId)
  if (!node) return { unit: '', rangeHint: '', label: '', seed: '' }

  const os = node.data?.observedState as any
  const { seed, inUserUnits } = resolveValueInputSeed(node.data)
  const unit = inUserUnits ? (os?.unit ?? '') : ''
  const label = (node.data as any)?.label ?? ''

  const range = modelScaleValueIsTheTypedScale(node.data) ? getNodeRange(node) : null
  const rangeHint = range ? `Range: ${range.min}–${range.max}${unit ? ` ${unit}` : ''}` : ''

  return { unit, rangeHint, label, seed: seed != null ? String(seed) : '' }
}

export function SetValuePopover({ nodeId, anchorPos, onConfirm, onClose }: SetValuePopoverProps) {
  const [meta] = useState(() => getNodeMeta(nodeId))
  const { unit, rangeHint, label } = meta
  const [value, setValue] = useState(meta.seed)
  const [refusal, setRefusal] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Focus input on mount, with the seeded number selected so typing replaces it
  // (the card's editor does the same, for the same served witness).
  useEffect(() => {
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select() })
  }, [])

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleConfirm = useCallback(() => {
    const num = parseFloat(value)
    if (isNaN(num)) return
    const outcome = onConfirm(nodeId, num)
    // ⛔ STAY OPEN on a refusal — the card's rule: a refusal must not read as a save.
    if (outcome === 'not_encodable') return setRefusal(VALUE_NOT_ENCODABLE_COPY)
    if (outcome === 'local_only') return setRefusal(VALUE_COMMIT_SETTLEMENT_COPY.local_only.message)
    onClose()
  }, [value, nodeId, onConfirm, onClose])

  // Adjust position to stay in viewport
  const x = Math.min(anchorPos.x, window.innerWidth - 260)
  const y = Math.min(anchorPos.y, window.innerHeight - 120)

  return (
    <div
      ref={popoverRef}
      className="fixed z-[101] w-[240px] rounded-md border border-panel-border bg-panel p-3 shadow-2"
      style={{ left: x, top: y }}
    >
      <p className={`${typography.panelMeta} mb-2 text-text-light`}>
        Set value for {label || 'node'}
      </p>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="number"
          step="any"
          value={value}
          onChange={(e) => { setValue(e.target.value); if (refusal) setRefusal(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
          placeholder="Enter value"
          className="h-8 flex-1 rounded-lg border border-panel-border bg-surface px-2 text-text-body outline-none focus:border-primary"
          aria-label="Custom value"
        />
        {unit && <span className={`${typography.panelMeta} text-text-light`}>{unit}</span>}
      </div>
      {rangeHint && (
        <p className={`${typography.panelMeta} mt-1 text-text-light`}>{rangeHint}</p>
      )}
      {refusal && (
        <p role="alert" className={`${typography.panelMeta} mt-1 text-text-body`}>{refusal}</p>
      )}
      <button
        onClick={handleConfirm}
        disabled={value === '' || isNaN(parseFloat(value))}
        className="mt-2 h-8 w-full rounded-lg bg-primary text-text-on-color transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Apply
      </button>
    </div>
  )
}
