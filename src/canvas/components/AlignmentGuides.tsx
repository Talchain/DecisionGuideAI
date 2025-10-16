import { useEffect, useState, useRef } from 'react'
import { Node } from '@xyflow/react'

interface Guide {
  id: string
  type: 'vertical' | 'horizontal'
  position: number
  opacity: number
}

interface AlignmentGuidesProps {
  nodes: Node[]
  draggingNodeIds: Set<string>
  isActive: boolean
}

const SNAP_THRESHOLD = 8 // pixels
const FADE_DURATION = 200 // ms

export function AlignmentGuides({ nodes, draggingNodeIds, isActive }: AlignmentGuidesProps) {
  const [guides, setGuides] = useState<Guide[]>([])
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Clear any pending fade timer on every effect run
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = null
    }

    if (!isActive || draggingNodeIds.size === 0) {
      // Fade out existing guides
      setGuides((prev) =>
        prev.map((g) => ({ ...g, opacity: 0 }))
      )
      // Clear after fade with cleanup
      fadeTimerRef.current = setTimeout(() => {
        setGuides([])
        fadeTimerRef.current = null
      }, FADE_DURATION)
      return
    }

    // Calculate guides for dragging nodes
    const draggingNodes = nodes.filter((n) => draggingNodeIds.has(n.id))
    const staticNodes = nodes.filter((n) => !draggingNodeIds.has(n.id))

    if (draggingNodes.length === 0 || staticNodes.length === 0) {
      setGuides([])
      return
    }

    const newGuides: Guide[] = []

    // Get center positions of dragging nodes
    const draggingCenters = draggingNodes.map((n) => ({
      x: n.position.x,
      y: n.position.y,
    }))

    // Check alignment with static nodes
    staticNodes.forEach((staticNode) => {
      const staticX = staticNode.position.x
      const staticY = staticNode.position.y

      draggingCenters.forEach((center) => {
        // Vertical alignment (same X)
        if (Math.abs(center.x - staticX) < SNAP_THRESHOLD) {
          newGuides.push({
            id: `v-${staticNode.id}`,
            type: 'vertical',
            position: staticX,
            opacity: 1,
          })
        }

        // Horizontal alignment (same Y)
        if (Math.abs(center.y - staticY) < SNAP_THRESHOLD) {
          newGuides.push({
            id: `h-${staticNode.id}`,
            type: 'horizontal',
            position: staticY,
            opacity: 1,
          })
        }
      })
    })

    // Deduplicate guides
    const uniqueGuides = Array.from(
      new Map(newGuides.map((g) => [g.id, g])).values()
    )

    setGuides(uniqueGuides)
  }, [nodes, draggingNodeIds, isActive])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current)
        fadeTimerRef.current = null
      }
    }
  }, [])

  if (guides.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {guides.map((guide) => (
        <div
          key={guide.id}
          className={`absolute bg-[#EA7B4B] transition-opacity`}
          style={{
            opacity: guide.opacity * 0.4,
            transitionDuration: `${FADE_DURATION}ms`,
            ...(guide.type === 'vertical'
              ? {
                  left: guide.position,
                  top: 0,
                  width: '1px',
                  height: '100%',
                }
              : {
                  left: 0,
                  top: guide.position,
                  width: '100%',
                  height: '1px',
                }),
          }}
        />
      ))}
    </div>
  )
}
