/**
 * The option cards' ordinal colour palette, moved out of `WinGauge` when #2747 re-scope 2 deleted it (DL ruling (A): the
 * gauge drew each option's win share, which C does not show). The cards keep their colours exactly as before.
 *
 * Colour assignment: ordinal by rank, NOT by option id. Determined state: first = success (green) · second = info (sky) ·
 * third = option (lilac) · fourth+ = sand. Indeterminate state: info / info-light (near-tie signal).
 * DS v5 §3.3: data channel — distinct ordinal colours, each reserved for its rank tier.
 */
import type { DecisionState } from './types'

/** The determined palette. */
export const OPTION_RANK_COLORS = [
  'var(--success)',         // First — mint-500
  'var(--info)',            // Second — sky-500
  'var(--option)',          // Third — lilac-400
  'var(--border-default)',  // Fourth+ — sand-200
]

/** Indeterminate colours — sky for the top two (near-tie signal), muted for the rest. */
const OPTION_RANK_COLORS_INDETERMINATE = [
  'var(--info)',            // Top option — sky-500
  'var(--info-light)',      // Second option — sky-200 (lighter, near-tie signal)
  'var(--border-default)',  // Third — sand-200
  'var(--border-default)',  // Fourth — sand-200
]

/** Option id → CSS colour, in the cards' rank order (the named option first, then by share, descending). */
export function buildOptionRankColorMap(
  options: Array<{ id: string; winProbability?: number | null; isRecommended?: boolean }>,
  winnerId: string | undefined,
  decisionState?: DecisionState,
): Record<string, string> {
  const colors = decisionState === 'indeterminate' ? OPTION_RANK_COLORS_INDETERMINATE : OPTION_RANK_COLORS
  const sorted = [...options].sort((a, b) => {
    if (a.id === winnerId && b.id !== winnerId) return -1
    if (a.id !== winnerId && b.id === winnerId) return 1
    // eslint-disable-next-line chance-gate/no-raw-chance-read -- chance-gate: win-share: orders the cards' colours; no number leaves
    return (b.winProbability ?? 0) - (a.winProbability ?? 0)
  })
  const map: Record<string, string> = {}
  sorted.forEach((opt, i) => {
    map[opt.id] = colors[Math.min(i, colors.length - 1)]
  })
  return map
}
