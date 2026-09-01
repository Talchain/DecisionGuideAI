/**
 * CanvasLegendPopover — a compact "How to read this" toolbar disclosure.
 *
 * Presentational only: reads nothing from the graph and triggers no actions.
 * Opens on click (keyboard: Enter/Space activates); dismissed via outside-click
 * or Esc. Focus alone does not open it. Every rendered
 * string is brief/amendment-approved (A4) — no Claude-authored copy, and no
 * "node/edge/graph" wording.
 *
 * ⚠ The rule above used to end "if more copy is ever needed here, stop and ask
 * Paul." R6 (Paul, 16 Aug 2026) is that instruction being given: "orange
 * reserved for contested connections only, WITH A LEGEND." The colour and
 * direction rows below are added under that ruling; the vocabulary constraint
 * is unchanged and still enforced by this component's spec. Any FURTHER copy
 * still stops and asks.
 *
 * L-49: the canvas spoke four vocabularies with no key — solid vs dashed, +/-
 * markers, thickness, and colour. The legend explained the first and the third.
 * Worse, it taught up/down ARROWS for direction, which the canvas has never
 * drawn: direction is a line colour plus a + or - marker. Every row here is now
 * derived from what StyledEdge actually paints.
 */
import { useRef, useEffect, useState, useCallback, type ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'
import { NodeShapeIndicator } from '../nodes/NodeShapeIndicator'
import { typography } from '../../styles/typography'
import toolbarStyles from '../../components/layout/CanvasFloatingToolbar.module.css'
import { DECISION_NODE_LABEL } from '../domain/vocabulary'
import { classifyNodeProvenance, VALUE_PROVENANCE_LABEL } from '../domain/valueProvenance'
import { VALUE_PROVENANCE_ICON } from '../domain/valueProvenanceIcon'

interface LegendRow {
  label: string
  swatch: ReactNode
}

// Shape swatches reuse the same indicators users see on the cards.
const TYPE_ROWS: LegendRow[] = [
  { label: DECISION_NODE_LABEL, swatch: <NodeShapeIndicator nodeKind="decision" size={12} /> },
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

function LineSwatch({ dashed, stroke = 'var(--text-body)', width = 1.5, mark }: {
  dashed?: boolean
  stroke?: string
  width?: number
  /** Optional polarity marker drawn beside the line, as the canvas draws it. */
  mark?: '+' | '−'
}) {
  return (
    <span className="inline-flex items-center gap-0.5" style={{ flexShrink: 0 }}>
      <svg width={mark ? 17 : 24} height={Math.max(width + 2, 8)} aria-hidden="true" style={{ flexShrink: 0 }}>
        <line
          x1={0}
          y1={Math.max(width + 2, 8) / 2}
          x2={mark ? 17 : 24}
          y2={Math.max(width + 2, 8) / 2}
          stroke={stroke}
          strokeWidth={width}
          strokeLinecap="round"
          strokeDasharray={dashed ? '3 2' : undefined}
        />
      </svg>
      {mark && (
        <span aria-hidden="true" style={{ color: stroke, fontWeight: 700, fontSize: '11px', lineHeight: 1 }}>
          {mark}
        </span>
      )}
    </span>
  )
}

const CONNECTION_ROWS: LegendRow[] = [
  { label: 'Solid connection: established', swatch: <LineSwatch dashed={false} /> },
  { label: 'Dashed connection: less certain', swatch: <LineSwatch dashed /> },
]

// Direction, as the canvas actually draws it: the line's colour, plus a + or -
// marker beside the label. `--edge-positive` / `--edge-negative` / `--edge-neutral`
// are the same tokens computeDirectionStroke() picks from, so this key cannot
// drift from the connections it describes.
//
// The grey row is the one that matters most and was missing entirely: grey is
// how the canvas says "nobody has stated this yet". Without it a reader has no
// way to tell an honest blank from a weak effect.
const DIRECTION_ROWS: LegendRow[] = [
  { label: 'Raises', swatch: <LineSwatch stroke="var(--edge-positive)" width={2} mark="+" /> },
  { label: 'Lowers', swatch: <LineSwatch stroke="var(--edge-negative)" width={2} mark="−" /> },
  { label: 'Grey: direction not set yet', swatch: <LineSwatch stroke="var(--edge-neutral)" width={2} /> },
]

// Colour, R6. Exactly one meaning is reserved on a connection: orange means the
// two reviews disagreed and it is waiting on the person. Every other orange the
// canvas used to paint on a connection (fragility, assumption flags, who set a
// value) has moved off the hue, so this row is true.
const COLOUR_ROWS: LegendRow[] = [
  {
    label: 'Orange: reviews disagree — your call',
    swatch: <LineSwatch stroke="var(--semantic-warning)" width={2} dashed />,
  },
]

function ThicknessSwatch({ width, stroke = 'var(--text-body)', testId }: {
  width: number
  /** Stroke colour. The "not set yet" row NEEDS this: at 1.5px it is the same
   *  width as "Weak effect", so colour is its only discriminator — a swatch
   *  that hard-coded the body colour rendered the two rows pixel-identical and
   *  the row's own caption ("thin and grey") was false about itself. */
  stroke?: string
  testId?: string
}) {
  // Height grows with the stroke so the thickest sample isn't clipped; the line
  // is inset by the max half-width so its round caps stay inside the 24px swatch.
  const h = Math.max(width + 2, 8)
  return (
    <svg width={24} height={h} aria-hidden="true" style={{ flexShrink: 0 }} data-testid={testId}>
      <line
        x1={4}
        y1={h / 2}
        x2={20}
        y2={h / 2}
        stroke={stroke}
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
  { label: 'Weak effect', swatch: <ThicknessSwatch width={1.5} testId="legend-thickness-weak" /> },
  { label: 'Moderate effect', swatch: <ThicknessSwatch width={2} /> },
  { label: 'Strong effect', swatch: <ThicknessSwatch width={3} /> },
  // Honesty row: an unset strength draws at the SAME width as a weak effect
  // (UNSET_EDGE_STROKE_WIDTH is 1.5), so without this the key actively teaches
  // the reader to mistake a blank for a finding. Thickness alone cannot tell
  // them apart — the colour does, which is why this swatch MUST carry the grey
  // stroke. It shipped without one for a review cycle and rendered identical to
  // the row above it, i.e. the caption said "grey" beside a body-coloured line.
  {
    label: 'Not set yet: thin and grey',
    swatch: <ThicknessSwatch width={1.5} stroke="var(--edge-neutral)" testId="legend-thickness-unset" />,
  },
]

/**
 * ⭐⭐ WHERE A VALUE CAME FROM — the key that stops the new card glyphs being a
 * PRIVATE CODE.
 *
 * `NodeProvenanceMark` was three words on every card ("AI estimate" on 9 of 14
 * on a real deployed model); it is now a glyph, per the founder's ruling that
 * copy identical on every card is furniture. Replacing words with pictures is
 * only an improvement if the pictures are legible to someone who has never seen
 * them — otherwise it trades repetition for illegibility. This legend is a real
 * toolbar BUTTON, reachable by keyboard and by touch, and it is the surface that
 * makes the swap honest for a reader who cannot hover.
 *
 * ⚠ DERIVED FROM THE PRODUCER, NOT HAND-LISTED. The rows come from the three
 * `CEEProvenance` literals run through `classifyNodeProvenance` — the same
 * authority the card itself uses — so this key CANNOT list a glyph the canvas
 * does not render, or miss one it does. A hand-written kind list would be the
 * mirror this estate keeps paying for (CLAUDE.md trap 12) and would silently
 * stop covering a literal the day one is added. Both the glyph and the words
 * come from the shared registers; no copy is authored here, which is what keeps
 * this component's "approved strings only" rule (A4) intact.
 */
const PROVENANCE_ROWS: LegendRow[] = (['user_set', 'from_brief', 'ai_inferred'] as const)
  .map((literal) => {
    const kind = classifyNodeProvenance(literal)!.kind
    const Icon = VALUE_PROVENANCE_ICON[kind]
    return {
      label: VALUE_PROVENANCE_LABEL[kind],
      // Declared at the DS canvas-badge 14px. No counter-scale here: the legend
      // is panel DOM, outside React Flow's transform, so the plain size is the
      // rendered size (this is exactly what the `var(…, 1)` fallback on the
      // card's own class is for).
      swatch: <Icon className="w-3.5 h-3.5 text-text-light shrink-0" aria-hidden="true" />,
    }
  })

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
        /* Shared with the LeftSidebar and the rest of this toolbar; open takes
           the same active treatment the sidebar's lens menu uses. */
        className={open ? toolbarStyles.iconButtonActive : toolbarStyles.iconButton}
        aria-label="How to read this"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="How to read this"
        data-testid="btn-canvas-legend"
      >
        <HelpCircle className={toolbarStyles.icon} aria-hidden="true" />
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
      <div className="h-px bg-panel-border my-2" aria-hidden="true" />
      <LegendGroup rows={COLOUR_ROWS} />
      <div className="h-px bg-panel-border my-2" aria-hidden="true" />
      <LegendGroup rows={PROVENANCE_ROWS} />
        </div>
      )}
    </div>
  )
}
