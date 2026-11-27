/**
 * V12 Simple band furniture, drawn in the canvas's own coordinates (so it pans and zooms with the cards): the label and small shape icon above
 * each band's first row, the unlinked mark (a quiet icon, its words on hover) on a figure no link touches (in the row gap over the card's top right corner, clear of its frame and its kind marker), and the fold control for 15 or more inputs. Positions are read from the
 * nodes as placed; no word here is core's: they are the boards' fixed notation chrome.
 */
import { controls } from '../../../styles/controls'
import { useMemo, type CSSProperties } from 'react'
import { NodeShapeIndicator } from '../../../canvas/nodes/NodeShapeIndicator'
import { typography } from '../../../styles/typography'
import { useStore, ViewportPortal, type Node } from '@xyflow/react'
import { OkIcon } from '../../look/icons'
import { Hover, HoverButton } from '../../look/Hover'
import { useCanvasStore } from '../../../canvas/store'
import type { ViewModel } from '../../client'
import { drawKindOf, drawnModelOf, SIMPLE_LABEL_GAP } from '../../layout'
import { KIND_GLYPH_PX } from '../../../canvas/utils/nodeLayoutConstants'
import { useViewStore } from '../../store'
import { levelOf, useSimpleLevel } from '../simpleStore'
import { bandLabelOf, bandOf, FOLD_ID, foldsInputs, IDEA_PREFIX, unlinkedIds, type BandId } from './bands'
import { setInputsOpen, useInputsOpen } from './foldStore'
import { groupBandOf } from './groups'

/** What the unlinked mark says, on hover and to a reader: the mark itself is an icon, quiet, so four of them do not read as four faults (DL look, 17 Nov). */
export const NOT_LINKED = 'No link touches this figure'

/** A band can hold two shapes, such as results and risks or aims and limits. */
export function bandKindsOf(band: BandId, model: ViewModel | null): ReturnType<typeof drawKindOf>[] {
  if (model === null || band === 'ideas') return []
  return [...new Set(model.cards.filter((card) => bandOf(card, model) === band).map((card) => drawKindOf(card, model)))]
}

function IdeaMark() {
  return <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" data-band-shape="idea">
    <rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 2.5" />
  </svg>
}

/** The band a drawn node stands in, by id. */
const bandOfNode = (id: string, model: ViewModel | null): BandId | null =>
  id === FOLD_ID ? 'inputs' : id.startsWith(IDEA_PREFIX) ? 'ideas' : groupBandOf(id) ?? (model === null ? null : (() => { const c = model.cards.find((x) => x.id === id); return c === undefined ? null : bandOf(c, model) })())

/**
 * Each present band's first row: its top, and that row's own left edge, so the label stands over the cards it names (Paul, 17 Nov: cards keep a max
 * width and rows stand centred and compact, so the board's far-left column left a short row's label floating away from it; was one shared column).
 * The label stands above that row, in the row gap, clear of the kind markers' overhang. `model` null: only the kept ideas' band stands (Codex 008e #1).
 */
export function bandLabelsOf(nodes: readonly Pick<Node, 'id' | 'position'>[], model: ViewModel | null): { band: BandId; x: number; y: number }[] {
  const tops = new Map<BandId, number>()
  const inBand: { b: BandId; x: number; y: number }[] = []
  for (const n of nodes) {
    const b = bandOfNode(n.id, model)
    if (b === null) continue
    inBand.push({ b, x: n.position.x, y: n.position.y })
    const t = tops.get(b)
    if (t === undefined || n.position.y < t) tops.set(b, n.position.y)
  }
  // The first row's left: the leftmost card whose top is the band's top (within a pixel).
  return [...tops].map(([band, y]) => ({ band, x: Math.min(...inBand.filter((n) => n.b === band && Math.abs(n.y - y) <= 1).map((n) => n.x)), y }))
}

/** Keep band labels whose row starts above the window's foot. */
export const labelsAboveFold = <T extends { y: number }>(labels: readonly T[], ty: number, zoom: number, height: number): T[] =>
  height <= 0 ? [...labels] : labels.filter((l) => l.y * zoom + ty < height)

export function BandLayer() {
  const level = useSimpleLevel((s) => levelOf(useViewStore.getState().sid, s))
  const core = useViewStore((s) => s.view?.model ?? null)
  const sid = useViewStore((s) => s.sid)
  const nodes = useCanvasStore((s) => s.nodes)
  const open = useInputsOpen((s) => s.open)
  const model = useMemo(() => (core === null ? null : drawnModelOf(core)), [core])
  const all = useMemo(() => bandLabelsOf(nodes, model), [nodes, model])
  const ty = useStore((s) => s.transform[1]), zoom = useStore((s) => s.transform[2]), paneH = useStore((s) => s.height)
  const labels = labelsAboveFold(all, ty, zoom, paneH)
  // The board's type scale (layout.ts simpleScaleOf), the cards' own, so a label is the size of the text it labels.
  const scale = useMemo(() => nodes.map((n) => (n.data as { scale?: number }).scale).find((x) => x !== undefined), [nodes])
  const unlinked = useMemo(() => (model === null ? new Set<string>() : new Set(unlinkedIds(model))), [model])
  // With no model only the kept ideas' band is drawn, on either level; with one, the bands are Simple's.
  if ((level !== 'simple' && model !== null) || all.length === 0) return null
  const folds = model !== null && foldsInputs(model), expanded = folds && sid !== null && open[sid] === true
  return (
    <ViewportPortal>
      <div className="pointer-events-none" data-testid="view-band-layer">
        {labels.map(({ band, x, y }) => (
          <div key={band} data-band-label={band} style={{ '--band-x': `${x}px`, '--band-y': `${y - SIMPLE_LABEL_GAP}px`, '--band-marker-overhang': `${KIND_GLYPH_PX / 2}px`, '--o-s': scale } as CSSProperties}
            className={`${typography.viewPanelMeta} ok-band-label pointer-events-none absolute z-[3] flex items-center gap-1.5 whitespace-nowrap rounded-sm bg-canvas pr-1 leading-tight`}>
            <span className="inline-flex shrink-0 items-center gap-0.5">
              {band === 'ideas' ? <IdeaMark /> : bandKindsOf(band, model).map((kind) => <NodeShapeIndicator key={kind} nodeKind={kind} size={14} />)}
            </span>
            {bandLabelOf(band, model)}
            {band === 'inputs' && expanded ? <HoverButton type="button" data-testid="view-inputs-unfold" className={`${controls.chipIcon} pointer-events-auto ml-1 inline-flex items-center justify-center border border-panel-border`}
              words="Fold these inputs into one group" aria-label="Fold these inputs into one group" onClick={() => { if (sid !== null) setInputsOpen(sid, false) }}><OkIcon id="fold-group" variant="alt" size={14} decorative inherit /></HoverButton> : null}
          </div>
        ))}
        {nodes.filter((n) => unlinked.has(n.id)).map((n) => (
          <Hover key={n.id} role="img" data-not-linked={n.id} aria-label={NOT_LINKED} words={NOT_LINKED} className="pointer-events-auto absolute left-[var(--band-x)] top-[var(--band-y)] z-[3] inline-flex -translate-x-full -translate-y-full text-text-light"
            style={{
              '--band-x': `${n.position.x + ((n.data as { width?: number }).width ?? n.measured?.width ?? 200)}px`,
              '--band-y': `${n.position.y - SIMPLE_LABEL_GAP}px`,
              '--o-s': scale,
            } as CSSProperties}>
            <OkIcon id="not-linked" size={14} decorative inherit className="[&>svg]:h-[calc(14px*var(--o-s,1))] [&>svg]:w-[calc(14px*var(--o-s,1))]" />
          </Hover>
        ))}
      </div>
    </ViewportPortal>
  )
}
