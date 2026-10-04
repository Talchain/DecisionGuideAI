import { useState } from 'react'
import { ListFilter, MessageCircle } from 'lucide-react'
import type { RunDelta, RunDeltaEndpoint } from '@talchain/schemas/boundary'
import { typography } from '../../styles/typography'
import { action, icon, surface } from '../../components/results/analysisNew/panelSurfaces'
import { SectionShell } from '../../components/results/analysisNew/sections/SectionShell'
import { useScienceExact, scienceQuantityText } from '../../components/science/ScienceQuantity'
import { openAskOlumi } from '../../components/results/coaching/askOlumiStore'
import type { RunDeltaView } from '../../components/results/analysisNew/runDeltaView'
import {
  emptyInputsText, inputRowText, noiseQualifier, noPairsText, WHATS_CHANGED_TESTID,
  type InputRowFocus, type InputRowLight,
} from '../../components/results/analysisNew/sections/WhatsChanged'
import type { RunChangeArtefact } from './runChangeArtefact'
import { RUN_CHANGE_ARTEFACT_TESTID } from './RunChangeArtefactCard'

const INPUT_FIELDS = 'run_delta.input_changes[].entity_id run_delta.input_changes[].option_id run_delta.input_changes[].link run_delta.input_changes[].before run_delta.input_changes[].after run_delta.input_coverage'
const LEADER_FIELDS = 'run_delta.leader.changed run_delta.leader.prior_leading_option_id run_delta.leader.current_leading_option_id run_delta.leader.noise_verdict'

/** Words selected from entitled producer claims, never from a score or a client comparison. */
function headline(delta: RunDelta, label: (id: string) => string | null, nearTie: boolean): string {
  if (nearTie) return 'Too close to call'
  const prior = delta.leader.prior_leading_option_id
  const current = delta.leader.current_leading_option_id
  const currentName = current ? label(current) : null
  if (!current) return 'The latest run does not put an option forward'
  if (!prior) return `The latest run puts forward ${currentName ?? 'an option'}; the previous run did not put one forward`
  if (delta.leader.changed) return 'The option put forward changed'
  return 'The option put forward is unchanged'
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
          {!resultsAllowed ? 'Option put forward not shown' : nearTie ? 'Too close to call' : leaderId ? `${label(leaderId) ?? 'Named option no longer labelled on the canvas'} · put forward by this run` : 'No option put forward'}
        </span>
      </dd>
    </div>
  )
}

/** Compare's presentation of the existing reader. Every semantic verdict remains producer-owned. */
export function ComparePairSections({ view, delta, artefact, label, nearTie, resultsAllowed, withheldReason, rowFocus, rowLight }: {
  view: RunDeltaView; delta: RunDelta; artefact: RunChangeArtefact | null; label: (id: string) => string | null
  nearTie: boolean; resultsAllowed: boolean; withheldReason: string | null; rowFocus: InputRowFocus; rowLight: InputRowLight
}): JSX.Element {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [allInputs, setAllInputs] = useState(false)
  const exact = useScienceExact(detailsOpen)
  const rows = view.inputs?.rows ?? []
  const shown = allInputs ? rows : rows.slice(0, 2)
  const inputAbsence = view.inputs === null ? 'Input changes were not recorded for this pair.' : emptyInputsText(view.inputs)
  const resultHeadline = resultsAllowed ? headline(delta, label, nearTie) : 'Result comparison not shown'
  const qualification = noiseQualifier(delta.leader.noise_verdict)
  return (
    <div data-testid={WHATS_CHANGED_TESTID} data-attributable={view.attributable ? 'true' : 'false'}>
      <section className={surface('neutral')} data-compare-section="headline" aria-label={artefact ? 'What changed between runs' : resultsAllowed ? 'Result comparison' : 'Result comparison not shown'}
        data-testid={artefact ? RUN_CHANGE_ARTEFACT_TESTID : undefined} data-prior-run-id={artefact?.priorRunId} data-current-run-id={artefact?.currentRunId}>
        <h3 className={`${typography.panelHeader} text-text m-0`} data-wire-fields={nearTie ? 'analysis_result.enrichment.robustness.near_tie analysis_result.enrichment.decision_brief.headline_banded' : LEADER_FIELDS}>{resultHeadline}</h3>
        {resultsAllowed && qualification ? <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-wire-fields="run_delta.leader.noise_verdict">{qualification}</p> : null}
        {!resultsAllowed ? <p className={`${typography.panelBody} text-text-light mt-1 mb-0`}>{withheldReason ?? 'Re-run to compare results for the model as it stands.'}</p> : null}
      </section>
      <section className={surface('neutral')} data-compare-section="endpoints" aria-label="Previous and latest runs">
        <dl className="grid grid-cols-2 gap-3 m-0">
          <Endpoint name="Previous run" endpoint={delta.endpoints?.prior} leaderId={delta.leader.prior_leading_option_id} label={label} resultsAllowed={resultsAllowed} />
          <Endpoint name="Latest run" endpoint={delta.endpoints?.current} leaderId={delta.leader.current_leading_option_id} label={label} resultsAllowed={resultsAllowed} nearTie={resultsAllowed && nearTie} />
        </dl>
      </section>
      <section className={surface('neutral')} data-compare-section="inputs" aria-label="What you changed">
        <h3 className={`${typography.panelHeader} text-text m-0`}>What you changed</h3>
        {inputAbsence ? <p className={`${typography.panelBody} text-text-light mt-1 mb-0`} data-wire-fields="run_delta.input_coverage">{inputAbsence}</p> : (
          <ul className="list-none p-0 mt-2 mb-0 space-y-2">{shown.map(row => <li key={row.key} className={`${typography.panelBody} text-text break-words`} data-wire-fields={INPUT_FIELDS}>{inputRowText(row)}</li>)}</ul>
        )}
        {rows.length > 2 ? <button type="button" className={`${typography.panelMeta} ${action('inline')} mt-1`} aria-expanded={allInputs} onClick={() => setAllInputs(v => !v)}>{allInputs ? 'Show fewer' : `See all ${rows.length} changes`}</button> : null}
      </section>
      <section className={surface('neutral')} data-compare-section="qualification" aria-label="How to read this comparison">
        <h3 className={`${typography.panelHeader} text-text m-0`}>How to read this comparison</h3>
        <p className={`${typography.panelBody} text-text-light mt-1 mb-0`} data-wire-fields="run_delta.attribution_case run_delta.input_coverage">{view.comparability}</p>
        {view.attributionLimit ? <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-wire-fields="run_delta.attribution_case">{view.attributionLimit}</p> : null}
        {view.inputs?.coverage === 'partial' ? <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-wire-fields="run_delta.input_coverage">Some inputs could not be compared between these two runs.</p> : null}
        {view.movementsUnavailable ? <p className={`${typography.panelBody} text-text-light mt-1 mb-0`} data-wire-fields="run_delta.win_probabilities_unavailable">{noPairsText(view)}</p> : null}
      </section>
      <section className={surface('neutral')} data-compare-section="ask" aria-label="Ask Olumi about this comparison">
        <button type="button" className={`${typography.panelBody} ${action('secondary')} gap-1`} onClick={() => openAskOlumi({
          label: 'Ask Olumi about this comparison',
          context: `${resultHeadline}.${resultsAllowed && qualification ? ` ${qualification}` : ''} Previous run: ${delta.endpoints?.prior.run_id ?? 'not recorded'}. Latest run: ${delta.endpoints?.current.run_id ?? 'not recorded'}. ${view.comparability}${view.attributionLimit ? ` ${view.attributionLimit}` : ''}`,
          draft: 'Help me understand what changed between these runs and what to investigate next.',
        })}><MessageCircle className={icon('inline')} aria-hidden="true" />Ask Olumi</button>
      </section>
      <section className={surface('neutral')} data-compare-section="canvas" aria-label="Changes on the canvas">
        <h3 className={`${typography.panelHeader} text-text m-0`}>Changes on the canvas</h3>
        {rows.length === 0 ? <p className={`${typography.panelBody} text-text-light mt-1 mb-0`}>{inputAbsence}</p> : (
          <ul className="list-none p-0 mt-2 mb-0 space-y-1">{shown.map(row => {
            const focus = rowFocus(row)
            const light = focus ? rowLight(row) : null
            return <li key={row.key} className={`${typography.panelBody} text-text`} data-testid={`${WHATS_CHANGED_TESTID}-input-row`} data-entity-id={row.entityId} data-option-id={row.optionId} data-on-canvas={focus ? 'true' : 'false'}>
              {focus ? <button type="button" className={`${action('inline')} text-left`} data-testid={`${WHATS_CHANGED_TESTID}-input-row-focus`} aria-label={`Show on the canvas: ${row.subject}`}
                onClick={focus} onMouseEnter={light?.on} onMouseLeave={light?.off} onFocus={light?.on} onBlur={light?.off}>{row.subject}</button> : row.subject}
              {focus === null && row.change !== 'removed' ? <span className={`${typography.panelMeta} text-text-light`} data-testid={`${WHATS_CHANGED_TESTID}-input-row-off-canvas`}> · not on the canvas now</span> : null}
            </li>
          })}</ul>
        )}
      </section>
      <SectionShell title="Result details" icon={ListFilter} count={null} testId="compare-result-details" open={detailsOpen} onOpenChange={setDetailsOpen}>
        <div className={`${typography.panelBody} text-text`}>
          {!resultsAllowed ? <p className="m-0">{withheldReason ?? 'Result comparison not shown.'}</p> : view.movementsUnavailable ? <p className="m-0">{noPairsText(view)}</p> : (
            <ul className="list-none p-0 m-0 space-y-2">{view.movements.map(m => <li key={m.optionId} data-option-id={m.optionId} data-wire-fields="run_delta.win_probabilities[].option_id run_delta.win_probabilities[].prior run_delta.win_probabilities[].current run_delta.win_probabilities[].noise_verdict">
              {m.label ?? 'An option this run does not name'}: {m.mayShowMagnitude ? `${scienceQuantityText('probability', m.prior, exact, false)} → ${scienceQuantityText('probability', m.current, exact, false)} chance of leading.` : noiseQualifier(m.noiseVerdict)}
              {m.mayShowMagnitude && noiseQualifier(m.noiseVerdict) ? <span className={`${typography.panelMeta} text-text-light block`}>{noiseQualifier(m.noiseVerdict)}</span> : null}
            </li>)}</ul>
          )}
        </div>
      </SectionShell>
    </div>
  )
}
