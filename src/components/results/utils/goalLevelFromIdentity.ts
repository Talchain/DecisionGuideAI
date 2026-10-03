/**
 * ⭐ ISL #207 — WHOSE BASE A GOAL FIGURE STANDS ON, FAIL-CLOSED.
 *
 * A goal that states no level today is anchored on its evaluated identity; ISL says so with the
 * `GOAL_LEVEL_FROM_IDENTITY_INPUTS` code (which reaches the UI in `inference_warnings`, `field`
 * `nodes[<goal>].nonlinear_identity`) and says WHOSE base it is on the typed carrier
 * `identity_evaluations[].level_author` (R3 #72 5876843426). AIQ's rule (5876871320): with the
 * code present, the goal figure is caveated UNLESS the goal's own typed entry says
 * `level_author: "user"` — a missing entry keeps the caveat (author-neutral, `unattested`), so a hop that drops the carrier
 * (CEE's enrichment keep-list does not list `identity_evaluations` today) can never uncaveat it.
 *
 * ONE reader for every surface that holds the enrichment: the V5 mapper (the live result rows) and
 * the analysis-snapshot factory (Compare's saved runs) both call it, so a saved goal figure carries
 * the same caveat the live row showed for that run (CODEX DELIVERY LEAD #72 5879597435).
 */
export function goalLevelFromIdentityCaveat(enrichment: unknown): 'olumi' | 'unattested' | null {
  if (!isPlainObject(enrichment)) return null
  const warnings = Array.isArray(enrichment.inference_warnings) ? enrichment.inference_warnings : []
  const anchor = warnings.find(
    (w): w is Record<string, unknown> => isPlainObject(w) && w.code === 'GOAL_LEVEL_FROM_IDENTITY_INPUTS',
  )
  if (anchor === undefined) return null
  // The FULL carrier shape only (Codex CR #2280): any other field names no goal, so the caveat stays.
  const goalId =
    typeof anchor.field === 'string' ? /^nodes\[([^\]]+)\]\.nonlinear_identity$/.exec(anchor.field)?.[1] : undefined
  const entries = Array.isArray(enrichment.identity_evaluations) ? enrichment.identity_evaluations : []
  const goalEntry = entries.find(
    (e): e is Record<string, unknown> =>
      isPlainObject(e) && goalId !== undefined && e.node_id === goalId && e.level_source === 'identity_inputs',
  )
  // AIQ 5877139338 (1): never attribute authorship the carrier does not state — a missing entry is
  // `unattested` (author-neutral copy), and only a typed "olumi" says it is Olumi's.
  if (goalEntry?.level_author === 'user') return null
  return goalEntry?.level_author === 'olumi' ? 'olumi' : 'unattested'
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}
