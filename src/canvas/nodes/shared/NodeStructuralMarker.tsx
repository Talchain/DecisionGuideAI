/**
 * NodeStructuralMarker — the CLIENT-DERIVED half of the node coaching slot.
 *
 * ⛔ NOT MOUNTED ON THE CARD ANY MORE — contract v3.1 (DESIGN-GAP-v31 #18). The
 * contract's resting top-right corner is the Info attention mark only
 * (`.node .attention`); measured on served `eec722ab`, this GitMerge glyph sat
 * at rest on 3 of 5 pricing factors ("Observed from the shape of your model:
 * every option acts directly on this part."), a cue the contract does not have.
 * `NodeCoachingMarker` no longer falls back to it, so it no longer reserves the
 * title spacer either (that reservation was the blank line above those titles
 * at landing, gap #17). The finding still reaches the reader through its
 * pre-analysis panel row, where its action lives. The component and its gate
 * are KEPT, unmounted, for the inspector to adopt (Canvas WS3) — everything
 * below describes it as it behaves wherever it is mounted.
 *
 * `computeStructuralAbsence` diagnoses a reasoning gap from the nodes and edges
 * sitting in the browser, entirely client-side, with no producer call of any
 * kind. Until now its finding reached the reader only as a row in a panel that
 * is collapsed by default, because the selector computed the element identities
 * and discarded them at the `return`. It now carries `actionTargetIds`, and this
 * component is the one place they are read: a small glyph on the node the
 * finding's prescribed action actually names.
 *
 * ⛔⛔ THE HONESTY FENCE, AND WHY IT HOLDS BY CONSTRUCTION RATHER THAN BY CARE.
 *
 * `NodeCoachingMarker` states the rule this component must not break: "Producer-
 * named targets only: an item counts iff its `target_object` names THIS node."
 * The obvious shortcut for getting a client-derived finding onto a node is to
 * synthesise a `GuidanceItem` with a `target_object` and push it into
 * `guidanceStore`. That would be a fabrication of producer provenance, and its
 * blast radius is not local: `useScienceIcons`'s `producerNamesThisNode`
 * predicate reads the same array, so a synthesised item would SILENCE the other
 * client-derived channel with a client-side computation dressed as the producer.
 *
 * ⭐ NOTHING IS WRITTEN TO `guidanceStore` HERE. No `GuidanceItem` is minted, no
 * `target_object` is synthesised, and this component does not import the store at
 * all. Because the finding never enters `guidanceItems`, no consumer of that
 * store can see it, `InspectorGuidanceSection` included. The fence is a property
 * of the shape, not of a rule someone must remember.
 *
 * ⭐⭐ PRECEDENCE: THE PRODUCER WINS, AND THIS IS THE EXISTING RULING APPLIED,
 * NOT A NEW ONE.
 *
 * `hooks/__tests__/oneVoicePerNode.spec.ts` and the docblock at
 * `hooks/useScienceIcons.ts:60-84` already settled this for the other local
 * channel: the producer's `guidance_items` carry a DSK claim id and a protocol,
 * which is attributable decision science; a signal derived from the shape of the
 * graph in the browser is a different epistemic class; the producer outranks it
 * per node; and the local channel is NOT deleted, because where the producer is
 * silent (most nodes, most runs) the local observation is all the reader gets and
 * it is true. A structural finding is the same class, so it inherits the same
 * precedence. It is implemented by rendering this component from
 * `NodeCoachingMarker`'s `if (!top)` branch: the producer's own filter decides,
 * in one place rather than at five call sites, and a node can never carry two
 * coaching voices.
 *
 * ⛔ A SIXTH `BaseNode` CORNER SIBLING WAS REJECTED ON SCOPE. The top-right
 * corner is a single-owner stack with an explicitly stated FIVE-MEMBER contract
 * (`BaseNode.tsx:1206-1240`), whose own comment records that arrivals four and
 * five each called themselves "the fourth occupant". Sharing the coaching slot
 * costs nothing, because the two sources are mutually exclusive by the
 * precedence above: the slot renders at most one glyph either way.
 *
 * ⭐ NAMED APART ON SCREEN AS WELL AS IN THE DOM. Distinct testid family,
 * `data-marker-source="canvas-structure"`, and its own glyphs (`Unplug`,
 * `GitMerge`), which no producer category uses. The distinction is
 * user-meaningful (attributable decision science versus an observation about
 * the board), so it is visible, not merely inspectable.
 *
 * ⛔ NO LONGER BY A DASHED BORDER — contract v3.1 (Paul 23 Sep pt 4: "Dash
 * remains existence certainty only"; deltas PILL-07 / ICON-09). On this canvas
 * a dash says a CONNECTION may not exist; on a marker it said something else
 * with the same picture. The marker now speaks the corner stack's one language
 * (see `NodeCoachingMarker`): the rail's counter-scaled box and glyph (25 / 15
 * since gap 34; it was a raw-px `h-5`, 13px at the 65% landing zoom), borderless
 * and shadowless (no panel fill since the stack moved inside the card, gap 11),
 * muted at rest and Info on hover/focus — Info at
 * rest is the attention marker's alone (pt 9). Colour only on hover, no
 * info-soft ground: that ground marks a thing you can PRESS, and this is not
 * one (the header-provenance mark's `.prov:hover` treatment).
 *
 * ⚠ NON-INTERACTIVE, `role="img"`, deliberately. The panel row already owns the
 * action (`send_prompt` + spark) and the registry's own rule bans dead-end
 * intents, so a button here would either duplicate that action or lead nowhere.
 * `edited-since-run` in the same corner is exactly this shape and is the
 * precedent reused. It explains itself through the shared `Tooltip` on hover
 * AND keyboard focus (Paul 23 Sep pt 12: "Icons need hover/focus labels"; ED
 * 02:31Z: a native `title` is not full-text recovery), so it is a tab stop —
 * the `EvidenceGapBadge` hover zone's shape: a named graphic with a focus ring,
 * still not a control.
 *
 * ⚠ ICON-ONLY, NO TEXT, AND THAT IS ENFORCED ELSEWHERE. See
 * `STRUCTURAL_MARKER_COPY`'s docblock: the canvas counter-scale census asserts its
 * `KNOWN_FIXED` set exactly over the directories React Flow renders from, and
 * `nodes/shared/` is one of them. No declared size means nothing to pin.
 */

import { Unplug, GitMerge, type LucideIcon } from 'lucide-react'
import Tooltip from '../../../components/Tooltip'
import { useCanvasStore } from '../../store'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import { CANVAS_GLYPH_SIZE_CLASSES, CANVAS_QUICK_ACTION_BOX_PX } from './canvasGlyphScale'
import { NODE_RAIL_GLYPH_CLASSES, NODE_RAIL_GLYPH_PX, NODE_RAIL_REST_TONE_CLASS } from './nodeCardRailStyles'
import {
  computeStructuralAbsence,
  type StructuralAbsence,
  type StructuralAbsenceKind,
} from '../../components/pre-analysis-v3/selectors/computeStructuralAbsence'
import { STRUCTURAL_MARKER_COPY } from '../../components/pre-analysis-v3/constants'

/**
 * ⚠ `Unplug`, NOT `Unlink`. `useScienceIcons` already spends `Unlink` on
 * `weak-connection` ("this relationship is uncertain"), which is a claim about an
 * edge that EXISTS. `no_downside` is the opposite claim: no option reaches this
 * risk at all. Both channels can fire on one node, so reusing the glyph would
 * put two different meanings behind one picture.
 *
 * Keyed by the union, and `no_external_factor` is `null` for the same reason its
 * copy is: it names no node, so it can never reach this surface.
 */
const STRUCTURAL_MARKER_ICON: Readonly<Record<StructuralAbsenceKind, LucideIcon | null>> = {
  no_downside: Unplug,
  shared_mechanism: GitMerge,
  no_external_factor: null,
}

interface NodeStructuralMarkerProps {
  /** The canvas node id this marker sits on. */
  nodeId: string
}

/**
 * The finding for the current graph, computed ONCE per `nodes`/`edges` pair
 * however many cards ask. A single-entry identity cache: the store replaces both
 * arrays on every change, so the last pair is the only one worth keeping, and
 * every card on the board reads it in the same render pass.
 */
let lastNodes: unknown = null
let lastEdges: unknown = null
let lastFinding: StructuralAbsence | null = null
function structuralAbsenceOf(
  nodes: Parameters<typeof computeStructuralAbsence>[0],
  edges: Parameters<typeof computeStructuralAbsence>[1],
): StructuralAbsence | null {
  if (nodes !== lastNodes || edges !== lastEdges) {
    lastFinding = computeStructuralAbsence(nodes, edges)
    lastNodes = nodes
    lastEdges = edges
  }
  return lastFinding
}

/**
 * ⭐ THE ONE GATE — whether THIS node carries the structural mark, and with what
 * sentence and glyph. The marker below renders from it, and `BaseNode` reserves
 * the title's corner clearance from it (through `useNodeCoachingMarkerShown`),
 * so the reserve and the mark cannot disagree about whether a mark is there.
 *
 * No finding, or a finding that names no node, or a finding that names a
 * DIFFERENT node: null. ⚠ `includes` is the whole binding — the marker is bound
 * to this node by IDENTITY, never by a predicate another node could satisfy, and
 * an `actionTargetIds` of `[]` therefore reaches every node and marks none of
 * them, which is the honest empty the selector intends. Fail-closed: a kind with
 * no sentence or no glyph is null rather than an unlabelled mark. Unreachable
 * while the two maps agree with the union, and kept because an unlabelled glyph
 * on a node is worse than no glyph.
 */
function structuralMarkerFor(
  finding: StructuralAbsence | null,
  nodeId: string,
): { kind: StructuralAbsenceKind; label: string; Icon: LucideIcon } | null {
  if (!finding || !finding.actionTargetIds.includes(nodeId)) return null
  const label = STRUCTURAL_MARKER_COPY[finding.kind]
  const Icon = STRUCTURAL_MARKER_ICON[finding.kind]
  if (!label || !Icon) return null
  return { kind: finding.kind, label, Icon }
}

/** Whether `NodeStructuralMarker` renders for this node — a boolean selector, so a
 *  card re-renders only when the answer flips, never on every graph edit. */
export function useNodeHasStructuralMarker(nodeId: string): boolean {
  return useCanvasStore((s) => structuralMarkerFor(structuralAbsenceOf(s.nodes, s.edges), nodeId) !== null)
}

export function NodeStructuralMarker({ nodeId }: NodeStructuralMarkerProps) {
  // Subscribe to the raw arrays (stable Zustand references) then derive locally,
  // the same pattern `usePreAnalysisModel` and `useScienceIcons` use. An inline
  // selector returning a derived array trips React's cached-snapshot loop.
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)

  const mark = structuralMarkerFor(structuralAbsenceOf(nodes, edges), nodeId)
  if (!mark) return null
  const { label, Icon } = mark

  // Positioning is owned by BaseNode's top-right corner STACK; this renders as a
  // static flex child of the coaching slot and carries no offset of its own.
  // No panel fill: the stack now sits INSIDE the card (gap 11), on the card's
  // own panel, so the fill that kept it legible over the layer gap has no job.
  // Resting grey is the rail's `.icon-btn` grey (gap 34).
  return (
    <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={label}>
      <span
        role="img"
        tabIndex={0}
        data-testid={`node-structural-marker-${nodeId}`}
        data-marker-source="canvas-structure"
        data-structural-kind={mark.kind}
        data-node-tooltip="true"
        aria-label={label}
        className={`nodrag nopan inline-flex items-center justify-center ${CANVAS_GLYPH_SIZE_CLASSES[CANVAS_QUICK_ACTION_BOX_PX]} rounded ${NODE_RAIL_REST_TONE_CLASS} hover:text-info focus-visible:text-info focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
      >
        <Icon size={NODE_RAIL_GLYPH_PX} className={NODE_RAIL_GLYPH_CLASSES} aria-hidden="true" />
      </span>
    </Tooltip>
  )
}
