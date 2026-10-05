import { useState } from 'react'
import { Gauge, Lightbulb, Link2, ListFilter, Settings, Target, type LucideIcon } from 'lucide-react'
import type { RunDelta, RunDeltaEndpoint } from '@talchain/schemas/boundary'
import { typography } from '../../styles/typography'
import { action, icon, surface } from '../../components/results/analysisNew/panelSurfaces'
import { SectionShell } from '../../components/results/analysisNew/sections/SectionShell'
import { OlumiAiIcon } from '../../components/results/analysisNew/OlumiAiIcon'
import { useScienceExact, scienceQuantityText } from '../../components/science/ScienceQuantity'
import { openAskOlumi } from '../../components/results/coaching/askOlumiStore'
import type { RunDeltaInputRow, RunDeltaView } from '../../components/results/analysisNew/runDeltaView'
import { sizingWords, strengthBandWords } from '../../components/results/analysisNew/runDeltaLinkWords'
import {
  emptyInputsText, INPUTS_PARTIAL_TEXT, inputRowText, MOVEMENT_SCOPE_TEXT, noiseQualifier, noPairsText, WHATS_CHANGED_TESTID,
  type InputRowFocus, type InputRowLight,
} from '../../components/results/analysisNew/sections/WhatsChanged'
import type { RunChangeArtefact } from './runChangeArtefact'
import { RUN_CHANGE_ARTEFACT_TESTID } from './RunChangeArtefactCard'
import { CompareSupportFigures, orderMovements, type OptionCanvasLink } from './CompareSupportFigures'

const INPUT_FIELDS = 'run_delta.input_changes[].entity_id run_delta.input_changes[].option_id run_delta.input_changes[].link run_delta.input_changes[].before run_delta.input_changes[].after run_delta.input_coverage'
const LEADER_FIELDS = 'run_delta.leader.changed run_delta.leader.prior_leading_option_id run_delta.leader.current_leading_option_id run_delta.leader.noise_verdict'
/** Section labels sit below the one headline: the panel's meta scale, so the result line is the only heading at 14px. */
const SECTION_LABEL = `${typography.panelMeta} text-text-light m-0`

/** One icon per input kind, in the canvas's own node grammar (Option Lightbulb, Factor Settings, Goal Target). */
const KIND_ICON: Record<RunDeltaInputRow['kind'], LucideIcon> = {
  option_setting: Lightbulb,
  option: Lightbulb,
  factor_value: Settings,
  goal: Target,
  constraint: Gauge,
  link: Link2,
}

/** The contract's strength bands, weakest first: ordered categories, not equally spaced amounts. */
const STRENGTH_BANDS = ['slight', 'moderate', 'strong', 'very_strong'] as const

/**
 * Words selected from entitled producer claims, never from a score or a client comparison. Principle audit (5 Oct):
 * an option is named only as what came out best IN THIS MODEL (Science's phrase), never as one Olumi "puts forward".
 */
function headline(delta: RunDelta, label: (id: string) => string | null, nearTie: boolean): string {
  if (nearTie) return 'Too close to call'
  const prior = delta.leader.prior_leading_option_id
  const current = delta.leader.current_leading_option_id
  const currentName = current ? label(current) : null
  if (!current) return 'The latest run names no option'
  if (!prior) return `In this model, ${currentName ?? 'an option'} came out best on the latest run; the previous run named no option`
  if (delta.leader.changed) return 'Which option came out best in this model changed'
  return 'The option that came out best in this model is unchanged'
}

const capitalise = (s: string | null): string => (s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}` : '')

/** The row's before → after in the producer's own formatted values, or what the change was when it has no value. */
function rowValue(row: RunDeltaInputRow): string {
  if (row.kind === 'link' && row.change === 'changed') {
    // Strength reads in the shared inline band words ("slight → strong"), the same words every other surface prints.
    if (row.field === 'strength') return `${strengthBandWords(row.before)} → ${strengthBandWords(row.after)}`
    if (row.field === 'sizing') return capitalise(`${sizingWords(row.before)} → ${sizingWords(row.after)}`)
  }
  if (row.change === 'changed') return `${row.before} → ${row.after}`
  if (row.kind === 'option') return row.change === 'added' ? 'Joined the comparison' : 'Left the comparison'
  if (row.kind === 'link') return row.change === 'added' ? 'Added to the model' : 'Removed from the model'
  if (row.change === 'added') return `Now ${row.after}`
  return `${row.before}, now not set`
}

/** A strength change as ordered steps: the previous band outlined, the latest filled. Words carry the meaning. */
function BandSteps({ before, after }: { before: string | null; after: string | null }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1 mt-1" aria-hidden="true" data-testid="compare-strength-steps">
      {STRENGTH_BANDS.map((band) => (
        <span key={band} data-band={band}
          className={`inline-block w-3 rounded-sm ${band === after ? 'h-2 bg-info' : band === before ? 'h-2 bg-panel border border-text-light' : 'h-1.5 bg-panel-border'}`} />
      ))}
    </span>
  )
}

function ChangeRow({ row, focus, light }: { row: RunDeltaInputRow; focus: (() => void) | null | undefined; light: ReturnType<InputRowLight> }): JSX.Element {
  const Icon = KIND_ICON[row.kind]
  const strength = row.field === 'strength' && row.kind === 'link' && row.change === 'changed'
    ? { before: row.before, after: row.after }
    : row.strength
  const body = (
    <>
      <Icon className={`${icon('row')} text-text-light shrink-0 mt-0.5`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className={`${typography.panelBody} text-text block break-words`}>{row.subject}</span>
        <span className={`${typography.panelTabular} text-text block mt-0.5 break-words`}>{rowValue(row)}</span>
        {row.field === 'sizing' && row.strength ? (
          <span className={`${typography.panelMeta} text-text-light block mt-0.5`}>{`${strengthBandWords(row.strength.before)} → ${strengthBandWords(row.strength.after)}`}</span>
        ) : null}
        {strength ? <BandSteps before={strength.before} after={strength.after} /> : null}
      </span>
    </>
  )
  return (
    <li className="py-1.5" data-testid={`${WHATS_CHANGED_TESTID}-input-row`} data-entity-id={row.entityId} data-option-id={row.optionId}
      data-kind={row.kind} data-on-canvas={focus ? 'true' : 'false'} data-wire-fields={INPUT_FIELDS}>
      {focus ? (
        <button type="button" className={`flex w-full items-start gap-2 text-left rounded -mx-1 px-1 py-0.5 hover:bg-panel-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
          data-testid={`${WHATS_CHANGED_TESTID}-input-row-focus`} aria-label={`Show on the canvas: ${inputRowText(row)}`}
          onClick={focus} onMouseEnter={light?.on} onMouseLeave={light?.off} onFocus={light?.on} onBlur={light?.off}>
          {body}
        </button>
      ) : <div className="flex items-start gap-2">{body}</div>}
      {focus === null && row.change !== 'removed' ? (
        <p className={`${typography.panelMeta} text-text-light mt-0.5 mb-0 pl-6`} data-testid={`${WHATS_CHANGED_TESTID}-input-row-off-canvas`}>Not on the canvas now</p>
      ) : null}
    </li>
  )
}

function Endpoint({ name, endpoint, leaderId, label, nearTie, resultsAllowed }: {
  name: string; endpoint?: RunDeltaEndpoint; leaderId?: string; label: (id: string) => string | null; nearTie?: boolean; resultsAllowed: boolean
}): JSX.Element {
  return (
    <div className="min-w-0" data-run-id={endpoint?.run_id}>
      <dt className={`${typography.panelMeta} text-text-light`}>{name}</dt>
      <dd className={`${typography.panelBody} text-text m-0 mt-1 break-words`}>
        {/* Plain words first: the run's identity stays in data-run-id (above), never as the visible text. */}
        <span className="block" data-wire-fields="run_delta.endpoints.*.computed_at">
          {endpoint?.computed_at ? <time dateTime={endpoint.computed_at}>{new Date(endpoint.computed_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time> : 'Run time not recorded'}
        </span>
        <span className="block mt-1" data-wire-fields={LEADER_FIELDS}>
          {!resultsAllowed ? 'Which option came out best: not shown' : nearTie ? 'Too close to call' : leaderId ? `${label(leaderId) ?? 'Named option no longer labelled on the canvas'} · came out best on this run, in this model` : 'No option named on this run'}
        </span>
      </dd>
    </div>
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

/** Compare's presentation of the existing reader. Every semantic verdict remains producer-owned. */
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
  const [allInputs, setAllInputs] = useState(false)
  const exact = useScienceExact(detailsOpen)
  const rows = view.inputs?.rows ?? []
  const shown = allInputs ? rows : rows.slice(0, 2)
  const inputAbsence = view.inputs === null ? 'Input changes were not recorded for this pair.' : emptyInputsText(view.inputs)
  const resultHeadline = resultsAllowed ? headline(delta, label, nearTie) : 'Result comparison not shown'
  const qualification = noiseQualifier(delta.leader.noise_verdict)
  const cohortChanged = rows.some((row) => row.kind === 'option' && row.change !== 'changed')
  const ordered = orderMovements(view.movements, designationsWithheld)
  return (
    <div data-testid={WHATS_CHANGED_TESTID} data-attributable={view.attributable ? 'true' : 'false'}>
      <section className={surface('neutral')} data-compare-section="headline" aria-label={artefact ? 'What changed between runs' : resultsAllowed ? 'Result comparison' : 'Result comparison not shown'}
        data-testid={artefact ? RUN_CHANGE_ARTEFACT_TESTID : undefined} data-prior-run-id={artefact?.priorRunId} data-current-run-id={artefact?.currentRunId}>
        <h3 className={`${typography.panelHeader} text-text m-0`} data-wire-fields={nearTie ? 'analysis_result.enrichment.robustness.near_tie analysis_result.enrichment.decision_brief.headline_banded' : LEADER_FIELDS}>{resultHeadline}</h3>
        {resultsAllowed && qualification ? <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-wire-fields="run_delta.leader.noise_verdict">{qualification}</p> : null}
        {!resultsAllowed ? <p className={`${typography.panelBody} text-text-light mt-1 mb-0`}>{withheldReason ?? 'Re-run to compare results for the model as it stands.'}</p> : null}
        {resultsAllowed && !view.movementsUnavailable ? (
          <CompareSupportFigures movements={view.movements} designationsWithheld={designationsWithheld} optionLink={optionLink} />
        ) : null}
        {resultsAllowed && !view.movementsUnavailable && cohortChanged ? (
          <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-testid={`${WHATS_CHANGED_TESTID}-movement-scope`}>{MOVEMENT_SCOPE_TEXT}</p>
        ) : null}
      </section>
      <section className={surface('neutral')} data-compare-section="endpoints" aria-label="Previous and latest runs">
        <dl className="grid grid-cols-2 gap-3 m-0">
          <Endpoint name="Previous run" endpoint={delta.endpoints?.prior} leaderId={delta.leader.prior_leading_option_id} label={label} resultsAllowed={resultsAllowed} />
          <Endpoint name="Latest run" endpoint={delta.endpoints?.current} leaderId={delta.leader.current_leading_option_id} label={label} resultsAllowed={resultsAllowed} nearTie={resultsAllowed && nearTie} />
        </dl>
      </section>
      <section className={surface('neutral')} data-compare-section="inputs" aria-label="What you changed">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className={SECTION_LABEL}>What you changed</h3>
          {rows.length > 0 ? <span className={`${typography.panelMeta} text-text-light`}>{rows.length} {rows.length === 1 ? 'change' : 'changes'}</span> : null}
        </div>
        {inputAbsence ? <p className={`${typography.panelBody} text-text-light mt-1 mb-0`} data-wire-fields="run_delta.input_coverage">{inputAbsence}</p> : (
          <ul className="list-none p-0 mt-1 mb-0">{shown.map((row) => {
            const focus = rowFocus(row)
            return <ChangeRow key={row.key} row={row} focus={focus} light={focus ? rowLight(row) : null} />
          })}</ul>
        )}
        {rows.length > 2 ? <button type="button" className={`${typography.panelMeta} ${action('inline')} mt-1`} aria-expanded={allInputs} onClick={() => setAllInputs((v) => !v)}>{allInputs ? 'Show fewer' : `See all ${rows.length} changes`}</button> : null}
        {rows.length > 0 && view.inputs?.coverage === 'partial' ? <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-wire-fields="run_delta.input_coverage">{INPUTS_PARTIAL_TEXT}</p> : null}
      </section>
      <section className={surface('neutral')} data-compare-section="qualification" aria-label="How to read this comparison">
        <h3 className={SECTION_LABEL}>How to read this comparison</h3>
        <p className={`${typography.panelBody} text-text-light mt-1 mb-0`} data-wire-fields="run_delta.attribution_case run_delta.input_coverage">{view.comparability}</p>
        {view.attributionLimit ? <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-wire-fields="run_delta.attribution_case">{view.attributionLimit}</p> : null}
        {view.movementsUnavailable ? <p className={`${typography.panelBody} text-text-light mt-1 mb-0`} data-wire-fields="run_delta.win_probabilities_unavailable">{noPairsText(view)}</p> : null}
      </section>
      <section className={surface('neutral')} data-compare-section="ask" aria-label="Ask Olumi about this comparison">
        {runIsCurrent && !analysing ? (
          <button type="button" className={`${typography.panelBody} ${action('secondary')} gap-1.5`} onClick={() => openAskOlumi({
            label: 'Ask Olumi about this comparison',
            context: `${resultHeadline}.${resultsAllowed && qualification ? ` ${qualification}` : ''} Previous run: ${delta.endpoints?.prior.run_id ?? 'not recorded'}. Latest run: ${delta.endpoints?.current.run_id ?? 'not recorded'}. ${view.comparability}${view.attributionLimit ? ` ${view.attributionLimit}` : ''}`,
            draft: compareAskDraft(shown, rows.length),
          })}><OlumiAiIcon className={`${icon('row')} text-info`} />Ask Olumi about this comparison</button>
        ) : (
          <p className={`${typography.panelMeta} text-text-light m-0`} data-testid="compare-ask-unavailable">
            {analysing ? 'You can ask Olumi about this comparison when the run finishes.' : 'You can ask Olumi about this comparison after the next run.'}
          </p>
        )}
      </section>
      <SectionShell title="Result details" icon={ListFilter} count={null} testId="compare-result-details" open={detailsOpen} onOpenChange={setDetailsOpen}>
        <div className={`${typography.panelBody} text-text`}>
          {!resultsAllowed ? <p className="m-0">{withheldReason ?? 'Result comparison not shown.'}</p> : view.movementsUnavailable ? <p className="m-0">{noPairsText(view)}</p> : (
            <ul className="list-none p-0 m-0 space-y-2">{ordered.map(m => <li key={m.optionId} data-option-id={m.optionId} data-wire-fields="run_delta.win_probabilities[].option_id run_delta.win_probabilities[].prior run_delta.win_probabilities[].current run_delta.win_probabilities[].noise_verdict">
              {m.label ?? 'An option this run does not name'}: {m.mayShowMagnitude ? `${scienceQuantityText('probability', m.prior, exact, false)} → ${scienceQuantityText('probability', m.current, exact, false)} chance of leading.` : noiseQualifier(m.noiseVerdict)}
              {m.mayShowMagnitude && noiseQualifier(m.noiseVerdict) ? <span className={`${typography.panelMeta} text-text-light block`}>{noiseQualifier(m.noiseVerdict)}</span> : null}
            </li>)}</ul>
          )}
        </div>
      </SectionShell>
    </div>
  )
}
