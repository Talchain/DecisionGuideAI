import { typography } from '@/styles/typography'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import { GOAL_IDENTITY_WITHHELD_FALLBACK, readGoalIdentityWithheld, readGoalWithheldReasonFor } from '../utils/goalIdentityWithheld'
import { optionChanceCellFromResults } from '../optionChanceCellFromResults'
import type { HeroChartModel, HeroLens } from './heroTypes'

export interface GoalOptionCoverage {
  hasFigures: boolean
  withheldLines: ReadonlyArray<{ id: string; line: string }>
}

/** Same range admission as the range renderer; point admission is the hero's existing goal row. */
export function withGoalOptionCoverage(model: HeroChartModel, data: ResultsSectionDataReturn): HeroChartModel {
  const figureIds = new Set(model.rows.filter(row => {
    const cell = optionChanceCellFromResults(data, row.id)
    return cell.kind === 'figure' || cell.kind === 'range'
  }).map(row => row.id))
  if (figureIds.size === 0) return model

  // The recommendation already uses this reader on the Run's report, just as the decision matrix does.
  const message = data.recommendation.goalFiguresWithheldMessage
    ?? readGoalIdentityWithheld({ inference_warnings: data.confidence?.inferenceWarnings })?.message
  const producerSaidFallback = data.confidence?.inferenceWarnings?.some((warning) =>
    warning.message?.trim() === GOAL_IDENTITY_WITHHELD_FALLBACK) === true
  const reason = message && (message !== GOAL_IDENTITY_WITHHELD_FALLBACK || producerSaidFallback) && message.startsWith('Not shown.')
    ? message.slice('Not shown.'.length).trim() : null
  return {
    ...model,
    goalOptionCoverage: {
      hasFigures: true,
      withheldLines: model.rows.filter((row) => !figureIds.has(row.id)).map((row) => {
        // Legacy callers carry only the Run-wide message. Once warnings are present, no Run-wide fallback is allowed.
        const rowReason = readGoalWithheldReasonFor({ inference_warnings: data.confidence?.inferenceWarnings }, row.id)
          ?? (data.confidence?.inferenceWarnings === undefined ? reason : null)
        return {
          id: row.id,
          line: rowReason ? `‘${row.label}’: not shown yet. ${rowReason}` : `‘${row.label}’: not shown yet in this model.`,
        }
      }),
    },
  }
}

/** The goal withholding box has no Run-wide meaning alongside a rendered option figure. */
export function suppressGoalWithholdingBox(model: HeroChartModel, lens: HeroLens): boolean {
  const coverage = model.goalOptionCoverage
  return coverage?.hasFigures === true && (lens === 'goal' || lens === 'outcome')
    && (coverage.withheldLines.length !== 0 || model.outcomeWithheldBody?.startsWith('Not shown.') === true)
}

export function GoalOptionWithheldLines({ coverage }: { coverage?: GoalOptionCoverage }) {
  if (!coverage?.withheldLines.length) return null
  return (
    <div data-testid="goal-option-withheld-lines" className={`flex flex-col gap-2 py-2 ${typography.panelBody}`}>
      {coverage.withheldLines.map(({ id, line }) => (
        <p key={id} data-testid="goal-option-withheld-line" data-option-id={id}>{line}</p>
      ))}
    </div>
  )
}
