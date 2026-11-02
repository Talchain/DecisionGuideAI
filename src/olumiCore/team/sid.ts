/**
 * Which olumi-core scenario is this page's scenario? DGAI names a scenario by a UUID. Core's own id (`s_<12 hex>`) has a reversible
 * UUID form (`00000000-0000-4000-8000-<12 hex>`, the same rule as scripts/olumi-core/lib/ids.mjs), and a scenario this browser
 * started itself has a random UUID whose pairing the PAGE keeps in its own storage (lib/tab.js, key `olumi-core-sc:<uuid>`).
 * Nothing is remembered here: both answers are read where they live.
 */
const DERIVED = /^00000000-0000-4000-8000-([0-9a-f]{12})$/i
const PAIRING_KEY = 'olumi-core-sc:'
const SID = /^s_[0-9a-f]+$/

function readPairing(uuid: string): string | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(PAIRING_KEY + uuid) } catch { return null }
}

/** The core scenario id for a DGAI scenario UUID, or null when this page does not know one (a scenario core has not made yet). */
export function coreScenarioIdOf(uuid: string | null | undefined, read: (uuid: string) => string | null = readPairing): string | null {
  if (typeof uuid !== 'string' || uuid === '') return null
  const paired = read(uuid)
  if (typeof paired === 'string' && SID.test(paired)) return paired
  const derived = DERIVED.exec(uuid)
  return derived ? `s_${derived[1]!.toLowerCase()}` : null
}

/** The UUID form of core's scenario id (the same rule as scripts/olumi-core/lib/ids.mjs `derivedUuidOfSid`), or null for another id. */
export function derivedUuidOf(sid: string): string | null {
  const m = /^s_([0-9a-f]{12})$/.exec(sid)
  return m ? `00000000-0000-4000-8000-${m[1]}` : null
}

/** Keep, in the page's storage, that this page's scenario UUID is core's `sid` (a brief this page sent made it). False when it cannot be kept. */
export function pairCoreScenario(uuid: string, sid: string): boolean {
  try { if (typeof localStorage === 'undefined') return false; localStorage.setItem(PAIRING_KEY + uuid, sid); return true } catch { return false }
}
