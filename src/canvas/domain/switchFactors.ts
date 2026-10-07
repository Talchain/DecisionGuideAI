import { BINARY_STATE_WORDS, SWITCH_STATE_WORD } from '../nodes/shared/optionChangeRows'
import { encodingMapPhrase } from '../../utils/formatFactorDisplayValue'

export interface SwitchFactorState {
  readonly ceeAnalysisReady?: unknown
  readonly servedSwitchFactorIds?: ReadonlySet<string>
}

/** Read only the producer's state words; units and numeric endpoints cannot mint a switch. */
export function switchFactorIdsOf(analysisReady: unknown): ReadonlySet<string> {
  const ids = new Set<string>()
  const options = (analysisReady as { options?: unknown } | null)?.options
  if (!Array.isArray(options)) return ids
  for (const option of options) {
    const details = option?.intervention_details
    if (!details || typeof details !== 'object' || Array.isArray(details)) continue
    for (const [id, detail] of Object.entries(details)) {
      const word = (detail as { display_value?: unknown } | null)?.display_value
      if (typeof word === 'string' && SWITCH_STATE_WORD.test(word.trim())) ids.add(id)
    }
  }
  return ids
}

export function switchReading(factorData: unknown, value: 0 | 1): string {
  return encodingMapPhrase((factorData as { encoding_map?: unknown } | null)?.encoding_map, value)
    ?? BINARY_STATE_WORDS[value]
}

export function isServedSwitch(factorId: string, state: SwitchFactorState): boolean {
  return state.servedSwitchFactorIds?.has(factorId) === true
    || switchFactorIdsOf(state.ceeAnalysisReady).has(factorId)
}

// Display context only: a symbol cannot enter JSON persistence or the graph contract.
// Readers receive this projection; stored nodes, values and provenance stay intact.
const SWITCH_CONTEXT = Symbol('servedSwitchFactor')
type DisplayData = Record<string, unknown> & { [SWITCH_CONTEXT]?: string }

export function switchFactorData<T extends Record<string, unknown>>(factorId: string, data: T, state: SwitchFactorState): T {
  if (isServedSwitch(factorId, state)) return { ...data, [SWITCH_CONTEXT]: factorId }
  if (!(SWITCH_CONTEXT in data)) return data
  const unmarked = { ...data } as T & DisplayData
  delete unmarked[SWITCH_CONTEXT]
  return unmarked
}

export function servedSwitchReading(data: unknown, value?: unknown): string | null {
  const d = data as DisplayData | null | undefined
  if (!d?.[SWITCH_CONTEXT]) return null
  const observed = (d.observedState ?? d.observed_state) as { value?: unknown } | undefined
  const v = value === undefined ? observed?.value : value
  return v === 0 || v === 1 ? switchReading(d, v) : null
}

export function switchFactorNodes<T extends { id: string; type?: string; data?: Record<string, unknown> }>(nodes: readonly T[], state: SwitchFactorState): T[] {
  const ids = new Set([...switchFactorIdsOf(state.ceeAnalysisReady), ...(state.servedSwitchFactorIds ?? [])])
  return nodes.map(node => {
    if ((node.type ?? node.data?.type ?? node.data?.kind) !== 'factor' || !node.data) return node
    const data = switchFactorData(node.id, node.data, { servedSwitchFactorIds: ids })
    return data === node.data ? node : { ...node, data }
  })
}
