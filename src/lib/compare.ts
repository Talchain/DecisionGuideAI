// src/lib/compare.ts
// Shallow diff of items with id; deterministic order. Returns arrays of ids.
export type IdObj = { id: string }
export function diff<T extends IdObj>(a: T[], b: T[]): { added: string[]; removed: string[]; changed: string[] } {
  const byId = (xs: T[]) => new Map(xs.map((x) => [x.id, x]))
  const ma = byId(a)
  const mb = byId(b)
  const added: string[] = []
  const removed: string[] = []
  const changed: string[] = []
  for (const [id, va] of ma.entries()) {
    if (!mb.has(id)) removed.push(id)
    else {
      const vb = mb.get(id) as T
      if (JSON.stringify(va) !== JSON.stringify(vb)) changed.push(id)
    }
  }
  for (const [id] of mb.entries()) {
    if (!ma.has(id)) added.push(id)
  }
  const by = (xs: string[]) => xs.slice().sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))
  return { changed: by(changed), added: by(added), removed: by(removed) }
}
