/**
 * V12 Simple band furniture, drawn in the canvas's own coordinates (so it pans and zooms with the cards): the label and small shape icon above
 * each band's first row, the unlinked mark (a quiet icon, its words on hover) on a figure no link touches (in the row gap over the card's top right corner, clear of its frame and its kind marker), and the fold control for 15 or more inputs. Positions are read from the
 * nodes as placed; no word here is core's: they are the boards' fixed notation chrome.
 */
import { useMemo, type CSSProperties } from 'react'
import { ViewportPortal, type Node } from '@xyflow/react'
import { Unlink } from 'lucide-react'
import { useCanvasStore } from '../../../canvas/store'
import type { ViewModel } from '../../client'
import { drawnModelOf, SIMPLE_LABEL_GAP } from '../../layout'
import { KIND_GLYPH_PX } from '../../../canvas/utils/nodeLayoutConstants'
import { useViewStore } from '../../store'
import { levelOf, useSimpleLevel } from '../simpleStore'
import { allKeptByReader, BANDS, bandLabelOf, bandOf, FOLD_ID, foldsInputs, IDEA_PREFIX, unlinkedIds, type BandId, type BandShape } from './bands'
import { keptIdeasOf } from './keptIdeas'
import { setInputsOpen, useInputsOpen } from './foldStore'
import { groupBandOf } from './groups'

const INK = 'var(--text-light)'
/** What the unlinked mark says, on hover and to a reader: the mark itself is an icon, quiet, so four of them do not read as four faults (DL look, 17 Nov). */
export const NOT_LINKED = 'No link touches this figure'

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
  id === FOLD_ID ? 'inputs' : id.startsWith(IDEA_PREFIX) ? 'ideas' : groupBandOf(id) ?? (model === null ? null : (() => { const c = model.cards.find((x) => x.id === id); return c === undefined ? null : bandOf(c, model) })())

/**
 * Each present band's first row: its top, and the one column every label shares, the board's left edge (production's arrangement, canvas/nodes/
 * TierLanes: one left column, never above a card's own x). The label stands above that row, in the row gap, clear of the kind markers' overhang.
 * `model` null: core holds none, and only the kept ideas' band stands (Codex 008e #1).
 */
export function bandLabelsOf(nodes: readonly Pick<Node, 'id' | 'position'>[], model: ViewModel | null): { band: BandId; x: number; y: number }[] {
  const tops = new Map<BandId, number>()
  let left = Infinity
  for (const n of nodes) {
    const b = bandOfNode(n.id, model)
    if (b === null) continue
    left = Math.min(left, n.position.x)
    const t = tops.get(b)
    if (t === undefined || n.position.y < t) tops.set(b, n.position.y)
  }
  return [...tops].map(([band, y]) => ({ band, x: left, y }))
}

export function BandLayer() {
  const level = useSimpleLevel((s) => levelOf(useViewStore.getState().sid, s))
  const core = useViewStore((s) => s.view?.model ?? null)
  const sid = useViewStore((s) => s.sid)
  // The ideas strip's heading follows core's `kept_by`: "Ideas you kept" only when the reader kept every idea in it.
  const ideasMine = useViewStore((s) => s.view === null || allKeptByReader(keptIdeasOf(s.view), s.view.you_id ?? null))
  const nodes = useCanvasStore((s) => s.nodes)
  const open = useInputsOpen((s) => s.open)
  const model = useMemo(() => (core === null ? null : drawnModelOf(core)), [core])
  const labels = useMemo(() => bandLabelsOf(nodes, model), [nodes, model])
  // The board's type scale (layout.ts simpleScaleOf), the cards' own, so a label is the size of the text it labels.
  const scale = useMemo(() => nodes.map((n) => (n.data as { scale?: number }).scale).find((x) => x !== undefined), [nodes])
  const unlinked = useMemo(() => (model === null ? new Set<string>() : new Set(unlinkedIds(model))), [model])
  // With no model only the kept ideas' band is drawn, on either level; with one, the bands are Simple's.
  if ((level !== 'simple' && model !== null) || labels.length === 0) return null
  const folds = model !== null && foldsInputs(model), expanded = folds && sid !== null && open[sid] === true
  return (
    <ViewportPortal>
      <div style={{ pointerEvents: 'none' }} data-testid="view-band-layer">
        {labels.map(({ band, x, y }) => (
          <div key={band} data-band-label={band} style={{ position: 'absolute', left: x, top: y, transform: `translateY(calc(-100% - ${SIMPLE_LABEL_GAP}px - ${KIND_GLYPH_PX / 2}px * var(--o-s, 1)))`, color: INK, pointerEvents: 'none', ...(scale === undefined ? {} : { '--o-s': scale } as CSSProperties) }}
            className="flex items-center gap-1.5 whitespace-nowrap font-medium leading-tight">
            <Shape shape={BANDS[band].shape} />{bandLabelOf(band, model, ideasMine)}
            {band === 'inputs' && expanded ? <button type="button" data-testid="view-inputs-unfold" style={{ pointerEvents: 'auto' }} className="ml-1 rounded-full border border-panel-border px-2 py-0.5 text-xs font-medium"
              title="Fold these inputs into one group" onClick={() => { if (sid !== null) setInputsOpen(sid, false) }}>Fold</button> : null}
          </div>
        ))}
        {nodes.filter((n) => unlinked.has(n.id)).map((n) => (
          <span key={n.id} role="img" data-not-linked={n.id} aria-label={NOT_LINKED} title={NOT_LINKED} className="inline-flex"
            style={{ position: 'absolute', left: n.position.x + ((n.data as { width?: number }).width ?? n.measured?.width ?? 200), top: n.position.y - SIMPLE_LABEL_GAP, transform: 'translate(-100%, -100%)', pointerEvents: 'auto', color: INK, ...(scale === undefined ? {} : { '--o-s': scale } as CSSProperties) }}>
            <Unlink aria-hidden="true" strokeWidth={1.75} style={{ width: 'calc(12px * var(--o-s, 1))', height: 'calc(12px * var(--o-s, 1))' }} />
          </span>
        ))}
      </div>
    </ViewportPortal>
  )
}
