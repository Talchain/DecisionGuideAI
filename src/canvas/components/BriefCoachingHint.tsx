import { typography } from '../../styles/typography'

interface BriefCoachingHintProps {
  isFocused: boolean
  isValid: boolean
  softWarning: string | null
}

export function BriefCoachingHint({ isFocused, isValid, softWarning }: BriefCoachingHintProps) {
  const showCoaching = isFocused && !isValid
  const showWarning = isValid && softWarning

  if (!showCoaching && !showWarning) return null

  return (
    <div className="mt-1.5 px-1" role="status" aria-live="polite" data-testid="brief-coaching-hint">
      {showCoaching && (
        <p className={`${typography.panelMeta} text-text-light`}>
          Describe the decision you are facing &mdash; for example, &ldquo;Should we launch the
          premium tier this quarter or wait until we have more active users?&rdquo;
        </p>
      )}
      {showWarning && (
        <p className={`${typography.panelMeta} text-warning`}>
          {softWarning}
        </p>
      )}
    </div>
  )
}
