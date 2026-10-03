import { classifyObservedValueProvenance } from '../../../canvas/domain/valueProvenance'
import { materialParameterCensus } from './materialParametersAwaitingUser'

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec | undefined => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Rec : undefined
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const UNAVAILABLE = 'The sources of this comparison’s factor starting values are unavailable.'
const COVERAGE = 'These are factor starting values on the comparison’s paths. Other model assumptions may also affect this comparison.'

/** Disclosure from existing fields. The caller owns displayed-run identity and permission. */
export function conditionalInputBasis(nodes: readonly unknown[] | undefined, admission: unknown, analysedOptionIds: readonly string[]): string | null {
  const ids = materialParameterCensus(admission)
  if (ids === null) return UNAVAILABLE
  if (ids.length === 0) return null
  if (nodes === undefined) return UNAVAILABLE
  const entries = nodes.map(rec).filter((n): n is Rec => n !== undefined)
  const options = analysedOptionIds.map((id) => entries.find((n) => (n.type ?? n.kind) === 'option' && n.id === id))
  if (options.length === 0 || options.some((n) => n === undefined)) return UNAVAILABLE
  const estimates: string[] = []; const unrecorded: string[] = []
  for (const id of new Set(ids)) {
    const node = entries.find((n) => n.id === id)
    const data = rec(node?.data) ?? node
    if ((node?.type ?? node?.kind) !== 'factor' || typeof data?.label !== 'string' || data.label.trim() === '') return UNAVAILABLE
    if (options.every((o) => {
      const entry = (rec(rec(o?.data)?.interventions) ?? rec(o?.interventions))?.[id]
      return finite(entry) || finite(rec(entry)?.value)
    })) continue
    const state = rec(data.observedState ?? data.observed_state)
    if (state === undefined || (!finite(state.raw_value) && !finite(state.value))) return UNAVAILABLE
    const origin = classifyObservedValueProvenance(state)
    const name = `"${data.label.trim()}"`
    // Confirming an existing Olumi figure changes its review, not its original author.
    if (state.source === 'user_confirmed' || origin?.kind === 'accepted' || origin?.kind === 'ai') estimates.push(name)
    else if (origin === null) unrecorded.push(name)
  }
  const lines = [
    ...(estimates.length > 0 ? [`This comparison uses Olumi’s estimates for ${estimates.join(', ')}.`] : []),
    ...unrecorded.map((name) => `${name}: source unrecorded.`),
  ]
  return lines.length === 0 ? null : `${lines.join(' ')} ${COVERAGE}`
}
