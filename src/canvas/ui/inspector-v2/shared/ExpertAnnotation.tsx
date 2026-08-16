/**
 * ExpertAnnotation — inline expert-only annotation beside an existing control.
 *
 * Renders nothing when techMode is false. Replaces scattered `{techMode && ...}`
 * blocks. Two modes:
 *   - Display: small mono text (e.g. "σ 0.18", "normalised 0.72")
 *   - Editable: compact mono number input
 *
 * techMode is passed as an explicit prop (no React context) so panels remain
 * easy to follow and testing stays simple.
 */

import type { ReactNode } from 'react'

interface ExpertAnnotationDisplayProps {
  techMode: boolean
  children: ReactNode
  editable?: false
}

interface ExpertAnnotationEditableProps {
  techMode: boolean
  editable: true
  value: number
  onChange: (v: number) => void
  onEditStart?: (v: number) => void
  onCommit?: (v: number) => void
  ariaLabel?: string
  /** Prefix label shown before the input, e.g. "σ =", "β =", "normalised =" */
  suffix?: string
  step?: number
  min?: number
  max?: number
}

type ExpertAnnotationProps = ExpertAnnotationDisplayProps | ExpertAnnotationEditableProps

export function ExpertAnnotation(props: ExpertAnnotationProps) {
  if (!props.techMode) return null

  if (props.editable) {
    const { value, onChange, onEditStart, onCommit, ariaLabel, suffix, step = 0.01, min, max } = props
    const commitCurrent = (input: HTMLInputElement) => {
      const v = Number(input.value)
      if (Number.isFinite(v)) onCommit?.(v)
    }
    return (
      <div className="flex items-center gap-1 mt-1">
        {suffix && (
          <span
            className="text-[10px] leading-none text-text-light font-mono"
          >
            {suffix}
          </span>
        )}
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          aria-label={ariaLabel}
          onFocus={e => onEditStart?.(Number(e.currentTarget.value))}
          onChange={e => {
            const raw = e.target.value
            if (raw === '') return // cleared field — don't push 0
            const v = Number(raw)
            if (Number.isFinite(v)) onChange(v)
          }}
          onBlur={e => commitCurrent(e.currentTarget)}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          className="text-[10px] leading-none font-mono text-right bg-panel border border-panel-border rounded px-1 py-0.5 w-16 text-text-body focus:outline-none focus:border-primary"
        />
      </div>
    )
  }

  return (
    <div
      className="text-[10px] leading-none text-text-light font-mono mt-1"
    >
      {props.children}
    </div>
  )
}
