/**
 * Scenario-ID reconciliation for the debug bundle.
 *
 * Replaces the hardcoded `session.scenario_id = null` in exportBundle.ts.
 * Pulls candidate IDs from five sources (canvas store, V5 analysis fact,
 * latest V5 payload, URL/route, full_graph metadata), applies a stable
 * preference order, and records any disagreement between sources.
 *
 * Pure module. No React, no zustand subscriptions — callers extract the
 * candidates and pass them in. Helpers below are also pure and exported
 * for direct testing.
 */

export type ScenarioIdSource =
  | 'store'
  | 'v5_fact'
  | 'payload'
  | 'url'
  | 'full_graph'
  | 'none'

export interface ScenarioIdReconciliationInputs {
  storeScenarioId: string | null
  v5FactScenarioId: string | null
  payloadScenarioId: string | null
  urlScenarioId: string | null
  fullGraphScenarioId: string | null
}

export interface ScenarioIdReconciliation {
  selected_scenario_id: string | null
  selected_source: ScenarioIdSource
  candidates: {
    store: string | null
    v5_fact: string | null
    payload: string | null
    url: string | null
    full_graph: string | null
  }
  /** Pairs of non-null candidates that disagree. Stable string format
   *  `<source_a>=<id_a> vs <source_b>=<id_b>`. */
  conflicts: string[]
}

const PREFERENCE_ORDER: ReadonlyArray<Exclude<ScenarioIdSource, 'none'>> = [
  'store',
  'v5_fact',
  'payload',
  'url',
  'full_graph',
]

/**
 * Apply the preference order and emit reconciled output. The selected ID
 * is the first non-null candidate; conflicts list every pair of non-null
 * candidates that disagree, regardless of which one was selected.
 */
export function reconcileScenarioId(
  inputs: ScenarioIdReconciliationInputs,
): ScenarioIdReconciliation {
  const candidates = {
    store: inputs.storeScenarioId,
    v5_fact: inputs.v5FactScenarioId,
    payload: inputs.payloadScenarioId,
    url: inputs.urlScenarioId,
    full_graph: inputs.fullGraphScenarioId,
  }

  let selected_scenario_id: string | null = null
  let selected_source: ScenarioIdSource = 'none'
  for (const source of PREFERENCE_ORDER) {
    const value = candidates[source]
    if (value !== null) {
      selected_scenario_id = value
      selected_source = source
      break
    }
  }

  const conflicts: string[] = []
  const present: Array<[Exclude<ScenarioIdSource, 'none'>, string]> = []
  for (const source of PREFERENCE_ORDER) {
    const value = candidates[source]
    if (value !== null) present.push([source, value])
  }
  for (let i = 0; i < present.length; i++) {
    for (let j = i + 1; j < present.length; j++) {
      if (present[i][1] !== present[j][1]) {
        conflicts.push(
          `${present[i][0]}=${present[i][1]} vs ${present[j][0]}=${present[j][1]}`,
        )
      }
    }
  }

  return {
    selected_scenario_id,
    selected_source,
    candidates,
    conflicts,
  }
}

/**
 * Walk the payload trace (most-recent-first per payload-trace-store) and
 * return the `scenario_id` field of the first V5 CEE turn request body
 * found. The V5 endpoint is `/orchestrate/v2/turn`; the body shape is
 * built by `src/v5/buildPayload.ts` and always carries `scenario_id` at
 * the root.
 */
export function extractScenarioIdFromLatestV5Payload(
  payloads: ReadonlyArray<{
    service?: string
    endpoint?: string
    request?: { body?: unknown }
  }>,
): string | null {
  for (const p of payloads) {
    const endpoint = typeof p.endpoint === 'string' ? p.endpoint : ''
    const isV5Turn =
      p.service === 'CEE' && endpoint.includes('/orchestrate/v2/turn')
    if (!isV5Turn) continue
    const body = p.request?.body
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const sid = (body as Record<string, unknown>).scenario_id
      if (typeof sid === 'string' && sid.length > 0) return sid
    }
  }
  return null
}

/**
 * Best-effort URL/route scenario-ID extraction. Looks for:
 *   - `?scenarioId=...` / `?scenario_id=...` query params
 *   - `/scenarios/<id>` or `/scenario/<id>` path segments
 * Returns null on parse failure or absence.
 */
export function extractScenarioIdFromUrl(href: string | null): string | null {
  if (!href) return null
  try {
    const url = new URL(href)
    const fromQuery =
      url.searchParams.get('scenarioId') ??
      url.searchParams.get('scenario_id')
    if (fromQuery && fromQuery.length > 0) return fromQuery
    const match = url.pathname.match(/\/scenarios?\/([^/?#]+)/i)
    if (match && match[1] && match[1].length > 0) return match[1]
    return null
  } catch {
    return null
  }
}

/**
 * Read scenario-ID from `full_graph` metadata. Today's
 * `transformGraphDataEnriched` output uses `_meta` for non-graph fields;
 * scenarioId may live there or at the root depending on export path.
 */
export function extractScenarioIdFromFullGraph(
  fullGraph: unknown,
): string | null {
  if (!fullGraph || typeof fullGraph !== 'object' || Array.isArray(fullGraph)) {
    return null
  }
  const fg = fullGraph as Record<string, unknown>

  const fromMeta = (() => {
    const meta = fg._meta
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
    const m = meta as Record<string, unknown>
    const v = m.scenarioId ?? m.scenario_id
    return typeof v === 'string' && v.length > 0 ? v : null
  })()
  if (fromMeta) return fromMeta

  const topLevel = fg.scenarioId ?? fg.scenario_id
  return typeof topLevel === 'string' && topLevel.length > 0 ? topLevel : null
}
