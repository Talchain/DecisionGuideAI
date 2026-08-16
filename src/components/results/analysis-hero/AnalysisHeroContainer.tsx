/**
 * AnalysisHeroContainer — the ONE authorised mount of the analysis cockpit.
 *
 * Mounted exclusively by ResultsBody (enforced by __tests__/inertness.spec.ts)
 * inside a SectionErrorBoundary. Bridges the store-aware hooks to the
 * store-free presentational panel and fails closed: an empty model renders
 * nothing but the act-on-it section, so the one place a user can confirm or
 * correct an estimate is never lost to a hero model that could not be built.
 *
 * Props are the SAME objects ResultsBody already holds — the cockpit
 * introduces no second data path.
 *
 * ⚠ NOT FLAG-GATED. `ResultsBody` used to fork on an analysis-hero flag,
 * mounting `AnalysisHeroV17` + `DecisionConfidencePanel` on an arm no
 * deployment ever rendered. That fork, those components and that flag are
 * deleted, so nothing a user loads changed.
 */
import { useCallback, useMemo, type ReactNode } from 'react'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import { focusModelTarget } from '../../../canvas/utils/focusHelpers'
import { useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import { revealOlumiSurface } from '../../../canvas/conversation/revealOlumi'
import { AnalysisHeroPanel } from './AnalysisHeroPanel'
import { useAnalysisHero } from './useAnalysisHero'
import { HERO_COPY } from './heroCopy'
import { ActOnItSection } from './actOnIt/ActOnItSection'
import { makeRowActionDispatcher } from './actOnIt/dispatchAction'
import {
  isReadyToBrief,
  rankActOnItRows,
  splitActOnItRows,
} from './actOnIt/rankActOnItRows'

export interface AnalysisHeroContainerProps {
  data: ResultsSectionDataReturn
  /**
   * OutputsDock's existing apply-threshold route (set goal threshold +
   * rerun) — powers the promoted Focus-next success-target action. Optional:
   * absent, the promoted line renders as plain text.
   */
  onApplyTarget?: (value: number) => void
  /**
   * Opens the Define-success modal (built by another lane at
   * src/components/results/modals/) — threaded through untouched to the
   * goal-lens inline CTA. Optional: absent, the CTA is hidden entirely.
   */
  onDefineSuccess?: () => void
  /**
   * Focus a factor on canvas — the act-on-it rows' `edit` action. Same
   * handler ResultsBody threads to every other results surface; falls back to
   * a chat send when absent (never a dead icon).
   */
  onFocusNode?: (nodeId: string) => void
  /** Confirm an AI estimate — the act-on-it rows' `confirm` action. */
  onConfirmFactor?: (nodeId: string) => void
  /**
   * Fragile-connection count from the report meta. Only consumer is the
   * ready-to-brief predicate, which requires it to be zero — so an absent
   * count must NOT read as "no fragile edges": the caller always passes the
   * derived value, and the default here is deliberately `undefined`-hostile
   * (see the `?? Number.NaN` guard below).
   */
  fragileEdgeCount?: number
  /**
   * The evidence-gap queue (`TriageActionCardsBody`) as a node — ResultsBody
   * owns its six write handlers, so it builds the element and this container
   * places it inside the cockpit's act-on-it section.
   */
  actOnItQueueSlot?: ReactNode
}

export function AnalysisHeroContainer({
  data,
  onApplyTarget,
  onDefineSuccess,
  onFocusNode,
  onConfirmFactor,
  fragileEdgeCount,
  actOnItQueueSlot,
}: AnalysisHeroContainerProps) {
  const { model, rerunDisabled, focusPanelSelector, nextRecommendation } =
    useAnalysisHero(data)
  // §6.5 quick links + evidence rows: focus the target on canvas through the
  // universal fail-closed resolver (Parity P1) — node id, edge id, or the
  // synthetic `${source}->${target}` edge form all resolve; a target that no
  // longer exists on the graph is a silent no-op, never a crash.
  const onFocusTarget = useCallback((targetId: string) => {
    focusModelTarget(targetId)
  }, [])

  // Chat availability. When the conversation panel is mounted it registers
  // `_sendMessage`; when nothing can receive a message the wire is null and
  // the chat-dependent row actions hide rather than render dead.
  const chatAvailable = useGuidanceStore(s => s._sendMessage !== null)

  const { visible: actOnItRows, hidden: actOnItHiddenRows } = useMemo(() => {
    // ⚠ An ABSENT fragile-edge count must never satisfy `=== 0`. NaN fails
    // every comparison, so a caller that forgets to thread the count gets the
    // conservative answer (not ready to brief) rather than the confident one.
    const fragile = fragileEdgeCount ?? Number.NaN
    return splitActOnItRows(
      rankActOnItRows(data, { readyToBrief: isReadyToBrief(data, fragile) }),
    )
  }, [data, fragileEdgeCount])

  // Read the send wire at DISPATCH time (not render time) so a
  // re-registration after the conversation panel mounts is picked up cleanly.
  const dispatchRowAction = useMemo(
    () =>
      makeRowActionDispatcher({
        sendToOlumi: (text: string) => {
          const send = useGuidanceStore.getState()._sendMessage
          if (!send) return
          send(text)
          revealOlumiSurface()
        },
        onFocusNode,
        onConfirm: onConfirmFactor,
      }),
    [onFocusNode, onConfirmFactor],
  )

  // Fail closed on the hero MODEL only — never on the act-on-it section. A
  // model that cannot be built (pre-run default, malformed retained state)
  // says nothing about whether there are factors to confirm, and the queue is
  // the only host of the confirm/set-value affordance.
  if (model.kind === 'empty') {
    if (actOnItRows.length === 0 && actOnItHiddenRows.length === 0 && actOnItQueueSlot == null) {
      return null
    }
    return (
      <section
        aria-label={HERO_COPY.actOnIt.aria}
        data-testid="analysis-act-on-it-standalone"
        className="space-y-2 rounded-lg border border-panel-border bg-panel p-3"
      >
        <ActOnItSection
          rows={actOnItRows}
          hiddenRows={actOnItHiddenRows}
          dispatchRowAction={dispatchRowAction}
          chatAvailable={chatAvailable}
          queueSlot={actOnItQueueSlot}
        />
      </section>
    )
  }

  return (
    <AnalysisHeroPanel
      model={model}
      rerunDisabled={rerunDisabled}
      focusPanelSelector={focusPanelSelector}
      nextRecommendation={nextRecommendation}
      onApplyTarget={onApplyTarget}
      onDefineSuccess={onDefineSuccess}
      onFocusTarget={onFocusTarget}
      actOnItRows={actOnItRows}
      actOnItHiddenRows={actOnItHiddenRows}
      dispatchRowAction={dispatchRowAction}
      chatAvailable={chatAvailable}
      actOnItQueueSlot={actOnItQueueSlot}
    />
  )
}

export default AnalysisHeroContainer
