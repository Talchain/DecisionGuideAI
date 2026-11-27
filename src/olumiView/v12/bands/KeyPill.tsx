import { useEffect, useId, useState } from 'react'
import { measureDockInset } from '../../../canvas/components/FloatingOlumiPanel'
import { typography } from '../../../styles/typography'
import { OkIcon } from '../../look/icons'
import { OlumiMark } from '../cards/marks'
import { useViewStore } from '../../store'
import { useDrawnLooks } from '../links/drawnLooks'
import type { EdgeLook } from '../links/edgeLook'
import { LinkDirectionIcon, LinkTrace } from '../links/LinkTrace'

// These entries describe links exclusively. The Core glossary still draws shared entries such as Olumi's mark.
export const LINK_KEY_IDS: ReadonlySet<string> = new Set([
  'effect', 'input', 'size', 'measures', 'target', 'reason', 'doubted', 'unsettled', 'alert',
  'raises', 'lowers', 'depends', 'disputed', 'unknown', 'none',
])

function KeyLinkSample({ look, signature }: { look: EdgeLook; signature: string }) {
  const marker = useId()
  const { toneClass, dash, end, mark } = look
  const path = end === 'none' ? 'M2 8H46' : 'M2 8H43'
  return (
    <span className="relative inline-flex shrink-0" aria-hidden="true">
      <svg width="48" height="16" data-key-sample="" data-link-dash={dash ?? undefined} className={`ok-key-sample ${toneClass}`}>
        <LinkTrace look={look} signature={signature} path={path} marker={marker} sample />
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
  const model = useViewStore((s) => s.view?.model)
  const drawn = useDrawnLooks()
  if (model == null) return null
  const samples = new Map<string, { look: EdgeLook; labelIds: Set<string> }>()
  for (const { signature, look, labelId } of drawn.values()) {
    const sample = samples.get(signature) ?? { look, labelIds: new Set<string>() }
    if (labelId !== null) sample.labelIds.add(labelId)
    samples.set(signature, sample)
  }
  const item = 'flex items-center gap-1.5'
  return (
    <div role="group" aria-label="Key" data-testid="view-key-lines" className={`flex flex-col items-start gap-y-1.5 ${typography.viewPanelMeta} font-normal text-text-light`}>
      {[...samples].map(([signature, { look, labelIds }]) => (
        <div key={signature} className={`${item} max-w-full flex-wrap`} data-key-row="link">
          <KeyLinkSample look={look} signature={signature} />
          {(model.key ?? []).filter(({ id, text }) => labelIds.has(id) && text !== '').map(({ id, text }) => (
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
