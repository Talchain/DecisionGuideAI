import { OkIcon } from '../../look/icons'
import { useViewStore } from '../../store'
import { goToOutcome } from '../../../olumiCore/team/outcomeNav'

/**
 * The mark on an option the team has committed to: core's stored commitments name their option (`collab.commitments[].option.id`), and an
 * option with at least one carries this mark. The words are the product's chrome "Committed" with core's date for it, then the person's own
 * action words as they were saved. Pressing it opens that commitment where "What happened" is recorded (`goToOutcome`, the existing opener):
 * the one without an outcome yet if there is one, otherwise the latest. Nothing is read from words: only the stored option id.
 */
export function CommittedMark({ card }: { card: string }): JSX.Element | null {
  const sid = useViewStore((s) => s.sid)
  const mine = useViewStore((s) => s.view?.collab?.commitments ?? []).filter((k) => k.option?.id === card)
  if (mine.length === 0 || !sid) return null
  const open = mine.find((k) => k.outcomes.length === 0) ?? mine[mine.length - 1]
  const first = `Committed${open.at ? ` · ${open.at}` : ''}`
  const words = [first, open.action].filter((t) => t !== '').join('\n')
  return (
    <button type="button" aria-label={words} title={words} data-committed-mark={card} data-commitment={open.id}
      onClick={(e) => { e.stopPropagation(); goToOutcome(sid, open.id) }}
      className="nodrag pointer-events-auto inline-grid h-6 w-6 cursor-pointer place-items-center rounded-full border border-panel-border bg-canvas text-text-body transition-colors duration-fast hover:border-text-header">
      <OkIcon id="committed" size={12} decorative />
    </button>
  )
}
