import { useId, useMemo, useState } from 'react'
import { BookOpenText, CircleDot, GitBranch, Layers3 } from 'lucide-react'
import { useCanvasStore } from '@/canvas/store'
import { typography } from '@/styles/typography'
import { readDecisionBriefViewModel, type DecisionBriefViewModel } from './decisionBriefViewModel'

interface BriefGroupProps {
  title: string
  items: string[]
  icon: typeof CircleDot
  expanded: boolean
  testId: string
}

const PREVIEW_ITEMS = 1

function BriefGroup({ title, items, icon: Icon, expanded, testId }: BriefGroupProps) {
  if (items.length === 0) return null
  const visible = expanded ? items : items.slice(0, PREVIEW_ITEMS)
  const hiddenCount = items.length - PREVIEW_ITEMS

  return (
    <div className="min-w-0" data-testid={testId}>
      <dt className={`${typography.panelMeta} flex items-center gap-1.5 text-text-light`}>
        <Icon size={13} className="shrink-0 text-info" aria-hidden="true" />
        <span>{title}</span>
      </dt>
      <dd className="mt-1.5 min-w-0">
        <ul className="space-y-1" aria-label={title}>
          {visible.map((item, index) => (
            <li
              key={`${index}-${item}`}
              className={`${typography.panelBody} flex min-w-0 items-start gap-1.5 text-text-body`}
            >
              <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-text-light/70" aria-hidden="true" />
              <span className="min-w-0 break-words whitespace-pre-wrap">{item}</span>
            </li>
          ))}
        </ul>
        {!expanded && hiddenCount > 0 && (
          <p className={`${typography.panelMeta} mt-1 text-text-light`} aria-hidden="true">
            +{hiddenCount} more
          </p>
        )}
      </dd>
    </div>
  )
}

export interface DecisionBriefSectionProps {
  brief: DecisionBriefViewModel
}

/** Store-free presentation, exported for focused and adversarial tests. */
export function DecisionBriefSection({ brief }: DecisionBriefSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const groups = [
    { title: 'What matters', items: brief.topDrivers.map(driver => driver.label), icon: CircleDot, testId: 'decision-brief-drivers' },
    { title: 'What this rests on', items: brief.keyAssumptions, icon: Layers3, testId: 'decision-brief-assumptions' },
    { title: 'What could change', items: brief.whatWouldChange, icon: GitBranch, testId: 'decision-brief-change' },
  ].filter(group => group.items.length > 0)

  if (groups.length === 0) return null

  return (
    <section
      className="rounded-lg border border-panel-border bg-panel px-3 py-2"
      aria-labelledby={`${detailsId}-heading`}
      data-testid="decision-brief-section"
    >
      <div className="flex items-start gap-2">
        <BookOpenText size={16} className="mt-0.5 shrink-0 text-info" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 id={`${detailsId}-heading`} className={`${typography.panelHeader} text-text-header`}>
            Decision brief
          </h3>
          <p className={`${typography.panelMeta} mt-0.5 text-text-light`}>
            Top drivers, key assumptions, and what could change.
          </p>
        </div>
      </div>

      <dl
        id={detailsId}
        className="mt-2 grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 border-t border-panel-border pt-2"
        data-testid="decision-brief-groups"
      >
        {groups.map(group => (
          <BriefGroup key={group.title} {...group} expanded={expanded} />
        ))}
      </dl>

      {groups.some(group => group.items.length > PREVIEW_ITEMS) && (
        <button
          type="button"
          className={`${typography.panelMeta} mt-2 min-h-7 rounded-sm py-1.5 text-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded(value => !value)}
          data-testid="decision-brief-toggle"
        >
          {expanded ? 'Show brief summary' : 'Show all brief details'}
        </button>
      )}
    </section>
  )
}

/**
 * The complete V5 report already reaches the store and persists with analysis.
 * Reading it here avoids a second mapper and keeps this surface independent of
 * the existing leader/hero authority.
 */
export function DecisionBriefSectionContainer() {
  const rawBrief = useCanvasStore(state => (
    (state.results.report as { decision_brief?: unknown } | null | undefined)?.decision_brief
  ))
  const brief = useMemo(() => readDecisionBriefViewModel(rawBrief), [rawBrief])

  if (!brief) return null
  return <DecisionBriefSection brief={brief} />
}

export default DecisionBriefSectionContainer
