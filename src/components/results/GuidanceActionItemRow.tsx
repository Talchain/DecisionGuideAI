/**
 * GuidanceActionItemRow — renders a GuidanceItem in the results panel style.
 *
 * Used in the "What to do next" section to display orchestrator coaching items
 * when the guidance store has items. Falls back to NextActionItem when empty.
 */

import { AlertTriangle, Lightbulb } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { GuidanceItem, GuidanceCategory } from '../../canvas/stores/guidanceStore'

interface GuidanceActionItemRowProps {
  item: GuidanceItem
  onActivate: (itemId: string) => void
}

const CATEGORY_CONFIG: Record<GuidanceCategory, {
  icon: typeof AlertTriangle
  textColor: string
  bgColor: string
  borderColor: string
}> = {
  must_fix: {
    icon: AlertTriangle,
    textColor: 'text-danger',
    bgColor: 'bg-danger-light',
    borderColor: 'border-danger/30',
  },
  should_fix: {
    icon: AlertTriangle,
    textColor: 'text-info',
    bgColor: 'bg-info-light',
    borderColor: 'border-info/30',
  },
  could_fix: {
    icon: Lightbulb,
    textColor: 'text-info',
    bgColor: 'bg-info-light',
    borderColor: 'border-info/30',
  },
  technique: {
    icon: Lightbulb,
    textColor: 'text-option',
    bgColor: 'bg-option-light',
    borderColor: 'border-option/30',
  },
}

export function GuidanceActionItemRow({ item, onActivate }: GuidanceActionItemRowProps) {
  const config = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.should_fix
  const { icon: Icon, textColor, bgColor, borderColor } = config

  return (
    <button
      type="button"
      className={`w-full text-left rounded-lg border px-3 py-2.5 ${bgColor} ${borderColor} hover:brightness-95 transition-all`}
      onClick={() => onActivate(item.item_id)}
      data-testid="guidance-action-item-row"
      data-item-id={item.item_id}
    >
      <div className="flex items-start gap-2">
        <Icon size={14} className={`${textColor} shrink-0 mt-0.5`} />
        <div className="min-w-0">
          <p className={`${typography.panelBody} ${textColor} font-medium`}>{item.title}</p>
          {item.detail && (
            <p className={`${typography.panelMeta} text-text-light mt-0.5`}>{item.detail}</p>
          )}
        </div>
      </div>
    </button>
  )
}
