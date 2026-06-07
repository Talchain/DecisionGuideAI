/**
 * CanvasLegendPopover — a compact "How to read this" toolbar disclosure.
 *
 * Presentational only: reads nothing from the graph and triggers no actions.
 * Opens on click/focus (dismissible via outside-click or Esc). Every rendered
 * string is brief/amendment-approved (A4) — no Claude-authored copy, and no
 * "node/edge/graph" wording. If more copy is ever needed here, stop and ask Paul.
 */
import { useRef, useEffect, useCallback, type ReactNode } from 'react'
import { HelpCircle, ArrowUp, ArrowDown } from 'lucide-react'
import { NodeShapeIndicator } from '../nodes/NodeShapeIndicator'
import { typography } from '../../styles/typography'
import { useLegendDisclosure } from '../stores/legendDisclosureStore'

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
  // Open-state lives in a shared store so the post-analysis edge-thickness
  // legend can yield while this legend is open (avoids the two bottom-left
  // legends overlapping). Display-only; not persisted.
  const open = useLegendDisclosure(s => s.isLegendOpen)
  const setLegendOpen = useLegendDisclosure(s => s.setLegendOpen)
  const toggleLegend = useLegendDisclosure(s => s.toggleLegend)
  const wrapRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setLegendOpen(false), [setLegendOpen])

  // Reset the shared flag on unmount so the edge-thickness legend is never left
  // suppressed if this control unmounts while open.
  useEffect(() => () => setLegendOpen(false), [setLegendOpen])

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
        onClick={toggleLegend}
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
          <LegendGroup rows={DIRECTION_ROWS} />
        </div>
      )}
    </div>
  )
}
