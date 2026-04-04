/**
 * useCEECoaching Hook
 * Provides AI-powered coaching suggestions based on graph analysis
 * Week 3: CEE-Powered Coaching
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useCanvasStore } from '../store'
import type { NudgeData } from '../../components/coaching/CoachingNudge'

// Debounce interval for checking coaching suggestions (5 seconds)
const COACHING_CHECK_INTERVAL = 5000
// Minimum nodes required before coaching activates
const MIN_NODES_FOR_COACHING = 3
// Maximum nudges to show per session
const MAX_NUDGES_PER_SESSION = 5

interface CoachingState {
  activeNudge: NudgeData | null
  dismissedNudges: Set<string>
  nudgeCount: number
}

export function useCEECoaching() {
  const [state, setState] = useState<CoachingState>({
    activeNudge: null,
    dismissedNudges: new Set(),
    nudgeCount: 0,
  })

  const checkTimeoutRef = useRef<NodeJS.Timeout>()
  const lastCheckRef = useRef<number>(0)

  // Keep graph state in refs so the interval callback stays stable and doesn't
  // reset on every position update (drag). The interval reads fresh data each
  // tick via getState() rather than depending on reactive values.
  const stateRef = useRef(state)
  stateRef.current = state

  const dismissNudge = useCallback((nudgeId: string) => {
    setState(prev => ({
      ...prev,
      activeNudge: null,
      dismissedNudges: new Set([...prev.dismissedNudges, nudgeId]),
    }))
  }, [])

  const showNudge = useCallback((nudge: Omit<NudgeData, 'onDismiss'>) => {
    setState(prev => {
      if (prev.nudgeCount >= MAX_NUDGES_PER_SESSION) return prev
      if (prev.dismissedNudges.has(nudge.id)) return prev

      return {
        ...prev,
        activeNudge: {
          ...nudge,
          onDismiss: () => dismissNudge(nudge.id),
        },
        nudgeCount: prev.nudgeCount + 1,
      }
    })
  }, [dismissNudge])

  // Reads fresh graph state via getState() on each call — no reactive deps on
  // nodes/edges so the callback reference is stable across drags/position updates.
  const analyzeGraphForCoaching = useCallback(() => {
    const { nodes, edges, currentScenarioFraming: framing, hasCompletedFirstRun } =
      useCanvasStore.getState()
    const currentState = stateRef.current

    if (nodes.length < MIN_NODES_FOR_COACHING) return
    if (currentState.nudgeCount >= MAX_NUDGES_PER_SESSION) return
    if (hasCompletedFirstRun) return

    const hasFraming = Boolean(framing?.title || framing?.goal || framing?.timeline)
    if (hasFraming) return

    // 1. Disconnected nodes
    const connectedNodeIds = new Set<string>()
    edges.forEach(e => {
      connectedNodeIds.add(e.source)
      connectedNodeIds.add(e.target)
    })
    const disconnectedNodes = nodes.filter(n => !connectedNodeIds.has(n.id))

    if (disconnectedNodes.length > 0 && !currentState.dismissedNudges.has('disconnected-nodes')) {
      const nodeLabels = disconnectedNodes.slice(0, 2).map(n => (n.data as any)?.label || 'Untitled').join(', ')
      showNudge({
        id: 'disconnected-nodes',
        type: 'missing_factor',
        severity: 'medium',
        title: 'Disconnected factors',
        message: `"${nodeLabels}" ${disconnectedNodes.length > 1 ? 'are' : 'is'} not connected to other factors. Consider adding relationships to show how they influence the decision.`,
        actionLabel: 'Show me',
        onAction: () => {
          useCanvasStore.getState().setHighlightedNodes(disconnectedNodes.map(n => n.id))
          setTimeout(() => {
            useCanvasStore.getState().setHighlightedNodes([])
          }, 3000)
        },
      })
      return
    }

    // 2. Single-path decisions
    const decisionNodes = nodes.filter(n => n.type === 'decision')
    const optionNodes = nodes.filter(n => n.type === 'option')

    if (decisionNodes.length > 0 && optionNodes.length < 2 && !currentState.dismissedNudges.has('single-option')) {
      showNudge({
        id: 'single-option',
        type: 'bias',
        severity: 'high',
        title: 'Consider alternatives',
        message: 'Your model has only one option. Adding alternative options helps reduce confirmation bias and leads to better decisions.',
        actionLabel: 'Add option',
        onAction: () => {
          useCanvasStore.getState().pushHistory()
          useCanvasStore.getState().addNode({ x: 300, y: 200 }, 'option')
        },
      })
      return
    }

    // 3. Missing risk factors
    const riskNodes = nodes.filter(n => n.type === 'risk')
    if (nodes.length >= 5 && riskNodes.length === 0 && !currentState.dismissedNudges.has('missing-risks')) {
      showNudge({
        id: 'missing-risks',
        type: 'improvement',
        severity: 'medium',
        title: 'Consider risks',
        message: 'Your model has no risk factors. Identifying potential risks helps you prepare for adverse outcomes.',
        actionLabel: 'Add risk',
        onAction: () => {
          useCanvasStore.getState().pushHistory()
          useCanvasStore.getState().addNode({ x: 400, y: 300 }, 'risk')
        },
      })
      return
    }

    // 4. Unbalanced edge weights
    const edgesWithWeight = edges.filter(e => (e.data as any)?.weight !== undefined)
    if (edgesWithWeight.length >= 3) {
      const weights = edgesWithWeight.map(e => (e.data as any)?.weight ?? 0.5)
      const allSameWeight = weights.every(w => Math.abs(w - weights[0]) < 0.01)

      if (allSameWeight && !currentState.dismissedNudges.has('uniform-weights')) {
        showNudge({
          id: 'uniform-weights',
          type: 'assumption',
          severity: 'low',
          title: 'Refine influence weights',
          message: 'All your connections have the same weight. Consider adjusting weights to reflect which factors have more influence.',
          actionLabel: 'Learn more',
          onAction: () => {},
        })
        return
      }
    }
  }, [showNudge])

  // Stable interval — never resets because analyzeGraphForCoaching is stable.
  // Graph state is read fresh from the store on each tick via getState().
  useEffect(() => {
    const checkCoaching = () => {
      const now = Date.now()
      if (now - lastCheckRef.current < COACHING_CHECK_INTERVAL) return
      lastCheckRef.current = now
      analyzeGraphForCoaching()
    }

    checkTimeoutRef.current = setTimeout(checkCoaching, 3000)
    const interval = setInterval(checkCoaching, COACHING_CHECK_INTERVAL)

    return () => {
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current)
      clearInterval(interval)
    }
  }, [analyzeGraphForCoaching])

  return {
    activeNudge: state.activeNudge,
    dismissNudge,
  }
}
