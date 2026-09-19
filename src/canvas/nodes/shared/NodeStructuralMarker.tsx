/**
 * NodeStructuralMarker — the CLIENT-DERIVED half of the node coaching slot.
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
 * `data-marker-source="canvas-structure"`, and a DASHED border against the
 * coaching marker's solid one. The distinction is user-meaningful (attributable
 * decision science versus an observation about the board), so it is visible, not
 * merely inspectable.
 *
 * ⚠ NON-INTERACTIVE, `role="img"`, deliberately. The panel row already owns the
 * action (`send_prompt` + spark) and the registry's own rule bans dead-end
 * intents, so a button here would either duplicate that action or lead nowhere.
 * `edited-since-run` in the same corner is exactly this shape and is the
 * precedent reused.
 *
 * ⚠ ICON-ONLY, NO TEXT, AND THAT IS ENFORCED ELSEWHERE. See
 * `STRUCTURAL_MARKER_COPY`'s docblock: the canvas counter-scale census asserts its
 * `KNOWN_FIXED` set exactly over the directories React Flow renders from, and
 * `nodes/shared/` is one of them. No declared size means nothing to pin.
 */

import { useMemo } from 'react'
import { Unplug, GitMerge } from 'lucide-react'
import type { ComponentType } from 'react'
import { useCanvasStore } from '../../store'
import {
  computeStructuralAbsence,
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
const STRUCTURAL_MARKER_ICON: Readonly<
  Record<StructuralAbsenceKind, ComponentType<{ className?: string }> | null>
> = {
  no_downside: Unplug,
  shared_mechanism: GitMerge,
  no_external_factor: null,
}

interface NodeStructuralMarkerProps {
  /** The canvas node id this marker sits on. */
  nodeId: string
}

export function NodeStructuralMarker({ nodeId }: NodeStructuralMarkerProps) {
  // Subscribe to the raw arrays (stable Zustand references) then derive locally,
  // the same pattern `usePreAnalysisModel` and `useScienceIcons` use. An inline
  // selector returning a derived array trips React's cached-snapshot loop.
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)

  const finding = useMemo(() => computeStructuralAbsence(nodes, edges), [nodes, edges])

  // No finding, or a finding that names no node, or a finding that names a
  // DIFFERENT node: nothing renders. ⚠ `includes` is the whole binding — the
  // marker is bound to this node by IDENTITY, never by a predicate another node
  // could satisfy, and an `actionTargetIds` of `[]` therefore reaches every node
  // and marks none of them, which is the honest empty the selector intends.
  if (!finding || !finding.actionTargetIds.includes(nodeId)) return null

  const label = STRUCTURAL_MARKER_COPY[finding.kind]
  const Icon = STRUCTURAL_MARKER_ICON[finding.kind]
  // Fail-closed: a kind with no sentence or no glyph renders nothing rather than
  // an unlabelled mark. Unreachable while the two maps agree with the union, and
  // kept because an unlabelled glyph on a node is worse than no glyph.
  if (!label || !Icon) return null

  // Positioning is owned by BaseNode's top-right corner STACK; this renders as a
  // static flex child of the coaching slot and carries no offset of its own.
  return (
    <span
      role="img"
      data-testid={`node-structural-marker-${nodeId}`}
      data-marker-source="canvas-structure"
      data-structural-kind={finding.kind}
      title={label}
      aria-label={label}
      className="
        nodrag nopan
        inline-flex items-center justify-center h-5 w-5
        rounded-full bg-panel border border-dashed border-info/30 shadow-1
      "
    >
      <Icon className="w-3.5 h-3.5 text-info" aria-hidden="true" />
    </span>
  )
}
