/**
 * ⭐ THE CANVAS KEY: what the provenance and uncertainty marks already on THIS board mean (DL #85 5939855664 queue;
 * PTL 5941434564 §6). Entries come from `provenanceKey` (the cue's own function + the cue's own words); a cue the board
 * does not draw has no entry, and with no cue at all the key does not claim its cell.
 *
 * DS v5:
 *   - a band occupant, never hand-placed: the `bottom-right` cell (`useOverlayCell`), AFTER `degraded-banner`, so a run
 *     warning always outranks it;
 *   - §9.2/§7.3: the toggle is text, `text-text-body` → `text-text-header`;
 *   - §9.4: no node-type icons, only the provenance glyph the card itself shows (`VALUE_PROVENANCE_ICON`, same size
 *     class);
 *   - §6.1: 1px borders.
 * The key opens ABOVE its pill (out of flow), like the M2 detail, so the band's fixed 64px row never grows.
 */
import { useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useOverlayCell } from './CanvasOverlayBand'
import { useCanvasStore } from '../store'
import { cardMark, type CardMarkId } from '../nodes/shared/cardMarks'
import { provenanceKey } from './provenanceKey'
import { VALUE_PROVENANCE_ICON, PROVENANCE_ICON_SIZE_CLASSES } from '../domain/valueProvenanceIcon'
import { UNSET_EDGE_STROKE_WIDTH } from '../utils/graphDisplayCalculations'
import { typography } from '../../styles/typography'
import { selectWinShareWithheldReason } from '../state/winShareGate'

export const CANVAS_PROVENANCE_KEY_TESTID = 'canvas-provenance-key'

export const CANVAS_PROVENANCE_KEY_COPY = {
  toggle: 'Key',
  marks: 'Who put it there',
  values: 'Values',
  links: 'Links',
  options: 'Options',
  /** The board's default kind: cards that carry only it show no mark at rest (`provenanceDefaultKind`). */
  unmarked: 'Unmarked cards',
} as const

const C = CANVAS_PROVENANCE_KEY_COPY
const T = CANVAS_PROVENANCE_KEY_TESTID

/** A link swatch drawn with the cue's own stroke: the not-set width, or the doubted link's own dash. */
function LinkSwatch({ width, dash }: { width: number; dash?: string }) {
  return (
    <svg width="28" height="10" viewBox="0 0 28 10" aria-hidden="true" className="flex-none text-text-body">
      <line x1="1" y1="5" x2="27" y2="5" stroke="currentColor" strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  )
}

export function CanvasProvenanceKey(): JSX.Element | null {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const withheldReason = useCanvasStore(selectWinShareWithheldReason)
  const hasRun = useCanvasStore(s => s.results.status === 'complete')
  const key = useMemo(() => provenanceKey(nodes as never, edges as never, withheldReason, hasRun), [nodes, edges, withheldReason, hasRun])
  const [open, setOpen] = useState(false)
  const panelId = useId()

  const { granted, target } = useOverlayCell('bottom-right', CANVAS_PROVENANCE_KEY_TESTID, !key.empty)
  if (key.empty || !granted) return null

  const body = (
    <div
      className="relative pointer-events-auto"
      data-testid={T}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false)
      }}
    >
      {open && (
        <div
          id={panelId}
          data-testid={`${T}-panel`}
          className="absolute right-0 bottom-full mb-2 w-[300px] max-h-[min(60vh,420px)] overflow-y-auto rounded-xl border border-panel-border bg-panel px-4 py-3 shadow-2"
        >
          {key.cardMarks.length > 0 && (
            <section aria-label={C.values}>
              <ul className="m-0 mt-1 list-none space-y-1 p-0">
                {key.cardMarks.map(m => <li key={m.id} data-testid={`canvas-key-card-mark-${m.id}`} className={`${typography.panelBody} flex items-center gap-2 text-text-body`}>
                  <m.Icon aria-hidden="true" className={`${PROVENANCE_ICON_SIZE_CLASSES} flex-none text-text-light`} />
                  <span>{m.keyText}</span>
                </li>)}
              </ul>
            </section>
          )}
          {key.marks.length > 0 && (
            <section aria-label={C.marks}>
              <p className={`${typography.panelMeta} m-0 text-text-light`}>{C.marks}</p>
              <ul className="m-0 mt-1 list-none space-y-1 p-0">
                {key.marks.map((m) => {
                  const Icon = VALUE_PROVENANCE_ICON[m.kind]
                  return (
                    <li
                      key={`${m.claim}-${m.kind}`}
                      data-testid={`${T}-mark`}
                      data-provenance-kind={m.kind}
                      data-provenance-claim={m.claim}
                      className={`${typography.panelBody} flex items-center gap-2 text-text-body`}
                    >
                      <Icon aria-hidden="true" className={`${PROVENANCE_ICON_SIZE_CLASSES} flex-none text-text-light`} />
                      <span>
                        {m.label}
                        {m.isDefault && <span className="text-text-light"> · {C.unmarked}</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
          {key.values.length > 0 && (
            <section aria-label={C.values} className={key.marks.length > 0 ? 'mt-3' : undefined}>
              <p className={`${typography.panelMeta} m-0 text-text-light`}>{C.values}</p>
              <ul className="m-0 mt-1 list-none space-y-1 p-0">
                {key.values.map((v) => { const Icon = cardMark(`source-${v.kind}` as CardMarkId).Icon; return (
                  <li key={v.kind} data-testid={`${T}-value`} data-value-kind={v.kind} className={`${typography.panelBody} flex items-baseline gap-2 text-text-body`}>
                    <Icon aria-hidden="true" className={`${PROVENANCE_ICON_SIZE_CLASSES} flex-none text-text-light`} />
                    <span>{v.label}</span>
                  </li>
                )})}
              </ul>
            </section>
          )}
          {key.links.length > 0 && (
            <section aria-label={C.links} className={key.marks.length > 0 || key.values.length > 0 ? 'mt-3' : undefined}>
              <p className={`${typography.panelMeta} m-0 text-text-light`}>{C.links}</p>
              <ul className="m-0 mt-1 list-none space-y-1.5 p-0">
                {key.links.map((l) => (
                  <li
                    key={l.cue}
                    data-testid={`${T}-link`}
                    data-cue={l.cue}
                    className={`${typography.panelBody} flex items-start gap-2 text-text-body`}
                  >
                    <span className="pt-1.5">
                      <LinkSwatch width={l.cue === 'placeholder' ? UNSET_EDGE_STROKE_WIDTH : 2} dash={l.dash} />
                    </span>
                    <span>{l.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {key.options !== null && (
            <section aria-label={C.options} className={key.marks.length > 0 || key.values.length > 0 || key.links.length > 0 ? 'mt-3' : undefined}>
              <p className={`${typography.panelMeta} m-0 text-text-light`}>{C.options}</p>
              <p data-testid={`${T}-option`} className={`${typography.panelBody} m-0 mt-1 text-text-body`}>
                {key.options.label}
                <span className="block text-text-light">{key.options.reason}</span>
              </p>
            </section>
          )}
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        data-testid={`${T}-toggle`}
        onClick={() => setOpen((v) => !v)}
        className={`${typography.panelMeta} flex items-center gap-1 rounded-full border border-panel-border bg-panel px-3 py-1.5 text-text-body shadow-2 hover:text-text-header focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
      >
        {C.toggle}
        {open ? <ChevronDown className="h-3 w-3" aria-hidden="true" /> : <ChevronUp className="h-3 w-3" aria-hidden="true" />}
      </button>
    </div>
  )

  return target ? createPortal(body, target) : body
}
