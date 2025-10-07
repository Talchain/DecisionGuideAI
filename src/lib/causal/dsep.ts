// src/lib/causal/dsep.ts
// Minimal deterministic d-separation and identifiability helpers
// NOTE: Library-only, not wired into runtime.

export type NodeId = string

export interface Graph {
  parents: Map<NodeId, Set<NodeId>>
  children: Map<NodeId, Set<NodeId>>
}

export function makeGraph(edges: Array<[NodeId, NodeId]>): Graph {
  const parents = new Map<NodeId, Set<NodeId>>()
  const children = new Map<NodeId, Set<NodeId>>()
  const ensure = (m: Map<NodeId, Set<NodeId>>, k: NodeId) => {
    if (!m.has(k)) m.set(k, new Set())
    return m.get(k) as Set<NodeId>
  }
  for (const [u, v] of edges) {
    ensure(children, u).add(v)
    ensure(parents, v).add(u)
    ensure(parents, u)
    ensure(children, v)
  }
  return { parents, children }
}

export function getParents(G: Graph, n: NodeId): Set<NodeId> {
  return G.parents.get(n) ?? new Set()
}
export function getChildren(G: Graph, n: NodeId): Set<NodeId> {
  return G.children.get(n) ?? new Set()
}

export function ancestorsOf(G: Graph, Z: Set<NodeId>): Set<NodeId> {
  const anc = new Set<NodeId>()
  const stack: NodeId[] = [...Z]
  while (stack.length) {
    const n = stack.pop()!
    for (const p of getParents(G, n)) {
      if (!anc.has(p)) {
        anc.add(p)
        stack.push(p)
      }
    }
  }
  return anc
}

export function descendantsOf(G: Graph, X: Set<NodeId>): Set<NodeId> {
  const desc = new Set<NodeId>()
  const stack: NodeId[] = [...X]
  while (stack.length) {
    const n = stack.pop()!
    for (const c of getChildren(G, n)) {
      if (!desc.has(c)) {
        desc.add(c)
        stack.push(c)
      }
    }
  }
  return desc
}

// Bayes-ball active trail query to test if any open path exists between X and Y given Z
export function isDSep(G: Graph, X: Set<NodeId>, Y: Set<NodeId>, Z: Set<NodeId>): boolean {
  // true means d-separated (no open path), false means connected (open path exists)
  const ancZ = ancestorsOf(G, Z)
  type Dir = 'up' | 'down'
  const visited = new Set<string>()
  const q: Array<[NodeId, Dir]> = []

  for (const x of X) {
    q.push([x, 'up'])
    q.push([x, 'down'])
  }

  const key = (n: NodeId, d: Dir) => `${n}:${d}`

  while (q.length) {
    const [n, dir] = q.shift()!
    const k = key(n, dir)
    if (visited.has(k)) continue
    visited.add(k)

    if (Y.has(n) && !X.has(n)) {
      // Found open trail to Y
      return false
    }

    const inZ = Z.has(n)
    const inAncZ = ancZ.has(n)

    if (dir === 'up') {
      if (!inZ) {
        // from child to parents and children when unobserved
        for (const p of getParents(G, n)) q.push([p, 'up'])
        for (const c of getChildren(G, n)) q.push([c, 'down'])
      } else {
        // from child: can pass to parents (collider opened by conditioning on node)
        for (const p of getParents(G, n)) q.push([p, 'up'])
      }
    } else {
      // dir === 'down' (came from parent)
      if (!inZ) {
        // Pass to children as usual
        for (const c of getChildren(G, n)) q.push([c, 'down'])
        // If node is ancestor of Z, colliders may be opened upward
        if (inAncZ) {
          for (const p of getParents(G, n)) q.push([p, 'up'])
        }
      } else {
        // observed node blocks downward flow
        // but colliders handled via 'up' case when visiting from child
      }
    }
  }

  return true
}

// Open backdoor path exists from A to B given Z (paths entering A via an incoming edge)
export function existsOpenBackdoorPath(G: Graph, A: Set<NodeId>, B: Set<NodeId>, Z: Set<NodeId>): boolean {
  const ancZ = ancestorsOf(G, Z)
  type Dir = 'up' | 'down'
  const visited = new Set<string>()
  const q: Array<[NodeId, Dir]> = []

  for (const a of A) {
    // Start only with 'up' to enforce initial incoming edge into A
    q.push([a, 'up'])
  }
  const key = (n: NodeId, d: Dir) => `${n}:${d}`

  while (q.length) {
    const [n, dir] = q.shift()!
    const k = key(n, dir)
    if (visited.has(k)) continue
    visited.add(k)

    if (B.has(n) && !A.has(n)) return true

    const inZ = Z.has(n)
    const inAncZ = ancZ.has(n)

    if (dir === 'up') {
      if (!inZ) {
        for (const p of getParents(G, n)) q.push([p, 'up'])
        for (const c of getChildren(G, n)) q.push([c, 'down'])
      } else {
        for (const p of getParents(G, n)) q.push([p, 'up'])
      }
    } else {
      if (!inZ) {
        for (const c of getChildren(G, n)) q.push([c, 'down'])
        if (inAncZ) {
          for (const p of getParents(G, n)) q.push([p, 'up'])
        }
      }
    }
  }
  return false
}

function lexicographic(a: string[], b: string[]): number {
  const as = [...a].sort()
  const bs = [...b].sort()
  const la = as.join(',')
  const lb = bs.join(',')
  return la < lb ? -1 : la > lb ? 1 : 0
}

export function backdoorOK(G: Graph, X: NodeId, Y: NodeId, Z: string[]): boolean {
  const Xs = new Set<NodeId>([X])
  const Ys = new Set<NodeId>([Y])
  const Zs = new Set<NodeId>(Z)
  // Z must not contain descendants of X
  const descX = descendantsOf(G, new Set([X]))
  for (const z of Zs) if (descX.has(z)) return false
  // No open backdoor path from X to Y given Z
  return !existsOpenBackdoorPath(G, Xs, Ys, Zs)
}

export function frontdoorOK(G: Graph, X: NodeId, Y: NodeId, Z: string[]): boolean {
  const Zs = new Set<NodeId>(Z)
  // 1) Z intercepts all directed paths X->...->Y
  if (!interceptsAllDirected(G, X, Y, Zs)) return false
  // 2) No unblocked backdoor paths from X to Z
  if (existsOpenBackdoorPath(G, new Set([X]), Zs, Zs)) return false
  // 3) All backdoor paths Z->...->Y are blocked by X (condition on Z ∪ {X})
  const ZX = new Set<NodeId>([...Zs, X])
  if (existsOpenBackdoorPath(G, Zs, new Set([Y]), ZX)) return false
  return true
}

function interceptsAllDirected(G: Graph, X: NodeId, Y: NodeId, Z: Set<NodeId>): boolean {
  // Return true if there is NO directed path from X to Y that avoids Z
  const stack: Array<{ n: NodeId; hitZ: boolean }> = [{ n: X, hitZ: Z.has(X) }]
  const seen = new Set<NodeId>()

  while (stack.length) {
    const { n, hitZ } = stack.pop()!
    if (n === Y && !hitZ) return false // reached Y without hitting Z
    for (const c of getChildren(G, n)) {
      if (Z.has(c)) {
        // intercepted here; don't continue beyond c
        continue
      }
      // Continue path; we can re-visit nodes across different hitZ states conservatively
      stack.push({ n: c, hitZ })
    }
    seen.add(n)
  }
  return true
}

export function pickDeterministicBackdoor(G: Graph, X: NodeId, Y: NodeId, candidates: string[][]): string[] | null {
  const valids = candidates.filter(Z => backdoorOK(G, X, Y, Z)).sort(lexicographic)
  return valids[0] ?? null
}

export function pickDeterministicFrontdoor(G: Graph, X: NodeId, Y: NodeId, candidates: string[][]): string[] | null {
  const valids = candidates.filter(Z => frontdoorOK(G, X, Y, Z)).sort(lexicographic)
  return valids[0] ?? null
}

export function globalAdjustOK(G: Graph, X: NodeId, Y: NodeId): { ok: boolean; Z: string[] } {
  // Simple sufficient set: all parents of X (classic backdoor adjustment set)
  const Z = Array.from(getParents(G, X))
  const ok = backdoorOK(G, X, Y, Z)
  return { ok, Z: ok ? Z : [] }
}

export function chooseMethod(
  G: Graph,
  X: NodeId,
  Y: NodeId,
  candidates: string[][]
): { method: 'backdoor' | 'frontdoor' | 'g-formula' | 'unidentifiable'; Z: string[]; notes: string[] } {
  // Backdoor (empty allowed if already blocked)
  const Zb = pickDeterministicBackdoor(G, X, Y, candidates)
  if (Zb && backdoorOK(G, X, Y, Zb)) return { method: 'backdoor', Z: Zb, notes: [] }

  // Frontdoor
  const Zf = pickDeterministicFrontdoor(G, X, Y, candidates)
  if (Zf && frontdoorOK(G, X, Y, Zf)) return { method: 'frontdoor', Z: Zf, notes: [] }

  // g-formula (global adjustment via parents of X if sufficient)
  const g = globalAdjustOK(G, X, Y)
  if (g.ok) return { method: 'g-formula', Z: g.Z, notes: [] }

  return { method: 'unidentifiable', Z: [], notes: ['bounds: manski'] }
}
