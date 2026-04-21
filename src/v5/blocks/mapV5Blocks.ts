/**
 * mapV5Blocks — pure mapper from V5 OlumiResponse.blocks[] to the UI's
 * ConversationBlock discriminated union.
 *
 * Hoisted out of useConversation so the V5 branch can consume a single
 * function. `error` blocks are filtered upstream by routeV5Response and
 * never reach this mapper; including them here would produce duplicate
 * typed_error rendering.
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
      // Filtered upstream by routeV5Response; returning null here keeps
      // callers' type-narrowing clean if a stray error block appears.
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
    default: {
      const _exhaustive: never = block
      // Unreachable at compile time; placate the narrowing guard without
      // crashing if a future schema bump adds a kind.
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
 * filtering out nulls (error blocks routed elsewhere).
 */
export function mapV5Blocks(blocks: V5Block[]): ConversationBlock[] {
  const out: ConversationBlock[] = []
  for (const b of blocks) {
    const mapped = mapV5Block(b)
    if (mapped) out.push(mapped)
  }
  return out
}
