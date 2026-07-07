/**
 * mapV5Blocks — pure mapper from V5 OlumiResponse.blocks[] to the UI's
 * ConversationBlock discriminated union.
 *
 * Hoisted out of useConversation so the V5 branch can consume a single
 * function.
 *
 * Error-block handling (post-2026-05 severity-aware routing):
 *   - FATAL error blocks (`severity: 'error'`) are intercepted by
 *     `routeV5Response` BEFORE the response reaches this mapper, so
 *     under normal flow the mapper does not see them.
 *   - ADVISORY error blocks (`severity: 'warn'` or `'info'`) DO reach
 *     this mapper alongside text / content blocks, because the router
 *     classifies the response by its non-error content while
 *     intentionally preserving the advisory block on `response.blocks`
 *     for diagnostic consumers (debug panel, telemetry view). The mapper
 *     deliberately returns `null` for these so chat rendering is driven
 *     by the friendly assistant_text and non-error blocks alone — the
 *     advisory signal stays out of the chat surface but remains
 *     accessible via `response.blocks` for tooling that wants it.
 *
 * Unknown block kinds (shouldn't appear — OlumiResponseSchema is strict)
 * degrade to `v5_unsupported` to keep the renderer crash-free. DEV logs
 * and telemetry-track in InlineBlocks' default branch pick up drift.
 */
import type { OlumiResponse } from '@talchain/schemas/boundary'

import type { ConversationBlock } from '../../canvas/conversation/types'

type V5Block = OlumiResponse['blocks'][number]

export function mapV5Block(block: V5Block): ConversationBlock | null {
  switch (block.type) {
    case 'text':
      // CEE emits text blocks primarily as inline commentary alongside
      // assistant_text. Render via the existing CommentaryBlock renderer.
      return { type: 'commentary', text: block.content }
    case 'error':
      // Fatal error blocks are routed to typed_error by routeV5Response
      // BEFORE this mapper runs. Advisory blocks (severity: 'warn' /
      // 'info') flow through alongside content blocks and are
      // intentionally not rendered as chat content; they remain on
      // response.blocks for diagnostic tooling. Returning null keeps the
      // chat surface clean either way.
      return null
    case 'draft_graph':
      // Applied directly to canvas via response.draft_graph, not rendered
      // as a chat block. Return null to keep the exhaustiveness check clean.
      return null
    case 'analysis_result':
      return {
        type: 'v5_analysis_result',
        summary: block.summary,
        leading_option_id: block.leading_option_id,
        ...(block.win_probabilities ? { win_probabilities: block.win_probabilities } : {}),
        ...(block.enrichment ? { enrichment: block.enrichment } : {}),
      }
    case 'graph_patch':
      return {
        type: 'v5_graph_patch',
        status: block.status,
        operation: block.operation,
        target_id: block.target_id,
        before: block.before,
        after: block.after,
      }
    case 'explanation':
      return {
        type: 'v5_explanation',
        narrative: block.narrative,
        referenced_option_ids: block.referenced_option_ids,
        ...(block.enrichment ? { enrichment: block.enrichment } : {}),
      }
    case 'comparison':
      return {
        type: 'v5_comparison',
        options: block.options,
        ...(block.narrative ? { narrative: block.narrative } : {}),
      }
    case 'flip_analysis':
      return {
        type: 'v5_flip_analysis',
        narrative: block.narrative,
        flip_scenarios: block.flip_scenarios,
        ...(block.enrichment ? { enrichment: block.enrichment } : {}),
      }
    case 'review_card':
      // Track C slice 1 (D-5): 0.13.x-typed Phase 3 review_card. At runtime
      // these normally arrive via the parser sidecar (splitBlocksTolerance
      // lifts them out of blocks[] pre-validation) and are surfaced by
      // composePhase3BridgedBlocks; this branch keeps the mapper coherent
      // for any future path where a schema-validated block reaches it
      // directly. Fields are typed by the 0.13.x schema — copied verbatim.
      return {
        type: 'v5_review_card',
        block_id: block.block_id,
        title: block.title,
        body: block.body,
        severity: block.severity,
        card_kind: block.card_kind,
        target_refs: block.target_refs,
        priority_rank: block.priority_rank,
        freshness: block.freshness,
        ...(block.action_intent ? { action_intent: block.action_intent } : {}),
        ...(block.action_label ? { action_label: block.action_label } : {}),
      }
    case 'coaching':
      // Track C slice 1 (D-5): 0.13.x-typed Phase 3 coaching. Same note as
      // review_card above.
      return {
        type: 'v5_coaching',
        block_id: block.block_id,
        title: block.title,
        body: block.body,
        coaching_kind: block.coaching_kind,
        source: block.source,
        target_refs: block.target_refs,
        priority_rank: block.priority_rank,
        freshness: block.freshness,
        ...(block.action_intent ? { action_intent: block.action_intent } : {}),
        ...(block.action_label ? { action_label: block.action_label } : {}),
      }
    case 'evidence':
      // Track C slice 2 (Lane UI-W4 C): 0.13.1-typed evidence. Like
      // review_card/coaching above, these normally arrive via the parser
      // sidecar and are surfaced by composePhase3BridgedBlocks; this
      // branch keeps the mapper coherent for any future path where a
      // schema-validated block reaches it directly. Copied verbatim.
      return {
        type: 'v5_evidence',
        block_id: block.block_id,
        factor_label: block.factor_label,
        factor_ref: block.factor_ref,
        target_refs: block.target_refs,
        current_confidence: block.current_confidence,
        evidence_gap: block.evidence_gap,
        suggested_technique: block.suggested_technique,
        impact_if_gathered: block.impact_if_gathered,
        priority_rank: block.priority_rank,
        severity: block.severity,
        freshness: block.freshness,
        ...(block.action_intent ? { action_intent: block.action_intent } : {}),
        ...(block.action_label ? { action_label: block.action_label } : {}),
      }
    case 'exercise':
      // Track C slice 2 (Lane UI-W4 C): 0.13.1-typed exercise. Same note
      // as evidence above. No priority_rank exists on this type (v1.3).
      return {
        type: 'v5_exercise',
        block_id: block.block_id,
        exercise_kind: block.exercise_kind,
        ...(block.failure_scenario ? { failure_scenario: block.failure_scenario } : {}),
        ...(block.warning_signs ? { warning_signs: block.warning_signs } : {}),
        ...(block.mitigation ? { mitigation: block.mitigation } : {}),
        ...(block.reference_class ? { reference_class: block.reference_class } : {}),
        ...(block.counter_case ? { counter_case: block.counter_case } : {}),
        ...(block.review_trigger ? { review_trigger: block.review_trigger } : {}),
        ...(block.target_element_ref ? { target_element_ref: block.target_element_ref } : {}),
        target_refs: block.target_refs,
        freshness: block.freshness,
      }
    default: {
      const _exhaustive: never = block
      // Unreachable at compile time (OlumiResponseSchema is strict, so unknown
      // block types fail parseV5Response before reaching here). Surface in DEV
      // to catch schema drift early without crashing.
      if (import.meta.env.DEV) {
        console.warn('[V5] unmapped block type:', (_exhaustive as { type?: string } | null)?.type ?? 'unknown', _exhaustive)
      }
      return {
        type: 'v5_unsupported',
        blockType: (_exhaustive as { type?: string } | null)?.type ?? 'unknown',
        raw: _exhaustive,
      }
    }
  }
}

/**
 * Map an entire V5 response's blocks array into ConversationBlock[],
 * filtering out nulls (fatal errors routed via typed_error; advisory
 * warn/info errors intentionally absent from chat surface).
 */
export function mapV5Blocks(blocks: V5Block[]): ConversationBlock[] {
  const out: ConversationBlock[] = []
  for (const b of blocks) {
    const mapped = mapV5Block(b)
    if (mapped) out.push(mapped)
  }
  return out
}
