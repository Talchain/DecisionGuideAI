import type { ViewLink } from '../../client'
import { linkEndHeading } from '../../layout'
import { useViewStore } from '../../store'

export function LinkRemovalSummary({ link }: { link: ViewLink }): JSX.Element | null {
  const model = useViewStore((s) => s.view?.model)
  if (model == null || link.remove == null) return null

  const part = link.remove.part
  const from = linkEndHeading(model, part ?? link.from)
  const to = linkEndHeading(model, link.to)
  if (from.trim() === '' || to.trim() === '') return null

  return (
    <p className="py-2.5" data-testid="lane-link-removal-summary">
      {part == null ? <>This takes out the link from <strong className="font-medium">{from}</strong> to <strong className="font-medium">{to}</strong>.</>
        : <><strong className="font-medium">{to}</strong> will no longer use <strong className="font-medium">{from}</strong> in this calculation.</>}
    </p>
  )
}
