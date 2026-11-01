import { ShieldQuestion } from 'lucide-react'
import { META } from './ui'

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
