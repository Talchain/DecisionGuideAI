import { Lock } from 'lucide-react'
import { TEAM_FIGURES_SERVED } from './model'
import { META, PRIVACY_AFTER, PRIVACY_BEFORE, PRIVACY_FIGURES } from './ui'

/**
 * The privacy promise, once, in the words of the moment: "Your view is private until the reveal." before it, "Revealed to everyone, Olumi
 * included." after it. The sentence about figures is shown only while figures can be entered (`TEAM_FIGURES_SERVED`): until then it would
 * promise about figures nobody can give. Static words by design: they are the contract, not a status.
 */
export function PrivacyNote({ phase }: { phase: 'before' | 'after' }): JSX.Element {
  return (
    <div data-testid="team-privacy" data-phase={phase} className="grid gap-1">
      <p className={`${META} flex items-start gap-1.5`}>
        <Lock aria-hidden="true" className="mt-0.5 h-3 w-3 flex-none" />
        <span data-testid="team-privacy-view">{phase === 'before' ? PRIVACY_BEFORE : PRIVACY_AFTER}</span>
      </p>
      {TEAM_FIGURES_SERVED && <p className={`${META} pl-[18px]`} data-testid="team-privacy-figures">{PRIVACY_FIGURES}</p>}
    </div>
  )
}
