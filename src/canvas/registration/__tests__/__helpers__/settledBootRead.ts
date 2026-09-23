/**
 * A SETTLED BOOT READ — the configuration production has for every
 * CEE-addressable scenario, for specs that mount `useImportRegistration`
 * without `useServerGraphHydration`.
 *
 * In the app the Canvas route mounts both: `useServerGraphHydration` reads every
 * UUID scenario the store binds, and the re-arm WAITS until that read has
 * answered (`bootGraphRead.ts`, review B1 F). A spec that mounts the re-arm
 * alone stands in a state production never settles in — no read recorded — and
 * sees `wait`, so a negative assertion there passes whether or not the rule it
 * names holds.
 *
 * This records the answer a read gives when CEE holds exactly `nodes`/`edges`:
 * outcome `merged`, and `lastAuthoritativeGraph` = those elements (what
 * `mergeServerGraphOnHydrate` records on that path). E.g. a fresh starter: the
 * registration acknowledges it, then the read of the bound id answers `merged`.
 */
import { useCanvasStore } from '../../../store'
import { beginBootGraphRead, settleBootGraphRead } from '../../../hydrate/bootGraphRead'
import { identityFromCanvasGraph } from '../../../utils/graphIdentity'

export function recordSettledBootRead(
  scenarioId: string,
  nodes: ReadonlyArray<{ id?: unknown }>,
  edges: ReadonlyArray<{ source?: unknown; target?: unknown }>,
): void {
  const token = beginBootGraphRead(scenarioId)
  settleBootGraphRead(scenarioId, token, 'merged')
  useCanvasStore.getState().setLastAuthoritativeGraph(identityFromCanvasGraph(nodes, edges))
}
