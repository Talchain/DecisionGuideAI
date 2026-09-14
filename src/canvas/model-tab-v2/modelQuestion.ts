/**
 * WHICH QUESTION IS THIS MODEL ABOUT? — the projection behind the tab's opening
 * line.
 *
 * `MODEL-TAB-REDESIGN-2026-07-29.md` §2: *"Nothing on the tab says what this
 * decision is."* Still true at `18d681c2`, and structurally so: `adapters.ts`
 * files a `decision` node into the `goal` GROUP, and `ModelTabV2Panel` passes
 * `initiallyClosedGroups={MODEL_GROUP_IDS}`, so the question reaches the outline
 * as a row inside a group that arrives CLOSED. The reader meets five collapsed
 * headers and never learns what is being worked out.
 *
 * ⭐ THE TEXT IS THE GRAPH (design §3.0). This is a pure function of the node
 * collection. No store read, no stored string, no LLM prose, nothing cached.
 * Same nodes in, same answer out.
 *
 * ⚠⚠ IT BORROWS BOTH ITS POLICIES RATHER THAN RE-EXPRESSING THEM, AND THAT IS
 * THE WHOLE DEFENCE AGAINST TRAP 21. The line and the outline row name the same
 * node, so if they resolved "which node is the question?" or "what is it
 * called?" differently, the tab would state the question two ways and the fix
 * would be worse than the gap:
 *
 *   · `nodeKind` (`./adapters`) decides which node is a question. It wraps
 *     `resolveNodeTypeLiteral`, the estate's one `type ?? data.kind ?? data.type`
 *     reader, so this cannot disagree with the canvas about a node's kind.
 *   · `resolveCanvasLabel` (`../domain/canvasLabels`) decides what it is called.
 *     It returns `null` rather than the id, and rejects a stored label that is
 *     itself a raw id, so `dec_ops_site` can never reach the reader as a name.
 *
 * ⛔ NO VERDICT LANGUAGE IS REACHABLE FROM HERE. This states composition: which
 * node, and what it is called. Naming a leading option or a recommendation is
 * owned by the results surfaces.
 */
import type { Node } from '@xyflow/react'

import { nodeKind } from './adapters'
import { labelIsTypeDefault } from './rowPresentation'
import { buildCanvasLabelMap, resolveCanvasLabel } from '../domain/canvasLabels'

/**
 * THREE STATES, AND THE THIRD IS THE ONE THE DESIGN MISSED.
 *
 * The 29 Jul design names two: a question, or the honest absence *"No decision
 * node yet"*. A third is required and was DERIVED rather than imagined. A
 * `decision` node that still carries its type default name reads "Question"
 * (`DECISION_NODE_LABEL`), and that state was WITNESSED on deployed `a9c2e050`
 * — `rowPresentation.labelIsTypeDefault` exists for exactly it. Collapsing it
 * into `stated` renders the word twice and states nothing; collapsing it into
 * `absent` claims the model has no question node when it has one.
 */
export type ModelQuestion =
  | { readonly state: 'stated'; readonly label: string }
  | { readonly state: 'unwritten' }
  | { readonly state: 'absent' }

/**
 * Project the model's question from its nodes.
 *
 * ⚠ WHY TWO PASSES AND NOT "THE FIRST DECISION NODE WINS". A stray unwritten
 * question node ahead of a written one would make a single-pass reader announce
 * "not written yet" while the outline plainly shows a written question below —
 * the line and the rows disagreeing about the same model, which is the one
 * outcome this whole module is shaped to prevent. So a WRITTEN question always
 * outranks an unwritten one, and only the total absence of any authored label
 * falls through to `unwritten`.
 *
 * Among several written questions the first in node order wins. That is not a
 * claim that several are common; it is a guarantee that the answer cannot vary
 * between renders of the same model. Node order is the same array the outline
 * reads, so the line names the question that appears first in the Goal group.
 */
export function projectModelQuestion(nodes: readonly Node[]): ModelQuestion {
  const labels = buildCanvasLabelMap(nodes)
  let sawQuestionNode = false

  for (const node of nodes) {
    if (nodeKind(node) !== 'decision') continue
    sawQuestionNode = true

    // `null` means no honest label exists: empty, whitespace, or id-shaped.
    // A node in that state is unwritten in exactly the sense a node still
    // carrying `DECISION_NODE_LABEL` is, and rendering the row's
    // `UNNAMED_ELEMENT_LABEL` fallback here would say "Question: Unnamed
    // element", which is the same gibberish one step along.
    const label = resolveCanvasLabel(node.id, labels)
    if (label === null) continue

    // ONE definition of "still carrying its type's default name", borrowed from
    // the row presenter rather than re-typed as a `=== 'Question'` comparison.
    // The product word moved once already (Paul retired "Decision" on 31 Aug);
    // a second copy here would be the mirror `domain/vocabulary.ts` exists to
    // abolish.
    if (labelIsTypeDefault({ kind: 'decision', label })) continue

    return { state: 'stated', label }
  }

  return sawQuestionNode ? { state: 'unwritten' } : { state: 'absent' }
}
