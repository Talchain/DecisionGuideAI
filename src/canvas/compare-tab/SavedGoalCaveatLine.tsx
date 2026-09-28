import { typography } from '../../styles/typography'
import { savedGoalCaveatLines, type SavedGoal } from './savedGoalCaveat'

/** The saved goal figures' base caveat sentences, beside the figures (see `savedGoalCaveat.ts`). */
export function SavedGoalCaveatLine({
  runs,
  testId,
  className = '',
}: {
  runs: ReadonlyArray<SavedGoal>
  testId: string
  className?: string
}) {
  const lines = savedGoalCaveatLines(runs)
  if (lines.length === 0) return null
  return (
    <div data-testid={testId} className={`${typography.panelMeta} text-text-light ${className}`}>
      {lines.map((line) => (
        <p key={line} className="m-0">
          {line}
        </p>
      ))}
    </div>
  )
}
