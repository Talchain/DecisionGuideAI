/**
 * Identity of things, derived rather than remembered, so the server holds no state a restart or a second browser can lose.
 *
 * - A scenario: olumi-core's `s_<12 hex>` has a reversible UUID form, which DGAI's UUID gate (`isCeeAddressableScenarioId`)
 *   accepts. A scenario the browser started itself has the random UUID DGAI minted before core knew of it: that pairing
 *   (an "alias") lives in a cookie of the browser that made it, never on the server.
 * - A held card, a turn, a revision: hashes of what they name.
 */
import crypto from 'node:crypto'

export const hex = (s, n) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, n)

const DERIVED = /^00000000-0000-4000-8000-([0-9a-f]{12})$/
const SID = /^s_([0-9a-f]{12})$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isUuid = (v) => typeof v === 'string' && UUID.test(v)
export const isSid = (v) => typeof v === 'string' && /^s_[0-9a-f]+$/.test(v)

/** The UUID form of a core scenario id (reversible, no lookup). */
export function derivedUuidOfSid(sid) {
  const m = SID.exec(sid)
  return m ? `00000000-0000-4000-8000-${m[1]}` : null
}

/** An alias map is a list of [uuid, sid] pairs, newest last. */
export function sidOfUuid(uuid, aliases = []) {
  const found = aliases.find(([u]) => u === uuid)
  if (found) return found[1]
  const m = DERIVED.exec(String(uuid))
  return m ? `s_${m[1]}` : null
}

/** The UUID this browser should use for a scenario: the alias it already knows, else the derived form. */
export function uuidOfSid(sid, aliases = []) {
  const found = [...aliases].reverse().find(([, s]) => s === sid)
  return found ? found[0] : derivedUuidOfSid(sid)
}

export const MAX_ALIASES = 12
export function withAlias(aliases, uuid, sid) {
  const rest = aliases.filter(([u, s]) => u !== uuid && s !== sid)
  return [...rest, [uuid, sid]].slice(-MAX_ALIASES)
}

/** The cookie value for an alias map, and back. Anything malformed is an empty map. */
export const encodeAliases = (aliases) => Buffer.from(JSON.stringify(aliases), 'utf8').toString('base64url')
export function decodeAliases(raw) {
  try {
    const v = JSON.parse(Buffer.from(String(raw ?? ''), 'base64url').toString('utf8'))
    return Array.isArray(v) ? v.filter((p) => Array.isArray(p) && isUuid(p[0]) && isSid(p[1])).map((p) => [p[0], p[1]]).slice(-MAX_ALIASES) : []
  } catch { return [] }
}

/** Parse a Cookie header into a plain object (first value wins). */
export function parseCookies(header) {
  const out = {}
  for (const part of String(header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    if (k && !(k in out)) { try { out[k] = decodeURIComponent(part.slice(i + 1).trim()) } catch { out[k] = part.slice(i + 1).trim() } }
  }
  return out
}

/** A held card's id: stable for one core proposal, so approve and decline need no memory of having issued it. */
export const propIdOf = (sid, coreId) => `prop_${hex(`${sid}:${coreId}`, 32)}`
/** The turn a core chat row stands for when the thread is read back (a UUID-shaped hash). */
export function turnIdOf(sid, chatId) {
  const h = hex(`turn:${sid}:${chatId}`, 32)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}
/** The run a version's results belong to: DGAI adopts a Run's view only when the turn names the same id (`mp_run_<n>_<12 hex>`). */
export const runIdOf = (version) => `mp_run_${version.n}_${hex(version.id, 12)}`

/** The 16-hex freshness token and the 64-hex content identity of what is saved or held now. */
const stamp = (view) => `${view.id}|${view.version?.id ?? 'none'}|${view.pending?.id ?? 'none'}`
export const rev16 = (view) => hex(stamp(view), 16)
/** The same token for the SAVED model alone, as it stands before any waiting change: the identity of what the Run was run on. */
export const revSaved16 = (view) => hex(stamp({ ...view, pending: null }), 16)
export const rev64 = (view) => hex(`${stamp(view)}|content`, 64)
