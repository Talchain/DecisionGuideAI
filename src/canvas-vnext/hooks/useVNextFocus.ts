// vNext focus handlers for the app-wide focus singleton.
//
// Registers into registerFocusHelpers (ownership-guarded unregister on
// unmount — a stale cleanup can never null a newer registration, so the
// default graph's own registration is safe across Exit round-trips, A3).
//
// Behaviour differences from RFG's handlers, by design:
//   - selection is vNext-LOCAL (no store selectNodeWithoutHistory, no
//     store edge.selected writes)
//   - pan-only: zoom is always preserved (setCenter with current zoom)
//   - in-viewport targets pulse without panning; off-viewport targets pan
//     (zoom preserved) then pulse
//   - fail-closed: unknown ids do nothing

import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { registerFocusHelpers } from '../../canvas/utils/focusHelpers'
import { useVNextSelection } from '../mode/contexts'

const PULSE_CLASS = 'guidance-pulse-ring'
const PULSE_MS = 2500

export function useVNextFocus() {
  const rf = useReactFlow()
  const { selectNode, pinEdge } = useVNextSelection()

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>()

    const pulse = (kind: 'node' | 'edge', id: string) => {
      const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id
      const el = document.querySelector(`.react-flow__${kind}[data-id="${escaped}"]`)
      if (!el) return
      el.classList.add(PULSE_CLASS)
      const timer = setTimeout(() => {
        el.classList.remove(PULSE_CLASS)
        timers.delete(timer)
      }, PULSE_MS)
      timers.add(timer)
    }

    const isOnScreen = (flowX: number, flowY: number): boolean => {
      try {
        const screen = rf.flowToScreenPosition({ x: flowX, y: flowY })
        const rect = document.querySelector('.react-flow')?.getBoundingClientRect()
        if (!rect) return false
        return screen.x >= rect.left && screen.x <= rect.right && screen.y >= rect.top && screen.y <= rect.bottom
      } catch {
        return false
      }
    }

    const focusNode = (nodeId: string) => {
      const node = rf.getNode(nodeId)
      if (!node) return
      selectNode(nodeId)
      if (!isOnScreen(node.position.x, node.position.y)) {
        rf.setCenter(node.position.x, node.position.y, { zoom: rf.getViewport().zoom, duration: 300 })
      }
      pulse('node', nodeId)
    }

    const focusEdge = (edgeId: string) => {
      const edge = rf.getEdges().find((e) => e.id === edgeId)
      if (!edge) return
      const sourceNode = rf.getNode(edge.source)
      const targetNode = rf.getNode(edge.target)
      if (!sourceNode || !targetNode) return
      pinEdge(edgeId)
      const midX = (sourceNode.position.x + targetNode.position.x) / 2
      const midY = (sourceNode.position.y + targetNode.position.y) / 2
      if (!isOnScreen(midX, midY)) {
        rf.setCenter(midX, midY, { zoom: rf.getViewport().zoom, duration: 300 })
      }
      pulse('edge', edgeId)
    }

    const unregister = registerFocusHelpers(focusNode, focusEdge)
    return () => {
      unregister()
      timers.forEach((t) => clearTimeout(t))
    }
  }, [rf, selectNode, pinEdge])
}
