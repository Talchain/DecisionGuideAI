import { useEffect, useId, useState } from 'react'
import { useCanvasStore } from '../../../canvas/store'
import { measureDockInset } from '../../../canvas/components/FloatingOlumiPanel'
import { typography } from '../../../styles/typography'
import { GROUP_LINK, ROOT_LINK, VIEW_LINK } from '../../canvas'
import { OkIcon } from '../../look/icons'
import { OlumiMark } from '../cards/marks'
import { edgeLook, type EdgeLook } from '../links/edgeLook'
import { LinkDirectionIcon, LinkTrace } from '../links/LinkTrace'
import { linkLookState, useLinkLookInputs, type ViewLinkData } from '../links/linkLookState'
import type { GroupLink } from './groups'

// These entries describe links exclusively. The Core glossary still draws shared entries such as Olumi's mark.
export const LINK_KEY_IDS: ReadonlySet<string> = new Set([
  'effect', 'input', 'size', 'measures', 'target', 'reason', 'doubted', 'unsettled', 'alert',
  'raises', 'lowers', 'depends', 'disputed', 'unknown', 'none',
])

const lookKey = ({ tone, lineClass, dash, end, halos, mark }: EdgeLook) =>
  JSON.stringify([tone, lineClass, dash, end, halos, mark])

function keyIds({ modelled, role, mark, dash, dotted, reasonAlert, halos }: EdgeLook): string[] {
  const ids = new Set<string>()
  if (modelled) ids.add('effect')
  else if (role !== null) ids.add(role)
  else if (dotted) ids.add('reason')
  if (mark !== null) ids.add(mark)
  if (mark === 'depends' || mark === 'disputed' || mark === 'unknown') ids.add('unsettled')
  if (dash !== null) ids.add('doubted')
  if (reasonAlert) ids.add('alert')
  for (const { kind } of halos) ids.add(kind === 'alert' ? 'alert' : 'olumi')
  return [...ids]
}

function useKeyLooks(inputs: ReturnType<typeof useLinkLookInputs>) {
  const edges = useCanvasStore((s) => s.edges)
  const samples = new Map<string, { look: EdgeLook; ids: Set<string> }>()
  for (const edge of edges) {
    if (edge.hidden) continue
    let look: EdgeLook
    switch (edge.type) {
      case VIEW_LINK:
        look = edgeLook(linkLookState(edge, edge.data as unknown as ViewLinkData, inputs))
        break
      case GROUP_LINK:
        look = edgeLook({ connector: 'group', mixedDirection: (edge.data as unknown as GroupLink).mixedDirection })
        break
      case ROOT_LINK:
        look = edgeLook({ connector: 'root' })
        break
      default:
        continue
    }
    const key = lookKey(look)
    const sample = samples.get(key) ?? { look, ids: new Set<string>() }
    for (const id of keyIds(look)) sample.ids.add(id)
    samples.set(key, sample)
  }
  return samples
}

function KeyLinkSample({ look }: { look: EdgeLook }) {
  const marker = useId()
  const { toneClass, dash, end, mark } = look
  const path = end === 'none' ? 'M2 8H46' : 'M2 8H43'
  return (
    <span className="relative inline-flex shrink-0" aria-hidden="true">
      <svg width="48" height="16" data-key-sample="" data-link-dash={dash ?? undefined} className={`ok-key-sample ${toneClass}`}>
        <LinkTrace look={look} path={path} marker={marker} sample />
      </svg>
      {mark === null ? null : (
        <span className="ok-key-link-mark absolute inset-0 m-auto flex h-fit w-fit items-center" data-key-direction={mark}>
          <LinkDirectionIcon mark={mark} />
        </span>
      )}
    </span>
  )
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

/** The live link samples in ViewLegend, followed by the authorship marks. */
export function KeyLines() {
  const inputs = useLinkLookInputs()
  const samples = useKeyLooks(inputs)
  const { model } = inputs
  if (model == null) return null
  const item = 'flex items-center gap-1.5'
  return (
    <div role="group" aria-label="Key" data-testid="view-key-lines" className={`flex flex-col items-start gap-y-1.5 ${typography.viewPanelMeta} font-normal text-text-light`}>
      {[...samples].map(([key, { look, ids }]) => (
        <div key={key} className={`${item} max-w-full flex-wrap`} data-key-row="link">
          <KeyLinkSample look={look} />
          {(model.key ?? []).filter(({ id }) => ids.has(id)).map(({ id, text }) => (
            <span key={id} data-key-item={id}>{text}</span>
          ))}
        </div>
      ))}
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
