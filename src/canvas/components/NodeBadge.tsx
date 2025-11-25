import type { CEEStructuralWarning } from '../../adapters/cee/types'
import { typography } from '../../styles/typography'

interface NodeBadgeProps {
  nodeId: string
  ceeWarnings: CEEStructuralWarning[]
  islAffected: boolean
  onClick?: () => void
}

interface Badge {
  icon: string
  label: string
  color: string
  priority: number // Higher = render first
}

// Map color names to full Tailwind class names for JIT/purge safety
const getBorderClass = (color: string): string => {
  const colorMap: Record<string, string> = {
    'sun-500': 'border-sun-500',
    'carrot-500': 'border-carrot-500',
    'sky-500': 'border-sky-500',
    'mint-500': 'border-mint-500',
  }
  return colorMap[color] || 'border-gray-500'
}

export function NodeBadge({ nodeId, ceeWarnings, islAffected, onClick }: NodeBadgeProps) {
  const badges: Badge[] = []

  // CEE structural warnings
  const isOrphan = ceeWarnings.some(
    w => w.type === 'orphan' && w.affectedNodes.includes(nodeId)
  )
  const inCycle = ceeWarnings.some(
    w => w.type === 'cycle' && w.affectedNodes.includes(nodeId)
  )
  const hasLogicIssue = ceeWarnings.some(
    w => w.type === 'decision_after_outcome' && w.affectedNodes.includes(nodeId)
  )

  if (isOrphan) {
    badges.push({
      icon: '⚠️',
      label: 'Orphan node – not connected',
      color: 'sun-500',
      priority: 3,
    })
  }

  if (inCycle) {
    badges.push({
      icon: '↻',
      label: 'Circular dependency detected',
      color: 'sun-500',
      priority: 3,
    })
  }

  if (hasLogicIssue) {
    badges.push({
      icon: '⚠️',
      label: 'Logic issue: decision after outcome',
      color: 'carrot-500',
      priority: 2,
    })
  }

  // ISL validation
  if (islAffected) {
    badges.push({
      icon: '🔍',
      label: 'Affected by identifiability issue',
      color: 'sky-500',
      priority: 1,
    })
  }

  if (badges.length === 0) return null

  // Sort by priority, take max 2
  const displayBadges = badges
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2)

  return (
    <div className="absolute -top-2 -right-2 flex gap-1 z-10">
      {displayBadges.map((badge, i) => (
        <button
          key={i}
          onClick={onClick}
          title={badge.label}
          aria-label={badge.label}
          className={`
            w-6 h-6 rounded-full bg-white border-2 ${getBorderClass(badge.color)}
            flex items-center justify-center text-xs shadow-sm
            hover:scale-110 transition-transform cursor-pointer
          `}
        >
          {badge.icon}
        </button>
      ))}
    </div>
  )
}
