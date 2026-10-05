import { useState } from 'react'
import type { RunDelta, RunDeltaEndpoint } from '@talchain/schemas/boundary'
import { typography } from '../../styles/typography'
import { PANEL_RULE } from '../../components/results/analysisNew/panelSurfaces'
import { PanelIconButton } from '../../components/results/analysisNew/PanelIconButton'
import { SectionShell } from '../../components/results/analysisNew/sections/SectionShell'
import { useScienceExact, scienceQuantityText } from '../../components/science/ScienceQuantity'
import { openAskOlumi } from '../../components/results/coaching/askOlumiStore'
import { INPUT_ROWS_SHOWN_FIRST, type RunDeltaInputRow, type RunDeltaView } from '../../components/results/analysisNew/runDeltaView'
import {
  InputChanges, inputRowText, MOVEMENT_SCOPE_TEXT, noiseQualifier, noPairsText, WHATS_CHANGED_TESTID,
  type InputRowFocus, type InputRowLight,
} from '../../components/results/analysisNew/sections/WhatsChanged'
import type { RunChangeArtefact } from './runChangeArtefact'
import { RUN_CHANGE_ARTEFACT_TESTID } from './RunChangeArtefactCard'
import { CompareSupportFigures, orderMovements, type OptionCanvasLink } from './CompareSupportFigures'

const INPUT_FIELDS = 'run_delta.input_changes[].entity_id run_delta.input_changes[].option_id run_delta.input_changes[].link run_delta.input_changes[].before run_delta.input_changes[].after run_delta.input_coverage'
const LEADER_FIELDS = 'run_delta.leader.changed run_delta.leader.prior_leading_option_id run_delta.leader.current_leading_option_id run_delta.leader.noise_verdict'
export const COMPARE_ASK_LABEL = 'Ask Olumi about this comparison'

/**
 * The one headline. Words selected from entitled producer claims, never from a score or a client comparison: an
 * option is named only by a leader id the producer sent, and only while results may be shown. Principle audit (5 Oct):
 * it is named as what came out best IN THIS MODEL (Science's phrase), never as one a run "puts forward".
 */
function headline(delta: RunDelta, label: (id: string) => string | null, nearTie: boolean): string {
  if (nearTie) return 'Too close to call in this model'
  const prior = delta.leader.prior_leading_option_id
  const current = delta.leader.current_leading_option_id
  if (!current) return 'The latest run names no option'
  const currentName = label(current)
  if (!prior) return `In this model, the most runs supported ${currentName ?? 'an option'} on the latest run; the previous run named no option`
  const priorName = label(prior)
  if (delta.leader.changed) {
    return currentName && priorName
      ? `In this model, the option the most runs supported changed from ${priorName} to ${currentName}`
      : 'Which option the most runs supported in this model changed'
  }
  return currentName ? `In this model, the most runs still supported ${currentName}` : 'The option the most runs supported in this model is unchanged'
}

function RunTime({ name, endpoint }: { name: string; endpoint?: RunDeltaEndpoint }): JSX.Element {
  // Plain words first: the run's identity stays in data-run-id, never as the visible text.
  return (
    <span data-run-id={endpoint?.run_id}>
      {name}{' '}
      {endpoint?.computed_at
        ? <time dateTime={endpoint.computed_at}>{new Date(endpoint.computed_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
        : 'time not recorded'}
    </span>
  )
}

/** The editable Ask draft: the user's question, then the changes the panel is showing, never more than it shows. */
export function compareAskDraft(shown: readonly RunDeltaInputRow[], total: number): string {
  const question = 'Help me understand what changed between these runs and what to investigate next.'
  if (shown.length === 0) return question
  const more = total - shown.length
  const lines = shown.map((row) => `- ${inputRowText(row)}`)
  if (more > 0) lines.push(`- and ${more} more recorded ${more === 1 ? 'change' : 'changes'}`)
  return `${question}\n\nChanges recorded between the two runs:\n${lines.join('\n')}`
}

/**
 * Compare's presentation of the shared reader, in Reasoning's own parts: one headline with its ✦ (CommitmentSummary's
 * heading row), the two-marker figures, Reasoning's input list (`InputChanges`), the reading note, and the exact
 * shares behind a `disclose` row. Every semantic verdict remains producer-owned.
 */
export function ComparePairSections({
  view, delta, artefact, label, nearTie, resultsAllowed, withheldReason, rowFocus, rowLight,
  runIsCurrent = true, analysing = false, designationsWithheld = false, optionLink = () => null,
}: {
  view: RunDeltaView; delta: RunDelta; artefact: RunChangeArtefact | null; label: (id: string) => string | null
  nearTie: boolean; resultsAllowed: boolean; withheldReason: string | null; rowFocus: InputRowFocus; rowLight: InputRowLight
  /** `selectRunAffirmedCurrent`: Ask is offered only while the pair on screen is the pair Olumi's tools read. */
  runIsCurrent?: boolean
  /** A run is in flight: the pair below is the previous one and stays visible. */
  analysing?: boolean
  /** The run withholds option designations: options keep the producer's order (`sortOptionsForDisplay`). */
  designationsWithheld?: boolean
  optionLink?: OptionCanvasLink
}): JSX.Element {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const exact = useScienceExact(detailsOpen)
  const rows = view.inputs?.rows ?? []
  const resultHeadline = resultsAllowed ? headline(delta, label, nearTie) : 'Result comparison not shown'
  const qualification = resultsAllowed ? noiseQualifier(delta.leader.noise_verdict) : null
  const showFigures = resultsAllowed && !view.movementsUnavailable
  const cohortChanged = rows.some((row) => row.kind === 'option' && row.change !== 'changed')
  const askAvailable = runIsCurrent && !analysing
  const ask = (): void => openAskOlumi({
    label: COMPARE_ASK_LABEL,
    context: `${resultHeadline}.${qualification ? ` ${qualification}` : ''} Previous run: ${delta.endpoints?.prior.run_id ?? 'not recorded'}. Latest run: ${delta.endpoints?.current.run_id ?? 'not recorded'}. ${view.comparability}${view.attributionLimit ? ` ${view.attributionLimit}` : ''}`,
    // The draft quotes the rows the list shows before "See all", then counts the rest.
    draft: compareAskDraft(rows.slice(0, INPUT_ROWS_SHOWN_FIRST), rows.length),
  })
  return (
    <div data-testid={WHATS_CHANGED_TESTID} data-attributable={view.attributable ? 'true' : 'false'}>
      <section data-compare-section="headline" aria-label={artefact ? 'What changed between runs' : resultsAllowed ? 'Result comparison' : 'Result comparison not shown'}
        data-testid={artefact ? RUN_CHANGE_ARTEFACT_TESTID : undefined} data-prior-run-id={artefact?.priorRunId} data-current-run-id={artefact?.currentRunId}>
        <div className="flex items-center gap-1">
          <h3 className={`${typography.panelHeader} text-text-header m-0 min-w-0 flex-1`}
            data-wire-fields={nearTie ? 'analysis_result.enrichment.robustness.near_tie analysis_result.enrichment.decision_brief.headline_banded' : LEADER_FIELDS}>
            {resultHeadline}
          </h3>
          {askAvailable ? <PanelIconButton ai label={COMPARE_ASK_LABEL} onClick={ask} testId="compare-ask" /> : null}
        </div>
        {qualification ? <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-wire-fields="run_delta.leader.noise_verdict">{qualification}</p> : null}
        <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-testid="compare-run-times" data-wire-fields="run_delta.endpoints.*.computed_at">
          <RunTime name="Previous run" endpoint={delta.endpoints?.prior} /> · <RunTime name="Latest run" endpoint={delta.endpoints?.current} />
        </p>
        {!resultsAllowed ? <p className={`${typography.panelBody} text-text-body mt-2 mb-0`}>{withheldReason ?? 'Re-run to compare results for the model as it stands.'}</p> : null}
        {resultsAllowed && view.movementsUnavailable ? <p className={`${typography.panelBody} text-text-body mt-2 mb-0`} data-wire-fields="run_delta.win_probabilities_unavailable">{noPairsText(view)}</p> : null}
        {showFigures ? <CompareSupportFigures movements={view.movements} designationsWithheld={designationsWithheld} optionLink={optionLink} /> : null}
        {showFigures && cohortChanged ? (
          <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-testid={`${WHATS_CHANGED_TESTID}-movement-scope`}>{MOVEMENT_SCOPE_TEXT}</p>
        ) : null}
      </section>
      <section className={PANEL_RULE} data-compare-section="inputs" aria-label="What you changed" data-wire-fields={INPUT_FIELDS}>
        {/* Inputs are half of what Compare is for, so a pair without an input record says so rather than going quiet. */}
        {view.inputs ? <InputChanges inputs={view.inputs} rowFocus={rowFocus} rowLight={rowLight} frame={view.frame} flush />
          : <p className={`${typography.panelMeta} text-text-light m-0`} data-wire-fields="run_delta.input_coverage">Input changes were not recorded for this pair.</p>}
        <p className={`${typography.panelMeta} text-text-light mt-2 mb-0`} data-testid="compare-comparability" data-wire-fields="run_delta.attribution_case run_delta.input_coverage">
          {view.comparability}{view.attributionLimit ? ` ${view.attributionLimit}` : ''}
        </p>
        {askAvailable ? null : (
          <p className={`${typography.panelMeta} text-text-light mt-2 mb-0`} data-testid="compare-ask-unavailable">
            {analysing ? 'You can ask Olumi about this comparison when the run finishes.' : 'You can ask Olumi about this comparison after the next run.'}
          </p>
        )}
      </section>
      {showFigures ? (
        <div className={PANEL_RULE}>
          <SectionShell variant="disclose" title="Result details" count={null} testId="compare-result-details" open={detailsOpen} onOpenChange={setDetailsOpen}>
            <ul className={`${typography.panelBody} text-text-body list-none p-0 m-0 space-y-2`}>
              {orderMovements(view.movements, designationsWithheld).map((m) => (
                <li key={m.optionId} data-option-id={m.optionId} data-wire-fields="run_delta.win_probabilities[].option_id run_delta.win_probabilities[].prior run_delta.win_probabilities[].current run_delta.win_probabilities[].noise_verdict">
                  {m.label ?? 'An option this run does not name'}: {m.mayShowMagnitude ? `${scienceQuantityText('probability', m.prior, exact, false)} → ${scienceQuantityText('probability', m.current, exact, false)} chance of leading.` : noiseQualifier(m.noiseVerdict)}
                  {m.mayShowMagnitude && noiseQualifier(m.noiseVerdict) ? <span className={`${typography.panelMeta} text-text-light block`}>{noiseQualifier(m.noiseVerdict)}</span> : null}
                </li>
              ))}
            </ul>
          </SectionShell>
        </div>
      ) : null}
    </div>
  )
}
