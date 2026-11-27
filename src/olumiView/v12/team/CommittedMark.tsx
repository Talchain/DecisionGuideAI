import { controls } from '../../../styles/controls'
import { OkIcon } from '../../look/icons'
import { HoverButton } from '../../look/Hover'
import { useViewStore } from '../../store'
import { goToOutcome } from '../../../olumiCore/team/outcomeNav'

/**
 * The mark on an option the team has committed to: core's stored commitments name their option (`collab.commitments[].option.id`), and an
 * option with at least one carries this mark. The words are the product's chrome "Committed" with core's date for it, then the person's own
 * action words as they were saved. Pressing it opens that commitment where "What happened" is recorded (`goToOutcome`, the existing opener):
 * the one without an outcome yet if there is one, otherwise the latest. Nothing is read from words: only the stored option id.
 */
/** The commitment an option's mark and its details speak of: the one without an outcome yet, else the latest; its words as the mark says them. Null where there is none. */
export function useCommitted(card: string): { readonly id: number; readonly lines: readonly string[] } | null {
  const mine = useViewStore((s) => s.view?.collab?.commitments ?? []).filter((k) => k.option?.id === card)
  if (mine.length === 0) return null
  const open = mine.find((k) => k.outcomes.length === 0) ?? mine[mine.length - 1]
  return { id: open.id, lines: [`Committed${open.at ? ` · ${open.at}` : ''}`, open.action].filter((t) => t !== '') }
}

export function CommittedMark({ card }: { card: string }): JSX.Element | null {
  const sid = useViewStore((s) => s.sid)
  const open = useCommitted(card)
  if (open === null || !sid) return null
  const words = open.lines.join('\n')
  return (
    <HoverButton type="button" aria-label={words} words={words} data-committed-mark={card} data-commitment={open.id}
      onClick={(e) => { e.stopPropagation(); goToOutcome(sid, open.id) }}
      className={`${controls.chipIcon} nodrag pointer-events-auto inline-grid cursor-pointer place-items-center border border-panel-border bg-canvas text-text-body transition-colors duration-fast hover:border-text-header`}>
      <OkIcon id="committed" size={14} decorative />
    </HoverButton>
  )
}
