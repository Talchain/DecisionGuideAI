/**
 * What a person reads to approve (DL ruling, 16 Nov; live round 1: the thing to approve was 19 lines, 14 of them the person's own sentences
 * listed one by one). Core's `proposal.to_read` (additive; olumi-core src/view/changes.ts ToRead, src/view/schema.ts ProposalV3): `lines`,
 * the change lines to read one by one, in order; `groups`, their grouping where over 12 are left (else null: flat); `noted`, the person's
 * own points the proposal only notes, said in ONE line of core's words (`text`) with their lines for a show-all. All are indexes into
 * `proposal.changes`, which stays whole: the ticks and the approval read `changes`, never this.
 *
 * NO LINE IS EVER LOST: this returns core's reading only where `lines` and `noted.lines` together name every line of `changes` exactly once
 * and `groups` (where given) holds exactly `lines`. Anything else (absent from an older core or a gated viewer, or a list that does not
 * add up) is undefined, and the card draws the whole list as before.
 */
import type { View } from './client'

export type ToRead = {
  readonly lines: readonly number[]
  readonly groups: ReadonlyArray<{ readonly heading: string; readonly lines: readonly number[] }> | null
  readonly noted: { readonly text: string; readonly lines: readonly number[] } | null
}

const indexes = (x: unknown): number[] | null => (Array.isArray(x) && x.every((i) => Number.isInteger(i)) ? (x as number[]) : null)
/** Do these name exactly the members of `of`, each once? */
const exactly = (named: readonly number[], of: ReadonlySet<number>): boolean => named.length === of.size && new Set(named).size === of.size && named.every((i) => of.has(i))

export function toReadOf(p: NonNullable<View['proposal']>): ToRead | undefined {
  const t = (p as { to_read?: unknown }).to_read as { lines?: unknown; groups?: unknown; noted?: unknown } | null | undefined
  if (t == null || typeof t !== 'object') return undefined
  const lines = indexes(t.lines)
  if (lines === null) return undefined
  let noted: ToRead['noted'] = null
  if (t.noted != null) {
    const n = t.noted as { text?: unknown; lines?: unknown }, at = indexes(n.lines)
    if (typeof n.text !== 'string' || n.text === '' || at === null || at.length === 0) return undefined
    noted = { text: n.text, lines: at }
  }
  if (!exactly([...lines, ...(noted?.lines ?? [])], new Set((p.changes ?? []).map((_, i) => i)))) return undefined
  let groups: ToRead['groups'] = null
  if (t.groups != null) {
    if (!Array.isArray(t.groups)) return undefined
    const made: Array<{ heading: string; lines: number[] }> = []
    for (const g of t.groups as Array<{ heading?: unknown; lines?: unknown } | null>) {
      const at = indexes(g?.lines)
      if (g == null || typeof g.heading !== 'string' || at === null) return undefined
      made.push({ heading: g.heading, lines: at })
    }
    if (!exactly(made.flatMap((g) => g.lines), new Set(lines))) return undefined
    groups = made
  }
  return { lines, groups, noted }
}
