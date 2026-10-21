/**
 * ⭐ CORE'S OPTION SWITCH IS THE ENGINE'S WORKING, NOT THE MODEL (Paul, 21 Oct 2026). The core mapper draws each option's
 * on/off lever as a factor `<option id>__on` ("<option> in place", value 0). By identity only: a node is a switch when an
 * option on the canvas has exactly that id plus `__on`. The canvas lays out and draws the model without it; its links run
 * from the option itself. The store keeps it (the engine and every save still need it).
 */
export function coreSwitchOptionOf<T extends { id: string; type?: string }>(nodes: readonly T[]): ReadonlyMap<string, string> {
  const ids = new Set(nodes.map((n) => n.id))
  const out = new Map<string, string>()
  for (const n of nodes) if (n.type === 'option' && ids.has(`${n.id}__on`)) out.set(`${n.id}__on`, n.id)
  return out
}

/** The model as drawn: no switch cards; a switch's own links start at its option; the option→switch edge is gone. */
export function withoutCoreSwitches<N extends { id: string; type?: string }, E extends { id: string; source: string; target: string }>(
  nodes: readonly N[], edges: readonly E[],
): { nodes: N[]; edges: E[]; hidden: N[] } {
  const option = coreSwitchOptionOf(nodes)
  if (option.size === 0) return { nodes: [...nodes], edges: [...edges], hidden: [] }
  const seen = new Set<string>()
  const drawn = edges.flatMap((e) => {
    if (option.get(e.target) === e.source) return []
    const source = option.get(e.source) ?? e.source
    const target = option.get(e.target) ?? e.target
    const key = `${source}->${target}`
    if (seen.has(key)) return []
    seen.add(key)
    return [source === e.source && target === e.target ? e : { ...e, source, target }]
  })
  return { nodes: nodes.filter((n) => !option.has(n.id)), edges: drawn, hidden: nodes.filter((n) => option.has(n.id)) }
}
