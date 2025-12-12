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

  // Store selectors
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const pushHistory = useCanvasStore(s => s.pushHistory)
  const framing = useCanvasStore(s => s.currentScenarioFraming)
  const hasCompletedFirstRun = useCanvasStore(s => s.hasCompletedFirstRun)

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

  const analyzeGraphForCoaching = useCallback(() => {
    // Don't analyze if not enough nodes
    if (nodes.length < MIN_NODES_FOR_COACHING) return

    // Don't show too many nudges
    if (state.nudgeCount >= MAX_NUDGES_PER_SESSION) return

    // Don't show nudges if:
    // Brief 33 Fix: Suppress coaching nudges after ANY successful run to prevent mixed messaging
    // (e.g., "Consider adding relationships" while showing "Strong" reliability rating)
    // Previously required BOTH framing AND first run, but that caused contradictory UX
    if (hasCompletedFirstRun) {
      // User has completed analysis - don't show coaching suggestions that contradict results
      return
    }

    // Also suppress if decision is well-framed (title, goal, or timeline set)
    const hasFraming = Boolean(framing?.title || framing?.goal || framing?.timeline)
    if (hasFraming) {
      // Decision is well-framed - user knows what they're doing
      return
    }

    // Analyze for common issues

    // 1. Check for disconnected nodes (missing edges)
    const connectedNodeIds = new Set<string>()
    edges.forEach(e => {
      connectedNodeIds.add(e.source)
      connectedNodeIds.add(e.target)
    })
    const disconnectedNodes = nodes.filter(n => !connectedNodeIds.has(n.id))

    if (disconnectedNodes.length > 0 && !state.dismissedNudges.has('disconnected-nodes')) {
      const nodeLabels = disconnectedNodes.slice(0, 2).map(n => n.data?.label || 'Untitled').join(', ')
      showNudge({
        id: 'disconnected-nodes',
        type: 'missing_factor',
        severity: 'medium',
        title: 'Disconnected factors',
        message: `"${nodeLabels}" ${disconnectedNodes.length > 1 ? 'are' : 'is'} not connected to other factors. Consider adding relationships to show how they influence the decision.`,
        actionLabel: 'Show me',
        onAction: () => {
          // Highlight disconnected nodes
          useCanvasStore.getState().setHighlightedNodes(disconnectedNodes.map(n => n.id))
          setTimeout(() => {
            useCanvasStore.getState().setHighlightedNodes([])
          }, 3000)
        },
      })
      return
    }

    // 2. Check for single-path decisions (no alternatives)
    const decisionNodes = nodes.filter(n => n.type === 'decision')
    const optionNodes = nodes.filter(n => n.type === 'option')

    if (decisionNodes.length > 0 && optionNodes.length < 2 && !state.dismissedNudges.has('single-option')) {
      showNudge({
        id: 'single-option',
        type: 'bias',
        severity: 'high',
        title: 'Consider alternatives',
        message: 'Your model has only one option. Adding alternative options helps reduce confirmation bias and leads to better decisions.',
        actionLabel: 'Add option',
        onAction: () => {
          pushHistory()
          useCanvasStore.getState().addNode({ x: 300, y: 200 }, 'option')
        },
      })
      return
    }

    // 3. Check for missing risk factors
    const riskNodes = nodes.filter(n => n.type === 'risk')
    if (nodes.length >= 5 && riskNodes.length === 0 && !state.dismissedNudges.has('missing-risks')) {
      showNudge({
        id: 'missing-risks',
        type: 'improvement',
        severity: 'medium',
        title: 'Consider risks',
        message: 'Your model has no risk factors. Identifying potential risks helps you prepare for adverse outcomes.',
        actionLabel: 'Add risk',
        onAction: () => {
          pushHistory()
          useCanvasStore.getState().addNode({ x: 400, y: 300 }, 'risk')
        },
      })
      return
    }

    // 4. Check for unbalanced edge weights
    const edgesWithWeight = edges.filter(e => e.data?.weight !== undefined)
    if (edgesWithWeight.length >= 3) {
      const weights = edgesWithWeight.map(e => e.data?.weight ?? 0.5)
      const allSameWeight = weights.every(w => Math.abs(w - weights[0]) < 0.01)

      if (allSameWeight && !state.dismissedNudges.has('uniform-weights')) {
        showNudge({
          id: 'uniform-weights',
          type: 'assumption',
          severity: 'low',
          title: 'Refine influence weights',
          message: 'All your connections have the same weight. Consider adjusting weights to reflect which factors have more influence.',
          actionLabel: 'Learn more',
          onAction: () => {
            // Could open help panel or highlight edges
          },
        })
        return
      }
    }
  }, [nodes, edges, state.dismissedNudges, state.nudgeCount, showNudge, pushHistory, framing, hasCompletedFirstRun])

  // Periodic check for coaching opportunities
  useEffect(() => {
    const checkCoaching = () => {
      const now = Date.now()
      if (now - lastCheckRef.current < COACHING_CHECK_INTERVAL) return

      lastCheckRef.current = now
      analyzeGraphForCoaching()
    }

    // Initial check after a delay
    checkTimeoutRef.current = setTimeout(checkCoaching, 3000)

    // Periodic checks
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
