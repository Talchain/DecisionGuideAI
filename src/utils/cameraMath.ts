// src/utils/cameraMath.ts
// Shared helpers for screen/canvas/world coordinate conversions

export type Camera = { x: number; y: number; zoom: number }

export function toCanvas(clientX: number, clientY: number, rect?: DOMRect | null) {
  const left = rect?.left ?? 0
  const top = rect?.top ?? 0
  return { x: clientX - left, y: clientY - top }
}

export function toWorld(canvasX: number, canvasY: number, camera: Camera) {
  return {
    x: (canvasX - camera.x) / camera.zoom,
    y: (canvasY - camera.y) / camera.zoom,
  }
}

export function viewportCenterWorld(rect: DOMRect | undefined | null, camera: Camera) {
  const width = rect?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 0)
  const height = rect?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 0)
  const cx = width / 2
  const cy = height / 2
  return toWorld(cx, cy, camera)
}
