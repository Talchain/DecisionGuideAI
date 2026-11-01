import { Lock } from 'lucide-react'
import { META, PRIVACY_FIGURES, PRIVACY_VIEW } from './ui'

/** The two privacy promises, verbatim. Static words by design: they are the contract, not a status. */
export function PrivacyNote({ scope }: { scope?: string }): JSX.Element {
  const id = (base: string) => (scope ? `${base}-${scope}` : base)
  return (
    <div data-testid={id('team-privacy')} className="grid gap-1">
      <p className={`${META} flex items-start gap-1.5`}>
        <Lock aria-hidden="true" className="mt-0.5 h-3 w-3 flex-none" />
        <span data-testid={id('team-privacy-view')}>{PRIVACY_VIEW}</span>
      </p>
      <p className={`${META} pl-[18px]`} data-testid={id('team-privacy-figures')}>{PRIVACY_FIGURES}</p>
    </div>
  )
}
