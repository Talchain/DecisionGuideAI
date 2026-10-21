/**
 * Whether the scenario on screen is a core one: its saved model carries a living model. The precise gate for a core-only
 * write. The URL mode is not: CEE serves core under the default `openai` mode (`laneModeFor`), and a legacy scenario
 * under either. Its own module, so a spec that replaces `savedGraph` with a plain read still gets this from that read.
 */
import { useSavedGraph } from './savedGraph'

export function useSavedModelIsCore(): boolean {
  const graph = useSavedGraph()
  if (graph === null || typeof graph !== 'object' || Array.isArray(graph)) return false
  const lm = (graph as { living_model?: unknown }).living_model
  return lm !== null && typeof lm === 'object'
}
