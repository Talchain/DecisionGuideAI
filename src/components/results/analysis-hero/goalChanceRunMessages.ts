import type { GoalChanceDriver } from '../utils/goalChanceLicence'
import type { GoalChanceTarget } from '../utils/goalChanceTarget'
import { unsizedLinksOf } from '../analysisNew/analysisNewCopy'

type Warning = Record<string, unknown>
const isRecord = (value: unknown): value is Warning => !!value && typeof value === 'object' && !Array.isArray(value)
const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
  : isRecord(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value

/** Code and target/link identities survive reordered carriers and different prose. */
function messageIdentity(warning: Warning): string {
  const listed = Array.isArray(warning.links) ? warning.links.filter(isRecord).flatMap(link =>
    typeof link.from === 'string' && typeof link.to === 'string' ? [[link.from, link.to]] : []) : []
  const ids = Array.isArray(warning.node_ids) ? warning.node_ids.filter(id => typeof id === 'string') : []
  const links = listed.length ? listed : ids.length >= 2 ? [[ids[0], ids[1]]] : []
  return JSON.stringify([warning.code, warning.goal_node_id ?? null, stable(warning.target ?? null),
    [...new Set(links.map(link => JSON.stringify(link)))].sort(), links.length ? [] : [...ids].sort()])
}

/** Warning identity, rather than prose, owns a Run-wide placeholder message. */
export function goalChanceRunMessages(
  warnings: unknown, designation?: { cause?: string | null; text: string | null },
): { lines: Array<{ text: string; identity: string }>; ownsDesignation: boolean } {
  if (!Array.isArray(warnings)) return { lines: [], ownsDesignation: false }
  const placeholders = warnings.filter(isRecord).filter(w => w.code === 'GOAL_FIGURES_PLACEHOLDER_PATH'
    && typeof w.message === 'string' && w.message.trim() !== '')
  // winShareGate's unsizedAwareCause uses the first placeholder warning for these two typed causes.
  const ownsDesignation = placeholders.length > 0 && !!designation?.text
    && (designation.cause === 'goal_path_unsized'
      || (designation.cause === 'separation_unavailable' && unsizedLinksOf(warnings).length > 0))
  const candidates = [...placeholders, ...(ownsDesignation ? [{ ...placeholders[0], message: designation!.text }] : [])]
  const seen = new Set<string>()
  const lines = candidates.flatMap(warning => {
    const identity = messageIdentity(warning)
    if (seen.has(identity)) return []
    seen.add(identity)
    return [{ text: warning.message as string, identity }]
  })
  return { lines, ownsDesignation }
}

/** Only an identical rendering of the same typed link/target warning aliases a driver; shared links alone do not. */
export function goalChanceDriverRunMessageIdentity(
  driver: GoalChanceDriver | undefined, target: GoalChanceTarget, text: string, warnings: unknown,
): string | null {
  if (!driver || driver.kind === 'factor_value' || !Array.isArray(warnings)) return null
  const linkKey = JSON.stringify([driver.from, driver.to])
  for (const warning of warnings.filter(isRecord)) {
    if (warning.code !== 'GOAL_FIGURES_PLACEHOLDER_PATH') continue
    const links = Array.isArray(warning.links) ? warning.links.filter(isRecord) : []
    const ids = Array.isArray(warning.node_ids) ? warning.node_ids : []
    const keys = [...new Set((links.length ? links.map(link => [link.from, link.to])
      : ids.length >= 2 ? [[ids[0], ids[1]]] : []).map(link => JSON.stringify(link)))]
    if (keys.length !== 1 || keys[0] !== linkKey) continue
    if (warning.target !== undefined && JSON.stringify(stable(warning.target)) !== JSON.stringify(stable(target))) continue
    // Equality is the alias admission check, never the dedupe key: another wording retains the same warning identity.
    if (warning.message === text) return messageIdentity(warning)
  }
  return null
}
