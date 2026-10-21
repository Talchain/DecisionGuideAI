/**
 * ⭐ CORE'S OPTION SWITCH IS THE ENGINE'S WORKING, NOT THE MODEL (Paul, 21 Oct 2026). The core mapper draws each option's
 * on/off lever as a factor `<option id>__on` ("<option> in place", value 0). By identity only: a node is a switch when an
 * option on the canvas has exactly that id plus `__on`. The canvas lays out and draws the model without it; its links run
 * from the option itself. The store keeps it (the engine and every save still need it).
 */
type SwitchNode = { id: string; type?: string; data?: unknown }
const labelOf = (n: SwitchNode): string | undefined => {
  const l = (n.data as { label?: unknown } | undefined)?.label
  return typeof l === 'string' ? l : undefined
}

/**
 * A switch is a FACTOR `<option id>__on` labelled "… in place", the mapper's own words (Codex R1: never a look-alike; R2: not
 * tied to the option's label, so renaming the option never brings its switch back).
 */
export function coreSwitchOptionOf<T extends SwitchNode>(nodes: readonly T[]): ReadonlyMap<string, string> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out = new Map<string, string>()
  for (const n of nodes) {
    const s = n.type === 'option' ? byId.get(`${n.id}__on`) : undefined
    if (s && s.type === 'factor' && labelOf(s)?.endsWith(' in place') === true) out.set(s.id, n.id)
  }
  return out
}

/** The model as drawn: no switch cards; a switch's own links start at its option (each keeps its own id); the option→switch edge is gone. */
export function withoutCoreSwitches<N extends SwitchNode, E extends { id: string; source: string; target: string }>(
  nodes: readonly N[], edges: readonly E[],
): { nodes: N[]; edges: E[]; hidden: N[] } {
  const option = coreSwitchOptionOf(nodes)
  if (option.size === 0) return { nodes: [...nodes], edges: [...edges], hidden: [] }
  const drawn = edges.flatMap((e) => {
    if (option.get(e.target) === e.source) return []
    const source = option.get(e.source) ?? e.source
    const target = option.get(e.target) ?? e.target
    return [source === e.source && target === e.target ? e : { ...e, source, target }]
  })
  return { nodes: nodes.filter((n) => !option.has(n.id)), edges: drawn, hidden: nodes.filter((n) => option.has(n.id)) }
}
