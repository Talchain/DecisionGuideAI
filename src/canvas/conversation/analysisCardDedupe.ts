/**
 * ⭐ ONE ANALYSIS CARD PER RUN IN THE TRANSCRIPT (RC #63 5803875794 "stop
 * repeated analysis cards"; emergency directive 5803995225, Canvas: "Do not
 * repeat analysis cards after unrelated chat turns").
 *
 * CEE deliberately re-sends the PRIOR `analysis_result` block on later turns
 * while that result is still fresh (`orchestrator-v5/compose.ts`, lifecycle
 * branch), and the transcript used to turn every one it received into a full,
 * pinned card — so an ideation or edit turn re-surfaced the same analysis as
 * if it were new. The Analysis tab (`results.report`) is the persistent home of
 * the current analysis; the transcript shows a card when a run PRODUCED one.
 *
 * The rule: on a turn that is NOT an explicit run, a `v5_analysis_result`
 * whose CONTENT HASH equals the most recent analysis card already in the
 * transcript is dropped. Everything else is kept:
 *   · an explicit run (`run_analysis`) always shows its card, even when the
 *     numbers are unchanged — the user asked for it;
 *   · a DIFFERENT result (any changed summary / probability / enrichment) is
 *     new information and shows;
 *   · the first analysis card of a conversation shows.
 *
 * The hash is the store's own (`v5AnalysisBlockContentHash`, the same
 * derivation `results.hash` uses), so the transcript and the Analysis tab
 * agree on "same result". There is no run id on the wire to key on.
 *
 * Filtered when the message is ADDED, not at render time, so the dock's
 * "new analysis arrived" count reads the same transcript the user sees.
 */
import type { ConversationBlock, ConversationMessage } from './types'
import { v5AnalysisBlockContentHash } from '../../v5/mapV5AnalysisToReport'

type AnalysisCard = Extract<ConversationBlock, { type: 'v5_analysis_result' }>

function isAnalysisCard(block: ConversationBlock): block is AnalysisCard {
  return (block as { type?: string }).type === 'v5_analysis_result'
}

/** The content hash of the most recent analysis card in the transcript, or null. */
export function lastRenderedAnalysisHash(messages: ReadonlyArray<Pick<ConversationMessage, 'blocks'>>): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const blocks = messages[i]?.blocks ?? []
    for (let j = blocks.length - 1; j >= 0; j--) {
      const b = blocks[j]
      if (isAnalysisCard(b)) return v5AnalysisBlockContentHash(b)
    }
  }
  return null
}

/** Drop a repeated analysis card on a non-run turn; keep every other block, in order. */
export function dropRepeatedAnalysisCards<T extends ConversationBlock>(
  blocks: ReadonlyArray<T>,
  opts: { isRunAnalysisTurn: boolean; lastHash: string | null },
): T[] {
  if (opts.isRunAnalysisTurn || opts.lastHash === null) return [...blocks]
  return blocks.filter(b => !(isAnalysisCard(b) && v5AnalysisBlockContentHash(b) === opts.lastHash))
}
