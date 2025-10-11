// src/plc/utils/snap.ts
export function snapCoord(v: number, grid: number, tol: number): number {
  if (!grid || grid <= 0) return v
  const r = ((v % grid) + grid) % grid
  const down = r
  const up = grid - r
  const d = Math.min(down, up)
  if (d <= tol) {
    if (down <= up) return v - down
    return v + up
  }
  return v
}

export function snapPoint(p: { x: number; y: number }, grid: number, tol: number) {
  return {
    x: snapCoord(p.x, grid, tol),
    y: snapCoord(p.y, grid, tol),
  }
}
