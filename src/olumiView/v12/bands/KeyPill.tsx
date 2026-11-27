/** The committed canvas link appearances, labelled with the current View's key words. */
import { useEffect, useMemo, useState } from 'react'
import { ICONS, OkIcon } from '../../look/icons'
import { measureDockInset } from '../../../canvas/components/FloatingOlumiPanel'
import type { View, ViewModel } from '../../client'
import { cardLinks, drawnModelOf } from '../../layout'
import { useViewStore } from '../../store'
import { VIEW_LINK, type ViewLinkData } from '../../canvas'
import { useCanvasStore } from '../../../canvas/store'
import { firstDraft as firstDraftOf, linkKey } from '../fields/fields'
import { LINK_MARK_IDS, linkLookOf } from '../links/linkLook'
import { typography } from '../../../styles/typography'
import { OlumiMark } from '../cards/marks'

const KEY_LINE_IDS = ['effect', 'input', 'size', 'doubted', 'unsettled', 'measures', 'target'] as const
type KeyLineId = (typeof KEY_LINE_IDS)[number]
type Look = ReturnType<typeof linkLookOf>
type KeyMark = keyof typeof LINK_MARK_IDS
export { LINK_MARK_IDS as KEY_MARK_IDS }

const unsettled = (mark: Look['mark']) => mark === 'depends' || mark === 'disputed' || mark === 'unknown'
const lookIds = (look: Look) => [
  look.haloAlert || look.reasonAlert ? 'alert' : null,
  look.haloProposed ? 'olumi' : null,
  look.doubt ? 'doubted' : null,
  look.dotted ? 'reason' : null,
  unsettled(look.mark) ? 'unsettled' : null,
  look.role === 'size' ? 'size' : look.styled?.role ?? (look.modelled ? 'effect' : null),
]

// These projection helpers are read by bands.spec.tsx. KeyLines reads the committed board below.
export function keyPresent(model: ViewModel): ReadonlySet<KeyLineId> {
  const out = new Set<KeyLineId>()
  for (const { link } of cardLinks(drawnModelOf(model))) {
    const look = linkLookOf(link, model, false)
    for (const id of KEY_LINE_IDS) if (lookIds(look).includes(id)) out.add(id)
  }
  return out
}

type KeyUnderlay = 'dotted' | 'halo-alert' | 'halo-proposed'
export function keyExtrasOf(view: View): { underlays: ReadonlySet<KeyUnderlay>; marks: ReadonlySet<KeyMark> } {
  const underlays = new Set<KeyUnderlay>(), marks = new Set<KeyMark>()
  const model = view.model
  if (model == null) return { underlays, marks }
  const first = firstDraftOf(view).firstDraft === true
  for (const { link } of cardLinks(drawnModelOf(model))) {
    const look = linkLookOf(link, model, first)
    if (look.mark !== null) marks.add(look.mark)
    if (look.dotted) underlays.add('dotted')
    if (look.haloAlert || look.reasonAlert) underlays.add('halo-alert')
    if (look.haloProposed) underlays.add('halo-proposed')
  }
  return { underlays, marks }
}

export function keyLinesOf(model: ViewModel): { id: KeyLineId; text: string }[] {
  const present = keyPresent(model)
  return (model.key ?? []).flatMap((k) => present.has(k.id as KeyLineId) ? [{ id: k.id as KeyLineId, text: k.text }] : [])
}

const SAMPLE_IDS: Readonly<Record<string, string>> = { reason: 'dotted', alert: 'halo-alert', olumi: 'halo-proposed' }
const markWord = (mark: Look['mark']) => mark === null ? undefined : ICONS[LINK_MARK_IDS[mark]].hover
const item = 'flex items-center gap-1.5'

function LineSample({ id, look }: { id: string; look: Look }) {
  const { stroke, dash, end, endStroke, width, mark, dotted, doubt, haloAlert, haloProposed } = look
  const polarity = mark === 'raises' ? 'increases' : mark === 'lowers' ? 'decreases' : undefined
  const d = end === 'arrow' ? 'M6 1V12' : end === 'dot' ? 'M6 1V11' : 'M6 1V15'
  const proposed = `ok-link-halo ok-link-halo-proposed${haloAlert ? ' ok-link-halo-inner' : ''}${dotted ? ' ok-link-dotted' : ''}${doubt ? ' ok-link-doubt' : ''}`
  return (
    <span className={item} data-key-look="">
      <span className={item} data-key-polarity={polarity}>
        <svg width="12" height="16" aria-hidden="true" data-key-sample={id} className={`${id === 'unsettled' ? typography.viewPanelMeta : ''}${haloAlert || haloProposed ? ' ok-key-underlay' : ''}`}>
          {haloAlert && <path d={d} className="ok-link-halo ok-link-halo-alert" />}
          {haloProposed && <path d={d} className={proposed} />}
          <path d={d} stroke={stroke} strokeWidth={width} strokeDasharray={dash ?? undefined} strokeLinecap={dotted && !doubt ? 'round' : undefined} fill="none" />
          {end === 'arrow' && <path d="M2 9 6 14 10 9" stroke={endStroke} strokeWidth={width} fill="none" />}
          {end === 'dot' && <circle cx="6" cy="13" r="2.5" fill={endStroke} />}
        </svg>
        {id === 'effect' && polarity}
      </span>
      {mark !== null && <span data-key-direction={mark} className="inline-flex ok-key-unsettled"><OkIcon id={LINK_MARK_IDS[mark]} size={14} decorative inherit /></span>}
    </span>
  )
}

type KeyRow = { id: string; text?: string; looks: Map<string, Look> }

function committedRows(view: View, sid: string | null, edges: ReturnType<typeof useCanvasStore.getState>['edges']): KeyRow[] {
  const model = view.model
  if (model == null) return []
  const words = model.key ?? []
  const core = new Map(words.filter((w) => typeof w.id === 'string').map((w) => [w.id, { id: SAMPLE_IDS[w.id] ?? w.id, text: w.text, looks: new Map<string, Look>() }]))
  const links = edges.flatMap((e) => e.type === VIEW_LINK ? [e.data as unknown as ViewLinkData] : [])
  const owned = links.length > 0 && links.every((e) => e.owner?.sid === sid && e.owner.view === view)
  if (!owned) return [...core].filter(([id]) => (KEY_LINE_IDS as readonly string[]).includes(id) || SAMPLE_IDS[id] !== undefined).map(([, row]) => row)

  const first = firstDraftOf(view).firstDraft === true
  const fallback = new Map<string, KeyRow>()
  const present = new Set<string>()
  const seen = new Set<string>()
  for (const { link } of links) {
    const look = linkLookOf(link, model, first)
    const ids = lookIds(look)
    for (const id of ids) if (id !== null) present.add(id)
    const { stroke, dash, end, endStroke, width, mark, haloAlert, haloProposed } = look
    const trace = JSON.stringify([stroke, dash, end, end === 'none' ? null : endStroke, width, mark, haloAlert, haloProposed])
    if (seen.has(trace)) continue
    seen.add(trace)
    const labelled = ids.find((id) => id !== null && core.has(id))
    if (labelled != null) {
      core.get(labelled)!.looks.set(trace, look)
    } else {
      const word = linkKey(link, words).item?.text ?? markWord(mark)
      const key = word ?? ''
      const row = fallback.get(key) ?? { id: mark === null ? 'link' : 'direction', text: word, looks: new Map<string, Look>() }
      row.looks.set(trace, look)
      fallback.set(key, row)
    }
  }
  const labelled = [...core].flatMap(([id, row]) => present.has(id) || SAMPLE_IDS[id] !== undefined ? [row] : [])
  return [...labelled, ...fallback.values()]
}

/** The dock's inset from the window's right edge, kept current (the dock opens, closes and resizes without the window moving). */
export function useDockInset(): number {
  const [inset, setInset] = useState(measureDockInset)
  useEffect(() => {
    const read = () => setInset(measureDockInset())
    read()
    const t = setInterval(read, 500)
    window.addEventListener('resize', read)
    return () => { clearInterval(t); window.removeEventListener('resize', read) }
  }, [])
  return inset
}

export function KeyLines() {
  const view = useViewStore((s) => s.view)
  const sid = useViewStore((s) => s.sid)
  const edges = useCanvasStore((s) => s.edges)
  const rows = useMemo(() => view === null ? [] : committedRows(view, sid, edges), [view, sid, edges])
  if (view?.model == null) return null
  const lineRows = rows.filter((row) => (KEY_LINE_IDS as readonly string[]).includes(row.id))
  const otherRows = rows.filter((row) => !(KEY_LINE_IDS as readonly string[]).includes(row.id))
  const showRows = (rows: KeyRow[]) => rows.map((row) => (
    <span key={`${row.id}:${row.text ?? ''}`} className={item} data-key-item={row.id}>
      {[...row.looks].map(([trace, look]) => <LineSample key={trace} id={row.id} look={look} />)}{row.text}
    </span>
  ))
  return (
    <div role="group" aria-label="Key" data-testid="view-key-lines" className={`flex flex-col items-start gap-y-1.5 ${typography.viewPanelMeta} font-normal text-text-light`}>
      {lineRows.length > 0 && <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-key-row="lines">{showRows(lineRows)}</div>}
      {otherRows.length > 0 && <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-key-row="drawn">{showRows(otherRows)}</div>}
      <div className="flex items-center gap-3" data-key-row="marks">
        <span className={item} data-key-item="olumi-mark">
          <OlumiMark words="Olumi's estimate" />Olumi&apos;s
        </span>
        <span className={item} data-key-item="person-mark">
          <OkIcon id="person-mark" size={14} words="A person's figure" inherit />a person&apos;s
        </span>
      </div>
    </div>
  )
}
