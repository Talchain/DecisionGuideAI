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
import { typography } from '../../../../styles/typography'

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
    const { value, onChange, suffix, step = 0.01, min, max } = props
    return (
      <div className="flex items-center gap-1 mt-1">
        {suffix && (
          <span
            className={`${typography.panelMeta} text-text-light font-mono`}
            style={{ fontSize: 10 }}
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
          onChange={e => {
            const v = Number(e.target.value)
            if (Number.isFinite(v)) onChange(v)
          }}
          className={`${typography.panelMeta} font-mono text-right bg-panel border border-panel-border rounded px-1 py-0.5 text-text-body focus:outline-none focus:border-primary`}
          style={{ fontSize: 10, width: 64 }}
        />
      </div>
    )
  }

  return (
    <div
      className={`${typography.panelMeta} text-text-light font-mono mt-1`}
      style={{ fontSize: 10 }}
    >
      {props.children}
    </div>
  )
}
