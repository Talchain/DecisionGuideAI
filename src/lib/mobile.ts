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

/**
 * Get mobile performance warnings based on node count and dynamic limits
 * @param nodeCount - Number of nodes in the graph
 * @param maxNodes - Maximum nodes from engine limits (defaults to 200 if not provided)
 */
export function getMobileCaps(nodeCount: number, maxNodes: number = 200): MobileCaps {
  // Use 50% of max as warning threshold, 60% as hard stop for mobile
  const warnThreshold = Math.floor(maxNodes * 0.5)
  const stopThreshold = Math.floor(maxNodes * 0.6)

  const warn = nodeCount >= warnThreshold && nodeCount < stopThreshold
  const stop = nodeCount >= stopThreshold
  let message: string | null = null
  if (stop) message = 'Too many items for a small screen. Please remove some to continue.'
  else if (warn) message = 'Approaching the small-screen limit. Consider simplifying.'
  return { warn, stop, message }
}
