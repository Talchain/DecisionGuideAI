/**
 * InspectorRouter — resolves selected node/edge type and renders the correct panel
 * inside an InspectorShell.
 */

import { memo, useMemo, useCallback, type ComponentType } from 'react'
import { useCanvasStore } from '../../store'
import type { NodeType, FactorCategory } from '../../domain/nodes'
import { InspectorShell } from './InspectorShell'
import { TechnicalDisclosure } from './shared/TechnicalDisclosure'
import { useTechToggle } from './useTechToggle'
import { INSPECTOR_EDGE_REASON, INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON, INSPECTOR_EDGE_AWAITING_STATED_STRENGTH_REASON, INSPECTOR_READ_ONLY_REASON, INSPECTOR_OPTION_READ_ONLY_REASON, INSPECTOR_FACTOR_CONTROLLABLE_REASON, INSPECTOR_FACTOR_EXTERNAL_REASON } from './useInspectorMutations'
import { getTypeLabel, EDGE_TYPE_LABEL } from './inspectorStrings'

// Panel imports — lazy would be premature, these are small
import { EdgePanel } from './panels/EdgePanel'
import { EdgeLabelModeToggle } from './shared/EdgeLabelModeToggle'
import { OptionPanel } from './panels/OptionPanel'
import { GoalPanel, INSPECTOR_GOAL_REASON } from './panels/GoalPanel'
import { FactorControllablePanel } from './panels/FactorControllablePanel'
import { DecisionPanel, DecisionAddOption } from './panels/DecisionPanel'
import { FactorObservablePanel } from './panels/FactorObservablePanel'
import { FactorExternalPanel } from './panels/FactorExternalPanel'
import { OutcomePanel, INSPECTOR_OUTCOME_REASON } from './panels/OutcomePanel'
import { RiskPanel, INSPECTOR_RISK_REASON } from './panels/RiskPanel'
import { GenericNodePanel } from './panels/GenericNodePanel'
import { InspectorQuickActions } from './shared/InspectorQuickActions'
import { InspectorAgencyNote } from './shared/InspectorAgencyNote'
import { InspectorAttentionContext, attentionAskContext } from './shared/InspectorAttentionContext'
import { useNodeAttention } from '../../nodes/shared/useNodeAttention'
import { revealOlumiSurface } from '../../conversation/revealOlumi'
import { resolveElementLabel } from '../../domain/elementLabel'
import { edgeStrengthEditIsAssertable } from '../../conversation/edgeStrengthEdit'
import { isStructuralEdge } from '../../domain/edgeUtils'
import type { EdgeData } from '../../domain/edges'
import type { Edge } from '@xyflow/react'

/**
 * A14 — a structural link (organisational wiring, e.g. decision→option) is
 * not a causal claim: it has no strength for the model to check a change
 * against, so it earns neither a confidence badge nor
 * `INSPECTOR_EDGE_REASON`'s "the link strength saves" claim. Defined here
 * rather than in `useInspectorMutations.ts` because this pane is the only
 * reader — the edge accessible-name module states the matching fact on the
 * assistive channel, independently, from the shared `isStructuralEdge`
 * predicate rather than from this string.
 */
const INSPECTOR_EDGE_STRUCTURAL_REASON =
  'This is a structural link, not a causal claim. It carries no strength, and nothing here is sent to the model.'

// ⭐ v3.1 (DESIGN-GAP-v31 row 7): the shell takes NO kind colour any more —
// the kind label is muted text (the kind colours measured 1.62–2.80:1 as
// text), and the confidence-coded border is gone. The two colour maps that fed
// them are deleted with them.

/**
 * Every NODE panel type → its panel. TOTAL by construction: `Record` over the
 * union minus 'edge' (early-returned) and null (guarded), so adding a panel
 * type without an arm here fails the typecheck instead of silently rendering
 * nothing.
 */
const NODE_PANELS: Record<Exclude<NonNullable<PanelType>, 'edge'>, ComponentType<import('./types').InspectorPanelProps>> = {
  'goal':                 GoalPanel,
  'decision':             DecisionPanel,
  'option':               OptionPanel,
  'factor-controllable':  FactorControllablePanel,
  'factor-observable':    FactorObservablePanel,
  'factor-external':      FactorExternalPanel,
  'outcome':              OutcomePanel,
  'risk':                 RiskPanel,
  'generic':              GenericNodePanel,
}

interface InspectorRouterProps {
  nodeId: string | null
  edgeId: string | null
  onClose: () => void
  dragHandlers?: import('./types').DragHandlers
}

type PanelType =
  | 'edge'
  | 'goal'
  | 'decision'
  | 'option'
  | 'factor-controllable'
  | 'factor-observable'
  | 'factor-external'
  | 'outcome'
  | 'risk'
  /**
   * L-24 — the real fallback. This used to be `null` for `action`,
   * `constraint`, `ghost-option` and anything a future producer emits, and the
   * router then rendered NOTHING: the user selected an element and the
   * inspector silently refused to appear.
   */
  | 'generic'
  | null

function resolvePanelType(
  nodeId: string | null,
  edgeId: string | null,
  nodes: { id: string; type?: string; data?: Record<string, unknown> }[],
): PanelType {
  if (edgeId) return 'edge'
  if (!nodeId) return null

  const node = nodes.find(n => n.id === nodeId)
  if (!node) return null

  const type = ((node.type || node.data?.kind || 'decision') as string) as NodeType

  if (type === 'factor') {
    const category = node.data?.category as FactorCategory | undefined
    switch (category) {
      case 'controllable': return 'factor-controllable'
      case 'observable':   return 'factor-observable'
      case 'external':     return 'factor-external'
      default:             return 'factor-controllable'
    }
  }

  switch (type) {
    case 'goal':       return 'goal'
    case 'decision':   return 'decision'
    case 'option':     return 'option'
    case 'outcome':    return 'outcome'
    case 'risk':       return 'risk'
    // L-24 — every OTHER resolvable node gets a panel. `null` above is
    // reserved for "there is no node", which is the only honest silence.
    default:           return 'generic'
  }
}

export const InspectorRouter = memo(function InspectorRouter({
  nodeId,
  edgeId,
  onClose,
  dragHandlers,
}: InspectorRouterProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const { techMode, setTechMode } = useTechToggle()

  const panelType = useMemo(
    () => resolvePanelType(nodeId, edgeId, nodes as { id: string; type?: string; data?: Record<string, unknown> }[]),
    [nodeId, edgeId, nodes],
  )

  // Navigate to another node (e.g., clicking a ConnectionRow)
  // ⚠⚠ DECLARED HERE, ABOVE EVERY EARLY RETURN, AND THAT PLACEMENT IS THE POINT.
  // It sat below `if (!nodeId) return null` / `if (!node) return null` on the
  // first cut, which is a rules-of-hooks violation: the hook would be skipped on
  // the renders that bail, so React's hook ORDER would differ between renders.
  // The local `pnpm typecheck` is blind to it — the required CI check runs
  // `lint → typecheck → tests` and ESLint caught it there. A green named gate is
  // necessary and not sufficient.
  //
  // ⚠ `nodeId` is nullable at this point (the narrowing happens later), so the
  // guard inside the callback is real rather than defensive.
  //
  // ⚠ AND THE TRUTH FOR `expected_label` IS READ STORE-SIDE from `node.data.label`
  // — never from the `label` variable below, which is a DISPLAY truncation of
  // `rawLabel` (the `(0-1, …)` notation strip). Asserting a truncated label as
  // the one the server holds would refuse every rename of a normalised-range
  // node, on a gate that was working correctly.
  const handleLabelChange = useCallback(
    (value: string) => {
      if (!nodeId) return
      useCanvasStore.getState().updateNodeLabel(nodeId, value)
    },
    [nodeId],
  )

  /**
   * v3.1 point 11 — "Back to the conversation": FRONT the conversation (the one
   * oracle for where Olumi is, `revealOlumiSurface`), then close. `onClose`
   * only hides the inspector (`setShowFullInspector(false)`); the selection
   * survives, so the element stays as the conversation's context. Above every
   * early return (rules of hooks — see `handleLabelChange`).
   */
  const handleBackToConversation = useCallback(() => {
    revealOlumiSurface()
    onClose()
  }, [onClose])

  const handleNavigate = useCallback((id: string) => {
    const store = useCanvasStore.getState()
    // Check if it's a node or edge
    const isNode = store.nodes.some(n => n.id === id)
    if (isNode) {
      store.selectNodeWithoutHistory?.(id)
    }
  }, [])

  // Paul 23 Sep contract feedback point 11 — the "Worth reviewing" reasons the
  // canvas marker opened this inspector for, read from the SAME plan the card
  // reads. Above every early return for the rules of hooks (see the note on
  // `handleLabelChange`); an edge or empty selection simply has no reasons.
  const attention = useNodeAttention(nodeId ?? '')

  if (!panelType) return null

  // ─── Edge panel ────────────────────────────────────────────────
  if (panelType === 'edge' && edgeId) {
    const edge = edges.find(e => e.id === edgeId)
    if (!edge) return null

    const sourceNode = nodes.find(n => n.id === edge.source)
    const targetNode = nodes.find(n => n.id === edge.target)
    const sourceLabel = resolveElementLabel(sourceNode?.data)
    const targetLabel = resolveElementLabel(targetNode?.data)
    const edgeLabel = `${sourceLabel} \u2192 ${targetLabel}`

    // A14 — a structural link's canonical strength signature is
    // `beliefExists === 1.0`, which is exactly the shape that used to render
    // a "✓ 100%" confidence badge: the organisational-wiring signature read
    // back as if it were a stated measurement. Asked of the ONE shared
    // predicate, not re-derived from the raw field here.
    const getNodeKindForEdge = (id: string) => {
      const n = nodes.find(nn => nn.id === id)
      return ((n?.data as Record<string, unknown> | undefined)?.kind as string | undefined) ?? n?.type
    }
    const isStructural = isStructuralEdge(edge as unknown as Edge<EdgeData>, getNodeKindForEdge)

    // ⭐ v3.1: NO CONFIDENCE BADGE IN THE HEAD. It rendered "✓ 78%" beside the
    // title — the SAME provenance-gated `beliefExists` figure the body states
    // under "Does this connection exist?" (`edge-existence-readout`), so the
    // head said it twice in a second style. v3.1's edge inspector head is the
    // kind, the title and Close; the stated figure stays readable in the body.
    // (A14 still holds: a structural link shows no figure anywhere up here.)

    /**
     * ⭐ THE PANEL NOW OWNS ITS OWN AUTHORITY, so the notice must say what is
     * true of THIS edge rather than of the whole surface. Asked of the emitter
     * (`edgeStrengthEditIsAssertable` → `buildEdgeStrengthEditEvent`), which is
     * the same question `EdgePanel` asks to decide whether to fence the control
     * — one derivation with two readers, not two rules kept in step by hand.
     */
    const edgeStrengthReaches = edgeStrengthEditIsAssertable(edge)
    /**
     * ⛔ THE THIRD CASE, AND WITHOUT IT THIS PANEL WOULD CONTRADICT ITSELF.
     *
     * `INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON` tells the reader to *"Ask Olumi
     * to set its strength"*. That is sound for a link the SERVER HOLDS with no
     * stated strength. It is WRONG for a link the user has just drawn, because
     * `EdgePanel` now offers them a control that states it themselves — and a
     * notice telling you to delegate an action the surface beside it is offering
     * is the same defect UI #1540 shipped and then corrected.
     *
     * Two populations, one sentence — CLAUDE.md trap 21, and this is the branch
     * that names them apart.
     */
    const edgeAwaitingStatedStrength =
      (edge.data as { structuralAddStandDown?: string } | undefined)?.structuralAddStandDown ===
      'strength_not_stated'

    return (
      <InspectorShell
        label={edgeLabel}
        typePill={EDGE_TYPE_LABEL}
        techMode={techMode}
        onTechToggleChange={setTechMode}
        onClose={onClose}
        dragHandlers={dragHandlers}
        quickActions={
          <InspectorQuickActions
            elementId={edgeId}
            elementLabel={edgeLabel}
            panelType="edge"
            labelContext={{ sourceLabel, targetLabel }}
            onBackToConversation={handleBackToConversation}
          />
        }
        footerNote={
          <InspectorAgencyNote>
            {isStructural
              ? INSPECTOR_EDGE_STRUCTURAL_REASON
              : edgeStrengthReaches
                ? INSPECTOR_EDGE_REASON
                : edgeAwaitingStatedStrength
                  ? INSPECTOR_EDGE_AWAITING_STATED_STRENGTH_REASON
                  : INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON}
          </InspectorAgencyNote>
        }
      >
        {/* ⭐ OUTSIDE THE FENCE, DELIBERATELY, AND THE PLACEMENT IS THE FIX.
            This toggle first shipped INSIDE `EdgePanel`, whose only mount is the
            `<fieldset disabled>` below. A disabled fieldset natively inerts every
            form-associated descendant, `<button>` included, so the control
            rendered and `setMode` was uncallable — the reachability zero it was
            written to close stayed open, and the panel's own spec could not see
            it because that spec renders `EdgePanel` directly and never crosses
            this boundary.

            It belongs out here on the same grounds as `Show technical detail`,
            which the authority guard's register already lists as a presentation
            toggle: it writes NO model value, it only changes how the canvas
            draws labels it already has. The notice above says the fields inside
            "are read-only for now"; a display preference does not sit under that
            sentence.

            ⚠ Registered in `DELIBERATELY_OUTSIDE` so this is a defended
            exception rather than an escape — that guard requires the entry to
            match a real element AND to resolve outside the boundary, so it REDs
            if the control is renamed, removed, or moved back inside. */}
        <div className="mb-2">
          <EdgeLabelModeToggle />
        </div>
        {/* ⭐⭐ NO BLANKET FENCE HERE ANY MORE, AND THAT IS THE CHANGE.
            This branch used to wrap the whole panel in `<fieldset disabled>`,
            which natively inerts every form-associated descendant — so the
            strength slider rendered, and `setStrength` was uncallable for every
            user. The whole chain behind it was already built and connected:
            `buildEdgeStrengthEditEvent` → `sendSystemEvent` →
            `buildPayload.ts` `adaptEdgeStrengthEdit` → CEE's
            `dispatchEdgeStrengthEdit`. The only thing missing was a user able
            to touch it.

            ⚠ OPTING OUT IS A DUTY, NOT A RELEASE. `EdgePanel` now fences its
            OWN carrier-less writers — existence probability, uncertainty — and
            fences the strength control too on any edge whose strength cannot be
            asserted. The boundary did not disappear; it moved to the question
            that decides it. */}
          {/* ⭐ KEYED ON THE EDGE, exactly as the node panels below are keyed on
              `nodeId` (`:533`, `:541`). Without it, selecting a different edge
              REUSES this component instance, so every `useState(...)` initialiser
              keeps its first value and the panel goes on reporting the edge you
              LEFT — measured: a fresh mount of an 0.85 edge reads "Very strong",
              but switching 0.30 → 0.85 without unmount stays "Moderate 0.30".
              The asymmetry with the node branch was the whole defect: one
              branch remounts per subject and the other does not. */}
          <EdgePanel
            key={edgeId}
            edgeId={edgeId}
            techMode={techMode}
            onClose={onClose}
            onNavigate={handleNavigate}
          />
      </InspectorShell>
    )
  }

  // ─── Node panels ───────────────────────────────────────────────
  if (!nodeId) return null
  const node = nodes.find(n => n.id === nodeId)
  if (!node) return null

  const nodeType = (node.type || node.data?.kind || 'decision') as NodeType
  const category = node.data?.category as FactorCategory | undefined
  const rawLabel = String(node.data?.label ?? 'Untitled')
  // Truncate normalised range notation like "(0-1, share of £..." from display
  const label = /\(0[-–]1/.test(rawLabel) ? rawLabel.split(/\(0[-–]1/)[0].trim() : rawLabel
  const typePill = getTypeLabel(nodeType, category)

  // A8 — a "✓ N%" header badge used to render here for goal/outcome/risk
  // nodes: the MEAN of inbound edges' `exists_probability`. No producer field
  // carries that number; it was a UI computation over data that answers a
  // different question. Removed rather than fixed — see
  // `__tests__/InspectorRouter.A8.noInventedNumbers.spec.tsx`.

  const panelProps = {
    nodeId,
    techMode,
    onClose,
    onNavigate: handleNavigate,
  }

  /**
   * ⭐⭐ WHY ONE PANEL IS ALLOWED OUT OF THE BLANKET WRAP.
   *
   * `<fieldset disabled>` inerts EVERY form-associated descendant, so the wrap
   * below was disabling three controls in `OptionPanel` that write nothing at
   * all: the factor-navigation button on each intervention row, each connection
   * row, and the coaching card. A reader who opened a node to understand it
   * could not follow the model from the panel built to explain it.
   *
   * This repo already made this argument once, at the header rename above: a
   * blanket "these changes cannot be saved" over a control that does not save
   * is trap 21 — two questions under one sentence. The rename needed a durable
   * wire carrier to earn its exemption; navigation and coaching need nothing,
   * because a control that performs no write cannot perform an unsavable one.
   *
   * ⭐ SECOND PANEL, AND THE REASON IS A CARRIER, NOT A PREFERENCE.
   * `factor-controllable` opts in because the factor VALUE has a durable
   * server-authoritative carrier — `factor_value_edit`, built and merged in
   * July (#513) and still the panel's commit path today. It has been
   * unreachable ever since, not because the write was unsafe but because the
   * blanket wrap below could not tell a control that saves from one that does
   * not. Nothing about the write changed here; only the fence moved to the
   * place that can see the difference.
   *
   * ⛔ AND IT DOES NOT ADMIT THE REST OF THE PANEL. `setDescription` has no
   * carrier and stays fenced INSIDE the panel. The test of a control is
   * whether it reaches a carrier that survives the next server rehydrate —
   * never whether it sits next to one that does.
   *
   * ⭐ THIRD PANEL — `factor-external`, and again the reason is a CARRIER.
   * `setPriorRange` writes `data.prior` through `updateNode` and the round trip
   * is pinned in `useAutosave.analysisFieldPersist.spec.ts` (hash flips, the
   * autosave fires, a real save→load rehydrates the value); it ALSO emits
   * `prior_range_edit` to CEE. Built, wired, tested — and no user could operate
   * it, because the blanket wrap below inerted the whole pane.
   *
   * ⛔ THIS IS NOT COSMETIC. `analyticalNodeFields.ts` records the consequence
   * in terms: a factor's prior range is analysis-affecting, riding the V2
   * adapter's passthrough to PLoT, and was "NOT user-editable today". The
   * deployed product refuses an analysis when a factor is "recorded as a bare
   * amount with no range", and then offered no control to supply one. A refusal
   * that names a remedy the UI does not provide is a dead end wearing an
   * explanation.
   *
   * ⭐ FOURTH PANEL — `factor-observable`, and the carrier is the SAME ONE as
   * the controllable pane's. Its headline value used to commit through a bare
   * `setObservedValue` (no wire carrier) inside this wrap, so one whole factor
   * category had zero editable surface. It now commits through
   * `useModelEditAuthority.proposeFactorValue` → `factor_value_edit`, the writer
   * the factor card and the Model tab already share; CEE resolves that event by
   * node id, so nothing new was needed on the server. The pane fences its
   * description and advanced editor itself (`data-writer-fence`), pinned by
   * `FactorObservablePanel.valueReachesTheModel.spec.tsx`.
   *
   * ⭐ FIFTH PANEL — `goal`, and the carrier is the Model tab's. The pane's own
   * target control was `GoalThresholdEditor`, whose commit is a store-only
   * `setGoalThresholdAndUpdateNode`, so it stayed in this wrap. On this pane it
   * is now `SuccessTargetLine` itself — the Model tab's control — committing
   * through `useModelEditAuthority.proposeGoalTarget` → a typed
   * `add_constraint`. Description, constraints and the advanced editor are
   * fenced by the pane (`data-writer-fence`), pinned by
   * `GoalPanel.targetReachesTheModel.spec.tsx`.
   *
   * ⚠ THIS COMMENT SAID "OPT-IN, ONE PANEL, DELIBERATELY" while the set below
   * already held TWO. Corrected rather than extended: the rule was never a
   * COUNT, it is a TEST — does this panel own a control that reaches a durable
   * carrier, and will it fence the rest itself? Stating it as a number is how a
   * doctrine comment drifts from the code beside it.
   *
   * ⭐ SIXTH PANEL — `risk`, and the admission test is NOT a carrier this time.
   * `setProbability`/`setImpact` commit through a bare `updateNode`, same as
   * the goal pane's own target control, so they stay fenced — `RiskPanel`
   * wraps those two controls in `data-writer-fence="probability-impact"`
   * (`INSPECTOR_RISK_REASON` says so). What earns the pane its exit is that the
   * blanket wrap was ALSO inerting the coaching card's Ask/Dismiss/Explore
   * buttons beneath it, and the "What drives this" navigation rows — none of
   * which write anything at all.
   *
   * ⭐ SEVENTH PANEL — `outcome`, read-first ("No primary editing surface" —
   * the pane's own docblock). The Router's wrap was disabling its coaching
   * card and result-navigation rows, none of which writes.
   *
   * ⛔ NEITHER PANE IS WRITER-FREE BEYOND THOSE CONTROLS (review 2038 on
   * `1cd208f5`). This note said outcome "owns no writer whatsoever" and named
   * likelihood/impact as risk's writers. Both panes' advanced editors, behind
   * "Show model detail", hold a Description textarea committing
   * `setDescription` — no carrier, spelled in `editors/*AdvancedEditor.tsx`,
   * not in the pane. Opting out un-fenced it on both; each pane now fences its
   * editor in `data-writer-fence="advanced-editor"`, pinned by
   * `InspectorRouter.A10.coachingReachable.spec.tsx`. Audit the tree, not the
   * file.
   *
   * ⚠ `decision` STAYS WRAPPED. Its description textarea has no carrier either,
   * and unfencing it would require the same self-fence discipline as the panes
   * above — left for a follow-up so this change stays reviewable.
   *
   * Every panel NOT in the set keeps the wrap below byte-for-byte. The question
   * "does this control reach a mutation?" is answerable only inside the panel —
   * in `OptionPanel` two buttons eighteen lines apart differ on it — so a
   * Router-side allow-list would be a mirror of knowledge that lives elsewhere,
   * which is this estate's most expensive defect class.
   *
   * ⛔ AND THE PANEL DOES NOT GAIN AUTHORITY BY OPTING IN. It takes on the duty
   * of fencing its own writers, which `OptionPanel.readOnlyFence.spec.tsx`
   * asserts as a discriminating pair — every writer disabled AND every
   * non-writer enabled — so it cannot pass by fencing everything or nothing.
   */
  const AUTHORITY_OWNING_PANELS = new Set<string>(['option', 'factor-controllable', 'factor-external', 'factor-observable', 'goal', 'risk', 'outcome'])
  const panelOwnsAuthority = panelType != null && AUTHORITY_OWNING_PANELS.has(panelType)

  // Typed as a TOTAL map over every NODE panel type (edge is handled by the
  // early return above, null by the guard at the top). Before this it was an
  // untyped object literal indexed by the full union, so `panelType` could be
  // 'edge' at the lookup and TypeScript reported TS2339 on the missing key —
  // a real hole, not noise: a panel type added to the union but forgotten here
  // would have resolved to `undefined` and rendered nothing, which is exactly
  // the L-24 defect this PR is closing. Now a missing arm is a TYPE ERROR.
  const PanelComponent = panelType === 'edge' ? null : NODE_PANELS[panelType]

  if (!PanelComponent) return null

  return (
    <InspectorShell
      nodeId={nodeId}
      label={label}
      typePill={typePill}
      techMode={techMode}
      onTechToggleChange={setTechMode}
      onClose={onClose}
      dragHandlers={dragHandlers}
      /* ⭐⭐ schemas 0.50.0 — THE ONE INSPECTOR CONTROL THAT NOW SAVES.
         Until this prop existed `EditableLabel` had no `onSave`, so it returned
         a bare `<span>` (`EditableLabel.tsx:124`) and the whole
         `requestNodeRename` → `autoEdit` canvas-double-click path terminated in
         an editor that could never open. This is not a new affordance; it is
         the missing half of one that was already built and already tested.

         ⚠ AND IT IS NOT INSIDE THE AUTHORITY FIELDSET. The `<fieldset disabled>`
         below wraps the panel BODY, which is still genuinely unsavable; the
         shell HEADER is outside it. That asymmetry is deliberate and is now the
         thing `INSPECTOR_READ_ONLY_REASON` describes — the notice was narrowed
         in the same change, because a blanket "these changes cannot be saved"
         over a control that saves is the estate's trap 21: two questions under
         one sentence.

         ⚠ `store.updateNodeLabel`, NOT the panel's own `setLabel`. It is the one
         chokepoint that (a) captures the durable `structural_rename` intent
         against the PRE-rename node and (b) stamps goal-label provenance through
         `provenanceAfterHumanAuthoredLabel`. `setLabel` writes via `updateNode`
         and would do neither — the rename would apply locally and vanish on
         reload, which is the exact defect UI #1025 reverted #1024 for. */
      onLabelChange={handleLabelChange}
      quickActions={
        <>
          {/* Paul 23 Sep point 11: the reason first, then the route to the
              conversation directly beneath it. */}
          <InspectorAttentionContext reasons={attention.reasons} />
          <InspectorQuickActions
            elementId={nodeId}
            elementLabel={label}
            panelType={panelType}
            askContext={attentionAskContext(attention.reasons)}
            onBackToConversation={handleBackToConversation}
            extra={panelType === 'decision' ? <DecisionAddOption decisionId={nodeId} /> : undefined}
          />
          {/* ⭐⭐ THE DECISION'S "+ Add option", OUTSIDE THE FENCE BY THE SAME
              TEST THE RENAME PASSED. Its gesture captures a durable
              `structural_add` for the new option (CEE `'mutating'`), so it may
              sit beside the header rather than inside the `<fieldset disabled>`
              below, which inerted it for every user while its own isolated spec
              stayed green. ONLY this control moves — the decision panel stays in
              the blanket wrap, so none of its other controls is released. See
              `DecisionAddOption`, and the escape guard's `DELIBERATELY_OUTSIDE`
              entry in `inspectorAuthorityBinding.spec.tsx`. v3.1: it is drawn
              in the SAME button row as the conversation buttons (`extra`). */}
        </>
      }
      footerNote={
        <InspectorAgencyNote>
          {/* ⚠ A BOOLEAN CANNOT PICK THIS ANY MORE. With one opting-in panel the
              notice was "self-fenced or not"; with two it is "WHAT saves here",
              and the two panes answer differently — the option pane saves the
              name, the factor pane also saves the value. Keyed by panel type so
              adding a third cannot silently inherit a sentence written about
              another surface. */}
          {/* ⚠ `factor-observable` TAKES THE CONTROLLABLE PANE'S SENTENCE BECAUSE
              IT IS THE SAME FACTS: the name saves (conditionally), the value
              saves through the same `factor_value_edit` carrier, and other edits
              are not sent. The constant names no category, so nothing in it is
              false of an observed factor. It is NOT allowed to fall through to
              the option string below, which would tell the reader about factor
              targets this pane does not have. */}
          {!panelOwnsAuthority
            ? INSPECTOR_READ_ONLY_REASON
            : panelType === 'factor-controllable' || panelType === 'factor-observable'
              ? INSPECTOR_FACTOR_CONTROLLABLE_REASON
              : panelType === 'factor-external'
                ? INSPECTOR_FACTOR_EXTERNAL_REASON
                : panelType === 'goal'
                  ? INSPECTOR_GOAL_REASON
                  : panelType === 'risk'
                    ? INSPECTOR_RISK_REASON
                    : panelType === 'outcome'
                      ? INSPECTOR_OUTCOME_REASON
                      : INSPECTOR_OPTION_READ_ONLY_REASON}
        </InspectorAgencyNote>
      }
    >
      {/* Full raw label in disclosure only when truncated */}
      {rawLabel !== label && (
        <TechnicalDisclosure visible={techMode}>
          <div>System: raw_label: {rawLabel}</div>
        </TechnicalDisclosure>
      )}
      {/* ⭐⭐ KEYED BY NODE IDENTITY, AND IT IS A DEFECT FIX RATHER THAN A
          STYLE CHOICE. Without a key React reconciles the panel for node A onto
          node B and keeps the instance — so any state a panel seeds ONCE at
          mount survives the switch and is displayed against the wrong node.
          `OptionPanel` seeds its description buffer that way, and the drafting
          notes beside it are derived, so the two came apart: A's description
          under B's notes.

          ⚠ THE KEY IS `nodeId` ALONE, DELIBERATELY. It must fire when the
          IDENTITY changes and stay quiet when the same node's CONTENT changes —
          a key on the content would remount mid-edit and discard what the user
          was typing. That is the same split #1343 made one level down, where an
          intervention row is keyed `${optionId}:${factorId}` and a focus-guarded
          effect covers same-option writes the key cannot see. */}
      {panelOwnsAuthority ? (
        <PanelComponent key={nodeId} {...panelProps} readOnly />
      ) : (
        <fieldset
          disabled
          aria-describedby="inspector-authority-notice"
          data-authority="disabled"
          className="contents"
        >
          <PanelComponent key={nodeId} {...panelProps} />
        </fieldset>
      )}
    </InspectorShell>
  )
})
