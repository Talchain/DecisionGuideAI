// src/plc/utils/align.ts
export type NodeBox = { id: string; x: number; y: number; w: number; h: number }

export function boundsOf(nodes: NodeBox[]) {
  const xs = nodes.map(n => n.x)
  const ys = nodes.map(n => n.y)
  const rights = nodes.map(n => n.x + n.w)
  const bottoms = nodes.map(n => n.y + n.h)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...rights)
  const maxY = Math.max(...bottoms)
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY }
}

export function alignLeft(nodes: NodeBox[]) {
  const b = boundsOf(nodes)
  return nodes.map(n => ({ id: n.id, to: { x: b.minX, y: n.y } }))
}
export function alignRight(nodes: NodeBox[]) {
  const b = boundsOf(nodes)
  return nodes.map(n => ({ id: n.id, to: { x: b.maxX - n.w, y: n.y } }))
}
export function alignCenterX(nodes: NodeBox[]) {
  const b = boundsOf(nodes)
  return nodes.map(n => ({ id: n.id, to: { x: Math.round(b.cx - n.w / 2), y: n.y } }))
}
export function alignTop(nodes: NodeBox[]) {
  const b = boundsOf(nodes)
  return nodes.map(n => ({ id: n.id, to: { x: n.x, y: b.minY } }))
}
export function alignBottom(nodes: NodeBox[]) {
  const b = boundsOf(nodes)
  return nodes.map(n => ({ id: n.id, to: { x: n.x, y: b.maxY - n.h } }))
}
export function alignCenterY(nodes: NodeBox[]) {
  const b = boundsOf(nodes)
  return nodes.map(n => ({ id: n.id, to: { x: n.x, y: Math.round(b.cy - n.h / 2) } }))
}

export function distributeH(nodes: NodeBox[]) {
  if (nodes.length === 0) return [] as Array<{ id: string; to: { x: number; y: number } }>
  if (nodes.length === 1) return nodes.map(n => ({ id: n.id, to: { x: n.x, y: n.y } }))
  const sorted = [...nodes].sort((a, b) => a.x - b.x)
  const b = boundsOf(nodes)
  const totalW = nodes.reduce((s, n) => s + n.w, 0)
  const gaps = nodes.length - 1
  const space = (b.w - totalW) / gaps
  const moves: Array<{ id: string; to: { x: number; y: number } }> = []
  if (nodes.length === 2) {
    // Anchor endpoints: leftmost at minX, rightmost at (maxX - w)
    const left = sorted[0]
    const right = sorted[1]
    moves.push({ id: left.id, to: { x: b.minX, y: left.y } })
    moves.push({ id: right.id, to: { x: b.maxX - right.w, y: right.y } })
    return moves
  }
  let x = sorted[0].x
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]
    const toX = i === 0 ? n.x : Math.round(x)
    moves.push({ id: n.id, to: { x: toX, y: n.y } })
    x = toX + n.w + space
  }
  return moves
}

export function distributeV(nodes: NodeBox[]) {
  if (nodes.length === 0) return [] as Array<{ id: string; to: { x: number; y: number } }>
  if (nodes.length === 1) return nodes.map(n => ({ id: n.id, to: { x: n.x, y: n.y } }))
  const sorted = [...nodes].sort((a, b) => a.y - b.y)
  const b = boundsOf(nodes)
  const totalH = nodes.reduce((s, n) => s + n.h, 0)
  const gaps = nodes.length - 1
  const space = (b.h - totalH) / gaps
  const moves: Array<{ id: string; to: { x: number; y: number } }> = []
  if (nodes.length === 2) {
    const top = sorted[0]
    const bottom = sorted[1]
    moves.push({ id: top.id, to: { x: top.x, y: b.minY } })
    moves.push({ id: bottom.id, to: { x: bottom.x, y: b.maxY - bottom.h } })
    return moves
  }
  let y = sorted[0].y
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]
    const toY = i === 0 ? n.y : Math.round(y)
    moves.push({ id: n.id, to: { x: n.x, y: toY } })
    y = toY + n.h + space
  }
  return moves
}
