import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { typography } from '../../styles/typography'

// Stroke widths aligned with importanceToStrokeWidth() in graphDisplayCalculations.ts
// which maps normalised importance [0,1] → [1,8] linearly.
// Weak ≈ 0.15 → 2, Moderate ≈ 0.5 → 4.5, Strong ≈ 1.0 → 8
const LEGEND_ITEMS = [
  { label: 'Weak influence', width: 2 },
  { label: 'Moderate influence', width: 4.5 },
  { label: 'Strong influence', width: 8 },
]

interface EdgeThicknessLegendProps {
  visible: boolean
}

export function EdgeThicknessLegend({ visible }: EdgeThicknessLegendProps) {
  const [dismissed, setDismissed] = useState(false)
  const [faded, setFaded] = useState(false)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!visible || dismissed) return
    fadeTimerRef.current = setTimeout(() => setFaded(true), 10_000)
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [visible, dismissed])

  if (!visible || dismissed) return null

  return (
    <div
      className={`absolute bottom-4 left-4 z-10 bg-panel border border-panel-border rounded-lg shadow-sm p-3 transition-opacity duration-500 motion-reduce:transition-none ${faded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      data-testid="edge-thickness-legend"
      role="figure"
      aria-label="Edge thickness legend"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className={`${typography.panelMeta} text-text-body font-medium`}>
          Edge thickness = influence
        </span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-text-light hover:text-text-body p-0.5 -mt-0.5 -mr-0.5"
          aria-label="Dismiss legend"
        >
          <X size={12} />
        </button>
      </div>
      <div className="space-y-2">
        {LEGEND_ITEMS.map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <svg width={32} height={item.width + 4} aria-hidden="true">
              <line
                x1={0}
                y1={(item.width + 4) / 2}
                x2={32}
                y2={(item.width + 4) / 2}
                stroke="var(--text-light)"
                strokeWidth={item.width}
                strokeLinecap="round"
              />
            </svg>
            <span className={`${typography.panelMeta} text-text-light`}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
