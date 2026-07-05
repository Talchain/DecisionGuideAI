/**
 * useGuidancePulseHighlight — Canvas pulse highlight for active GuidanceItem
 *
 * Subscribes to the guidance store and monitors activeGuidanceItemId.
 * When a node/edge target is found, adds a CSS class to the React Flow element.
 * On clear, removes the class. No full canvas re-render required.
 *
 * CSS ring uses outline on the React Flow wrapper element to avoid layout shifts.
 * Single 600ms pulse then holds as static ring until activeGuidanceItemId changes.
 *
 * prefers-reduced-motion: no animation, static ring shown immediately.
 */

import { useEffect, useRef } from 'react'
import { useGuidanceStore, selectActiveItem, type GuidanceCategory } from '../stores/guidanceStore'
import { trackGuidance } from '../../telemetry/guidanceEvents'
import { useCanvasStore } from '../store'
import { focusExistingTarget } from '../utils/focusHelpers'

const GUIDANCE_PULSE_CLASS = 'guidance-pulse-ring'
/** Minimum ms between HIGHLIGHT_TRIGGERED events for the same item_id */
const HIGHLIGHT_COOLDOWN_MS = 2000

export function useGuidancePulseHighlight(): void {
  const prevTargetIdRef = useRef<string | null>(null)
  const prevCategoryRef = useRef<GuidanceCategory | null>(null)
  /** Cooldown map: item_id → timestamp of last HIGHLIGHT_TRIGGERED fire */
  const cooldownMapRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const unsubscribe = useGuidanceStore.subscribe((state) => {
      const activeItem = selectActiveItem(state)
      const target = activeItem?.target_object

      // Only highlight node/edge targets (not graph/framing/option — no specific element)
      const newTargetId: string | null =
        target &&
        (target.type === 'node' || target.type === 'edge') &&
        target.id
          ? target.id
          : null

      const newCategory: GuidanceCategory | null = activeItem?.category ?? null

      // Re-apply ring if target OR category changed (same target can switch must_fix→could_fix)
      const unchanged =
        newTargetId === prevTargetIdRef.current &&
        newCategory === prevCategoryRef.current
      if (unchanged) return

      // Remove ring from previous target
      if (prevTargetIdRef.current) {
        removeRing(prevTargetIdRef.current)
      }

      // Apply ring to new target and fire telemetry (once per item_id within 2s)
      if (newTargetId) {
        applyRing(newTargetId, newCategory ?? 'could_fix')

        // AI-to-graph slice: activating a guidance item also centres its
        // target so the pulse is actually visible (activation is an explicit
        // user action on a guidance card/strip). Fail-closed passthrough —
        // stale/unknown ids centre nothing; existing ids only get viewport
        // movement + selection, never a graph mutation.
        focusExistingTarget(newTargetId, target?.type === 'edge' ? 'edge' : 'node')

        const now = Date.now()
        const lastFired = cooldownMapRef.current.get(newTargetId) ?? 0
        if (now - lastFired >= HIGHLIGHT_COOLDOWN_MS) {
          cooldownMapRef.current.set(newTargetId, now)
          const storeState = useCanvasStore.getState()
          trackGuidance('HIGHLIGHT_TRIGGERED', {
            item_id: newTargetId,
            item_type: 'highlight',
            surface: 'canvas',
            scenario_id: storeState.currentScenarioId ?? undefined,
            profile_stage: (storeState.currentStage ?? undefined) as 'frame' | 'ideate' | 'evaluate' | 'decide' | undefined,
          })
        }
      }

      prevTargetIdRef.current = newTargetId
      prevCategoryRef.current = newCategory
    })

    return () => {
      // Clean up ring on unmount
      if (prevTargetIdRef.current) {
        removeRing(prevTargetIdRef.current)
        prevTargetIdRef.current = null
      }
      prevCategoryRef.current = null
      unsubscribe()
    }
  }, [])
}

function findCanvasElement(elementId: string): Element | null {
  // React Flow renders nodes as .react-flow__node[data-id="<id>"]
  // and edges as .react-flow__edge[data-id="<id>"]
  const escaped = CSS.escape(elementId)
  return (
    document.querySelector(`.react-flow__node[data-id="${escaped}"]`) ??
    document.querySelector(`.react-flow__edge[data-id="${escaped}"]`) ??
    null
  )
}

function applyRing(elementId: string, category: GuidanceCategory): void {
  const el = findCanvasElement(elementId)
  if (el) {
    el.classList.add(GUIDANCE_PULSE_CLASS)
    el.setAttribute('data-guidance-category', category)
  }
}

function removeRing(elementId: string): void {
  const el = findCanvasElement(elementId)
  if (el) {
    el.classList.remove(GUIDANCE_PULSE_CLASS)
    el.removeAttribute('data-guidance-category')
  }
}
