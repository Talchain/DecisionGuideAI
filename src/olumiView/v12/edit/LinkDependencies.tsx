import { typography } from '../../../styles/typography'
import type { ViewLink } from '../../client'
import { linkEndHeading } from '../../layout'
import { useViewStore } from '../../store'

/** The View identifies the removable record or sum part. It doesn't carry the engine's before/after reach. */
export function LinkDependencies({ link }: { link: ViewLink }): JSX.Element {
  const model = useViewStore((s) => s.view?.model)
  const remove = link.remove
  if (model == null || remove == null) return <p>Olumi could not show the dependencies for this link.</p>

  const name = (id: string) => linkEndHeading(model, id) || 'a figure outside this view'
  const from = name(remove.part ?? link.from), to = name(link.to)
  const readers = new Set<string>()
  // For a sum, follow calculation and measure links downstream. This shows what reads the result today.
  if (remove.part != null) {
    const queue = [link.to]
    const visited = new Set([link.to, remove.part])
    for (const id of queue) {
      for (const next of model.links) {
        if (next.from !== id || visited.has(next.to) || (next.role !== 'input' && next.role !== 'effect' && next.role !== 'measures' && next.role !== 'target')) continue
        visited.add(next.to)
        readers.add(next.to)
        queue.push(next.to)
      }
    }
  } else {
    for (const next of model.links) {
      if (next.from === remove.record) readers.add(next.to)
      if (next.to === remove.record) readers.add(next.from)
    }
  }
  return (
    <div className="grid gap-2 py-2.5" data-testid="lane-link-dependencies">
      <p>{remove.part == null ? <>This takes out the link from <strong className="font-medium">{from}</strong> to <strong className="font-medium">{to}</strong>.</>
        : <><strong className="font-medium">{to}</strong> will no longer use <strong className="font-medium">{from}</strong> in this calculation.</>}</p>
      {readers.size === 0 ? <p className={`${typography.viewPanelMeta} text-text-light`}>This view shows no other dependencies on this link.</p> : (
        <>
          <p className={`${typography.viewPanelHeading} text-text-header`}>{remove.part == null ? 'Also connected to this link' : 'Uses this result in the current model'}</p>
          <ul className="list-disc pl-4">{[...readers].map((reader) => <li key={reader}>{name(reader)}</li>)}</ul>
        </>
      )}
    </div>
  )
}
