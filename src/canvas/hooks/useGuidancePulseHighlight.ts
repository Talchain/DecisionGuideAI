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

const GUIDANCE_PULSE_CLASS = 'guidance-pulse-ring'

export function useGuidancePulseHighlight(): void {
  const prevTargetIdRef = useRef<string | null>(null)
  const prevCategoryRef = useRef<GuidanceCategory | null>(null)

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

      // Apply ring to new target
      if (newTargetId) {
        applyRing(newTargetId, newCategory ?? 'could_fix')
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
