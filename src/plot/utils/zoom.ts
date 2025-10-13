// src/plot/utils/zoom.ts
// Zoom utilities: clamp scale, throttle events, preserve origin

export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 3.0
export const ZOOM_THROTTLE_MS = 50

export function clampScale(scale: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, scale))
}

export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): T {
  let lastCall = 0
  return ((...args: any[]) => {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      fn(...args)
    }
  }) as T
}

export function fitToContent(
  nodes: { x?: number; y?: number }[],
  containerWidth: number,
  containerHeight: number,
  padding = 50
): { scale: number; translateX: number; translateY: number } {
  if (nodes.length === 0) {
    return { scale: 1, translateX: 0, translateY: 0 }
  }

  const xs = nodes.map(n => n.x ?? 0)
  const ys = nodes.map(n => n.y ?? 0)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const contentWidth = maxX - minX + 100 // node width estimate
  const contentHeight = maxY - minY + 80 // node height estimate

  const scaleX = (containerWidth - padding * 2) / contentWidth
  const scaleY = (containerHeight - padding * 2) / contentHeight
  const scale = clampScale(Math.min(scaleX, scaleY, 1))

  const translateX = (containerWidth - contentWidth * scale) / 2 - minX * scale
  const translateY = (containerHeight - contentHeight * scale) / 2 - minY * scale

  return { scale, translateX, translateY }
}
