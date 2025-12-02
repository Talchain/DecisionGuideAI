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

type CompareStats = {
  p10: number
  p50: number
  p90: number
  top3_edges: any[]
}

type CompareMap = Record<string, CompareStats>

type CompareDeltaEntry = { a: number; b: number; delta: number }

export type CompareResult = {
  p10: CompareDeltaEntry
  p50: CompareDeltaEntry
  p90: CompareDeltaEntry
  top3_edges: any[]
}

function isValidStats(value: any): value is CompareStats {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof value.p10 === 'number' &&
    typeof value.p50 === 'number' &&
    typeof value.p90 === 'number' &&
    Array.isArray(value.top3_edges)
  )
}

function buildDelta(a: CompareStats, b: CompareStats): CompareResult {
  const mk = (field: 'p10' | 'p50' | 'p90'): CompareDeltaEntry => ({
    a: a[field],
    b: b[field],
    delta: b[field] - a[field],
  })

  return {
    p10: mk('p10'),
    p50: mk('p50'),
    p90: mk('p90'),
    top3_edges: b.top3_edges ?? [],
  }
}

export function deriveCompare(
  compareMap: CompareMap | undefined | null,
  optionA: string,
  optionB: string,
): CompareResult | null {
  if (!compareMap || typeof compareMap !== 'object') return null
  const a = (compareMap as any)[optionA]
  const b = (compareMap as any)[optionB]
  if (!isValidStats(a) || !isValidStats(b)) return null
  return buildDelta(a, b)
}

export function deriveCompareAcrossRuns(
  compareMapA: CompareMap | undefined | null,
  compareMapB: CompareMap | undefined | null,
  option: string,
): CompareResult | null {
  if (!compareMapA || typeof compareMapA !== 'object') return null
  if (!compareMapB || typeof compareMapB !== 'object') return null
  const a = (compareMapA as any)[option]
  const b = (compareMapB as any)[option]
  if (!isValidStats(a) || !isValidStats(b)) return null
  return buildDelta(a, b)
}

