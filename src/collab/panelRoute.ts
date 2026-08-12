/**
 * COLLAB — the one place the owner-panel href is built.
 *
 * The app is a HashRouter, so an in-app link to the blind-panel owner page is
 * a hash href. Spelling `#/scenario/<id>/panel` at each call site would be a
 * hand-maintained mirror of the route table; this helper is the single
 * spelling, and `__tests__/panelRoute.spec.ts` binds it to the route AppPoC
 * actually declares (derived from the source, not retyped), so a route move
 * REDs the suite instead of stranding the entry point on a dead href.
 */
export function ownerPanelHash(scenarioId: string): string {
  return `#/scenario/${encodeURIComponent(scenarioId)}/panel`
}
