/**
 * V12 Simple band furniture, drawn in the canvas's own coordinates (so it pans and zooms with the cards): the label and small shape icon above
 * each band's first row, the "not linked" mark on a figure no link touches, and the fold control for 15 or more inputs. Positions are read from the
 * nodes as placed; no word here is core's: they are the boards' fixed notation chrome.
 */
import { useMemo } from 'react'
import { ViewportPortal, type Node } from '@xyflow/react'
import { useCanvasStore } from '../../../canvas/store'
import type { ViewModel } from '../../client'
import { drawnModelOf, SIMPLE_LABEL_H } from '../../layout'
import { useViewStore } from '../../store'
import { levelOf, useSimpleLevel } from '../simpleStore'
import { BANDS, bandLabelOf, bandOf, FOLD_ID, foldsInputs, IDEA_PREFIX, unlinkedIds, type BandId, type BandShape } from './bands'
import { setInputsOpen, useInputsOpen } from './foldStore'

const INK = 'var(--text-light)'
export const NOT_LINKED = 'not linked'
/** A label stands 8 px above its band's first row (the layout reserves SIMPLE_LABEL_H above it; the label's 16 px box is lifted by half of it). */
const LABEL_LIFT = 8

function Shape({ shape }: { shape: BandShape }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 }
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" data-band-shape={shape}>
      {shape === 'square' ? <rect x="3" y="6" width="18" height="12" rx="2" {...p} />
        : shape === 'pill' ? <rect x="2" y="7" width="20" height="10" rx="5" {...p} />
        : shape === 'double' ? <><rect x="2.5" y="5.5" width="19" height="13" rx="2" {...p} /><rect x="5.5" y="8.5" width="13" height="7" rx="1" {...p} /></>
        : shape === 'diamond' ? <path d="M12 3 21 12 12 21 3 12Z" {...p} />
        : <rect x="3" y="6" width="18" height="12" rx="2" strokeDasharray="3 2.5" {...p} />}
    </svg>
  )
}

/** The band a drawn node stands in, by id. */
const bandOfNode = (id: string, model: ViewModel | null): BandId | null =>
  id === FOLD_ID ? 'inputs' : id.startsWith(IDEA_PREFIX) ? 'ideas' : model === null ? null : (() => { const c = model.cards.find((x) => x.id === id); return c === undefined ? null : bandOf(c, model) })()

/** Each present band's first row: its label's place in canvas coordinates (the left of the row, above it). */
/** `model` null: core holds none, and only the kept ideas' band stands (Codex 008e #1). */
export function bandLabelsOf(nodes: readonly Pick<Node, 'id' | 'position'>[], model: ViewModel | null): { band: BandId; x: number; y: number }[] {
  const tops = new Map<BandId, { x: number; y: number }>()
  for (const n of nodes) {
    const b = bandOfNode(n.id, model)
    if (b === null) continue
    const t = tops.get(b)
    if (t === undefined || n.position.y < t.y - 1) tops.set(b, { x: n.position.x, y: n.position.y })
    else if (Math.abs(n.position.y - t.y) <= 1 && n.position.x < t.x) t.x = n.position.x
  }
  return [...tops].map(([band, p]) => ({ band, x: p.x, y: p.y - SIMPLE_LABEL_H }))
}

export function BandLayer() {
  const level = useSimpleLevel((s) => levelOf(useViewStore.getState().sid, s))
  const core = useViewStore((s) => s.view?.model ?? null)
  const sid = useViewStore((s) => s.sid)
  const nodes = useCanvasStore((s) => s.nodes)
  const open = useInputsOpen((s) => s.open)
  const model = useMemo(() => (core === null ? null : drawnModelOf(core)), [core])
  const labels = useMemo(() => bandLabelsOf(nodes, model), [nodes, model])
  const unlinked = useMemo(() => (model === null ? new Set<string>() : new Set(unlinkedIds(model))), [model])
  // With no model only the kept ideas' band is drawn, on either level; with one, the bands are Simple's.
  if ((level !== 'simple' && model !== null) || labels.length === 0) return null
  const folds = model !== null && foldsInputs(model), expanded = folds && sid !== null && open[sid] === true
  return (
    <ViewportPortal>
      <div style={{ pointerEvents: 'none' }} data-testid="view-band-layer">
        {labels.map(({ band, x, y }) => (
          <div key={band} data-band-label={band} style={{ position: 'absolute', left: x, top: y - LABEL_LIFT, height: SIMPLE_LABEL_H, color: INK, pointerEvents: 'none' }}
            className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium leading-none">
            <Shape shape={BANDS[band].shape} />{bandLabelOf(band, model)}
            {band === 'inputs' && expanded ? <button type="button" data-testid="view-inputs-unfold" style={{ pointerEvents: 'auto' }} className="ml-1 rounded-full border border-panel-border px-2 py-0.5 text-xs font-medium"
              title="Fold these inputs into one group" onClick={() => { if (sid !== null) setInputsOpen(sid, false) }}>Fold</button> : null}
          </div>
        ))}
        {nodes.filter((n) => unlinked.has(n.id)).map((n) => (
          <span key={n.id} data-not-linked={n.id} title="No link touches this figure" style={{ position: 'absolute', left: n.position.x + ((n.data as { width?: number }).width ?? n.measured?.width ?? 200) - 4, top: n.position.y - 7, transform: 'translateX(-100%)', pointerEvents: 'none' }}
            className="rounded-full border border-dashed border-panel-border bg-panel px-2 py-0.5 text-xs font-medium leading-none text-text-light">{NOT_LINKED}</span>
        ))}
      </div>
    </ViewportPortal>
  )
}
