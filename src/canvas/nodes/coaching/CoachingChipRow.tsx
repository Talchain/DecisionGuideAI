/**
 * Renders a resolved coaching chip row, or nothing.
 *
 * This is the PRESENTATION half of the split `resolveNodeCoaching` makes. The
 * resolver decides WHAT to ask; this decides nothing at all — it maps chips to
 * `NodeChip` in the order the resolver returned them and renders no wrapper
 * when the resolver chose silence.
 *
 * ⚠ IT LIVES HERE, NOT IN `nodes/shared/`. `shared/` carries surfaces other
 * lanes own concurrently; a new file beside the resolver it serves keeps this
 * lane's fence intact.
 *
 * ⚠ `className` IS REQUIRED RATHER THAN DEFAULTED, deliberately. The pristine
 * rows are not uniform — `DecisionNode`'s pre-analysis cluster carries
 * `items-center`, `GoalNode`'s card row orders its utilities differently, and
 * defaulting would silently normalise a layout this lane has no measurement to
 * change. Each call site passes the class list its pristine `<div>` carried,
 * byte for byte.
 *
 * ⛔ NO `null` SHORT-CIRCUIT IS DUPLICATED AT THE CALL SITES. The resolver's
 * `null` reaches here and becomes no DOM, so a caller cannot forget the check
 * and render an empty bordered row. That is the whole reason silence has one
 * spelling.
 */
import { NodeChip } from '../shared/NodeChip'
import type { ResolvedCoaching } from './resolveNodeCoaching'

interface CoachingChipRowProps {
  /** The resolver's output, passed through unchanged — `null` renders nothing. */
  chips: ResolvedCoaching
  /**
   * The pristine wrapper's class list for this surface, or `null` where the
   * pristine site rendered the chip BARE with no wrapper element at all.
   *
   * ⚠ `null` IS NOT A CONVENIENCE. `OutcomeNode`'s `outcome_validate_assumption`
   * sat directly inside a fragment beneath its own `<p>`, with no flex row and
   * no `mt-1.5`. Wrapping it to make this component uniform would change that
   * surface's spacing, and jsdom cannot prove a layout claim either way
   * (CLAUDE.md trap 3) — so there is no measurement here that would justify it.
   * The DOM each site produces is byte-for-byte what it produced before.
   */
  className: string | null
  /** Preserved where a pristine row carried one; omitted where it did not. */
  testId?: string
}

export function CoachingChipRow({ chips, className, testId }: CoachingChipRowProps) {
  if (!chips) return null
  const rendered = chips.map(chip => (
    <NodeChip
      key={chip.id}
      chipId={chip.id}
      actionType={chip.actionType}
      label={chip.label}
      message={chip.message}
    />
  ))
  if (className === null) return <>{rendered}</>
  return (
    <div className={className} data-testid={testId}>
      {rendered}
    </div>
  )
}
