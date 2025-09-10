// PLoT shims: map between a generic plot model and tldraw document shapes

export type PlotNode = { id: string; title?: string }
export type PlotEdge = {
  id: string
  from: string
  to: string
  p?: number
  fromSide?: 'left' | 'right' | 'top' | 'bottom'
  toSide?: 'left' | 'right' | 'top' | 'bottom'
}

export function importPlotModel(json: { nodes?: PlotNode[]; edges?: PlotEdge[]; assumptions?: any[] }) {
  const shapes: any[] = []

  const nodes = Array.isArray(json.nodes) ? json.nodes : []
  nodes.forEach((n, idx) => {
    shapes.push({
      id: n.id,
      type: 'scenario-tile',
      x: (idx % 4) * 240,
      y: Math.floor(idx / 4) * 180,
      props: { title: n.title ?? `Scenario ${idx + 1}`, status: 'draft', assumptions: json.assumptions ?? [] },
    })
  })

  const edges = Array.isArray(json.edges) ? json.edges : []
  edges.forEach((e, idx) => {
    shapes.push({
      id: e.id ?? `edge_${idx}`,
      type: 'probability-connector',
      x: 0,
      y: 0,
      props: {
        from: e.from,
        to: e.to,
        p: typeof e.p === 'number' ? e.p : 0.5,
        fromSide: e.fromSide ?? 'right',
        toSide: e.toSide ?? 'left',
        label: 'p',
      },
    })
  })

  return {
    meta: { kind: 'sandbox' },
    shapes,
    bindings: [],
  }
}

export function exportPlotModel(doc: any) {
  const shapes = Array.isArray(doc?.shapes) ? doc.shapes : []
  const nodes: PlotNode[] = shapes
    .filter((s: any) => s.type === 'scenario-tile')
    .map((s: any) => ({ id: s.id, title: s?.props?.title }))

  const edges: PlotEdge[] = shapes
    .filter((s: any) => s.type === 'probability-connector')
    .map((s: any) => ({
      id: s.id,
      from: s?.props?.from,
      to: s?.props?.to,
      p: s?.props?.p ?? 0.5,
      fromSide: s?.props?.fromSide ?? 'right',
      toSide: s?.props?.toSide ?? 'left',
    }))

  return {
    nodes,
    edges,
    assumptions: doc?.meta?.assumptions ?? [],
  }
}
