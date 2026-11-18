import type { View } from '../../olumiView/client'
import { dissentHolderName } from './DissentPanel'
import { openStep } from './flow'
import { goToOutcome, withoutOutcome } from './outcomeNav'
import { BODY, CARD, GO, META } from './ui'

type Kept = { id: string; d: View['collab']['dissent'][number] | null; label: string | null }

/** Fixed chrome for the commit step's done state: the one-line continuation. Everything else on the card is the team's own record. */
export const SAVED_WORDS = { next: 'Record what happened', see: 'See what happened', saved: 'Recorded' } as const

/**
 * THE COMMIT STEP'S DONE STATE (Codex 008 finding 6, 18 Nov): once an action is recorded, the step shows it, in the words core stores
 * (action, owner, who set it, what the team expects, what would make it reconsider, the disagreements it keeps open), and one direct
 * continuation into "What happened" (the existing outcome form for the first action with no outcome yet, else the step itself).
 * Nothing is written here and nothing is reworded: the outcome form's own write is the only one.
 */
export function SavedActions({ sid, view }: { sid: string; view: View }): JSX.Element | null {
  const c = view.collab
  if (c.commitments.length === 0) return null
  const open = withoutOutcome(c.commitments)[0]
  const labelOf = (id: string) => c.records.find((r) => r.id === id)?.label ?? null
  return (
    <div className="grid gap-2" data-testid="team-saved-actions">
      <ul className="m-0 grid list-none gap-2 p-0">
        {c.commitments.map((k) => {
          // Every id the action keeps open, in core's order, none dropped: a disagreement record (writer's name first), else the record's own label.
          const kept: Kept[] = k.keeps.flatMap((id): Kept[] => { const d = c.dissent.find((x) => x.id === id); if (d !== undefined) return [{ id, d, label: null }]; const l = labelOf(id); return l === null ? [] : [{ id, d: null, label: l }] })
          return (
            <li key={k.id} data-testid={`team-saved-action-${k.id}`} className={CARD}>
              <p className={`${BODY} whitespace-pre-wrap break-words text-text-header`} data-testid={`team-saved-action-words-${k.id}`}>{k.action}</p>
              <p className={META}>owner {k.owner} · set by {k.by}</p>
              <dl className="m-0 grid gap-1">
                <div><dt className={META}>What we expect</dt><dd className={`${BODY} m-0 whitespace-pre-wrap break-words`} data-testid={`team-saved-action-expect-${k.id}`}>{k.expect}</dd></div>
                <div><dt className={META}>What would make us reconsider</dt><dd className={`${BODY} m-0 whitespace-pre-wrap break-words`} data-testid={`team-saved-action-reconsider-${k.id}`}>{k.reconsider}</dd></div>
              </dl>
              {kept.length > 0 && (
                <ul className="m-0 grid list-none gap-0.5 p-0" data-testid={`team-saved-action-keeps-${k.id}`}>
                  {kept.map(({ id, d, label }) => {
                    const name = d === null ? null : dissentHolderName(c, d)
                    return <li key={id} data-testid={`team-saved-action-keep-${k.id}-${id}`} className={`${META} whitespace-pre-wrap break-words`}>Keeps open: {name === null ? '' : `${name}: `}{d === null ? label : d.confirmed?.words ?? d.position}</li>
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
      <div>
        {open !== undefined
          ? <button type="button" className={GO} data-testid="team-saved-next" data-commitment={open.id} onClick={() => goToOutcome(sid, open.id)}>{SAVED_WORDS.next}</button>
          : <button type="button" className={GO} data-testid="team-saved-next" onClick={() => openStep('outcome')}>{SAVED_WORDS.see}</button>}
      </div>
    </div>
  )
}
