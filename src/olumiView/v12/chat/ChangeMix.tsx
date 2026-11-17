/**
 * The proposal strip's change mix (17 Nov, calm panel mock v2): a small stacked bar, one segment per kind of change in the proposal, each in that kind's
 * own colour token, as wide as its share of the changes. The kind is core's own `proposal.changes[].family`; a family with no card-kind shape
 * (a claim, a condition, a relation, ...) is drawn in the neutral border token, never a new colour. Its text alternative names each kind with the count the bar
 * draws for it (core's own family names); the changes' words are the list under Review.
 * Nothing is drawn for a proposal whose changes carry no family (an older core).
 */
import type { View } from '../../client'

type Changes = NonNullable<NonNullable<View['proposal']>['changes']>

/** The tokens NodeShapeIndicator draws each card kind with (option, goal, factor, risk, constraint), by the change's family. */
export const FAMILY_FILL: Readonly<Record<string, string>> = { option: 'var(--option)', goal: 'var(--goal)', quantity: 'var(--factor)', risk: 'var(--danger)', limit: 'var(--text-light)' }
export const OTHER_FILL = 'var(--border-emphasis)'

export function mixOf(changes: Changes | undefined): { family: string; n: number }[] {
  const by = new Map<string, number>()
  for (const c of changes ?? []) if (typeof c.family === 'string' && c.family !== '') by.set(c.family, (by.get(c.family) ?? 0) + 1)
  return [...by].map(([family, n]) => ({ family, n }))
}

/** The bar in words: each kind of change core names, with how many of the proposal's changes are of that kind. */
export const mixWords = (mix: readonly { family: string; n: number }[]): string => `Kinds of change: ${mix.map((m) => `${m.family} ${m.n}`).join(', ')}`

export function ChangeMix({ changes }: { changes: Changes | undefined }): JSX.Element | null {
  const mix = mixOf(changes)
  if (mix.length === 0) return null
  return (
    <span role="img" aria-label={mixWords(mix)} title={mixWords(mix)} className="inline-flex h-1 w-12 flex-none overflow-hidden rounded-full" data-testid="view-change-mix">
      {mix.map((m) => <span key={m.family} data-family={m.family} data-n={m.n} style={{ flex: m.n, background: FAMILY_FILL[m.family] ?? OTHER_FILL }} />)}
    </span>
  )
}
