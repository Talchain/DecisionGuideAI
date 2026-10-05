import { typography } from '../../styles/typography'
import { surface } from '../../components/results/analysisNew/panelSurfaces'
import type { RunChangeArtefact as Artefact, RunChangeArtefactLine } from './runChangeArtefact'

export const RUN_CHANGE_ARTEFACT_TESTID = 'compare-run-change-artefact'

function FactLine({ line }: { line: RunChangeArtefactLine }): JSX.Element {
  return (
    <li className={`${typography.panelBody} text-text m-0 break-words`} data-wire-fields={line.wireFields.join(' ')}>
      {line.text}
      {line.qualifier !== null ? <span className={`${typography.panelMeta} text-text-light block`}>{line.qualifier}</span> : null}
    </li>
  )
}

/** Presentation only: a missing licensed pair leaves no card or substitute claim. */
export function RunChangeArtefactCard({ artefact }: { artefact: Artefact | null }): JSX.Element | null {
  if (artefact === null) return null
  const titleId = `${RUN_CHANGE_ARTEFACT_TESTID}-title`
  return (
    <section
      className={surface('neutral')}
      aria-labelledby={titleId}
      data-testid={RUN_CHANGE_ARTEFACT_TESTID}
      data-prior-run-id={artefact.priorRunId}
      data-current-run-id={artefact.currentRunId}
      data-wire-fields="run_delta.endpoints.prior.run_id run_delta.endpoints.current.run_id"
    >
      <h3 id={titleId} className={`${typography.panelHeader} text-text m-0`}>What changed between runs</h3>
      <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`}>Earlier run → This run</p>
      <dl className="mt-3 mb-0 space-y-3">
        {artefact.edits.length > 0 ? (
          <div>
            <dt className={`${typography.panelMeta} text-text-light`}>Model edits</dt>
            <dd className="m-0 mt-1">
              <ul className="list-none p-0 m-0 space-y-1">{artefact.edits.map(line => <FactLine key={line.key} line={line} />)}</ul>
              {artefact.moreEdits ? <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`}>More model edits are listed below.</p> : null}
            </dd>
          </div>
        ) : null}
        {artefact.results.length > 0 ? (
          <div>
            <dt className={`${typography.panelMeta} text-text-light`}>Result</dt>
            <dd className="m-0 mt-1">
              <ul className="list-none p-0 m-0 space-y-1">{artefact.results.map(line => <FactLine key={line.key} line={line} />)}</ul>
              {artefact.moreResults ? <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`}>More results are listed below.</p> : null}
            </dd>
          </div>
        ) : null}
      </dl>
      <p className={`${typography.panelMeta} text-text-light mt-3 mb-0`} data-wire-fields={artefact.basis.wireFields.join(' ')}>{artefact.basis.text}</p>
      {artefact.limit !== null ? (
        <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-wire-fields={artefact.limit.wireFields.join(' ')}>{artefact.limit.text}</p>
      ) : null}
    </section>
  )
}
