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
