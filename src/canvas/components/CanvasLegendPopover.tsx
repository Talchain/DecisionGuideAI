/**
 * CanvasLegendPopover — a compact "How to read this" toolbar disclosure.
 *
 * Presentational only: reads nothing from the graph and triggers no actions.
 * Opens on click (keyboard: Enter/Space activates); dismissed via outside-click
 * or Esc. Focus alone does not open it. Every rendered
 * string is brief/amendment-approved (A4) — no Claude-authored copy, and no
 * "node/edge/graph" wording. If more copy is ever needed here, stop and ask Paul.
 */
import { useRef, useEffect, useState, useCallback, type ReactNode } from 'react'
import { HelpCircle, ArrowUp, ArrowDown } from 'lucide-react'
import { NodeShapeIndicator } from '../nodes/NodeShapeIndicator'
import { typography } from '../../styles/typography'

interface LegendRow {
  label: string
  swatch: ReactNode
}

// Shape swatches reuse the same indicators users see on the cards.
const TYPE_ROWS: LegendRow[] = [
  { label: 'Decision', swatch: <NodeShapeIndicator nodeKind="decision" size={12} /> },
  { label: 'Option', swatch: <NodeShapeIndicator nodeKind="option" size={12} /> },
  { label: 'Factor', swatch: <NodeShapeIndicator nodeKind="factor" size={12} /> },
  { label: 'Outcome', swatch: <NodeShapeIndicator nodeKind="outcome" size={12} /> },
  { label: 'Risk', swatch: <NodeShapeIndicator nodeKind="risk" size={12} /> },
  { label: 'Goal', swatch: <NodeShapeIndicator nodeKind="goal" size={12} /> },
  {
    label: 'Outside your control',
    // Dashed factor (circle) — mirrors the external-factor border treatment.
    swatch: <span aria-hidden="true" className="inline-block w-3 h-3 rounded-full border-[0.5px] border-dashed border-text-light shrink-0" />,
  },
]

function LineSwatch({ dashed }: { dashed: boolean }) {
  return (
    <svg width={24} height={8} aria-hidden="true" style={{ flexShrink: 0 }}>
      <line
        x1={0}
        y1={4}
        x2={24}
        y2={4}
        stroke="var(--text-body)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeDasharray={dashed ? '3 2' : undefined}
      />
    </svg>
  )
}

const CONNECTION_ROWS: LegendRow[] = [
  { label: 'Solid connection: established', swatch: <LineSwatch dashed={false} /> },
  { label: 'Dashed connection: less certain', swatch: <LineSwatch dashed /> },
]

function ThicknessSwatch({ width }: { width: number }) {
  // Height grows with the stroke so the thickest sample isn't clipped; the line
  // is inset by the max half-width so its round caps stay inside the 24px swatch.
  const h = Math.max(width + 2, 8)
  return (
    <svg width={24} height={h} aria-hidden="true" style={{ flexShrink: 0 }}>
      <line
        x1={4}
        y1={h / 2}
        x2={20}
        y2={h / 2}
        stroke="var(--text-body)"
        strokeWidth={width}
        strokeLinecap="round"
      />
    </svg>
  )
}

// Thickness = effect strength (weight magnitude), the same meaning in both
// phases (P2.9 — thickness no longer switches to composite importance after a
// run). Stroke widths mirror weightMagnitudeToStrokeWidth() in
// graphDisplayCalculations.ts: |mean| < 0.4 → 1.5, ≥ 0.4 → 2, ≥ 0.7 → 3.
// Folded in from the former standalone EdgeThicknessLegend so the two
// bottom-left legends are now one key.
const THICKNESS_ROWS: LegendRow[] = [
  { label: 'Weak effect', swatch: <ThicknessSwatch width={1.5} /> },
  { label: 'Moderate effect', swatch: <ThicknessSwatch width={2} /> },
  { label: 'Strong effect', swatch: <ThicknessSwatch width={3} /> },
]

const DIRECTION_ROWS: LegendRow[] = [
  { label: 'Raises', swatch: <ArrowUp size={12} className="text-success shrink-0" aria-hidden="true" /> },
  { label: 'Lowers', swatch: <ArrowDown size={12} className="text-danger shrink-0" aria-hidden="true" /> },
]

function LegendGroup({ rows }: { rows: LegendRow[] }) {
  return (
    <div className="space-y-1.5">
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-6 flex items-center justify-center">{r.swatch}</span>
          <span className={`${typography.panelMeta} text-text-light`}>{r.label}</span>
        </div>
      ))}
    </div>
  )
}

export function CanvasLegendPopover() {
  // Local open-state — this is now the only canvas legend (the edge-thickness
  // scale is folded in below), so there's no second legend to coordinate with.
  // Display-only; not persisted.
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])
  // Functional updater stays immune to focus-before-click staleness: a real mouse
  // click fires focus (mousedown) before click, so the toggle must read the live
  // value. No onFocus — keyboard users open via Enter/Space → click.
  const toggle = useCallback(() => setOpen(o => !o), [])

  useEffect(() => {
    if (!open) return
    const onDocPointer = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDocPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="w-7 h-7 inline-flex items-center justify-center rounded-full text-text-light hover:text-text-body transition-colors focus-visible:outline-2 focus-visible:outline-info focus-visible:outline-offset-2"
        aria-label="How to read this"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="How to read this"
        data-testid="btn-canvas-legend"
      >
        <HelpCircle size={16} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="How to read this"
          className="absolute left-full ml-2 bottom-0 w-56 bg-panel border border-panel-border rounded-lg shadow-panel p-3 z-[1200]"
          data-testid="canvas-legend-popover"
        >
          <div className={`${typography.panelMeta} text-text-body font-medium mb-2`}>How to read this</div>
          <LegendGroup rows={TYPE_ROWS} />
          <div className="h-px bg-panel-border my-2" aria-hidden="true" />
          <LegendGroup rows={CONNECTION_ROWS} />
          <div className="h-px bg-panel-border my-2" aria-hidden="true" />
          <LegendGroup rows={THICKNESS_ROWS} />
          <div className="h-px bg-panel-border my-2" aria-hidden="true" />
          <LegendGroup rows={DIRECTION_ROWS} />
        </div>
      )}
    </div>
  )
}
