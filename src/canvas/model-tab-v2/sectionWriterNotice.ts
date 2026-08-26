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
 *   `mutationAuthority.ts` declares `modelOptionIntervention: 'disabled'`
 *      → `hasServerGraphAuthority` false
 *      → `OPTION_INTERVENTION_CONNECTED` false (`ModelTabV2Panel.tsx`)
 *      → `editConnectedIds` contains FACTORS ONLY (`ModelTabV2Panel.tsx`)
 *      → the row's value cell falls to `<span>{display ?? ''}</span>`
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
 * ⭐ SELF-RETIRING BY CONSTRUCTION, which is the property that matters most.
 * The second conjunct reads the SAME `editConnectedIds` the row's value cell
 * reads, so the notice and the control cannot disagree about what is editable.
 * When `modelOptionIntervention` becomes `server_graph`, options enter that set
 * and this returns empty — the notice disappears with no one remembering to
 * delete it. A notice that outlives its cause is the defect it was written to
 * fix, wearing the opposite sign.
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
