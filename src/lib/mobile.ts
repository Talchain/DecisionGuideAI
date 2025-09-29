// src/lib/mobile.ts
export function isNarrowViewport(max = 480): boolean {
  try {
    const w = (globalThis as any)?.innerWidth
    return typeof w === 'number' && w > 0 ? w <= max : false
  } catch {
    return false
  }
}

export type MobileCaps = { warn: boolean; stop: boolean; message: string | null }

export function getMobileCaps(nodeCount: number): MobileCaps {
  const warn = nodeCount >= 10 && nodeCount < 12
  const stop = nodeCount >= 12
  let message: string | null = null
  if (stop) message = 'Too many items for a small screen. Please remove some to continue.'
  else if (warn) message = 'Approaching the small-screen limit. Consider simplifying.'
  return { warn, stop, message }
}
