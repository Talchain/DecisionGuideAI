/**
 * ⭐ RECORDED RESULTS FOR TWO SAVED VERSIONS — the UI half of the version result-diff (schemas 0.74 `result_comparison`;
 * DL #85 5947565590; CANVAS review 5947598637; producer CODEX BUILDER).
 *
 * CEE binds each version's inputs to a recorded Run and sends ONE of three verdicts. This surface says it and decides
 * nothing:
 *   - `paired_runs` carries the SAME `RunDelta` the Compare tab reads, so it goes through the same reader
 *     (`buildRunDeltaView` → `WhatsChanged`). Its noise verdicts, leader rule and attribution limits are the producer's;
 *     only the nouns change (`frame: 'versions'`): the version compared FROM may hold the LATER Run, so nothing says
 *     "earlier", "previous" or "last time".
 *   - `shared_run`: both versions have the same analysis inputs and one recorded result. It is said ONCE, never as two
 *     results compared with each other (DL acceptance row).
 *   - `unavailable`: the typed reason, and no figure.
 * `null` (a CEE without the opt-in) renders nothing: the structural differences above stand alone, as before.
 *
 * Copy follows the contract: "Recorded result for these inputs" with its date, never "the Run of this version".
 */
import { useMemo } from 'react'
import type { ModelVersionResults, ServerModelVersion } from '../../adapters/cee/modelVersions'
import { buildRunDeltaView } from '../../components/results/analysisNew/runDeltaView'
import { nodeLabelMap } from '../../components/results/analysisNew/displayedRunDeltaView'
import { WhatsChanged } from '../../components/results/analysisNew/sections/WhatsChanged'
import { typography } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { formatTimestamp, versionCaption } from './ServerVersionDiff'

export const VERSION_RESULT_DIFF_TESTID = 'version-result-diff'

type UnavailableReason = Extract<ModelVersionResults, { status: 'unavailable' }>['reason']

/** One sentence per typed reason. None names a figure, and none guesses a cause the reason does not carry. */
export const VERSION_RESULTS_UNAVAILABLE_COPY: Record<UnavailableReason, string> = {
  missing_run: 'One of these versions has no recorded result for its inputs, so there are no results to compare.',
  unconfirmed_identity: "Olumi can't confirm which recorded result belongs to each version, so results are not compared.",
  incompatible_results: 'The recorded results for these two versions cannot be compared with each other.',
}

type VersionRef = Pick<ServerModelVersion, 'versionNumber' | 'label'>

export interface VersionResultDiffProps {
  results: ModelVersionResults | null
  fromVersion: VersionRef
  toVersion: VersionRef
}

export function VersionResultDiff({ results, fromVersion, toVersion }: VersionResultDiffProps) {
  const nodes = useCanvasStore((s) => s.nodes)
  const labels = useMemo(() => nodeLabelMap(nodes), [nodes])
  const view = useMemo(() => {
    if (results?.status !== 'available' || results.kind !== 'paired_runs') return null
    const label = (id: string) => labels.get(id) ?? null
    return buildRunDeltaView(results.run_delta, label, label, 'versions')
  }, [results, labels])

  if (results === null) return null

  return (
    <section
      className="space-y-1.5 rounded-md border border-panel-border p-2"
      data-testid={VERSION_RESULT_DIFF_TESTID}
      data-status={results.status}
      data-kind={results.status === 'available' ? results.kind : undefined}
    >
      <h4 className={`${typography.panelBody} text-text-body font-medium`}>Recorded results for these inputs</h4>

      {results.status === 'unavailable' ? (
        <p className={`${typography.panelMeta} text-text-light`} data-testid={`${VERSION_RESULT_DIFF_TESTID}-unavailable`}>
          {VERSION_RESULTS_UNAVAILABLE_COPY[results.reason]}
        </p>
      ) : results.kind === 'shared_run' ? (
        <p className={`${typography.panelMeta} text-text-light`} data-testid={`${VERSION_RESULT_DIFF_TESTID}-shared`}>
          Both versions have the same analysis inputs, so they share one recorded result (
          {formatTimestamp(results.recorded_run.computed_at)}).
        </p>
      ) : (
        <>
          <p className={`${typography.panelMeta} text-text-light`} data-testid={`${VERSION_RESULT_DIFF_TESTID}-pair`}>
            {versionCaption(fromVersion)}: recorded {formatTimestamp(results.prior_run.computed_at)} →{' '}
            {versionCaption(toVersion)}: recorded {formatTimestamp(results.current_run.computed_at)}
          </p>
          {view !== null ? <WhatsChanged view={view} /> : null}
        </>
      )}
    </section>
  )
}
