import { useEffect, useState } from 'react'
import { ICONS, OkIcon, type IconId } from '../../look/icons'
import { measureDockInset } from '../../../canvas/components/FloatingOlumiPanel'
import type { ViewLinkData } from '../../../canvas/edges/ViewLinkEdge'
import { useCanvasStore } from '../../../canvas/store'
import { typography } from '../../../styles/typography'
import { GROUP_LINK, ROOT_LINK, VIEW_LINK, viewEdgesBelongTo } from '../../canvas'
import { useViewLens } from '../../lens'
import { useViewStore } from '../../store'
import { OlumiMark } from '../cards/marks'
import { linkRole } from '../contract'
import { ConnectorSwatch, ROOT_LOOK, connectorLookOf, directionOf, lookKey, type ConnectorLook } from '../links/connector'
import { groupConnectorLook } from './GroupLinkEdge'
import type { GroupLink } from './groups'

export const KEY_MARK_IDS = { raises: 'link-raises', lowers: 'link-lowers', depends: 'link-depends', disputed: 'link-disputed', unknown: 'link-unknown', none: 'link-none' } as const satisfies Record<string, IconId>
type KeyMark = keyof typeof KEY_MARK_IDS

function appearanceWord(look: ConnectorLook): string {
  if (look.halo === 'alert' || look.halo === 'both') return 'orange halo'
  if (look.halo === 'proposed') return 'blue halo'
  if (look.dash === 'doubt') return 'dashed line'
  if (look.dash === 'dotted') return 'dotted line'
  if (look.end === 'arrow') return 'line with arrow'
  return look.end === 'dot' ? 'line with dot end' : 'plain line'
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
  const edges = useCanvasStore((s) => s.edges)
  const sid = useViewStore((s) => s.sid)
  const lensOn = useViewLens((s) => s.lens === 'what_changes')
  const rows = new Map<string, { id?: string; text: string; looks: Map<string, ConnectorLook> }>()
  const marks = new Set<KeyMark>()
  for (const edge of viewEdgesBelongTo(sid) ? edges : []) {
    let look: ConnectorLook
    let meaning: NonNullable<ViewLinkData['committed']>['meaning']
    if (edge.type === VIEW_LINK) {
      const { link, committed } = edge.data as unknown as ViewLinkData
      if (committed === undefined) continue
      look = connectorLookOf(link, { ...committed, driver: committed.driver && lensOn })
      meaning = committed.meaning
      const mark = directionOf(link) ?? (link.causal?.sign === 'none' ? 'none' : null)
      if (mark !== null && linkRole(link) !== 'size') marks.add(mark)
    } else if (edge.type === GROUP_LINK) {
      look = groupConnectorLook(edge.data as unknown as GroupLink)
    } else if (edge.type === ROOT_LINK) {
      look = ROOT_LOOK
    } else continue
    const key = lookKey(look), rowKey = meaning === undefined ? key : `meaning:${meaning.id}`
    const row = rows.get(rowKey) ?? { id: meaning?.id, text: meaning?.text ?? appearanceWord(look), looks: new Map<string, ConnectorLook>() }
    row.looks.set(key, look)
    rows.set(rowKey, row)
  }
  // The registry's words, said once where marks share them (depends, disputed and unknown all say "Direction not settled").
  const markWords = [...new Set((Object.keys(KEY_MARK_IDS) as KeyMark[]).filter((m) => marks.has(m)).map((m) => ICONS[KEY_MARK_IDS[m]].hover))]
  const item = 'flex items-center gap-1.5'
  return (
    <div role="group" aria-label="Key" data-testid="view-key-lines" className={`flex flex-col items-start gap-y-1.5 ${typography.viewPanelMeta} font-normal text-text-light`}>
      {rows.size === 0 ? null : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-key-row="lines">
          {[...rows].map(([key, row]) => (
            <span key={key} className={item} data-key-item={row.id ?? key}>
              {[...row.looks].map(([id, look]) => <ConnectorSwatch key={id} look={look} />)}{row.text}
            </span>
          ))}
        </div>
      )}
      {marks.size === 0 ? null : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-key-row="drawn">
          {markWords.map((w) => (
            <span key={w} className={item} data-key-item="direction">
              {(Object.keys(KEY_MARK_IDS) as KeyMark[]).filter((m) => marks.has(m) && ICONS[KEY_MARK_IDS[m]].hover === w).map((m) => <span key={m} data-key-direction={m} className="inline-flex"><OkIcon id={KEY_MARK_IDS[m]} size={14} decorative /></span>)}{w}
            </span>
          ))}
        </div>
      )}
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
