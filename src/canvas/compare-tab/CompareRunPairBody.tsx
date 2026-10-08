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
import { useCallback, useMemo } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { InputRowFocus, InputRowLight } from '../../components/results/analysisNew/sections/WhatsChanged'
import { nodeLabelMap, useDisplayedRunDeltaView } from '../../components/results/analysisNew/displayedRunDeltaView'
import { useRunChangesProjection } from '../graphChanges/useRunChangesProjection'
import { canvasLinkOfTarget, useCanvasLight } from '../graphChanges/rowCanvasLink'
import { useRunChangesRouteFocus } from '../graphChanges/routeFocus'
import { FOOTER_COPY } from '../components/pre-analysis-v3/constants'
import type { RunOnRecordWithoutResult } from '../stores/declinedSavedRunStore'
import { useCanvasStore } from '../store'
import { useAnalysisStaleReasonWords } from '../hooks/useAnalysisStaleReasonWords'
import { selectRunDeltaAbsenceReason } from '../state/storedRunDelta'
import { runDeltaSentence } from '../../components/results/analysisNew/commitmentSynthesis'
import { selectRunAffirmedCurrent } from '../state/analysisStateSelector'
import { selectWinSharesWithheld, selectWinShareWithheldReason } from '../state/winShareGate'
import { buildRunChangeArtefact } from './runChangeArtefact'
import { ComparePairSections } from './ComparePairSections'
import { withheldReasonSegments } from './withheldReasonSegments'
import { linkSizingStateOf, type LinkSizingStateOf } from './CompareSizingChecklist'
import { unsizedLinksOf } from '../../components/results/analysisNew/analysisNewCopy'
import type { OptionCanvasLink } from './CompareSupportFigures'
import { deriveDecisionVerdict } from '../../lib/decisionVerdict'

export const COMPARE_RUN_PAIR_TESTID = 'compare-run-pair'
/**
 * Reasoning's own measure (`AnalysisNewTabBody`'s inner wrapper): the same gutters, rhythm and line length, so moving
 * between the two tabs never shifts the text. The surface declares `padding: 'self'` to own it.
 */
const COMPARE_MEASURE = 'px-4 pt-2 pb-4 space-y-4 max-w-[440px] mx-auto'

/** An empty Compare body: a plain left-aligned title and sentence, as Reasoning words its own empty and pre-run states. */
/**
 * The Compare body when there is no pair to draw (v3 artefact): `empty` (nothing compared yet) is the centred empty
 * state, its glyph the tab's own two-way arrow; `notice` (a Run is on record but its result is not held here) is the
 * artefact's state notice, a warning rule beside its heading. Same words as before; only the presentation is v3's.
 */
function CompareNotice({ title, body, variant = 'empty', ...data }: { title: string; body: string; variant?: 'empty' | 'notice' } & Record<`data-${string}`, string | undefined>): JSX.Element {
  if (variant === 'notice') {
    return (
      <div className={COMPARE_MEASURE} {...data} data-variant="notice">
        <div className="border-l-2 border-warning pl-3">
          <p className={`${typography.panelHeader} text-text-header m-0`}>{title}</p>
          <p className={`${typography.panelBody} text-text-light mt-1 mb-0`}>{body}</p>
        </div>
      </div>
    )
  }
  return (
    <div className={`${COMPARE_MEASURE} flex flex-col items-center text-center !pt-16`} {...data} data-variant="empty">
      <ArrowLeftRight className="w-8 h-8 text-text-light mb-4" aria-hidden="true" />
      <p className={`${typography.panelHeader} text-text-header m-0`}>{title}</p>
      <p className={`${typography.panelBody} text-text-light mt-2 mb-0 max-w-[272px]`}>{body}</p>
    </div>
  )
}

/** What the empty Compare body says when a Run is on record but its result is not held here. */
export const COMPARE_RUN_ON_RECORD_COPY = {
  stale: {
    title: 'The model has changed since the last Run',
    body: 'Re-run to compare the model as it stands with the last Run.',
  },
  // The Run control's own sentence, verbatim — the same words Reasoning shows for this state.
  unconfirmed: { title: 'Comparison not shown', body: FOOTER_COPY.savedRunUnconfirmedSub },
} as const

/**
 * RT-10 B′: the stale notice when the MODEL DID NOT CHANGE (a hash-equal stale): "The model has changed" is false there,
 * so the notice states CEE's own reason (`selectAnalysisStaleReasonWords`).
 */
export function compareOutOfDateCopy(words: string): { title: string; body: string } {
  return {
    title: 'The last Run is out of date',
    body: `${words.charAt(0).toUpperCase()}${words.slice(1)}. Re-run to compare the model as it stands with the last Run.`,
  }
}

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
  // The links that reason names, each pressable to its own inspector (DL 7 Oct): the same warning and node labels the
  // selector read, so the phrases match its sentence exactly.
  const inferenceWarnings = useCanvasStore(s => (s.results?.report as { inference_warnings?: unknown } | null | undefined)?.inference_warnings)
  const withheldSegments = useMemo(() => withheldReason === null ? null : withheldReasonSegments(withheldReason, inferenceWarnings, (id) => {
    const data = nodes.find(n => n.id === id)?.data as { label?: unknown } | undefined
    return typeof data?.label === 'string' ? data.label : null
  }), [withheldReason, inferenceWarnings, nodes])
  // Each named link's tick reads the canvas NOW, by the link's ids (a sizing edit after the Run ticks its row).
  const edges = useCanvasStore(s => s.edges)
  const linkSizingState: LinkSizingStateOf = useCallback((fromId, toId) => linkSizingStateOf(edges, fromId, toId), [edges])
  const unsizedLinks = useMemo(() => unsizedLinksOf(inferenceWarnings), [inferenceWarnings])
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
  const absenceReason = useCanvasStore(s => selectRunDeltaAbsenceReason(s, responseHash))
  const staleWords = useAnalysisStaleReasonWords()
  if (view === null && runOnRecordWithoutResult !== null) {
    const copy = runOnRecordWithoutResult === 'stale' && staleWords !== null
      ? compareOutOfDateCopy(staleWords) : COMPARE_RUN_ON_RECORD_COPY[runOnRecordWithoutResult]
    return (
      <CompareNotice variant="notice" title={copy.title} body={copy.body}
        data-testid={`${COMPARE_RUN_PAIR_TESTID}-run-on-record`} data-run-on-record={runOnRecordWithoutResult} />
    )
  }
  if (view === null) {
    // CEE's typed reason, worded by Reasoning's own rule, so the tab and the Reasoning bullet agree (audit 5942900903
    // (b)). `isStale: false`: the reason is about the run PAIR, which a later edit to the model does not change.
    const why = runDeltaSentence(null, { isStale: false, absenceReason })
    return (
      <CompareNotice title="No comparison yet" body={why ?? 'The two most recent runs of this model are compared here.'}
        data-testid={`${COMPARE_RUN_PAIR_TESTID}-empty`} data-absence-reason={why !== null ? absenceReason ?? undefined : undefined} />
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
    <div className={COMPARE_MEASURE} data-testid={COMPARE_RUN_PAIR_TESTID} aria-busy={analysing || undefined}>
      <ComparePairSections view={view} delta={delta!} artefact={artefact} label={id => labels.get(id) ?? null}
        nearTie={nearTie} resultsAllowed={runIsCurrent && !winSharesWithheld} withheldReason={withheldReason} withheldSegments={withheldSegments} rowFocus={rowFocus} rowLight={rowLight}
        runIsCurrent={runIsCurrent} analysing={analysing} designationsWithheld={designationsWithheld} optionLink={optionLink}
        linkSizingState={linkSizingState} unsizedLinks={unsizedLinks} />
    </div>
  )
}
