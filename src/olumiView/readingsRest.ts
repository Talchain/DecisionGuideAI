/**
 * DL 12:1xZ / PL-1083 (1): while a proposal holds Olumi's readings, its reading rows (each its words and its two choices) rest wholly in view
 * ABOVE the proposal's sticky actions, never under them (the 12:08Z click-through at 1232: both rows sat under Approve at rest, so the one act
 * in view was Approve, which core then refused).
 *
 * `readingsRest` gives the scrollTop range of the scroll box `box` that shows the MOST leading rows marked `data-reading-row` under `root`
 * whole above `foot`: at `low` the last of those rows sits just above the actions, at `high` the first row's top is just inside the box.
 * Where the words are long (13:50Z on 7163b55b: a first row of 352 px) not every row fits: then as many leading rows as do; the first row
 * alone may give up its gap to fit; and where even that cannot (15:12Z on 7163b55b, old look at 1128: a first row of 374 px in 359 px of
 * room, its second choice under the actions), the first row's FOOT rests just above the actions, so both its choices are in view and its
 * top is cut. `rows` says how many rest whole (0 = not even the first). `short` is how many more pixels of height the box would need to hold EVERY row with its gap above and below (<= 0 when they all
 * fit with their gaps; it can be a few pixels above 0 while `rows` counts them all, when a sole row fits only without its gap). Positions come from
 * layout and are taken in the box's own scroll coordinates, so they do not depend on where it is scrolled now. null where no row is held.
 */
export type ReadingsRange = { readonly low: number; readonly high: number; readonly rows: number; readonly short: number }

/**
 * `head` (contract 3, Codex 15 Nov on the redesign): a block held at the box's TOP while it scrolls (the one-row review's sticky row). The
 * rows rest below it as they rest above the actions: the box's own view runs from the head's foot to the actions' top.
 */
export function readingsRest(box: HTMLElement, root: HTMLElement, foot: HTMLElement, gap = 8, head: HTMLElement | null = null): ReadingsRange | null {
  const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-reading-row]'))
  if (rows.length === 0) return null
  const origin = box.getBoundingClientRect().top + box.clientTop - box.scrollTop
  const room = box.clientHeight - foot.getBoundingClientRect().height
  const held = head === null ? 0 : head.getBoundingClientRect().height
  const top = rows[0]!.getBoundingClientRect().top - origin - held
  const bottoms = rows.map((r) => r.getBoundingClientRect().bottom - origin)
  const short = bottoms[bottoms.length - 1]! + gap - room - (top - gap)
  for (let k = rows.length; k >= 1; k--) {
    const low = bottoms[k - 1]! + gap - room
    if (low <= top - gap) return { low, high: top - gap, rows: k, short }
  }
  const tight = bottoms[0]! - room
  if (tight <= top) return { low: tight, high: top, rows: 1, short }
  // Not even the first row fits: its foot (its two choices, what the person has to reach) rests just above the actions; its top is cut.
  return { low: tight, high: tight, rows: 0, short }
}

/** The rest scrollTop: the least move from `now` into the range, within 0..`max`. */
export function restTop(now: number, r: Pick<ReadingsRange, 'low' | 'high'>, max: number): number {
  const want = r.low > r.high ? r.high : Math.min(r.high, Math.max(now, r.low))
  return Math.max(0, Math.min(max, want))
}
