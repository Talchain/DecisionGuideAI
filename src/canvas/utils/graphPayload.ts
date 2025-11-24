export function buildBasicGraphPayload(nodes: any[], edges: any[]) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      label: n.data?.label || '',
      type: n.type || 'decision',
    })),
    edges: edges.map((e) => ({
      from: e.source,
      to: e.target,
    })),
  }
}

export function buildRichGraphPayload(nodes: any[], edges: any[]) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      label: n.data?.label || '',
      type: n.type || 'decision',
      value: n.data?.value,
    })),
    edges: edges.map((e) => ({
      from: e.source,
      to: e.target,
      weight: e.data?.weight,
    })),
  }
}
