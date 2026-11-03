/**
 * Which olumi-core scenario is this page's scenario? DGAI names a scenario by a UUID; core's own id (`s_<12 hex>`) has one reversible
 * UUID form (`00000000-0000-4000-8000-<12 hex>`), and that form is the scenario's address on this lane (`/scenario/<uuid>`). Nothing is
 * remembered in the browser, so the same address opens the same scenario for every member, in any browser.
 */
const DERIVED = /^00000000-0000-4000-8000-([0-9a-f]{12})$/i

/** The core scenario id for a DGAI scenario UUID, or null for any other UUID (a scenario core has not made yet). */
export function coreScenarioIdOf(uuid: string | null | undefined): string | null {
  const derived = typeof uuid === 'string' ? DERIVED.exec(uuid) : null
  return derived ? `s_${derived[1]!.toLowerCase()}` : null
}

/** The UUID form of core's scenario id, or null for another id. */
export function derivedUuidOf(sid: string): string | null {
  const m = /^s_([0-9a-f]{12})$/.exec(sid)
  return m ? `00000000-0000-4000-8000-${m[1]}` : null
}
