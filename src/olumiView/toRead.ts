/** The review's reading order, as core serves it: see `toReadOf`. Pure; nothing here ranks or words a change. */
import type { View } from './client'

type Proposal = NonNullable<View['proposal']>

/**
 * How core says the proposal reads (`proposal.to_read`, olumi.view/3 additive, core src/view/changes.ts ToRead): `lines` to read one by one, in core's
 * order; `groups` of those where over 12 remain (else null); `noted`: the person's own points the proposal only notes, core's ONE sentence and their lines.
 * Indices into `changes`. Used only where it is a whole split of `changes` (every index in exactly one of `lines` and `noted.lines`, and the groups exactly
 * `lines`), so no change is ever left out of sight; anything else (absent from an older core or a gated viewer, or malformed) is null: today's list.
 */
export type ToRead = { readonly lines: readonly number[]; readonly groups: readonly { heading: string; lines: number[] }[] | null; readonly noted: { readonly text: string; readonly lines: readonly number[] } | null }
export function toReadOf(p: Proposal, n: number): ToRead | null {
  const t = (p as { to_read?: unknown }).to_read as { lines?: unknown; groups?: unknown; noted?: unknown } | null | undefined
  if (t == null || typeof t !== 'object') return null
  const idx = (x: unknown): x is number[] => Array.isArray(x) && x.every((i) => Number.isInteger(i) && i >= 0 && i < n)
  const once = (xs: readonly number[]) => new Set(xs).size === xs.length
  if (!idx(t.lines)) return null
  const nr = t.noted as { text?: unknown; lines?: unknown } | null | undefined
  if (nr != null && (typeof nr.text !== 'string' || nr.text === '' || !idx(nr.lines))) return null
  const noted = nr == null || (nr.lines as number[]).length === 0 ? null : { text: nr.text as string, lines: nr.lines as number[] }
  const all = [...t.lines, ...(noted?.lines ?? [])]
  if (all.length !== n || !once(all)) return null
  let groups: { heading: string; lines: number[] }[] | null = null
  if (t.groups != null) {
    if (!Array.isArray(t.groups)) return null
    groups = []
    for (const g of t.groups as Array<{ heading?: unknown; lines?: unknown } | null>) {
      if (g == null || typeof g.heading !== 'string' || !idx(g.lines)) return null
      groups.push({ heading: g.heading, lines: g.lines })
    }
    const inGroups = groups.flatMap((g) => g.lines), shown = new Set(t.lines)
    if (inGroups.length !== t.lines.length || !once(inGroups) || !inGroups.every((i) => shown.has(i))) return null
  }
  return { lines: t.lines, groups, noted }
}
