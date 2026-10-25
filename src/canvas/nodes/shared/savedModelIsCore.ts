/**
 * Whether the scenario on screen is a core one: its saved model carries a living model. The precise gate for a core-only
 * write. The URL mode is not: CEE serves core under the default `openai` mode (`laneModeFor`), and a legacy scenario
 * under either. Its own module, so a spec that replaces `savedGraph` with a plain read still gets this from that read.
 */
import { useSavedGraph } from './savedGraph'
import { useCanvasStore } from '../../store'
import { isOpenAiLane, resolveAiComparisonMode } from '../../../v5/aiComparisonMode'
import { isCeeAddressableScenarioId } from '../../hydrate/bootGraphRead'

export function useSavedModelIsCore(): boolean {
  const graph = useSavedGraph()
  if (graph === null || typeof graph !== 'object' || Array.isArray(graph)) return false
  const lm = (graph as { living_model?: unknown }).living_model
  return lm !== null && typeof lm === 'object'
}

/**
 * Whether the legacy client validator is off for the board on screen (store `legacyValidationOff`): a read that answered
 * decides (a living model → off), and while the read is pending or failed it is off on the core lane (the URL's
 * `openai`-family mode, a scenario CEE can address), where CEE serves core and its admission decides. Off that lane (a
 * guest or local board, another AI mode) the validator runs as before (Codex r1 on #2995: a pending read must not
 * switch the cycle rule back on).
 */
export function useLegacyValidationOff(): boolean {
  const graph = useSavedGraph()
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  if (graph !== null && typeof graph === 'object' && !Array.isArray(graph)) {
    const lm = (graph as { living_model?: unknown }).living_model
    return lm !== null && typeof lm === 'object'
  }
  return isOpenAiLane(resolveAiComparisonMode()) && isCeeAddressableScenarioId(scenarioId)
}
