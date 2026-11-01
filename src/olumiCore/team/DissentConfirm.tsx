import { ShieldQuestion } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { dissentsOf, recordWords } from './model'
import { BODY, CARD, H, META } from './ui'
import type { TeamScenario } from './types'

/**
 * A kept disagreement is the HOLDER's, and only the holder can confirm their words (design plan step 6). Olumi's API has no route to
 * confirm or edit a disagreement yet, so nothing here is, or can be called, confirmed: the row says it is not, and offers no button that
 * would pretend otherwise. When the route exists this is where "Confirm / Edit my words" and the team's approval go, shown apart.
 */
export function DissentNotConfirmed({ holder }: { holder: string | null }): JSX.Element {
  return (
    <span data-testid="team-dissent-unconfirmed" className={`${META} inline-flex items-center gap-1`}>
      <ShieldQuestion aria-hidden="true" className="h-3 w-3 flex-none" />
      {holder ? `Not yet confirmed by its holder (${holder}). Only ${holder} can confirm these words.` : 'Not yet confirmed by its holder.'}
    </span>
  )
}

/**
 * DISAGREEMENTS HELD (design plan step 6; v10 board 15b). Each disagreement in the confirmed model, in the holder's words, with the two
 * states shown apart: it is IN THE MODEL (a member approved it), and it is CONFIRMED BY ITS HOLDER (only the holder can say these are
 * their words). The second cannot be recorded yet, so every row reads "not yet" and the control is drawn disabled: nothing here is, or
 * can be called, confirmed until core has a route that stores the holder's confirmation.
 */
export function DissentPanel({ scenario }: { scenario: Pick<TeamScenario, 'version'> }): JSX.Element | null {
  const held = dissentsOf(scenario)
  if (held.length === 0) return null
  return (
    <section data-testid="team-dissent" aria-label="Disagreements held" className="grid gap-2">
      <h3 className={H}>Disagreements held</h3>
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {held.map((d) => (
          <li key={d.id} data-testid={`team-dissent-${d.id}`} className={CARD}>
            <p className={`${BODY} whitespace-pre-wrap break-words text-text-header`}>{recordWords(d)}</p>
            <p className={`${META}`} data-testid={`team-dissent-state-${d.id}`}>In the model: yes. Confirmed by its holder: not yet.</p>
            <DissentNotConfirmed holder={d.holder ?? null} />
            <div>
              <Button size="sm" variant="secondary" disabled data-testid={`team-dissent-confirm-${d.id}`} title="Opens when Olumi can store a holder’s confirmation">Confirm these words (holder)</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
