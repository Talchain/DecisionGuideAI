/**
 * THE OLUMI-CORE LANE: a build of DecisionGuideAI that talks to olumi-core only (`VITE_OLUMI_CORE=1`, scripts/olumi-core/env.sh).
 *
 * On this lane olumi-core serves this build on its own origin (OLUMI_UI_DIST), and the page reads the scenario through core's View and
 * writes through core's routes (src/olumiView/, src/olumiCore/team/). What olumi-core cannot honour is not offered: this module is the
 * ONE place that says so, and every surface asks it. A control that would hang or 404 on this lane is hidden or disabled here.
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
 * The right-hand dock's surfaces olumi-core has no backend for. Analysis (`results`), Reasoning (`analysisNew`, drawn from core's View
 * on this lane: src/olumiView/ViewReasoning.tsx) and the chat (`olumi`) stay. Compare (`compare`) and Version history (`versions`) are
 * shown, fed by core's own stored versions and comparison (`compare.tsx`, `versions.tsx`), never the local snapshots or CEE's run delta.
 */
// The legend and the Summary are shown: on the lane each is the View's own (src/olumiView/ViewLegend.tsx draws core's key, model.key;
// src/olumiView/ViewBrief.tsx the question, the Run and each option), never the legacy ones of legacy marks and the saved model.
// Compare and Version history are core's own (compare.tsx, versions.tsx). `lenses` is the legacy lens bar, which reads legacy node shapes
// a View card never carries (review 00057 #2): the lane's canvas draws its own, fed from the View (src/olumiView/ViewLensBar.tsx).
// `diagnostics` (Model) is the lane's own outline, drawn from the View (src/olumiView/ViewModelTab.tsx; DL 4 Nov, R2), in place of the
// legacy tab, which projects node shapes a View card does not carry (review 00002 #4).
const CEE_ONLY_SURFACES: ReadonlySet<string> = new Set(['lenses'])
/** The surfaces only this lane has: the team's panels (`team`), drawn from core's View. */
const LANE_ONLY_SURFACES: ReadonlySet<string> = new Set(['team'])
export function coreLaneShowsSurface(surfaceId: string): boolean {
  return isOlumiCoreLane() ? !CEE_ONLY_SURFACES.has(surfaceId) : !LANE_ONLY_SURFACES.has(surfaceId)
}

/**
 * SPIKE (UI restore, 11 Nov 2026; never served): on this lane, `?previous-canvas` in the address mounts the PREVIOUS product's canvas
 * (ReactFlowGraph with its own toolbar, lens bar, zoom controls and menus), fed read-only from core's View by the one adapter
 * (src/olumiView/coreViewToLegacy.ts), in place of the lane's own canvas. A look, not a feature: no write is offered through it.
 */
export function previousCanvasSpike(): boolean {
  return isOlumiCoreLane() && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('previous-canvas')
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
