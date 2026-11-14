/**
 * DL 12:1xZ / PL-1083 (1): while a proposal holds Olumi's readings, every reading row (its words and its two choices) rests wholly in view
 * ABOVE the proposal's sticky actions, never under them (the 12:08Z click-through at 1232: both rows sat under Approve at rest, so the one act
 * in view was Approve, which core then refused).
 *
 * `readingsRest` gives the scrollTop range of the scroll box `box` in which every row marked `data-reading-row` under `root` is whole above
 * `foot`: at `low` the last row's foot sits just above the actions, at `high` the first row's top is just inside the box. Positions come from
 * layout and are taken in the box's own scroll coordinates, so they do not depend on where it is scrolled now. null where no row is held.
 */
export type ReadingsRange = { readonly low: number; readonly high: number }

export function readingsRest(box: HTMLElement, root: HTMLElement, foot: HTMLElement, gap = 8): ReadingsRange | null {
  const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-reading-row]'))
  if (rows.length === 0) return null
  const origin = box.getBoundingClientRect().top + box.clientTop - box.scrollTop
  const first = rows[0]!.getBoundingClientRect().top - origin
  const last = rows[rows.length - 1]!.getBoundingClientRect().bottom - origin
  return { low: last + gap + foot.getBoundingClientRect().height - box.clientHeight, high: first - gap }
}

/** The rest scrollTop: the least move from `now` into the range, within 0..`max`; where the rows cannot all fit, the first row's top (`high`). */
export function restTop(now: number, r: ReadingsRange, max: number): number {
  const want = r.low > r.high ? r.high : Math.min(r.high, Math.max(now, r.low))
  return Math.max(0, Math.min(max, want))
}
