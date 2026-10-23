/**
 * The unit printed beside the card's open value field (vision spec §2d, 23 Oct 2026): the inspector option row's own
 * adornment (`optionTargetEntryAdornment` on `resolveOptionTargetEntryFrame`) — `£` before, `customers per week` after.
 *
 * ⛔ DISPLAY ONLY. The field stays the number field it was: a unit cannot be typed into it, so no typed unit is ever
 * read. The inspector's text admission (`admitOptionTargetEntry`) is deliberately NOT used: on this card it admits
 * ".5" as 5, "-£6.80" as 6.8, "6.8junk" as 6 and "6.80 EUR" on a £ row (Codex r2 on #2943), so it would write a wrong
 * number from the card. Null wherever that frame is not a user unit, and for every percent factor (its stored scale,
 * 0–1 ratio or points, is not settled here): those fields stay exactly as they were.
 */
import {
  optionTargetEntryAdornment,
  resolveOptionTargetDisplayFrame,
  resolveOptionTargetEntryFrame,
} from '../../ui/inspector-v2/shared/optionTargetEntry'

export function factorValueFieldUnit(
  factorData: Record<string, unknown> | null | undefined,
): { prefix?: string; suffix?: string } | null {
  const frame = resolveOptionTargetEntryFrame(resolveOptionTargetDisplayFrame(factorData))
  if (frame.kind !== 'user_units' || frame.unitKind === 'percent') return null
  return optionTargetEntryAdornment(frame)
}
