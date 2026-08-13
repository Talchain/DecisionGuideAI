/**
 * MAY THIS CLIENT WRITE `scenarios.graph`?
 *
 * `scenarios.graph` is a CROSS-BOUNDARY column with two writers and one shape.
 * CEE writes `GraphV3` — `NodeV3` REQUIRES `id`/`kind`/`label`, `EdgeV3` REQUIRES
 * `from`/`to`/`strength`/`exists_probability`/`effect_direction` (CEE
 * `src/schemas/cee-v3.ts:117`, `:218`) — and CEE READS the column back with
 * `GraphV3.safeParse` on every analyse turn.
 *
 * This client holds the RAW React Flow canvas store: nodes keyed
 * `{id,type,position,measured,data}`, edges keyed `{id,source,target,type,data}`,
 * with `kind`/`label` buried inside `data`, which is not a declared key.
 * **There is no React-Flow→GraphV3 projector anywhere on the write path.** So
 * every byte this client could write is a graph CEE cannot parse.
 *
 * ── ⚠ P0, 2026-08-13 — THIS IS NOT HYPOTHETICAL ────────────────────────────
 * It took staging down for browser users. `GraphV3.safeParse` over the REAL
 * persisted bytes of scenario `197062e4` returned **116 issues, every one
 * `invalid_type`, and ZERO numeric-range issues**. The zero is what made it
 * fatal: CEE's graceful `analysis_not_ready` carve-out fires only on
 * `too_small`/`too_big` on a `number`, so execution fell through to a throw,
 * re-wrapped as `scenario_read_failed`, surfaced as **HTTP 500 on every analyse
 * turn**. `OutputsDock.tsx:963` awaits the flush barrier immediately before
 * dispatching a run, so the overwrite was not a race — it was guaranteed,
 * microseconds before every run.
 *
 * It became reachable only on 12 August: `apply_patch_and_log` is
 * `WHERE user_id = auth.uid()`, so for the guest population the write always
 * threw and never landed (`graph_saved`: zero events on every single day from
 * 20 July to 11 August, 13 on 12 August). The auth flip did not break the read —
 * it switched on a writer that had never run.
 *
 * Full derivation:
 * `olumi-docs/PHASE0-EVIDENCE-2026-07-28/analysis-500-p0-2026-08-13/DIAGNOSIS.md`
 *
 * ── WHY A MODULE, AND WHY A FUNCTION ───────────────────────────────────────
 * A MODULE, because the specs that pin the write MECHANISM — the single gated
 * RPC, single-owner autosave, the flush barrier's ordering, the unmount flush —
 * are still correct and must not be deleted just because the policy is currently
 * shut. They lift this policy explicitly (`vi.mock`) and go on proving the
 * plumbing, so when a projector lands the mechanism is already covered.
 *
 * A FUNCTION rather than a `const false`, because a boolean literal narrows and
 * would make the real write path read as unreachable code — which is how a choke
 * point gets "tidied away" by a later cleanup.
 *
 * ── WHAT UNSHUTS IT ────────────────────────────────────────────────────────
 * Either a faithful React-Flow→GraphV3 projector (derived from `NodeV3`/`EdgeV3`,
 * NOT from the symptom — writing it from the failure mode is trap 13d), or
 * routing canvas-local edits through CEE's own `edit_graph`, which matches the
 * architecture's stated intent that CEE owns the graph. At that point this
 * becomes a real check on the PROJECTED payload. Until then it must answer
 * `false`.
 */
export function clientCanWriteReadableGraph(): boolean {
  return false
}
