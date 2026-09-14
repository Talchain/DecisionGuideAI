/**
 * A SECTION THAT DISPLAYS A BLOCKER MUST NAME WHAT CAN RESOLVE IT.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS, AND WHY IT IS A NOTICE RATHER THAN A CONTROL
 * ═══════════════════════════════════════════════════════════════════════════
 * The OPTIONS section renders `missing-intervention` markers and offers no
 * control that can clear them. Established before writing any of this, and it
 * is NOT an oversight:
 *
 *   ~~`mutationAuthority.ts` declares `modelOptionIntervention: 'disabled'`~~
 *      ~~→ `hasServerGraphAuthority` false~~
 *      ~~→ `OPTION_INTERVENTION_CONNECTED` false (`ModelTabV2Panel.tsx`)~~
 *      → `editConnectedIds` contains FACTORS, the GOAL and ASSERTABLE EDGES —
 *        never options, on ANY authority value (`ModelTabV2Panel.tsx:444-452`)
 *      → the row's value cell falls to `<span>{display ?? ''}</span>`
 *
 * ⚠⚠ THE FIRST THREE LINKS ARE STALE AND ARE STRUCK RATHER THAN DELETED — the
 * CONCLUSION survives and the REASON changed, which is exactly the case where
 * quietly rewriting the chain would rob the next reader of the correction.
 * `modelOptionIntervention` is now `'server_graph'`, so
 * `OPTION_INTERVENTION_CONNECTED` is TRUE. The notice still fires — for a
 * different reason than this file recorded.
 *
 * ⭐ ONE DECLARATION, TWO SYMPTOMS: that same line is why the option INSPECTOR
 * sits inside a `<fieldset disabled>`. Two separate investigations chased those
 * as unrelated dead ends; they are the same fact.
 *
 * So there is no writer for an option intervention anywhere in the product
 * except a typed sentence to Olumi. **A control here would be a surface with no
 * writer** — the thing the standing direction forbids. The honest repair is for
 * the section to say so and point at what does work.
 *
 * ⚠ IT DOES NOT REUSE `SHARED_MODEL_AUTHORITY_COPY`, AND THAT IS DELIBERATE.
 * That constant reads *"Change this through the Model tab or ask Olumi…"* —
 * correct on the canvas, CIRCULAR here, because the Model tab is precisely the
 * surface that just failed the user. A notice that points back at itself is
 * worse than silence.
 *
 * ⚠ SECTION-LEVEL, NEVER PER-ROW. `ModelRowView`'s NOT SET WALL rule — *"'Not
 * set' is printed only where it is ACTIONABLE; where nothing can be done from
 * this cell, the cell is SILENT"* — is correct and is left intact. A per-row
 * string would rebuild the wall of identical inert text that rule removed. One
 * sentence for the group; the rows stay silent.
 */

import type { GroupAction } from './groupActions'
import type { ModelGroupId, ModelRow } from './types'

/** The testid for one section's notice. ID-addressed, never label-derived. */
export function SECTION_WRITER_NOTICE_TESTID(group: ModelGroupId): string {
  return `model-group-v2-${group}-writer-notice`
}

/**
 * The rows this section DISPLAYS a blocker for and CANNOT resolve.
 *
 * ⭐ CONSISTENT BY CONSTRUCTION. The second conjunct reads the SAME
 * `editConnectedIds` the row's value cell reads, so the notice and the control
 * cannot disagree about what is editable. That property is real and unchanged.
 *
 * ⚠⚠ BUT IT IS NOT SELF-RETIRING, AND THIS PARAGRAPH PROMISED THAT IT WAS:
 *
 *   ~~"When `modelOptionIntervention` becomes `server_graph`, options enter that
 *     set and this returns empty — the notice disappears with no one remembering
 *     to delete it."~~
 *
 * `modelOptionIntervention` BECAME `server_graph`. Nothing disappeared. The
 * mechanism the promise named does not exist: `editConnectedIds`
 * (`ModelTabV2Panel.tsx:444-452`) adds factors, the goal and assertable edges,
 * and has NO OPTION BRANCH AT ALL — so options cannot enter that set whatever
 * the authority key says. The stated trigger fired and the guard did not move.
 *
 * ⭐ WHAT WOULD ACTUALLY RETIRE IT, stated so the next lane does not inherit the
 * wrong condition: something on this surface that can ADD an intervention. The
 * detail region's editor changes the MAGNITUDE of an EXISTING one — it renders
 * behind `interventions.length > 0` — and a `missing-intervention` row has none
 * by definition. So the notice's SENTENCE remains true; only its account of its
 * own ending was wrong.
 *
 * `__tests__/theNoticeCannotSelfRetire.spec.ts` derives the authority value at
 * run time and REDs if this prose contradicts the table again — the check the
 * promise never had, which is why it could rot unobserved.
 *
 * `undefined` means "this host connects everything" — the same convention
 * `ModelOutline` already applies at the row cell, so a host without the concept
 * behaves exactly as it does today.
 */
export function rowsThisSectionCannotResolve(
  rows: readonly ModelRow[],
  editConnectedIds: ReadonlySet<string> | undefined,
): readonly string[] {
  if (editConnectedIds === undefined) return []
  return rows
    .filter(
      r =>
        r.attention.includes('missing-intervention') && !editConnectedIds.has(r.id),
    )
    .map(r => r.id)
}

/**
 * The sentence. It states the blocker, admits this section cannot clear it, and
 * names the affordance ALREADY on screen — quoting the action's own label
 * rather than a re-typed copy, so a rename cannot leave the notice pointing at
 * a control the user can no longer find (trap 12).
 */
export function sectionWriterNoticeText(count: number, discussLabel: string): string {
  const subject = count === 1 ? 'One of these has' : `${count} of these have`
  return `${subject} no effect on any factor yet, and that cannot be set from this section. Use "${discussLabel}" below.`
}

/** The `discuss` action for a group, or `null` when it has none. */
export function discussActionFor(
  actions: readonly GroupAction[] | undefined,
): GroupAction | null {
  return actions?.find(a => a.intent === 'discuss') ?? null
}
