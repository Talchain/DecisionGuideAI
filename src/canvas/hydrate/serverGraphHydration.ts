/**
 * serverGraphHydration — the boot orchestration for ROADMAP 2.312 piece 3.
 *
 * Reads the scenario's graph from CEE and merges its VALUES onto the restored
 * canvas, keeping the LOCAL layout. Deliberately a plain async function rather
 * than logic inside a hook, so every boot outcome — including the refusals —
 * is measurable without mounting React.
 *
 * ⚠ THE ONE INVARIANT: an answer that is not a graph NEVER touches the canvas.
 * A 404 on this route is "not readable" — the union of absent, not-yours and
 * ownership-oracle-unresolvable — and is explicitly NOT authoritative deletion;
 * a 503 is "unknown, try again". Both leave the canvas exactly as the autosave
 * restored it, with no error surfaced: a user who is offline, or whose guest
 * scenario the server has never seen, is in a normal state and has nothing to
 * act on. Rendering a DB blip as an empty canvas over live data is the precise
 * failure the server's fail-closed 503 exists to prevent, and it would be
 * reintroduced here by treating any of these as "no graph".
 */

import { useCanvasStore } from '../store'
import { logger } from '../../lib/logger'
import { fetchScenarioGraph } from '../../adapters/cee/scenarioGraph'
import { mergeServerGraphOnHydrate } from '../utils/mergeServerGraph'

export type HydrationOutcome =
  /** The server's graph was read and merged onto the canvas. */
  | 'merged'
  /** Read fine; CEE's token says the server graph has not moved. No write. */
  | 'unchanged'
  /** 200 with no graph yet — a normal empty scenario. Canvas untouched. */
  | 'absent'
  /** 404 — not readable. NEVER deletion. Canvas untouched. */
  | 'notReadable'
  /** 503 through every attempt. Canvas untouched. */
  | 'unavailable'
  /** 401 / 403 / 429. Canvas untouched. */
  | 'refused'
  /** Transport failure or a shape we cannot act on. Canvas untouched. */
  | 'unusable'
  /** No usable scenario id — nothing was requested. */
  | 'skipped'

export interface HydrateFromServerOptions {
  /** Supabase user id, when signed in. Omitted for guests. */
  userId?: string | null
  signal?: AbortSignal
  retryDelayMs?: number
}

/**
 * A scenario id CEE can address is a UUID — `scenarios.id` is a uuid column, so
 * anything else is a local draft id and would spend a request to earn a
 * guaranteed refusal.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Whether CEE's answer is the SAME graph we already hydrated from.
 *
 * ⚠ CEE-TO-CEE, GATED ON `projectionVersion`. Both sides of this comparison are
 * tokens CEE issued; nothing here is derived locally, and equality is only
 * meaningful WITHIN one projection. When the projection differs the values are
 * simply not comparable — the normalisation behind them has changed — so the
 * answer is "not known to be the same", which re-merges. Comparing across
 * versions would silently skip a hydration on a coincidence of bytes.
 */
function isSameServerGraph(
  stored: { value: string; projectionVersion: string } | null,
  fetched: { value: string; projectionVersion: string } | null,
): boolean {
  if (!stored || !fetched) return false
  if (stored.projectionVersion !== fetched.projectionVersion) return false
  return stored.value === fetched.value
}

/**
 * Hydrate the canvas from the server's copy of this scenario's graph.
 *
 * Never throws and never rejects — the caller is a boot effect, and an
 * unhandled rejection at boot is how a canvas ends up in an undefined state.
 */
export async function hydrateCanvasFromServer(
  scenarioId: string | null | undefined,
  opts: HydrateFromServerOptions = {},
): Promise<HydrationOutcome> {
  if (typeof scenarioId !== 'string' || !UUID_RE.test(scenarioId)) {
    return 'skipped'
  }

  const result = await fetchScenarioGraph(scenarioId, {
    userId: opts.userId,
    signal: opts.signal,
    retryDelayMs: opts.retryDelayMs,
  })

  // ── Every non-graph answer: leave the canvas alone, say why, surface nothing.
  if (result.status !== 'graph') {
    logger.debug('server_graph_hydration.no_merge', {
      scenarioId,
      outcome: result.status,
    })
    switch (result.status) {
      case 'absent':
        return 'absent'
      case 'notReadable':
        return 'notReadable'
      case 'unavailable':
        return 'unavailable'
      case 'refused':
        return 'refused'
      default:
        return 'unusable'
    }
  }

  // A canvas whose scenario changed under an in-flight read must not receive
  // another scenario's graph — the request is slower than a route change.
  const currentId = useCanvasStore.getState().currentScenarioId
  if (currentId !== null && currentId !== undefined && currentId !== scenarioId) {
    logger.warn('server_graph_hydration.scenario_moved', {
      requestedScenarioId: scenarioId,
      currentScenarioId: currentId,
    })
    return 'skipped'
  }

  const stored = useCanvasStore.getState().serverGraphIdentity
  if (isSameServerGraph(stored, result.identity)) {
    // The server has not moved since we last hydrated, so there is nothing to
    // apply. Skipping is not merely an optimisation: re-merging would roll a
    // local edit made since that hydration back to the same server value the
    // user has already been shown once.
    return 'unchanged'
  }

  mergeServerGraphOnHydrate(result.graph)

  // Store CEE's token VERBATIM — after the merge, so a throw could not leave a
  // token recorded for a graph that was never applied. `null` when CEE issued
  // none (an identity-empty graph), which never suppresses a later merge.
  useCanvasStore.getState().setServerGraphIdentity(
    result.identity
      ? {
          value: result.identity.value,
          projectionVersion: result.identity.projectionVersion,
        }
      : null,
  )

  return 'merged'
}
