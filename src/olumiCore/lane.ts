/**
 * THE OLUMI-CORE LANE: a build of DecisionGuideAI that talks to olumi-core only (`VITE_OLUMI_CORE=1`, scripts/olumi-core/env.sh).
 *
 * On this lane the backend is `scripts/olumi-core/server.mjs`, which answers DGAI's chat turn and saved-model read from
 * olumi-core's REST API. What olumi-core cannot honour is not offered: this module is the ONE place that says so, and every
 * surface asks it. A control that would hang or 404 on this lane is hidden or disabled here, never left to fail.
 *
 * What olumi-core honours from the canvas:
 *   - a figure the person types (its own /edit route, applied at once as their figure; Olumi replies);
 *   - everything said in the chat (a message, a card press, a challenge).
 * What it does not (so the canvas does not offer it): adding, deleting or renaming an element, linking or unlinking, an edge's
 * strength, an option's status or settings, an aim's target. Those are said in the chat, where Olumi proposes them as a card.
 */
export type CoreLaneWrite =
  | 'figure'     // a typed figure on a factor: honoured
  | 'structure'  // add, delete, rename, link, unlink, strength, option status/settings, goal target: not honoured

const HONOURED: ReadonlySet<CoreLaneWrite> = new Set<CoreLaneWrite>(['figure'])

export function isOlumiCoreLane(): boolean {
  return import.meta.env.VITE_OLUMI_CORE === '1'
}

/** May the canvas offer this write? Always true off the lane (nothing changes there). */
export function coreLaneAllows(write: CoreLaneWrite): boolean {
  return !isOlumiCoreLane() || HONOURED.has(write)
}

/** The words for a control that is on the page but cannot act on this lane. */
export const CORE_LANE_USE_THE_CHAT = 'Tell Olumi in the chat what to change; it will propose it for you to confirm.'

/**
 * The right-hand dock's surfaces olumi-core has no backend for. `analysisNew` is "Reasoning" and `compare` is "Compare": both
 * read CEE routes that do not exist here. Analysis (`results`), the model outline (`diagnostics`) and the chat (`olumi`) stay.
 */
// `legend` explains marks a View card never draws (each mark carries core's own hover); `summary` builds the brief from the
// adapter's saved model, which this lane does not read (canvas A S6, gaps B8 and C7); `versions` snapshot and restore View cards
// locally, which core never sees (lane audit 7.5).
const CEE_ONLY_SURFACES: ReadonlySet<string> = new Set(['analysisNew', 'compare', 'legend', 'summary', 'versions'])
/** The surfaces only this lane has: the team's panels (`team`), which read olumi-core's scenario view. */
const LANE_ONLY_SURFACES: ReadonlySet<string> = new Set(['team'])
export function coreLaneShowsSurface(surfaceId: string): boolean {
  return isOlumiCoreLane() ? !CEE_ONLY_SURFACES.has(surfaceId) : !LANE_ONLY_SURFACES.has(surfaceId)
}

/**
 * Accounts. On this lane a person is who their private link says (olumi-core's own, opened at `/k/<token>`), and the page was
 * opened for exactly one of them. There is no Supabase behind this build (its address is dead on purpose), so the account chrome
 * (sign in, sign out, profile settings, delete account, "My scenarios", shared versions that need a signed-in session) cannot work:
 * it is not offered, and the routes that lead to it go to the canvas.
 */
export function coreLaneHasAccounts(): boolean {
  return !isOlumiCoreLane()
}

/** Who this page was opened for (set by the server before DGAI starts, `lib/tab.js`), or null off the lane / before it is set. */
export function coreLanePerson(): { readonly id: string; readonly name: string } | null {
  if (!isOlumiCoreLane() || typeof window === 'undefined') return null
  const person = (window as unknown as { __OLUMI_CORE__?: { person?: { id?: unknown; name?: unknown } } }).__OLUMI_CORE__?.person
  return person && typeof person.id === 'string' && typeof person.name === 'string' ? { id: person.id, name: person.name } : null
}
