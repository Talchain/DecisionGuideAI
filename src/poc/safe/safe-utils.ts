// src/poc/safe/safe-utils.ts
// Keep safe utilities react-free

/**
 * Ping an edge endpoint to check if it's reachable.
 * Pure fetch - no React dependencies.
 */
export async function pingEdge(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Check if we should show the safe screen based on URL params.
 */
export function shouldShowSafe(): boolean {
  const params = new URLSearchParams(window.location.search)
  return params.get('forceSafe') === '1'
}
