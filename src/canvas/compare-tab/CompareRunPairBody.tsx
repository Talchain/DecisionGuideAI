/**
 * The Compare tab — previous Run vs this Run (SC-24 v3, ChatGPT #75 5917800777; lease DL #75 5917856638).
 *
 * ⭐ THIS BODY DECIDES NOTHING. It renders the comparison CEE produced for the analysis on screen, read by the
 * ONE reader both surfaces share (`displayedRunDeltaView.ts`), presented in the Reasoning design system.
 * The old Compare body computed its own comparison in the browser from snapshots it
 * captured (`deriveRunPairComparison`, `leaderClaim`, `deriveTransitions`, `graphChangeDiff`) — a second
 * authority that contradicted the rest of the product once already (5 Aug). It is no longer on this path.
 *
 * Empty state (Design System v5 §18): no comparison exists until a second Run of this model completes.
 *
 * ⛔ …unless a Run IS on record and its result simply isn't held here (DL #75 5922778531, PANEL's sweep 5922761384):
 * the cold open of a `complete_stale` read (an approved edit, not yet re-run) ships no result and no `run_delta`, so
 * the reader returns null, and "No comparison yet" was false beside a Run control saying "Re-run analysis". The body
 * reads the SAME fact Reasoning reads (`selectRunOnRecordWithoutResult`, from the Run control's own facts), passed
 * down by the dock; it decides nothing of its own.
 */
import { useMemo } from 'react'
import { Shuffle } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { InputRowFocus, InputRowLight } from '../../components/results/analysisNew/sections/WhatsChanged'
import { nodeLabelMap, useDisplayedRunDeltaView } from '../../components/results/analysisNew/displayedRunDeltaView'
import { icon } from '../../components/results/analysisNew/panelSurfaces'
import { useRunChangesProjection } from '../graphChanges/useRunChangesProjection'
import { canvasLinkOfTarget, useCanvasLight } from '../graphChanges/rowCanvasLink'
import { useRunChangesRouteFocus } from '../graphChanges/routeFocus'
import { FOOTER_COPY } from '../components/pre-analysis-v3/constants'
import type { RunOnRecordWithoutResult } from '../stores/declinedSavedRunStore'
import { useCanvasStore } from '../store'
import { selectRunDeltaAbsenceReason } from '../state/storedRunDelta'
import { runDeltaSentence } from '../../components/results/analysisNew/commitmentSynthesis'
import { selectRunAffirmedCurrent } from '../state/analysisStateSelector'
import { selectWinSharesWithheld, selectWinShareWithheldReason } from '../state/winShareGate'
import { buildRunChangeArtefact } from './runChangeArtefact'
import { ComparePairSections } from './ComparePairSections'
import type { OptionCanvasLink } from './CompareSupportFigures'
import { deriveDecisionVerdict } from '../../lib/decisionVerdict'

export const COMPARE_RUN_PAIR_TESTID = 'compare-run-pair'

/** What the empty Compare body says when a Run is on record but its result is not held here. */
export const COMPARE_RUN_ON_RECORD_COPY = {
  stale: {
    title: 'The model has changed since the last Run',
    body: 'Re-run to compare the model as it stands with the last Run.',
  },
  // The Run control's own sentence, verbatim — the same words Reasoning shows for this state.
  unconfirmed: { title: 'Comparison not shown', body: FOOTER_COPY.savedRunUnconfirmedSub },
} as const

export function CompareRunPairBody({
  responseHash,
  runOnRecordWithoutResult = null,
}: {
  responseHash: string | null | undefined
  /** `selectRunOnRecordWithoutResult` from the dock; absent = no Run on record, so "No comparison yet" stands. */
  runOnRecordWithoutResult?: RunOnRecordWithoutResult
}): JSX.Element {
  const view = useDisplayedRunDeltaView(responseHash)
  const delta = useCanvasStore(s => s.runDelta?.delta)
  const endpoints = delta?.endpoints
  const nodes = useCanvasStore(s => s.nodes)
  const labels = useMemo(() => nodeLabelMap(nodes), [nodes])
  // Current-run tie words come from the existing producer-verdict reader, not the delta noise tag.
  const nearTie = useCanvasStore(s => s.results?.hash === responseHash && deriveDecisionVerdict(s.results?.report).separation === 'tied')
  const withheldReason = useCanvasStore(selectWinShareWithheldReason)
  const runIsCurrent = useCanvasStore(selectRunAffirmedCurrent)
  // A run in flight keeps the previous pair on screen; Ask waits for the new pair (the one Olumi's tools will read).
  const analysing = useCanvasStore(s => s.results?.status === 'preparing' || s.results?.status === 'connecting' || s.results?.status === 'streaming')
  // The shared display order's own gate (`sortOptionsForDisplay`): a run that withholds designations keeps the producer's order.
  const designationsWithheld = useCanvasStore(s => !deriveDecisionVerdict(s.results?.report).hasLeadingOption)
  const winSharesWithheld = useCanvasStore(selectWinSharesWithheld)
  const artefact = buildRunChangeArtefact({
    view,
    priorRun: endpoints?.prior,
    currentRun: endpoints?.current,
    runIsCurrent,
    winSharesWithheld,
  })
  // CANVAS (lease DL #75 5920620752, UNDO grant 5920635710): the same view marks the canvas while this tab shows it,
  // and each row focuses the element its producer ids name — or says it is not on the canvas now.
  const changes = useRunChangesProjection(view)
  const light = useCanvasLight()
  // WHERE THIS CHANGE FLOWS: on a C1 pair only, a row click also lights its element's route to the Goal.
  const route = useRunChangesRouteFocus(view?.attributable === true)
  const absenceReason = useCanvasStore(selectRunDeltaAbsenceReason)
  if (view === null && runOnRecordWithoutResult !== null) {
    const copy = COMPARE_RUN_ON_RECORD_COPY[runOnRecordWithoutResult]
    return (
      <div
        className="flex flex-col items-center px-6 py-10 text-center"
        data-testid={`${COMPARE_RUN_PAIR_TESTID}-run-on-record`}
        data-run-on-record={runOnRecordWithoutResult}
      >
        <Shuffle className={`${icon('section')} text-text-light`} aria-hidden="true" />
        <p className={`${typography.panelHeader} text-text-body mt-3 mb-1.5`}>{copy.title}</p>
        <p className={`${typography.panelBody} text-text-light max-w-[260px] m-0`}>{copy.body}</p>
      </div>
    )
  }
  if (view === null) {
    // CEE's typed reason, worded by Reasoning's own rule, so the tab and the Reasoning bullet agree (audit 5942900903
    // (b)). `isStale: false`: the reason is about the run PAIR, which a later edit to the model does not change.
    const why = runDeltaSentence(null, { isStale: false, absenceReason })
    return (
      <div
        className="flex flex-col items-center px-6 py-10 text-center"
        data-testid={`${COMPARE_RUN_PAIR_TESTID}-empty`}
        data-absence-reason={why !== null ? absenceReason ?? undefined : undefined}
      >
        <Shuffle className={`${icon('section')} text-text-light`} aria-hidden="true" />
        <p className={`${typography.panelHeader} text-text-body mt-3 mb-1.5`}>No comparison yet</p>
        <p className={`${typography.panelBody} text-text-light max-w-[260px] m-0`}>
          {why ?? 'The two most recent runs of this model are compared here.'}
        </p>
      </div>
    )
  }
  // Each row's link to the canvas, by the row's own ids: click focuses; hover / keyboard focus lights (DL 5939855664).
  const rowFocus: InputRowFocus = (row) => {
    const target = changes.focusByRowKey.get(row.key)
    if (target === undefined) return undefined
    return canvasLinkOfTarget(target, { route })?.focus ?? null
  }
  const rowLight: InputRowLight = (row) => {
    const link = canvasLinkOfTarget(changes.focusByRowKey.get(row.key))
    return link ? { on: () => light.on(link), off: light.off } : null
  }
  // An option's movement row lights and focuses the option's own node, by id, only when the canvas has it now.
  const optionLink: OptionCanvasLink = (optionId) => {
    if (!nodes.some(n => n.id === optionId)) return null
    const link = canvasLinkOfTarget({ kind: 'node', id: optionId })
    return link ? { focus: link.focus, on: () => light.on(link), off: light.off } : null
  }
  return (
    <div data-testid={COMPARE_RUN_PAIR_TESTID}>
      <ComparePairSections view={view} delta={delta!} artefact={artefact} label={id => labels.get(id) ?? null}
        nearTie={nearTie} resultsAllowed={runIsCurrent && !winSharesWithheld} withheldReason={withheldReason} rowFocus={rowFocus} rowLight={rowLight}
        runIsCurrent={runIsCurrent} analysing={analysing} designationsWithheld={designationsWithheld} optionLink={optionLink} />
    </div>
  )
}
