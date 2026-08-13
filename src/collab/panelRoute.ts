/**
 * COLLAB — the one place the owner-panel href is built.
 *
 * The app is a HashRouter, so an in-app link to the blind-panel owner page is
 * a hash href. Spelling `#/scenario/<id>/panel` at each call site would be a
 * hand-maintained mirror of the route table; this helper is the single
 * spelling, and `__tests__/panelRoute.spec.ts` binds it to the route AppPoC
 * actually declares (derived from the source, not retyped), so a route move
 * REDs the suite instead of stranding the entry point on a dead href.
 *
 * ── THE PREFILL (capability A's one new hop) ──────────────────────────────
 * "Ask a teammate" on an unresolved estimate row lands the owner here with
 * the target already named: `{factorId, label, unit}` ride the HASH QUERY
 * (`#/scenario/<id>/panel?factor=…&label=…&unit=…`). The HashRouter parses
 * everything after `#` as a full location, so `useLocation().search` carries
 * the query and the ROUTE PATTERN IS UNCHANGED — a bare hash is still every
 * existing caller's href, byte-identical.
 *
 * Producer (`ownerPanelHash`) and consumer (`readPanelPrefill`) live in this
 * one module so the two spellings of the query keys cannot drift (trap 12).
 *
 * ⚠ NOTE WHAT THE PREFILL CANNOT CARRY: a value. The type has no value field,
 * `panelRoutePrefill.spec.ts` pins the key manifest, and CEE's `parseTargets`
 * structurally refuses value-bearing fields at the mint anyway — blindness is
 * inherited from the round machinery, never re-implemented here.
 */

export interface PanelPrefill {
  /** The factor the round is about — the model's own id (`row.nodeId` is the wire factor id). */
  factorId: string
  /** Initial wording for the panel (the setup page's label field). Null = owner writes their own. */
  label: string | null
  /**
   * The factor's display unit, identity-bound to `factorId`: the setup page
   * carries it into the mint's `targets[0].unit` ONLY while the target id
   * still names this factor.
   */
  unit: string | null
}

/** Trimmed-non-empty, or null — blank strings never ride the query. */
function presence(value: string | null | undefined): string | null {
  if (value == null) return null
  return value.trim() === '' ? null : value
}

export function ownerPanelHash(scenarioId: string, prefill?: PanelPrefill): string {
  const base = `#/scenario/${encodeURIComponent(scenarioId)}/panel`
  // A prefill with no target is no prefill: the bare href is the honest form.
  if (prefill === undefined || presence(prefill.factorId) === null) return base
  const query = new URLSearchParams()
  query.set('factor', prefill.factorId)
  const label = presence(prefill.label)
  if (label !== null) query.set('label', label)
  const unit = presence(prefill.unit)
  if (unit !== null) query.set('unit', unit)
  return `${base}?${query.toString()}`
}

/**
 * Read the prefill back from `useLocation().search` (leading `?` optional).
 * Null when there is no usable prefill — the bare hash keeps working, and
 * label/unit without a factor are not a prefill (they would describe nothing).
 */
export function readPanelPrefill(search: string): PanelPrefill | null {
  const query = new URLSearchParams(search)
  const factorId = presence(query.get('factor'))
  if (factorId === null) return null
  return {
    factorId,
    label: presence(query.get('label')),
    unit: presence(query.get('unit')),
  }
}
