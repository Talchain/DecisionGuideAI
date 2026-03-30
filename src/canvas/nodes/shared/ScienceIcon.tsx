/**
 * ScienceIcon — 12px guidance icon for node headers.
 * No background colour. Hover shows tooltip card. Click triggers _sendMessage.
 */
import { useState, useCallback, type ComponentType } from 'react'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { typography } from '../../../styles/typography'

interface ScienceIconProps {
  icon: ComponentType<{ size?: number; className?: string }>
  tooltip: string
  action: string
  colour?: string
}

export function ScienceIcon({ icon: Icon, tooltip, action, colour = 'text-text-light' }: ScienceIconProps) {
  const [showTip, setShowTip] = useState(false)

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    useGuidanceStore.getState()._sendMessage?.(action)
  }, [action])

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        className={`nodrag nopan p-0 border-0 bg-transparent cursor-pointer ${colour}`}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onClick={handleClick}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={tooltip}
      >
        <Icon size={12} />
      </button>
      {showTip && (
        <div
          className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-30 w-[180px] bg-panel border border-panel-border rounded-lg shadow-1 px-2 py-1.5 pointer-events-none`}
          role="tooltip"
        >
          <p className={`${typography.edgeLabel} text-text-body m-0`}>{tooltip}</p>
        </div>
      )}
    </div>
  )
}
