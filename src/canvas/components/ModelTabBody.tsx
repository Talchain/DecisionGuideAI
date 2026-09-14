/**
 * ModelTabBody — "Model" tab for the outputs dock.
 *
 * Sections: Goal · Options (collapsed) · Factors · Relationships · Risks (collapsed) · Audit (collapsed)
 * Above sections: StatusBar (actionable counts) + EntityBar (node composition).
 *
 * Typography: panelHeader (14px/600) · panelBody (12px/400) · panelMeta (11px/400)
 * British English throughout. Sentence case.
 */

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  memo,
} from 'react'
import type { Node, Edge } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { useAnalysisTrust } from '../hooks/useAnalysisTrust'
import { AnalysisRunStateCover } from './AnalysisRunStateCover'
import { useUIStore, type ModelTabSectionId } from '../../stores/uiStore'
import { getDisplayEdgeId, buildFragileEdgeLookup } from '../utils/edgeIdentity'
// THE ONE id → label policy. This container OUTLIVES the duplicate editor, so a
// raw-id fallback here would have become permanent when the sections go — the
// same argument that fixed `buildGoalFitRows` in place rather than pinning it.
import { buildCanvasLabelMap, resolveCanvasLabel, UNNAMED_ELEMENT_LABEL } from '../domain/canvasLabels'
import { edgeValueSource, resolveEdgeValueDisplay, compareEdgeValueDisplays } from '../domain/edgeValueProvenance'
import { getCausalEdges } from '../domain/edgeUtils'
import type { MappedRobustness } from '../../lib/mappers/types'
import { trackGuidance } from '../../telemetry/guidanceEvents'
/**
 * The constraints list — live, and the reason it survived the v1 removal.
 *
 * ⭐ HISTORY, KEPT BECAUSE IT IS THE ARGUMENT THAT SAVED IT. Until the v1
 * removal (Paul's ruling, 2026-09-11) this file imported nine sibling sections
 * from `model-tab/`, all of them inside a `LEGACY_DETAILED_EDITOR_MOUNTED =
 * false` gate and therefore dead. This one was deliberately mounted OUTSIDE
 * that gate; had it been placed inside, it would have shipped dark — the
 * failure mode this estate keeps repeating. The gate and the nine dead
 * sections are gone; this section stays live.
 */
import { GoalConstraintsSection } from './model-tab/GoalConstraintsSection'
import type { EdgeData } from '../domain/edges'
import { ModelHealthSection, type AuditTrailData } from './model-tab/ModelHealthSection'
import { normalizeAutoNoiseProvenance } from '../../components/results/types'
import { readInferenceWarnings } from '../../components/results/utils/readInferenceWarnings'
import { DetailToggleContext } from './model-tab/DetailToggleContext'
import { ModelFooter } from './model-tab/ModelFooter'
import { StreamingDiagnostics } from './model-tab/StreamingDiagnostics'
import { buildSynthesisedPriorMap } from './model-tab/synthesisedPriorHelpers'
import { countFactorsToVerify, mapSourceToDisplay } from './model-tab/utils'
import { ModelAdjustments } from './model-tab/ModelAdjustments'
// The Model Editor v2 (16 Aug 2026 mount train). Mounted ON, no flag: the
// no-dark-launches rule. Its factor-value edits ride the SAME canonical
// transaction as FactorsSection's chips (`useModelEditAuthority`); everything
// without a canonical carrier renders honestly disabled. The v1 sections below
// are retained UNCHANGED — the design's §7 KEEP/CUT removals await Paul's
// verdict and are deliberately not executed in this train.
import { ModelTabV2Panel } from '../model-tab-v2/ModelTabV2Panel'
import { type ModelGroupId } from '../model-tab-v2/types'
// THE ONE hand-off for affordances that terminate in a conversation. Built here
// because this file is the Model tab's only live-app seam; the v2 directory
// stays free of fronting and store concerns.
import { createOlumiHandOff } from '../conversation/olumiHandOff'

// ── Types ────────────────────────────────────────────────────────────────────

interface ModelTabBodyProps {
  showDebug: boolean
  hasDiagnostics: boolean
  diagnostics: any
  hasTrim: boolean
  effectiveCorrelationId: string | null | undefined
  correlationMismatch: boolean
  correlationIdHeader: string | null | undefined
  nodes: Node[]
  edges: Edge[]
  robustness: MappedRobustness | null
  /**
   * ⚠ RETIRED — the shell owns this now, and the prop is gone rather than
   * kept "just in case". Its only consumer was `ReanalyseBar`, which the shell
   * hosts in its reserved footer region (`footerBar: 'reanalyse'`). Leaving an
   * unused `onReanalyse` here is an invitation to re-mount the bar inside the
   * scroller, which is the occlusion this move fixed.
   */
  /** CEE quality dimensions from store */
  ceeQuality?: import('../store').CeeQualityDimensions | null
  expertMode?: boolean
  /**
   * ⭐ Ask `OutputsDock` to flip `olumi.expertMode` — the product's ONE expert
   * preference (`OutputsDock.tsx:1150`, localStorage-persisted).
   *
   * This tab does not own the preference; it forwards the setter so the tier
   * control inside `ModelTabV2Panel` writes the same thing the `</>` toggle in
   * the tab strip writes. Before this existed the outline held a private,
   * unpersisted tier and the two disagreed — see that panel's `expertMode` prop.
   */
  onToggleExpert?: (next: boolean) => void
  onSendMessage?: (message: string, opts?: { hidden?: boolean; debugSource?: string }) => void
}

// ── Source mapping ────────────────────────────────────────────────────────────
//
// ROADMAP 2.638 S2 — this file used to carry its OWN copy of the three-literal
// `SOURCE_LABELS` map, byte-identical to `model-tab/utils.ts`'s. It feeds
// `handleCopyText`, so a source outside the three landed in the user's
// clipboard as the raw wire literal ("user_confirmed"). The duplicate is gone;
// the one classification authority now serves both (trap 12: derive, do not
// mirror).

/**
 * Assistant/pre-analysis section names → their connected v2 receiver.
 *
 * ⭐⭐ ONE ENTRY CARRIES BOTH FACTS — WHERE TO SCROLL AND WHAT TO OPEN — AND
 * THAT IS THE REPAIR, NOT A TIDY-UP (9 Sep 2026).
 *
 * This map used to hold testid strings only, and the effect below opened the
 * target with a SEPARATE lookup:
 *     `MODEL_GROUP_IDS.find(g => g === (pendingSection as string))`
 * i.e. it compared a SECTION id against a GROUP id. Four of the six matched by
 * luck of shared spelling; `risks` did not, because its group is
 * `outcomes-risks`. So the assistant's "show me the risks" scrolled to the right
 * heading and left it SHUT — a deep link that lands on a collapsed section is
 * the defect `outlineDeepLinkAndSearchToggle.spec.tsx` was written to close,
 * arriving through the one id whose two names differ.
 *
 * That second lookup was a hand-maintained mirror of a mapping this table
 * already held (trap 12). Now the group IS the entry, the testid is DERIVED from
 * it, and the two cannot drift apart again.
 *
 * ⭐ `modelcard` HAS NO GROUP, AND THAT IS THE HONEST ANSWER. It pointed at
 * `model-group-v2-evidence-review` — an outline group no producer could ever
 * fill (see `model-tab-v2/types.ts`), so the model-card deep link landed the
 * reader on the words "Nothing in this group yet". The real Model card was
 * mounted the whole time: `ModelHealthSection`, `testId="model-health-section"`,
 * inside `model-scientific-transparency` and OUTSIDE the then-present
 * `LEGACY_DETAILED_EDITOR_MOUNTED = false` gate (that gate and the dead stack
 * it held were removed on 2026-09-11). It is not an outline group, so
 * it carries an explicit `testId` and an `openSection` instead — the controlled
 * accordion key this component already owns.
 *
 * ⚠⚠ THE MEASUREMENT THAT ESTABLISHED THE DEAD TARGET — RETAINED FROM #1380,
 * whose fix for this same entry merged first as `103ac4fd` while this branch was
 * in review. It is a dated record of what the product once rendered, so it is
 * kept rather than rewritten (trap 14b). Measured at `3b2df4ce` by rendering the
 * real panel with a drafted model (goal + option + factor + risk + edge) and
 * opening every group: goal 5 · options 5 · factors 8 · outcomes-risks 4 ·
 * relationships 4 · assumptions-provenance 0 · evidence-review 0 — and that
 * group's text read, verbatim, "Evidence & review state0Nothing in this group
 * yet". The zero is STRUCTURAL, not a state a model grows out of.
 *
 * ⚠ SCOPE, from that same measurement: no in-repo caller passes `'modelcard'`
 * — the literal `requestModelTabSection` arguments in `src/` are
 * `'relationships'` and `'factors'`. The reachable route is the ASSISTANT's:
 * `applyV5State.ts:1161` narrows a server-supplied `open_section` id through
 * `isModelTabSectionId` and forwards anything in `MODEL_TAB_SECTION_IDS`,
 * `'modelcard'` included. A live sanctioned route with a broken destination —
 * not a witnessed wire capture.
 *
 * ⚠ WHY #1380's `model-card-region` WRAPPER IS NOT KEPT ALONGSIDE THIS.
 * #1380 routed this entry to a wrapper `<div>` it added, on the stated premise
 * that `ModelHealthSection` "renders no single wrapping testid of its own".
 * That premise is false at the bytes: the MOUNTED card is
 * `model-tab/ModelHealthSection.tsx:217`, which renders
 * `testId="model-health-section"` — and that testid is resolved in a real
 * `ModelTabBody` render by `ModelTabBody.modelCardOpen.spec.tsx:128`, a spec
 * that predates both changes, so the fact is executed rather than argued. The
 * wrapper was therefore a SECOND addressable name for one card (trap 21) with
 * zero consumers repo-wide (`rg -a` over the whole tree: three hits, all inside
 * this file; contrast control `model-health-section` non-zero in seven files in
 * the same sweep). It is removed rather than left as a decoy for the next
 * reader asking where a model-card deep link lands. ⭐ #1380's CAPABILITY is
 * UNCHANGED and strictly better pinned: the link still lands on the card and
 * still OPENS it, and both lanes' specs assert it — #1380's by containment
 * (`landed.contains(model-card-methodology)`), this lane's by identity.
 */
type ModelSectionTarget =
  /** An outline group: `ModelOutline` owns both the testid and the opening. */
  | { readonly group: ModelGroupId }
  /**
   * A surface that is not an outline group. `testId` must name a MOUNTED
   * element; `openSection` is the controlled-accordion key that reveals it.
   */
  | { readonly group?: undefined; readonly testId: string; readonly openSection: ModelTabSectionId }

const MODEL_SECTION_TARGET: Readonly<Record<ModelTabSectionId, ModelSectionTarget>> = {
  goal: { group: 'goal' },
  options: { group: 'options' },
  factors: { group: 'factors' },
  relationships: { group: 'relationships' },
  risks: { group: 'outcomes-risks' },
  modelcard: { testId: 'model-health-section', openSection: 'modelcard' },
}

/** The element a section request scrolls to. Derived — never a second literal. */
function sectionTargetTestId(target: ModelSectionTarget): string {
  return target.group ? `model-group-v2-${target.group}` : target.testId
}

const KIND_ORDER = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome'] as const
type KindKey = typeof KIND_ORDER[number]

// ── Main component ────────────────────────────────────────────────────────────

export const ModelTabBody = memo(function ModelTabBody({
  showDebug,
  hasDiagnostics,
  diagnostics,
  hasTrim,
  effectiveCorrelationId,
  correlationMismatch,
  correlationIdHeader,
  nodes,
  edges,
  robustness,
  ceeQuality,
  expertMode,
  onToggleExpert,
  onSendMessage,
}: ModelTabBodyProps) {
  // ⚠ THE SEARCH STATE IS GONE, NOT PARKED. It was declared here, threaded to
  // `ModelFooter`, and consumed by NOTHING — no filter read it anywhere in
  // `src/`, so the box was an enabled control that silently did nothing. Keeping
  // the state beside a disabled input would leave the next reader hunting for a
  // filter that does not exist. See `ModelFooter`'s header.

  // Single-open accordion: in default mode, only one section open at a time.
  // In expert mode (showDetail), sections manage their own state independently.
  // ⭐ THE MODEL CARD OPENS ON ARRIVAL (29 Aug 2026), and this is where the
  // non-expert (CONTROLLED) path decides it — `makeSectionProps` below hands
  // the Accordion `isExpanded: openSection === sectionId`, which makes the
  // section's own `defaultExpanded` inert.
  //
  // ⚠ WHY THIS CLOSES NOTHING, which is the only reason it is safe in a
  // single-open group: the previous value `'factors'` named a section that was
  // NOT MOUNTED. `FactorsSection` and every other `makeSectionProps` consumer
  // (options/factors/relationships/risks, and a second ModelHealthSection) lived
  // inside a `LEGACY_DETAILED_EDITOR_MOUNTED = false` block — all of it DELETED
  // on 2026-09-11. The live tree has exactly ONE member of this group — the
  // Model card — and it was the one member the initial state never named, i.e.
  // the group could only ever render fully closed.
  const [openSection, setOpenSection] = useState<string | null>('modelcard')

  // ── The v1 stack: REMOVED 2026-09-11 (Paul's ruling) ───────────────────────
  //
  // ⭐ THIS IS A RECORD, NOT A DESCRIPTION OF LIVE CODE. It is retained because
  // it carries dated measurements and a reachability derivation that would
  // otherwise be lost with the code (trap 14b: a dated measurement is evidence,
  // not a fixture to keep current).
  //
  // WHAT WAS HERE. The Model tab used to render TWO complete editors of the SAME
  // model, stacked: the v2 outline and, below it, nine v1 sections. Measured on
  // the deployed build `d4b9f981` by a fresh guest with their own drafted brief:
  // 2,967px of content in a 669px dock body — 4.47 screens — at both 1280×800
  // and 1440×900, before and after analysis. The lower block addressed NO entity
  // the outline did not already address.
  //
  // It was then gated behind `const LEGACY_DETAILED_EDITOR_MOUNTED = false` — a
  // plain module constant, never a feature flag — so from that day nothing below
  // it could render on any route, for any user, under any configuration.
  //
  // WHAT THE REMOVAL COST, stated precisely because the previous version of this
  // comment warned that deleting the block "is not free". Derived at the tip,
  // with a contrast control proving the sweep can see a live mount:
  //
  //   contested-edge adjudication   ⛔ was ALREADY UNREACHABLE before this
  //                                 removal. `ContestedEdgeCard`'s two hosts were
  //                                 `RelationshipsSection` (inside the dead gate)
  //                                 and `pre-analysis/AllImprovements`, which is
  //                                 ITSELF unmounted. Removing the gate deleted
  //                                 the first host. `ContestedEdgeCard` and
  //                                 `AllImprovements` were BOTH KEPT — the card
  //                                 still has a (dead) host, so it is not dead by
  //                                 manifest, and reviving adjudication is a
  //                                 product decision, not a tidy-up.
  //                                 ⚠ THE HONEST DISTINCTION: this removal cost
  //                                 no user any capability, because the gate was
  //                                 already `false`. What it removed is the
  //                                 ability to revive the surface by flipping one
  //                                 constant. That is a real loss of optionality
  //                                 and it is recorded here deliberately.
  //   CEE structural repairs        ✅ `RepairQueueList`, in `ModelTabV2Panel`.
  //   model card / audit trail      ✅ `ModelHealthSection`, mounted above — it
  //                                 always sat outside the gate. A SECOND
  //                                 `<ModelHealthSection>` inside the gate was
  //                                 deleted with it. Witnessed on deployed
  //                                 `14276d5b` as "Model card".
  //                                 ⚠ NO LINE NUMBER HERE, DELIBERATELY. This
  //                                 row said ":950" when first written and was
  //                                 FALSE BY THE TIME THE PATCH APPLIED. A line
  //                                 number in a comment is the hand-maintained
  //                                 mirror this paragraph exists to warn about.
  //   goal-target editing           ✅ but on ANOTHER SURFACE — the Reasoning
  //                                 tab's `SuccessTargetLine`. Not here.
  //   edge strength / direction /   ◐ STRENGTH ✅ via `proposeEdgeStrength`
  //   likelihood                    (it gained a wire carrier in #1287/#1295).
  //                                 Direction and likelihood remain disabled,
  //                                 honestly and deliberately — no carrier.
  //   factor prior-range + baseline ✅ but on ANOTHER SURFACE — the Inspector's
  //                                 `useInspectorMutations.setPriorRange`.
  //
  // ⚠ THE DURABLE POINT, KEPT VERBATIM IN SPIRIT FROM THE ORIGINAL: a comment
  // that says "nothing was removed" is exactly the comment nobody re-checks, and
  // it sat above a constant that removed everything below it.
  const isExpert = expertMode ?? false
  const makeSectionProps = useCallback((sectionId: string) => {
    if (isExpert) return {} // expert mode: uncontrolled (multi-open)
    return {
      isExpanded: openSection === sectionId,
      onExpandChange: (expanded: boolean) => setOpenSection(expanded ? sectionId : null),
    }
  }, [isExpert, openSection])

  // Telemetry: fire MODEL_CARD_VIEWED once when the tab mounts
  useEffect(() => {
    const state = useCanvasStore.getState()
    trackGuidance('MODEL_CARD_VIEWED', {
      item_id: 'model_tab',
      item_type: 'trust',
      surface: 'model_tab',
      scenario_id: state.currentScenarioId ?? undefined,
      profile_stage: state.currentStage ?? undefined,
    })
  }, [])

  // Mounted guard for the deferred scroll RAF below. Lets the callback skip
  // its DOM work if the Model tab unmounts (e.g. user switches the right
  // panel) between the frame being scheduled and it firing. Cheaper and safer
  // than reinstating cancelAnimationFrame, which previously raced the
  // store-clear re-render and killed the scroll altogether.
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  // Cross-panel handoff: when another surface (e.g. PreAnalysisPanel's "See all
  // relationships" link) requests a section, open it and scroll into view, then
  // clear the request so it doesn't fire again on subsequent renders.
  //
  // Why no cancelAnimationFrame cleanup: clearing the request synchronously
  // triggers a re-render that fires the previous run's cleanup before the RAF
  // callback gets a chance to execute, killing the scroll. The mountedRef
  // guard above handles the unmount-during-RAF case without that race.
  //
  // ⚠⚠ THE DISCLOSURE ABOVE HAD TO BE BUILT AROUND THIS EFFECT, NOT PAST IT.
  // The scroll target is found with `document.querySelector`, so it exists only
  // while the v1 sections are MOUNTED. Two consequences, both load-bearing:
  //
  //   1. The collapsed v1 stack stays MOUNTED and is hidden with the `hidden`
  //      ATTRIBUTE — never unmounted, never conditionally rendered. Unmounting
  //      it would make this `querySelector` return null and the deep link would
  //      fail SILENTLY: `el?.scrollIntoView` no-ops on null, nothing throws, and
  //      no test that does not assert the scroll would notice.
  //   2. Mounted is necessary but NOT sufficient — `scrollIntoView` on a
  //      `display:none` element does nothing either. So the request also
  //      EXPANDS the stack, in the same commit as `setOpenSection`, before the
  //      frame that scrolls. This is the pattern the existing `setOpenSection`
  //      call already relies on: a passive-effect state update is processed
  //      before the browser paints, so the RAF callback sees the expanded DOM.
  //
  // Reachable callers of this deep link, all live: the assistant's `open_section`
  // UI directive (`v5/applyV5State.ts`), PreAnalysisPanel's "See all
  // relationships", and ContestedSection. Pinned in
  // `__tests__/ModelTabBody.v1StackCollapsed.spec.tsx`.
  const pendingSection = useUIStore(s => s.pendingModelTabSection)
  /**
   * The group the deep link wants OPEN — held here rather than read from
   * `pendingSection`, which is cleared at the end of the effect below, so the
   * outline would never see it.
   *
   * Since the outline began arriving closed, all five callers of this deep link
   * landed the reader on a COLLAPSED heading: the `<section>` this scrolls to
   * renders unconditionally, its body does not. The comment above still
   * describes the intended behaviour — a passive-effect state update flushes
   * before paint, so the RAF callback sees the expanded DOM — which is exactly
   * what had stopped happening, because nothing outside `ModelOutline` could
   * open a group.
   */
  const [openGroupRequest, setOpenGroupRequest] = useState<ModelGroupId | null>(null)
  useEffect(() => {
    if (!pendingSection) return
    // Set BEFORE the RAF is scheduled, so the outline re-renders expanded and
    // only then does the callback measure and scroll.
    //
    // ⚠ ONE READ OF ONE TABLE decides both what opens and what is scrolled to.
    // Two lookups is how `risks` came to scroll to a heading it left collapsed.
    const target = MODEL_SECTION_TARGET[pendingSection]
    if (target?.group) {
      setOpenGroupRequest(target.group)
    } else {
      // ⭐ Not an outline group — reveal it through the controlled accordion.
      // The reader may have shut the card since arrival, in which case scrolling
      // to it without opening it lands them on a closed header: the same harm as
      // a collapsed group, one component along. That is precisely the defect
      // #1275 shipped for the outline groups, and the reason `setOpenGroupRequest`
      // exists at all (rationale retained from #1380, which fixed this for
      // `modelcard` as a special case; the table generalises it).
      //
      // Harmless when the card is already open (`openSection` starts at
      // `'modelcard'`), and it does not fight the reader: it fires only on an
      // explicit request, never on render.
      setOpenGroupRequest(null)
      if (target) setOpenSection(target.openSection)
    }
    requestAnimationFrame(() => {
      if (!mountedRef.current) return
      const testId = target ? sectionTargetTestId(target) : 'model-tab-v2-panel'
      const el = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    useUIStore.getState().requestModelTabSection(null)
  }, [pendingSection])

  // F9 (UI brief 2026-07-16 item 3): run-state coverage. One trust surface:
  // the composed useAnalysisTrust answer drives the in-flight treatment.
  const trust = useAnalysisTrust()

  // P4 transport — contested-edge verdicts ride the conversation dispatcher
  // (deferral buffer included) when a provider is present; optional so an
  // isolated Model tab render still resolves locally.

  const ceeAnalysisReady = useCanvasStore(s => s.ceeAnalysisReady)
  const ceePipelineTrace = useCanvasStore(s => s.ceePipelineTrace)
  const repairsApplied = useCanvasStore(s => s.repairsApplied)
  const results = useCanvasStore(s => s.results)
  const hasCompletedFirstRun = useCanvasStore(s => s.hasCompletedFirstRun)
  /**
   * ⭐ THE RENAME WRITE, read HERE because this file is the Model tab's only
   * live-app seam — `modelTabV2Boundary.sourceScan` forbids the v2 directory
   * from importing a store module at all.
   *
   * `updateNodeLabel` is not a plain setter and must not be replaced with one.
   * Its own header calls it "THE ONE CHOKEPOINT EVERY RENAME GESTURE CROSSES"
   * (`store.ts:3035`): it records the `structural_rename` intent BEFORE the
   * local write — so `expected_label` asserts the label the user was LOOKING AT
   * rather than the one just written, which is what keeps the concurrency gate
   * from being a tautology — then pushes history and supersedes a goal's
   * `from_brief` provenance. The inspector title, the canvas double-click and
   * both pre-analysis editors already land here; the Model tab is the fourth
   * gesture and inherits every one of those properties for free.
   */
  const updateNodeLabel = useCanvasStore(s => s.updateNodeLabel)
  const rawV2Response = useCanvasStore(s => s.rawV2Response)
  // The v2 outline's goal row reads the store scalar (RAW user units — the
  // single-writer carrier `setGoalThresholdAndUpdateNode` maintains it).
  const goalThreshold = useCanvasStore(s => s.goalThreshold ?? null)
  /**
   * ⚠ READ HERE, NOT IN THE PANEL, AND THAT IS THE LANE BOUNDARY DOING ITS JOB.
   * `modelTabV2Boundary.sourceScan` bans a store import and a foreign hook call
   * in every `model-tab-v2` file: the mount host owns every live-app seam. These
   * two feed the effect-edit transaction's scenario fence and its recovery of
   * the one clearable refusal, and they arrive exactly as `nodes`/`edges` do.
   */
  const currentScenarioId = useCanvasStore(s => s.currentScenarioId)
  const lastServerGraphHash = useCanvasStore(s => s.lastServerGraphHash)
  /**
   * The model's stated constraints, for the read-only list rendered beside the
   * outline. Read HERE for the same reason every selector above is: the mount
   * host owns the store seams.
   *
   * ⚠ THE SLICE IS camelCase `goalConstraints`. A snake_case `goal_constraints`
   * sweep under-reports this feature badly — `GoalPanel`, the richest existing
   * consumer, contains no literal `goal_constraints` at all.
   */
  const goalConstraints = useCanvasStore(s => s.goalConstraints)

  // ── Scientific enrichment data from PLoT response ───────────────────────────
  // Single-pass extraction of all per-factor enrichment maps from factor_sensitivity.
  // Each map is keyed by factor node_id. Fields are only set when present in the response.
  //
  // Source priority:
  //   1. results.report.factor_sensitivity — picked best source from the V1 mapper.
  //      Survives history loads (rawV2Response is null after Supabase hydration).
  //   2. rawV2Response.factor_sensitivity / downstream_calls — fresh-run fallback
  //      when the V1 mapper hasn't populated the report yet.

  // Audit trail for ModelHealthSection
  const auditTrail = useMemo(() => ({
    seedUsed: rawV2Response?.meta?.seed_used ?? null,
    responseHash: rawV2Response?.response_hash ?? null,
    nSamples: rawV2Response?.meta?.n_samples ?? null,
    repairsApplied: repairsApplied ?? null,
    inferenceWarnings: (() => {
      // ROADMAP 2.173 (Paul-ratified 2026-07-30): shared dual read — ROOT
      // slot first, then the legacy `robustness` nesting. This read was
      // robustness-only, which is empty on every live run (0/827 measured
      // 2026-07-30; root 419/827 non-empty), so the ModelHealthSection
      // banner and audit row were permanently blank. See
      // readInferenceWarnings' header for the adoption history.
      const raw = readInferenceWarnings(results?.report as never)
      return Array.isArray(raw)
        ? (raw as NonNullable<AuditTrailData['inferenceWarnings']>)
        : null
    })(),
    // ⛔ REMOVED (ROADMAP 2.1273): `recommendationStability`. The Model card no
    // longer declares the field, because PLoT withholds the wire value it came
    // from and a legacy hydrated payload still carries it — see
    // `model-tab/ModelHealthSection.tsx`'s file header.
    // Legacy fallback: older PLoT builds emitted the flag under `_meta`
    // before it was promoted to a top-level field. Cached/hydrated bundles
    // captured pre-promotion still rely on this read path; without it the
    // Model card audit row vanishes for those bundles. Same `as any` shape
    // as stabilityPenaltyFactor below (legacy fields aren't on V2RunResponse).
    autoNoiseApplied:
      rawV2Response?.auto_noise_applied
      ?? (rawV2Response as any)?._meta?.auto_noise_applied
      ?? null,
    autoNoiseProvenance: normalizeAutoNoiseProvenance(rawV2Response?.auto_noise_provenance),
    stabilityPenaltyFactor: (rawV2Response as any)?.stability_penalty_factor ?? null,
  }), [rawV2Response, repairsApplied, results, robustness])

  // ── Synthesised prior lookup from repair summary ───────────────────────────

  const synthesisedPriorMap = useMemo(
    () => buildSynthesisedPriorMap(ceePipelineTrace, nodes),
    [ceePipelineTrace, nodes],
  )

  // ── Model adjustments — CEE structural repairs with resolved node labels ──
  // Mirror of usePreAnalysisData Task 6 logic; kept here so ModelTabBody can
  // own the transparency surface without importing the full pre-analysis hook.

  const modelAdjustments = useMemo(() => {
    const raw = (ceeAnalysisReady as Record<string, unknown> | null)?.model_adjustments
    if (!Array.isArray(raw)) return []
    return raw.map((adj: Record<string, unknown>) => {
      const target = adj.target
      if (!target || typeof target !== 'string') return adj
      const node = nodes.find(n => n.id === target)
      const nodeLabel = node ? (node.data as { label?: string })?.label : null
      if (nodeLabel) return { ...adj, target: nodeLabel, targetNodeId: target }
      const cleaned = target
        .replace(/^fac_/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase())
      return { ...adj, target: cleaned, targetNodeId: target }
    })
  }, [ceeAnalysisReady, nodes])

  const modelRepairActions = useMemo<string[]>(() => {
    if (!ceePipelineTrace) return []
    const trace = ceePipelineTrace as unknown as Record<string, unknown>
    const repairSummary = trace.repair_summary ?? trace.repair
    if (!repairSummary || typeof repairSummary !== 'object') return []
    const summary = repairSummary as Record<string, unknown>
    const repairs = summary.deterministic_repairs
    if (!Array.isArray(repairs)) return []
    return repairs
      .map((r: unknown) => {
        if (r && typeof r === 'object' && 'action' in r) return String((r as { action: unknown }).action)
        return null
      })
      .filter((s): s is string => s !== null)
  }, [ceePipelineTrace])

  // ── Node groups ───────────────────────────────────────────────────────────

  const grouped = useMemo<Record<KindKey, Node[]>>(() => {
    const g: Record<KindKey, Node[]> = {
      goal: [], decision: [], option: [], factor: [], risk: [], outcome: [],
    }
    for (const n of nodes) {
      const kind = (n.type ?? (n.data as any)?.kind ?? (n.data as any)?.type) as KindKey | undefined
      if (kind && kind in g) g[kind].push(n)
    }
    return g
  }, [nodes])

  // ── Causal edges (exclude organisational edges from/to decision/option) ───
  // Centralised in edgeUtils.getCausalEdges so ModelTabBody and PreAnalysisPanel
  // (cross-panel "See all relationships" link) share one definition.

  const causalEdges = useMemo(
    () => getCausalEdges(nodes, edges as Edge<EdgeData>[]),
    [nodes, edges]
  )

  // ── Robustness data ───────────────────────────────────────────────────────

  // hasAnalysisData is true if either:
  //   - robustness has been mapped from the latest report, OR
  //   - the user has completed at least one analysis run in this session
  // (the second branch matters after Supabase hydration where robustness may
  //  be stale or omitted while hasCompletedFirstRun is restored).
  const hasRobustnessData = robustness !== null || hasCompletedFirstRun

  // Build a lookup keyed by RF edge.id, matching by source+target when PLoT canonical IDs differ
  const fragileLookup = useMemo(() => {
    if (!robustness?.fragileEdges?.length) return new Map<string, import('../../lib/mappers/types').MappedFragileEdge>()
    return buildFragileEdgeLookup(edges, robustness.fragileEdges)
  }, [edges, robustness?.fragileEdges])

  const fragileEdgeIds = useMemo(() => new Set(fragileLookup.keys()), [fragileLookup])

  const fragileEdgeSwitchProbMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const [rfId, fe] of fragileLookup) {
      if (fe.switchProbability !== undefined) map.set(rfId, fe.switchProbability)
    }
    return map
  }, [fragileLookup])

  const factorsToVerify = useMemo(() => countFactorsToVerify(grouped.factor), [grouped.factor])

  // ── Factor sort: needs-attention first, then alpha ─────────────────────────

  const sortedFactors = useMemo(() => {
    return [...grouped.factor].sort((a, b) => {
      const srcA = (a.data as any)?.observedState?.source ?? (a.data as any)?.observed_state?.source
      const srcB = (b.data as any)?.observedState?.source ?? (b.data as any)?.observed_state?.source
      const extA = (a.data as any)?.category === 'external'
      const extB = (b.data as any)?.category === 'external'
      // Check explicit prior and synthesised prior fallback
      const priorMinA = (a.data as any)?.prior?.range_min ?? synthesisedPriorMap.get(a.id)?.rangeMin
      const priorMaxA = (a.data as any)?.prior?.range_max ?? synthesisedPriorMap.get(a.id)?.rangeMax
      const fullRangeA = extA && (priorMinA === undefined || priorMinA === 0) && (priorMaxA === undefined || priorMaxA === 1)
      const priorMinB = (b.data as any)?.prior?.range_min ?? synthesisedPriorMap.get(b.id)?.rangeMin
      const priorMaxB = (b.data as any)?.prior?.range_max ?? synthesisedPriorMap.get(b.id)?.rangeMax
      const fullRangeB = extB && (priorMinB === undefined || priorMinB === 0) && (priorMaxB === undefined || priorMaxB === 1)

      const needsA = (!srcA || srcA === 'cee_inference' || fullRangeA) ? 0 : 1
      const needsB = (!srcB || srcB === 'cee_inference' || fullRangeB) ? 0 : 1
      if (needsA !== needsB) return needsA - needsB
      // ⚠ ORDERING KEYS, NOT DISPLAY — an id used to break a tie never reaches
      // the screen. Kept raw (a resolved label would collapse every unnamed node
      // to one key and make the order arbitrary) and PINNED in the scan rather
      // than excused by a narrower pattern: a scan that decides which matches
      // "don't count" is a scan that can be argued with.
      const labelA = String((a.data as any)?.label ?? a.id)
      const labelB = String((b.data as any)?.label ?? b.id)
      return labelA.localeCompare(labelB)
    })
  }, [grouped.factor, synthesisedPriorMap])

  // ── Edge sort: fragile by switchProbability desc, then low likelihood, then high |effect| ─

  const sortedEdges = useMemo(() => {
    return [...causalEdges].sort((a, b) => {
      const aId = getDisplayEdgeId(a)
      const bId = getDisplayEdgeId(b)
      const aSwitchProb = fragileEdgeSwitchProbMap.get(aId) ?? -1
      const bSwitchProb = fragileEdgeSwitchProbMap.get(bId) ?? -1
      if (aSwitchProb !== bSwitchProb) return bSwitchProb - aSwitchProb

      const aData = a.data as Record<string, unknown> | undefined
      const bData = b.data as Record<string, unknown> | undefined

      // ⛔ Provenance gate on the ORDER. The sentinels here were wrong twice:
      // `!= null` is a tautology (`DEFAULT_EDGE_DATA`/`USER_EDGE_DEFAULTS`
      // always define both fields, so neither arm could fire and every
      // defaulted edge ranked as a measured one), and the two sentinels had
      // OPPOSITE SIGNS — `+Infinity` for the ascending key, `-Infinity` for the
      // descending one — a hand-compensation that silently inverts the moment
      // either sort direction changes. `compareEdgeValueDisplays` puts unset
      // last in BOTH directions without a sentinel, so the order cannot drift
      // from the intent. The export payload below this list was already gated;
      // this brings the on-screen order into line with the copied JSON.
      const aConf = resolveEdgeValueDisplay(aData, 'beliefExists')
      const bConf = resolveEdgeValueDisplay(bData, 'beliefExists')
      const confOrder = compareEdgeValueDisplays(aConf, bConf, 'asc')
      const bothConfShown = aConf.show && bConf.show
      if (!bothConfShown ? confOrder !== 0 : Math.abs(aConf.value - bConf.value) > 0.001) {
        return confOrder
      }

      return compareEdgeValueDisplays(
        resolveEdgeValueDisplay(aData, 'weight'),
        resolveEdgeValueDisplay(bData, 'weight'),
        'desc',
      )
    })
  }, [causalEdges, fragileEdgeSwitchProbMap])

  // ── Goal headline ─────────────────────────────────────────────────────────

  /**
   * ONE map for every label this container resolves — the goal heading and both
   * clipboard exports. Built here rather than per call site, which is also what
   * stops the three of them drifting apart.
   */
  const nodeLabels = useMemo(() => buildCanvasLabelMap(nodes), [nodes])

  const goalNode = grouped.goal[0]
  const goalLabel = goalNode
    ? resolveCanvasLabel(goalNode.id, nodeLabels) ?? UNNAMED_ELEMENT_LABEL
    : null

  // ── Contested pending count (reactive — updates after each resolution) ───

  const handleCopyText = useCallback(() => {
    const lines: string[] = []
    if (goalLabel) lines.push(`Goal: ${goalLabel}`)
    lines.push('')
    lines.push('Factors:')
    for (const n of sortedFactors) {
      const lbl = resolveCanvasLabel(n.id, nodeLabels) ?? UNNAMED_ELEMENT_LABEL
      const obs = (n.data as any)?.observedState ?? (n.data as any)?.observed_state ?? {}
      // ⚠ NO `?? obs.source` TAIL. ⚠⚠ AND THIS COMMENT WAS FALSE FROM THE MOMENT
      // THE TAIL WAS REMOVED: it said, present tense, that `mapSourceToDisplay`
      // "already returns the raw token for anything it cannot classify". It
      // returns `null` now — that was the point of the change — and this sat
      // directly above the new block saying so. Corrected on review.
      //
      // The rule stands: no second, unclassified route for a wire token to
      // reach the clipboard. `utils.ts` records the original leak as having
      // "left the estate in what a user pastes into a document".
      /* ⚠ THREE STATES, NOT TWO. `mapSourceToDisplay` now returns `null` for a
         source it cannot classify, so a bare interpolation would paste the word
         "null" into a user's document — strictly worse than the wire token it
         replaced. "No source" and "a source we cannot name" are different facts
         and the clipboard says which. */
      const namedSource = obs.source ? mapSourceToDisplay(obs.source) : null
      const src = namedSource
        ? ` [${namedSource}]`
        : obs.source
          ? ' [source not recognised]'
          : ' [no source]'
      lines.push(`  • ${lbl}${src}`)
    }
    lines.push('')
    lines.push('Edges:')
    for (const e of sortedEdges) {
      // ⚠ The two `nodes.find` lookups that stood here are gone with the raw
      // reads that needed them — `nodeLabels` is the one map, built once.
      const fromLbl = resolveCanvasLabel(e.source, nodeLabels) ?? UNNAMED_ELEMENT_LABEL
      const toLbl = resolveCanvasLabel(e.target, nodeLabels) ?? UNNAMED_ELEMENT_LABEL
      lines.push(`  • ${fromLbl} → ${toLbl}`)
    }
    const text = lines.join('\n')
    navigator.clipboard?.writeText(text).catch(() => {})
  }, [goalLabel, sortedFactors, sortedEdges, nodeLabels])

  const handleCopyJson = useCallback(() => {
    const payload = {
      goal: goalLabel ?? null,
      factors: sortedFactors.map(n => ({
        // The id stays, deliberately — an export needs identity. It is the
        // LABEL that must never silently become one.
        id: n.id,
        label: resolveCanvasLabel(n.id, nodeLabels) ?? UNNAMED_ELEMENT_LABEL,
        category: (n.data as any)?.category ?? null,
        observedState: (n.data as any)?.observedState ?? (n.data as any)?.observed_state ?? null,
        prior: (n.data as any)?.prior ?? null,
      })),
      // ⛔ F7. The three numbers below are `DEFAULT_EDGE_DATA` /
      // `USER_EDGE_DEFAULTS` on any edge nobody characterised, and this
      // payload lands on the user's clipboard — where nothing downstream can
      // tell a chosen 0.3 from a fabricated one. The stamps now travel WITH
      // the values, derived from the same accessor the renderers use, so the
      // export cannot disagree with the screen about what is known.
      edges: sortedEdges.map(e => {
        const data = e.data as Record<string, unknown> | undefined
        return {
          id: getDisplayEdgeId(e),
          source: e.source,
          target: e.target,
          weight: (data as Record<string, unknown> | undefined)?.weight ?? null,
          weightSource: edgeValueSource(data, 'weight'),
          direction: (data as Record<string, unknown> | undefined)?.direction ?? null,
          beliefExists: (data as Record<string, unknown> | undefined)?.beliefExists ?? null,
          beliefExistsSource: edgeValueSource(data, 'beliefExists'),
          provenance: (data as Record<string, unknown> | undefined)?.provenance ?? null,
        }
      }),
    }
    const json = JSON.stringify(payload, null, 2)
    navigator.clipboard?.writeText(json).catch(() => {})
  }, [goalLabel, sortedFactors, sortedEdges, nodeLabels])

  /**
   * The Olumi hand-off for the canonical outline's group affordances.
   *
   * ⚠ `null` WHEN THERE IS NO SENDER, and that null travels all the way to the
   * buttons, which then do not render. The v1 sections each guarded their
   * send-to-AI controls behind `{onSendMessage && …}`; this preserves that guard
   * in ONE place instead of eleven, and it is what stops the outline offering an
   * action whose turn cannot be delivered (preamble P8).
   */
  const olumiHandOff = useMemo(() => createOlumiHandOff(onSendMessage), [onSendMessage])

  const handOffToOlumi = useCallback(
    (message: string, reason: string) => {
      olumiHandOff?.({ message, reason })
    },
    [olumiHandOff],
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="space-y-4 pb-4"
      data-testid="model-tab"
      aria-busy={trust.isRunning || undefined}
    >

      {/* F9: run in flight — banner above the retained model (marked, never
          blanked); defensive skeleton when there is no model to retain. The
          dock-level announcer carries the aria-live announcement. */}
      <AnalysisRunStateCover
        isRunning={trust.isRunning}
        startedAt={trust.runStartedAt}
        contentRetained={nodes.length > 0}
      />

      {/* ── The Model Editor v2 (mounted 16 Aug 2026, no flag) ─────────────── */}
      {/* One filterable outline of the model, editable in place where the
          canonical transaction exists. ADDITIVE: the v1 sections below are
          unchanged — §7's removals await Paul's KEEP/CUT verdict. */}
      <ModelTabV2Panel
        openGroupRequest={openGroupRequest}
        nodes={nodes}
        edges={edges}
        goalThreshold={goalThreshold}
        fragileEdgeIds={hasRobustnessData ? fragileEdgeIds : undefined}
        onHandOffToOlumi={olumiHandOff ? handOffToOlumi : undefined}
        currentScenarioId={currentScenarioId}
        lastServerGraphHash={lastServerGraphHash}
        expertMode={expertMode ?? false}
        onToggleExpert={onToggleExpert}
        onRenameRow={updateNodeLabel}
      />

      {/* ── The model's constraints, READ-ONLY ───────────────────────────────
          Answers "where can the user view the constraints?" with a surface that
          STAYS OPEN. The two other live constraint displays are the goal node's
          transient hover pills and the Inspector's GoalPanel — and the Inspector
          is mutually exclusive with this dock, so opening this tab closes it.
          Renders nothing when the model has no constraints. */}
      <GoalConstraintsSection constraints={goalConstraints} nodes={nodes} />

      {/* Unique scientific transparency from the legacy stack, rehomed rather
          than discarded. These are disclosures/audit facts, not a second
          entity editor: automatic repairs, quality dimensions, simulation
          metadata and warnings remain inspectable beside the one v2 route. */}
      <DetailToggleContext.Provider value={{ showDetail: expertMode ?? false }}>
        <div data-testid="model-scientific-transparency" className="space-y-3">
          <ModelAdjustments
            adjustments={modelAdjustments}
            repairActions={modelRepairActions}
          />
          {/* The Model card. Its own `testId="model-health-section"`
              (`model-tab/ModelHealthSection.tsx:217`) is the deep-link target —
              see `MODEL_SECTION_TARGET` above for why no extra wrapper is
              interposed. */}
          {/* ⚠ THE HAND-OFF, NOT THE BARE SENDER. This passed `onSendMessage`, so
              the card's one clickable affordance posted a real turn into a tab that
              is `hidden` + `aria-hidden` whenever Model is active
              (`OutputsDock.tsx:3735-3737`): the user clicked and the screen did not
              change. It is the defect `olumiHandOff.ts`'s header closed on the v2
              outline and MISSED here, because this mount sat OUTSIDE the
              `LEGACY_DETAILED_EDITOR_MOUNTED` gate while the five sibling v1
              discuss buttons sat inside it — `groupActions.ts:186-207` records that
              survival and draws the opposite conclusion from it. The gate and those
              five siblings were deleted on 2026-09-11; this mount is now the only
              discuss affordance in the file, which is why the hand-off matters.
              `olumiHandOff` is null when no conversation can receive the turn, which
              is what keeps the button off screen in that case rather than dropping
              the send. */}
          <ModelHealthSection
            ceeQuality={ceeQuality}
            auditTrail={auditTrail}
            factorCount={grouped.factor.length}
            edgeCount={causalEdges.length}
            factorsToVerify={factorsToVerify}
            onHandOffToOlumi={olumiHandOff ?? undefined}
            {...makeSectionProps('modelcard')}
          />
        </div>
      </DetailToggleContext.Provider>


      {/* ── Streaming diagnostics (Shift+D) ───────────────────────────────── */}
      <StreamingDiagnostics
        showDebug={showDebug}
        hasDiagnostics={hasDiagnostics}
        diagnostics={diagnostics}
        hasTrim={hasTrim}
        effectiveCorrelationId={effectiveCorrelationId}
        correlationMismatch={correlationMismatch}
        correlationIdHeader={correlationIdHeader}
      />

      {/* ⚠ `ReanalyseBar` USED TO MOUNT HERE AND MUST NOT COME BACK.
          It was `sticky bottom-0`, and because this surface declares
          `scroll: 'shell'` its content sits inside the dock's scroller — so
          the bar pinned itself to the bottom of that scroller from a mid-list
          position and, being opaque, covered `ModelFooter` (rendered directly
          below) and everything after it.
          The shell now hosts it in its RESERVED FOOTER REGION, a flex sibling
          of the scroller that can occlude nothing, declared by this surface as
          `footerBar: 'reanalyse'` in `workspaceShell/shellContract.ts`.
          Re-adding it here would put the Model tab's only stale warning and
          only re-run control back inside the scroll region. */}

      {/* ── Footer: search + copy ─────────────────────────────────────────── */}
      <ModelFooter
        onCopyText={handleCopyText}
        onCopyJson={handleCopyJson}
      />
    </div>
  )
})
