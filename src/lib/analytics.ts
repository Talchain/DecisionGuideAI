const DEBUG = (import.meta as any)?.env?.VITE_DEBUG_BOARD === 'true'

let forceProdSchema = false // test override
let forceProdMode: 'mirror' | 'replace' | null = null
const testBuffer: Array<{ event: string; props: Record<string, unknown> }> = []
const seenKeys = new Set<string>()

const mapping: Record<string, string> = {
  // Core
  sandbox_trigger: 'decision_trigger_fired',
  sandbox_alignment: 'alignment_updated',
  sandbox_delta_reapply: 'delta_reapplied',
  sandbox_projection: 'kr_projection_updated',
  sandbox_rival_edit: 'rival_edit',
  sandbox_panel: 'panel_view_changed',
  history_archived: 'projections_history_archived',
  // Lifecycle (dev == prd canonical already)
  trigger_debounced: 'trigger_debounced',
  trigger_evaluation_cycle: 'trigger_evaluation_cycle',
  trigger_cooldown_started: 'trigger_cooldown_started',
}

function toProdProps(props: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = { ...props }
  // Common field renames
  if ('decisionId' in out) { out.decision_id = out.decisionId; out.board_id = out.decisionId }
  if ('ts' in out) { out.client_ts = out.ts }
  // Best-effort user id (none in sandbox)
  if (!('user_id' in out)) out.user_id = null
  return out
}

export function mapToProd(event: string, props: Record<string, unknown> = {}, mode: 'mirror' | 'replace'): Array<{ event: string; props: Record<string, unknown> }> {
  const mapped = mapping[event]
  if (!mapped) {
    // No mapping: always emit dev name regardless of mode
    return [{ event, props }]
  }
  if (mode === 'replace') {
    return [{ event: mapped, props: toProdProps(props) }]
  }
  // mirror
  return [
    { event, props },
    { event: mapped, props: toProdProps(props) },
  ]
}

export function track(event: string, props?: Record<string, unknown>) {
  const p = props ?? {}
  const prodEnabled = forceProdSchema || ((import.meta as any)?.env?.VITE_ANALYTICS_PROD_SCHEMA === 'true')
  const envMode = (import.meta as any)?.env?.VITE_ANALYTICS_PROD_SCHEMA_MODE as any
  const defaultMode: 'mirror' | 'replace' = ((import.meta as any)?.env?.PROD === true) ? 'replace' : 'mirror'
  const mode: 'mirror' | 'replace' = (forceProdMode ?? envMode ?? defaultMode) === 'replace' ? 'replace' : 'mirror'
  if (DEBUG && typeof console !== 'undefined' && console.info) {
    console.info('[analytics]', event, p)
  }
  const pairs: Array<{ event: string; props: Record<string, unknown> }> = (() => {
    if (!prodEnabled) return [{ event, props: p }]
    return mapToProd(event, p, mode)
  })()
  for (const pair of pairs) {
    try {
      if (typeof window !== 'undefined') {
        const key = `${pair.event}|${(pair.props as any).decision_id ?? (pair.props as any).decisionId ?? ''}|${(pair.props as any).client_ts ?? (pair.props as any).ts ?? ''}`
        if (!seenKeys.has(key)) { testBuffer.push({ event: pair.event, props: pair.props }); seenKeys.add(key) }
      }
    } catch {}
    if (DEBUG && typeof console !== 'undefined' && console.info && pair.event !== event) {
      console.info('[analytics:prod]', pair.event, pair.props)
    }
  }
}

// Scenario Sandbox: segmented control change within the Model view
export function model_segment_changed(segment: 'Options' | 'Probabilities') {
  track('model_segment_changed', { segment })
}

// Test helpers
export function __setProdSchemaForTest(v: boolean) { forceProdSchema = v }
export function __setProdSchemaModeForTest(m: 'mirror' | 'replace' | null) { forceProdMode = m }
export function __getTestBuffer() { return [...testBuffer] }
export function __clearTestBuffer() { testBuffer.length = 0; seenKeys.clear() }
