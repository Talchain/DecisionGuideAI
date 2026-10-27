/**
 * Vision spec §2a (goal card): "a track from today to the target marker". Display only: today's level fills the track in
 * the goal's colour and the target is an ink marker, both on one scale from zero. The words stay on the card's lines;
 * this draws where today stands against the target, so the gap reads at a glance.
 *
 * Drawn only for a level target whose figure and today's level are both known, finite, not negative and in the goal's
 * unit (the caller's `goalTodayLevel` already binds the unit). A change target ("+10% on today") has no level to mark.
 */
/** The scale runs to a third past the larger figure, so neither end sits on the track's edge (vision mock: 125 → 62%, 150 → 75%). */
export function goalTrackPositions(today: number, target: number): { todayPct: number; targetPct: number } | null {
  if (![today, target].every(n => Number.isFinite(n) && n >= 0)) return null
  const max = Math.max(today, target) * (4 / 3)
  if (max <= 0) return null
  return { todayPct: (today / max) * 100, targetPct: (target / max) * 100 }
}

export function GoalTrack({ today, target, label, testId }: { today: number; target: number; label: string; testId: string }) {
  const at = goalTrackPositions(today, target)
  if (at === null) return null
  return (
    <div role="img" aria-label={label} data-testid={testId} className="relative mt-1.5 h-1.5 rounded-full bg-border-default">
      <span className="absolute inset-y-0 left-0 rounded-full bg-goal" style={{ width: `${at.todayPct}%` }} />
      <span data-testid={`${testId}-target`} className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-text-header" style={{ left: `${at.targetPct}%` }} />
    </div>
  )
}
