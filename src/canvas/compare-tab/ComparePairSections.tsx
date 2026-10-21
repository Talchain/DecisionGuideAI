import { ArrowRight } from 'lucide-react'
import type { RunDelta, RunDeltaEndpoint } from '@talchain/schemas/boundary'
import { typography } from '../../styles/typography'
import { icon, PANEL_RULE } from '../../components/results/analysisNew/panelSurfaces'
import { PanelIconButton } from '../../components/results/analysisNew/PanelIconButton'
import { openAskOlumi } from '../../components/results/coaching/askOlumiStore'
import { type RunDeltaInputRow, type RunDeltaView } from '../../components/results/analysisNew/runDeltaView'
import {
  inputRowText, noiseQualifier, WHATS_CHANGED_TESTID,
  type InputRowFocus, type InputRowLight,
} from '../../components/results/analysisNew/sections/WhatsChanged'
import { CoverageNote, InputChangeRows } from '../../components/results/analysisNew/sections/InputChangeRows'
import type { RunChangeArtefact } from './runChangeArtefact'
import { RUN_CHANGE_ARTEFACT_TESTID } from './RunChangeArtefactCard'
import type { ReasonSegment } from './withheldReasonSegments'
import { CompareSizingChecklist, sizingLinksOf, type LinkSizingStateOf } from './CompareSizingChecklist'
import { GraphLink } from '../../components/results/GraphLink'
import type { PairChanceFigures } from '../runView/runView'
import { PairChanceSlope } from './PairChanceSlope'
import { goalChanceHeadline } from './goalChanceHeadline'

/**
 * The way out of a withheld Run (DL 58e392 GO "A" and ruling 2, 8 Oct), read by the body from the store:
 *   · `stateOf` / `listed`: each named link's sizing now, and every link the Run's warning lists (the checklist).
 * #2747 re-scope 2 (DL ruling (A)): the first sized pair's latest run shares are no longer carried (no share in C).
 */
export type SizingPath = {
  readonly stateOf: LinkSizingStateOf
  readonly listed: ReadonlyArray<{ from: string; to: string }>
}

const INPUT_FIELDS = 'run_delta.input_changes[].entity_id run_delta.input_changes[].option_id run_delta.input_changes[].link run_delta.input_changes[].before run_delta.input_changes[].after run_delta.input_coverage'
const LEADER_FIELDS = 'run_delta.leader.changed run_delta.leader.prior_leading_option_id run_delta.leader.current_leading_option_id run_delta.leader.noise_verdict'
const NEAR_TIE_FIELDS = 'analysis_result.enrichment.robustness.near_tie analysis_result.enrichment.decision_brief.headline_banded'
const GOAL_CHANCE_FIELDS = 'canonical_analysis_view.leader.goal_chance_leader run_delta.goal_chances'
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
 * heading row), the input rows (`InputChangeRows`, Reasoning's facts in the v3 row layout) and the reading note. In C
 * (#2747 re-scope 2) it drew no goal chance; since 20 Oct 2026 it draws each option's chance, earlier run → this run, only from the chance gate (`pairChanceFigures`). It still draws no run share. Every semantic verdict remains producer-owned.
 */
export function ComparePairSections({
  view, delta, artefact, label, nearTie, resultsAllowed, withheldReason, withheldSegments = null, rowFocus, rowLight,
  runIsCurrent = true, analysing = false, sizingPath = null, chances = null,
}: {
  view: RunDeltaView; delta: RunDelta; artefact: RunChangeArtefact | null; label: (id: string) => string | null
  nearTie: boolean; resultsAllowed: boolean; withheldReason: string | null; rowFocus: InputRowFocus; rowLight: InputRowLight
  /** `withheldReason` cut at each link it names (`withheldReasonSegments`); a named link opens its own inspector. */
  withheldSegments?: ReadonlyArray<ReasonSegment> | null
  /** `selectRunAffirmedCurrent`: Ask is offered only while the pair on screen is the pair Olumi's tools read. */
  runIsCurrent?: boolean
  /** A run is in flight: the pair below is the previous one and stays visible. */
  analysing?: boolean
  /** The way out of a withheld Run: the links to size, then the first sized pair's latest side (`SizingPath`). */
  sizingPath?: SizingPath | null
  /** Each option's chance on each side, ONLY from the chance gate (`pairChanceFigures`, DL ruling 20 Oct 2026). */
  chances?: PairChanceFigures | null
}): JSX.Element {
  const linkSizingState = sizingPath?.stateOf
  const rows = view.inputs?.rows ?? []
  // #2747 re-scope 2 (U0, DL ruling (A)): Compare shows NO goal chance and NO run share in C. Each option's chance is
  // said on the journey path only (the Analysis tab, the chat analysis card) in CEE's words, and CEE serves no share
  // string. The headline keeps the producer's leader claim, in words, under its own entitlement (`resultsAllowed`).
  // Restore trigger: each measure's own served string and Run licence on this surface (post-C).
  // 20 Oct 2026: where CEE's goal-chance licence makes a claim about this run, the headline is that claim (each option's
  // chance of meeting the goal is the headline, DL ruling 6 Oct); otherwise the comparative sentence stands, as before.
  // DL 21 Oct: when this run's view is not current, no result is said at all, only the way back to a comparison.
  const notCurrent = chances?.notCurrent === true
  const goalHeadline = chances ? goalChanceHeadline(chances, label) : null
  const shareHeadline = resultsAllowed && !notCurrent ? headline(delta, label, nearTie) : null
  const resultHeadline = goalHeadline ?? shareHeadline ?? 'Result comparison not shown'
  // The noise qualifier speaks about the comparative leader's share, so it never sits under a goal-chance headline.
  const qualification = resultsAllowed && !notCurrent && goalHeadline === null ? noiseQualifier(delta.leader.noise_verdict) : null
  const askAvailable = runIsCurrent && !analysing
  // The not-shown line's named links as the user's next step (DL GO "A", 8 Oct): only CEE's named links, never the canvas's.
  const sizingLinks = !resultsAllowed && linkSizingState ? sizingLinksOf(withheldSegments) : []
  const ask = (): void => openAskOlumi({
    label: COMPARE_ASK_LABEL,
    context: `${resultHeadline}.${qualification ? ` ${qualification}` : ''} Previous run: ${delta.endpoints?.prior.run_id ?? 'not recorded'}. Latest run: ${delta.endpoints?.current.run_id ?? 'not recorded'}. ${view.comparability}${view.attributionLimit ? ` ${view.attributionLimit}` : ''}`,
    // Every recorded row is visible, so the draft quotes the same complete list.
    draft: compareAskDraft(rows, rows.length),
  })
  return (
    <div data-testid={WHATS_CHANGED_TESTID} data-attributable={view.attributable ? 'true' : 'false'}>
      {analysing ? (
        // v3 state notice: a complete info border while a Run is in progress; the saved pair stays below it.
        <div role="status" className="rounded-md border border-info/30 px-3 py-2 mb-4" data-testid="compare-run-in-progress">
          <p className={`${typography.panelHeader} text-text-header m-0 flex items-center gap-2`}>
            <span className="inline-block w-2 h-2 rounded-full bg-info animate-pulse motion-reduce:animate-none" aria-hidden="true" />
            {COMPARE_RUN_IN_PROGRESS_HEADING}
          </p>
          <p className={`${typography.panelBody} text-text-light mt-1 mb-0`}>{COMPARE_RUN_IN_PROGRESS_TEXT}</p>
        </div>
      ) : null}
      <section data-compare-section="headline" aria-label={artefact ? 'What changed between runs' : resultsAllowed ? 'Result comparison' : 'Result comparison not shown'}
        data-testid={artefact ? RUN_CHANGE_ARTEFACT_TESTID : undefined} data-prior-run-id={artefact?.priorRunId} data-current-run-id={artefact?.currentRunId}>
        {/* The two saved endpoints first (v3 artefact): what is being compared, before what it shows. */}
        <p className={`${typography.panelMeta} text-text-light flex items-center justify-between gap-3 mt-0 mb-2`} data-testid="compare-run-times" data-wire-fields="run_delta.endpoints.*.computed_at">
          <RunTime name="Earlier" endpoint={delta.endpoints?.prior} />
          <ArrowRight className={`${icon('inline')} flex-shrink-0`} aria-hidden="true" />
          <RunTime name="Latest" endpoint={delta.endpoints?.current} />
        </p>
        <div className="flex items-center gap-1">
          <h3 className={`${typography.panelHeader} text-text-header m-0 min-w-0 flex-1`}
            data-wire-fields={goalHeadline !== null ? GOAL_CHANCE_FIELDS : nearTie ? NEAR_TIE_FIELDS : LEADER_FIELDS}
            data-goal-chance-claim={goalHeadline !== null ? chances?.claim?.kind : undefined}
            data-option-id={goalHeadline !== null ? chances?.claim?.optionId : undefined}>
            {resultHeadline}
          </h3>
          {askAvailable ? <PanelIconButton ai label={COMPARE_ASK_LABEL} onClick={ask} testId="compare-ask" /> : null}
        </div>
        {qualification ? <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-wire-fields="run_delta.leader.noise_verdict">{qualification}</p> : null}
        {/* The reading note sits ABOVE the figures it qualifies: its words ("anything below", "nothing below") point at them. */}
        <div className="mt-2">
          <CoverageNote text={`${view.comparability}${view.attributionLimit ? ` ${view.attributionLimit}` : ''}`} testId="compare-comparability" wireFields="run_delta.attribution_case run_delta.input_coverage" />
        </div>
        {chances ? <PairChanceSlope figures={chances} /> : null}
        {/* This run's view is not current: no figure on either side and no other result line, only the way back to a
            comparison (DL, 21 Oct 2026). */}
        {notCurrent ? (
          <p className={`${typography.panelBody} text-text-body mt-2 mb-0`} data-testid="compare-goal-chances-not-current">
            Re-run to compare results for the model as it stands.
          </p>
        ) : !resultsAllowed && sizingLinks.length > 0 && linkSizingState ? (
          // The shared sentence, word for word; its named links are the checklist's rows below, each with its own press.
          <>
            <p className={`${typography.panelBody} text-text-body mt-2 mb-0`} data-testid="compare-withheld-reason">
              {withheldSegments!.map((s) => s.text).join('')}
            </p>
            <CompareSizingChecklist links={sizingLinks} listed={sizingPath?.listed ?? []} stateOf={linkSizingState} />
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
    </div>
  )
}
