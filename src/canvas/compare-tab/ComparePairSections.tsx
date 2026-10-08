import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { RunDelta, RunDeltaEndpoint } from '@talchain/schemas/boundary'
import { typography } from '../../styles/typography'
import { icon, PANEL_RULE } from '../../components/results/analysisNew/panelSurfaces'
import { PanelIconButton } from '../../components/results/analysisNew/PanelIconButton'
import { SectionShell } from '../../components/results/analysisNew/sections/SectionShell'
import { useScienceExact, scienceQuantityText } from '../../components/science/ScienceQuantity'
import { openAskOlumi } from '../../components/results/coaching/askOlumiStore'
import { INPUT_ROWS_SHOWN_FIRST, type RunDeltaInputRow, type RunDeltaView } from '../../components/results/analysisNew/runDeltaView'
import {
  inputRowText, MOVEMENT_SCOPE_TEXT, noiseQualifier, noPairsText, WHATS_CHANGED_TESTID,
  type InputRowFocus, type InputRowLight,
} from '../../components/results/analysisNew/sections/WhatsChanged'
import { CoverageNote, InputChangeRows } from '../../components/results/analysisNew/sections/InputChangeRows'
import type { RunChangeArtefact } from './runChangeArtefact'
import { RUN_CHANGE_ARTEFACT_TESTID } from './RunChangeArtefactCard'
import { CompareLatestOnlyFigures, CompareSupportFigures, OptionNameLink, orderMovements, type OptionCanvasLink } from './CompareSupportFigures'
import type { LatestShare } from './latestOnlyShares'
import type { ReasonSegment } from './withheldReasonSegments'
import { CompareSizingChecklist, sizingLinksOf, type LinkSizingStateOf } from './CompareSizingChecklist'
import { GraphLink } from '../../components/results/GraphLink'
import { COMPARE_GOAL_CHANCE_HEADING, goalChanceCompareWords, goalChanceSideWords } from '../../components/results/analysis-hero/goalChanceCopy'

const INPUT_FIELDS = 'run_delta.input_changes[].entity_id run_delta.input_changes[].option_id run_delta.input_changes[].link run_delta.input_changes[].before run_delta.input_changes[].after run_delta.input_coverage'
const LEADER_FIELDS = 'run_delta.leader.changed run_delta.leader.prior_leading_option_id run_delta.leader.current_leading_option_id run_delta.leader.noise_verdict'
const NEAR_TIE_FIELDS = 'analysis_result.enrichment.robustness.near_tie analysis_result.enrichment.decision_brief.headline_banded'
const GOAL_CHANCE_FIELDS = 'run_delta.goal_chances[].option_id run_delta.goal_chances[].prior run_delta.goal_chances[].current'
export const COMPARE_ASK_LABEL = 'Ask Olumi about this comparison'
/** While a Run is in flight the previous pair stays on screen; this says so, and promises nothing about the next pair. */
export const COMPARE_RUN_IN_PROGRESS_TEXT = 'A Run is in progress. The comparison below is between the two runs before it.'
/** The state notice's heading while a Run is in progress (v3 artefact "Rerun in progress"). */
export const COMPARE_RUN_IN_PROGRESS_HEADING = 'Rerun in progress'

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
        ? <time className={`${typography.panelTabular} text-text-header`} dateTime={endpoint.computed_at}>{new Date(endpoint.computed_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
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
 * heading row), the two-marker figures, the input rows (`InputChangeRows`, Reasoning's facts in the v3 row layout), the reading note, and the exact
 * shares behind a `disclose` row. Every semantic verdict remains producer-owned.
 */
export function ComparePairSections({
  view, delta, artefact, label, nearTie, resultsAllowed, withheldReason, withheldSegments = null, rowFocus, rowLight,
  runIsCurrent = true, analysing = false, designationsWithheld = false, optionLink = () => null, linkSizingState, unsizedLinks = [],
  latestShares = null,
}: {
  view: RunDeltaView; delta: RunDelta; artefact: RunChangeArtefact | null; label: (id: string) => string | null
  nearTie: boolean; resultsAllowed: boolean; withheldReason: string | null; rowFocus: InputRowFocus; rowLight: InputRowLight
  /** `withheldReason` cut at each link it names (`withheldReasonSegments`); a named link opens its own inspector. */
  withheldSegments?: ReadonlyArray<ReasonSegment> | null
  /** `selectRunAffirmedCurrent`: Ask is offered only while the pair on screen is the pair Olumi's tools read. */
  runIsCurrent?: boolean
  /** A run is in flight: the pair below is the previous one and stays visible. */
  analysing?: boolean
  /** The run withholds option designations: options keep the producer's order (`sortOptionsForDisplay`). */
  designationsWithheld?: boolean
  optionLink?: OptionCanvasLink
  /** Each named link's sizing on the canvas now (stored provenance, by its ids): turns the not-shown line into a checklist. */
  linkSizingState?: LinkSizingStateOf
  /** Every link the same Run's GOAL_FIGURES_PLACEHOLDER_PATH warning lists (`unsizedLinksOf`), named or only counted. */
  unsizedLinks?: ReadonlyArray<{ from: string; to: string }>
  /** The first sized pair (`prior_withheld`): the latest Run's own shares, bound to the analysis on screen (`latestOnlyShares`). */
  latestShares?: readonly LatestShare[] | null
}): JSX.Element {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const exact = useScienceExact(detailsOpen)
  const rows = view.inputs?.rows ?? []
  // Compare-chance (schemas 0.81.0, DL #87 6035414740): when the pair carries each option's chance of meeting the goal,
  // that is what Compare leads with, under each Run's OWN licence (so also when run shares are withheld); the run-share
  // sentence and figures move behind Result details. Only for the pair Olumi's tools read (`runIsCurrent`).
  // ...and only when at least one side of one option carries a figure (served witness cgc-1, 7 Oct: a pair whose Runs showed
  // no chance at all led with the heading over rows of "not shown → not shown"; that pair keeps the run-share layout).
  const goalRows = runIsCurrent && view.goalChances !== undefined
    && view.goalChances.some((g) => [g.prior, g.current].some((side) => side.kind === 'point' || side.kind === 'range'))
    ? view.goalChances : null
  const shareHeadline = resultsAllowed ? headline(delta, label, nearTie) : null
  const resultHeadline = goalRows ? COMPARE_GOAL_CHANCE_HEADING : shareHeadline ?? 'Result comparison not shown'
  const qualification = resultsAllowed ? noiseQualifier(delta.leader.noise_verdict) : null
  const showFigures = resultsAllowed && !view.movementsUnavailable
  const cohortChanged = rows.some((row) => row.kind === 'option' && row.change !== 'changed')
  const askAvailable = runIsCurrent && !analysing
  // The not-shown line's named links as the user's next step (DL GO "A", 8 Oct): only CEE's named links, never the canvas's.
  const sizingLinks = !resultsAllowed && linkSizingState ? sizingLinksOf(withheldSegments) : []
  const ask = (): void => openAskOlumi({
    label: COMPARE_ASK_LABEL,
    context: `${resultHeadline}.${qualification ? ` ${qualification}` : ''} Previous run: ${delta.endpoints?.prior.run_id ?? 'not recorded'}. Latest run: ${delta.endpoints?.current.run_id ?? 'not recorded'}. ${view.comparability}${view.attributionLimit ? ` ${view.attributionLimit}` : ''}`,
    // The draft quotes the rows the list shows before "See all", then counts the rest.
    draft: compareAskDraft(rows.slice(0, INPUT_ROWS_SHOWN_FIRST), rows.length),
  })
  // The run-share half: inline when it leads, behind Result details when goal chances lead.
  const shareResults = (
    <>
      {resultsAllowed && view.movementsUnavailable && latestShares
        ? <CompareLatestOnlyFigures shares={latestShares} designationsWithheld={designationsWithheld} optionLink={optionLink} />
        : resultsAllowed && view.movementsUnavailable ? <p className={`${typography.panelBody} text-text-body mt-2 mb-0`} data-wire-fields="run_delta.win_probabilities_unavailable">{noPairsText(view)}</p> : null}
      {showFigures ? <CompareSupportFigures movements={view.movements} designationsWithheld={designationsWithheld} optionLink={optionLink} /> : null}
      {showFigures && cohortChanged ? (
        <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-testid={`${WHATS_CHANGED_TESTID}-movement-scope`}>{MOVEMENT_SCOPE_TEXT}</p>
      ) : null}
    </>
  )
  return (
    <div data-testid={WHATS_CHANGED_TESTID} data-attributable={view.attributable ? 'true' : 'false'}>
      {analysing ? (
        // v3 state notice: the info rule while a Run is in progress; the saved pair stays below it.
        <div role="status" className="border-l-2 border-info pl-3 mb-4" data-testid="compare-run-in-progress">
          <p className={`${typography.panelHeader} text-text-header m-0 flex items-center gap-2`}>
            <span className="inline-block w-2 h-2 rounded-full bg-info animate-pulse motion-reduce:animate-none" aria-hidden="true" />
            {COMPARE_RUN_IN_PROGRESS_HEADING}
          </p>
          <p className={`${typography.panelBody} text-text-light mt-1 mb-0`}>{COMPARE_RUN_IN_PROGRESS_TEXT}</p>
        </div>
      ) : null}
      <section data-compare-section="headline" aria-label={artefact ? 'What changed between runs' : resultsAllowed || goalRows ? 'Result comparison' : 'Result comparison not shown'}
        data-testid={artefact ? RUN_CHANGE_ARTEFACT_TESTID : undefined} data-prior-run-id={artefact?.priorRunId} data-current-run-id={artefact?.currentRunId}>
        {/* The two saved endpoints first (v3 artefact): what is being compared, before what it shows. */}
        <p className={`${typography.panelMeta} text-text-light flex items-center justify-between gap-3 mt-0 mb-2`} data-testid="compare-run-times" data-wire-fields="run_delta.endpoints.*.computed_at">
          <RunTime name="Earlier" endpoint={delta.endpoints?.prior} />
          <ArrowRight className={`${icon('inline')} flex-shrink-0`} aria-hidden="true" />
          <RunTime name="Latest" endpoint={delta.endpoints?.current} />
        </p>
        <div className="flex items-center gap-1">
          <h3 className={`${typography.panelHeader} text-text-header m-0 min-w-0 flex-1`}
            data-wire-fields={goalRows ? GOAL_CHANCE_FIELDS : nearTie ? NEAR_TIE_FIELDS : LEADER_FIELDS}>
            {resultHeadline}
          </h3>
          {askAvailable ? <PanelIconButton ai label={COMPARE_ASK_LABEL} onClick={ask} testId="compare-ask" /> : null}
        </div>
        {qualification && !goalRows ? <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-wire-fields="run_delta.leader.noise_verdict">{qualification}</p> : null}
        {/* The reading note sits ABOVE the figures it qualifies: its words ("anything below", "nothing below") point at them. */}
        <div className="mt-2">
          <CoverageNote text={`${view.comparability}${view.attributionLimit ? ` ${view.attributionLimit}` : ''}`} testId="compare-comparability" wireFields="run_delta.attribution_case run_delta.input_coverage" />
        </div>
        {goalRows ? (
          // Figures only (DL ruling 2): each side as its own Run showed it, in the producer's (model) order, never a direction.
          <ul className={`${typography.panelBody} text-text-body list-none p-0 mt-2 mb-0 space-y-2`} data-testid="compare-goal-chances" data-wire-fields={GOAL_CHANCE_FIELDS}>
            {goalRows.map((g) => {
              const name = g.label ?? 'An option this run does not name'
              // A side with a figure reads in the panel's ink; the latest one a step stronger. No figure stays muted.
              const tone = (side: typeof g.prior, latest: boolean) => side.kind === 'point' || side.kind === 'range'
                ? (latest ? 'text-text-header' : 'text-text-body') : 'text-text-light'
              return (
                <li key={g.optionId} data-option-id={g.optionId}>
                  {/* The whole pair in its words, for assistive technology; the drawn line below repeats it for the eye. */}
                  <span className="sr-only" data-testid="compare-goal-chance-words">{`${name}: ${goalChanceCompareWords(g.prior, g.current)}`}</span>
                  {/* v3 artefact row: the option, then its pair on the same line at the right; a long name pushes the pair below. */}
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3" data-testid="compare-goal-chance-row">
                    <OptionNameLink name={name} link={optionLink(g.optionId)} />
                    <p className={`${typography.panelTabular} flex items-baseline gap-x-2 m-0 ml-auto`} aria-hidden="true" data-testid="compare-goal-chance-pair">
                      <span className={tone(g.prior, false)}>{goalChanceSideWords(g.prior)}</span>
                      <ArrowRight className={`${icon('inline')} self-center flex-shrink-0 text-text-light`} aria-hidden="true" />
                      <span className={tone(g.current, true)}>{goalChanceSideWords(g.current)}</span>
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}
        {!resultsAllowed && sizingLinks.length > 0 && linkSizingState ? (
          // The shared sentence, word for word; its named links are the checklist's rows below, each with its own press.
          <>
            <p className={`${typography.panelBody} text-text-body mt-2 mb-0`} data-testid="compare-withheld-reason">
              {withheldSegments!.map((s) => s.text).join('')}
            </p>
            <CompareSizingChecklist links={sizingLinks} listed={unsizedLinks} stateOf={linkSizingState} />
          </>
        ) : !resultsAllowed ? (
          <p className={`${typography.panelBody} text-text-body mt-2 mb-0`} data-testid="compare-withheld-reason">
            {withheldSegments?.some((s) => s.link)
              // "Set them" with a way to: each named link is one click to its own inspector (`GraphLink` → `openLinkInspector`;
              // a link no longer on the canvas falls back to focusing its source).
              ? withheldSegments.map((s, i) => s.link
                ? <GraphLink key={i} edgeRef={s.link} label={s.text} opensInspector flow="inline" className="underline" />
                : <span key={i}>{s.text}</span>)
              : (withheldReason ?? 'Re-run to compare results for the model as it stands.')}
          </p>
        ) : null}
        {goalRows ? null : shareResults}
      </section>
      <section className={PANEL_RULE} data-compare-section="inputs" aria-labelledby="compare-input-changes-heading" data-wire-fields={INPUT_FIELDS}>
        {/* v3 rows: kind icon, name + context, crosshair to the canvas, the recorded before → after (or band / origin). */}
        <InputChangeRows inputs={view.inputs} rowFocus={rowFocus} rowLight={rowLight} frame={view.frame} />
        {askAvailable ? null : (
          <p className={`${typography.panelMeta} text-text-light mt-2 mb-0`} data-testid="compare-ask-unavailable">
            {analysing ? 'You can ask Olumi about this comparison when the run finishes.' : 'You can ask Olumi about this comparison after the next run.'}
          </p>
        )}
      </section>
      {showFigures || (goalRows && resultsAllowed) ? (
        <div className={PANEL_RULE}>
          <SectionShell variant="disclose" title="Result details" count={null} testId="compare-result-details" open={detailsOpen} onOpenChange={setDetailsOpen}>
            {goalRows ? (
              <div className="mb-3" data-testid="compare-share-results">
                <p className={`${typography.panelBody} text-text-body mt-0 mb-0`} data-wire-fields={nearTie ? NEAR_TIE_FIELDS : LEADER_FIELDS}>{shareHeadline}</p>
                {qualification ? <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-wire-fields="run_delta.leader.noise_verdict">{qualification}</p> : null}
                {shareResults}
              </div>
            ) : null}
            {showFigures ? <ul className={`${typography.panelBody} text-text-body list-none p-0 m-0 space-y-2`}>
              {orderMovements(view.movements, designationsWithheld).map((m) => (
                <li key={m.optionId} data-option-id={m.optionId} data-wire-fields="run_delta.win_probabilities[].option_id run_delta.win_probabilities[].prior run_delta.win_probabilities[].current run_delta.win_probabilities[].noise_verdict">
                  {m.label ?? 'An option this run does not name'}: {m.mayShowMagnitude ? `supported by ${scienceQuantityText('probability', m.prior, exact, false)} → ${scienceQuantityText('probability', m.current, exact, false)} of runs.` : noiseQualifier(m.noiseVerdict)}
                  {m.mayShowMagnitude && noiseQualifier(m.noiseVerdict) ? <span className={`${typography.panelMeta} text-text-light block`}>{noiseQualifier(m.noiseVerdict)}</span> : null}
                </li>
              ))}
            </ul> : null}
          </SectionShell>
        </div>
      ) : null}
    </div>
  )
}
