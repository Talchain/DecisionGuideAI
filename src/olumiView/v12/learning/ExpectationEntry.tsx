import { OkIcon } from '../../look/icons'
import { Button } from '../../../components/ui/Button'
import type { View } from '../../client'
import { goToOutcome, withoutOutcome } from '../../../olumiCore/team/outcomeNav'
import { BODY, CARD, LABEL, META } from '../../../olumiCore/team/ui'

/**
 * THE SAVED EXPECTATION, back in front of the person who wrote it. "Record what you will do" promises "You can compare what happened with
 * what you expected later", and then the saved expectation is nowhere on the Olumi tab. This card is that later: the person's own action
 * and expectation, whole and as typed, the review date where one was saved, and one button that opens the EXISTING outcome form for that
 * commitment in the Team tab (`goToOutcome`). It writes nothing, reads no clock and judges nothing: no "due", "late" or "on track".
 *
 * Whose: an expectation the reader saved (`by_id` is theirs), so "you" is true. Until: an outcome is recorded (the nudges' rule). Several
 * open: the earliest review date first, dated before undated, then the View's order; the rest stay in Team's own list.
 */
export const EXPECTATION_WORDS = { expect: 'What you expect to happen', review: 'Review on', record: 'Record what happened' } as const

type Commitment = View['collab']['commitments'][number]

/** The reader's own expectation to draw, or none. Calendar dates (YYYY-MM-DD) order as text. */
export function expectationOf(view: View): Commitment | null {
  const mine = withoutOutcome(view.collab.commitments.filter((k) => k.by_id === view.you_id))
  const dated = mine.filter((k) => k.review_on != null).sort((a, b) => (a.review_on! < b.review_on! ? -1 : a.review_on! > b.review_on! ? 1 : 0))
  return dated[0] ?? mine[0] ?? null
}

export function ExpectationEntry({ sid, view }: { sid: string; view: View }): JSX.Element | null {
  const k = expectationOf(view)
  if (k === null) return null
  return (
    <section data-testid="expectation-entry" data-commitment={k.id} aria-label={EXPECTATION_WORDS.expect} className={CARD}>
      <p className={`${BODY} whitespace-pre-wrap break-words text-text-header`} data-testid="expectation-entry-action">{k.action}</p>
      <div className="grid gap-1">
        <p className={LABEL}>{EXPECTATION_WORDS.expect}</p>
        <p className={`${BODY} whitespace-pre-wrap break-words`} data-testid="expectation-entry-expect">{k.expect}</p>
      </div>
      {k.review_on != null && (
        <p className={`${META} flex items-center gap-1.5`} data-testid="expectation-entry-review">
          <OkIcon id="decide-by" size={14} decorative inherit />{EXPECTATION_WORDS.review} {k.review_on}
        </p>
      )}
      <div><Button size="chip" variant="secondary" data-testid="expectation-entry-record" onClick={() => goToOutcome(sid, k.id)}>{EXPECTATION_WORDS.record}</Button></div>
    </section>
  )
}
