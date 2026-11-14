/**
 * DL 12:1xZ / PL-1083 (1): while a proposal holds Olumi's readings, its reading rows (each its words and its two choices) rest wholly in view
 * ABOVE the proposal's sticky actions, never under them (the 12:08Z click-through at 1232: both rows sat under Approve at rest, so the one act
 * in view was Approve, which core then refused).
 *
 * `readingsRest` gives the scrollTop range of the scroll box `box` that shows the MOST leading rows marked `data-reading-row` under `root`
 * whole above `foot`: at `low` the last of those rows sits just above the actions, at `high` the first row's top is just inside the box.
 * Where the words are long (13:50Z on 7163b55b: a first row of 352 px) not every row fits: then as many leading rows as do; the first row
 * alone may give up its gap to fit; and where even that cannot, the first row's top. `rows` says how many rest whole (0 = not even the
 * first) and `short` how many more pixels of height the box would need to hold them all (<= 0 when they all fit). Positions come from
 * layout and are taken in the box's own scroll coordinates, so they do not depend on where it is scrolled now. null where no row is held.
 */
export type ReadingsRange = { readonly low: number; readonly high: number; readonly rows: number; readonly short: number }

export function readingsRest(box: HTMLElement, root: HTMLElement, foot: HTMLElement, gap = 8): ReadingsRange | null {
  const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-reading-row]'))
  if (rows.length === 0) return null
  const origin = box.getBoundingClientRect().top + box.clientTop - box.scrollTop
  const room = box.clientHeight - foot.getBoundingClientRect().height
  const top = rows[0]!.getBoundingClientRect().top - origin
  const bottoms = rows.map((r) => r.getBoundingClientRect().bottom - origin)
  const short = bottoms[bottoms.length - 1]! + gap - room - (top - gap)
  for (let k = rows.length; k >= 1; k--) {
    const low = bottoms[k - 1]! + gap - room
    if (low <= top - gap) return { low, high: top - gap, rows: k, short }
  }
  const tight = bottoms[0]! - room
  if (tight <= top) return { low: tight, high: top, rows: 1, short }
  return { low: top - gap, high: top - gap, rows: 0, short }
}

/** The rest scrollTop: the least move from `now` into the range, within 0..`max`. */
export function restTop(now: number, r: Pick<ReadingsRange, 'low' | 'high'>, max: number): number {
  const want = r.low > r.high ? r.high : Math.min(r.high, Math.max(now, r.low))
  return Math.max(0, Math.min(max, want))
}
