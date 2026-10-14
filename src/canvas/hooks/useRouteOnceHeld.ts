import { useCanvasStore } from '../store'
import { routeOnceHeldIds } from '../domain/routeOnceHeld'

/** A boolean selector also updates when another route changes this edge's hold. */
export function useRouteOnceHeld(edgeId: string): boolean {
  return useCanvasStore(s => routeOnceHeldIds(s.nodes, s.edges).has(edgeId))
}
