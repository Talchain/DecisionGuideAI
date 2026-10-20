/**
 * "Since your last run" on the Reasoning tab (Paul, 20 Oct 2026): the comparison of this Run with the one before it,
 * shown where the user reads the result, not on a separate tab.
 *
 * It mounts the Compare body itself (`CompareRunPairBody`), so the comparison has ONE presentation and ONE reader
 * (`displayedRunDeltaView.ts`). It renders only when that reader has a comparison for the analysis on screen
 * (`vm.whatsChanged`), which is the same rule the one-line receipt it replaces used.
 */
import { typography } from '../../../../styles/typography'
import { CompareRunPairBody } from '../../../../canvas/compare-tab/CompareRunPairBody'
import { surface } from '../panelSurfaces'
import type { RunDeltaView } from '../runDeltaView'

export const SINCE_LAST_RUN_TESTID = 'analysis-new-since-last-run'

export function SinceLastRun({ view, responseHash }: {
  view: RunDeltaView | null
  responseHash: string | null | undefined
}): JSX.Element | null {
  if (view === null) return null
  return (
    <section className={surface('neutral')} data-testid={SINCE_LAST_RUN_TESTID} aria-labelledby={`${SINCE_LAST_RUN_TESTID}-title`}>
      <p id={`${SINCE_LAST_RUN_TESTID}-title`} className={`${typography.panelMeta} text-text-light mt-0 mb-2`}>
        Since your last run
      </p>
      <CompareRunPairBody responseHash={responseHash} embedded />
    </section>
  )
}
