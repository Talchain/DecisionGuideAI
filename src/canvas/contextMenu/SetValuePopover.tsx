/**
 * SetValuePopover — inline numeric input for "Custom…" set value action.
 *
 * Anchored near the context menu position. Shows unit label and range hint
 * when available. Confirms via Enter or button click.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { typography } from '../../styles/typography'
import { useCanvasStore } from '../store'

interface SetValuePopoverProps {
  nodeId: string
  anchorPos: { x: number; y: number }
  onConfirm: (nodeId: string, value: number) => void
  onClose: () => void
}

function getNodeMeta(nodeId: string) {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId)
  if (!node) return { unit: '', rangeHint: '', label: '' }

  const os = node.data?.observedState as any
  const prior = node.data?.prior as any
  const ss = (node.data as any)?.state_space

  const unit = os?.unit ?? ''
  const label = (node.data as any)?.label ?? ''

  let min: number | null = null
  let max: number | null = null
  if (os?.range_min != null && os?.range_max != null) { min = os.range_min; max = os.range_max }
  else if (prior?.range_min != null && prior?.range_max != null) { min = prior.range_min; max = prior.range_max }
  else if (ss?.range?.min != null && ss?.range?.max != null) { min = ss.range.min; max = ss.range.max }

  const rangeHint = min != null && max != null ? `Range: ${min}–${max}${unit ? ` ${unit}` : ''}` : ''

  return { unit, rangeHint, label }
}

export function SetValuePopover({ nodeId, anchorPos, onConfirm, onClose }: SetValuePopoverProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const { unit, rangeHint, label } = getNodeMeta(nodeId)

  // Focus input on mount
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus())
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
    onConfirm(nodeId, num)
    onClose()
  }, [value, nodeId, onConfirm, onClose])

  // Adjust position to stay in viewport
  const x = Math.min(anchorPos.x, window.innerWidth - 260)
  const y = Math.min(anchorPos.y, window.innerHeight - 120)

  return (
    <div
      ref={popoverRef}
      className="fixed z-[101] w-[240px] rounded-xl border border-panel-border bg-panel p-3 shadow-2"
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
          onChange={(e) => setValue(e.target.value)}
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
