/**
 * SectionTitle — Lucide icon (13px) + uppercase label
 * Spec §2.2: panelMeta, 12px semibold, text-light, letter-spacing 0.5px
 */

import type { LucideIcon } from 'lucide-react'
import {
  Target, BarChart3, GitBranch, Layers, FileText, Zap, Gauge,
  FileSearch, Sliders, Activity, ShieldQuestion, Maximize2,
  AlertTriangle, Beaker, TrendingUp,
} from 'lucide-react'
import { typography } from '../../../../styles/typography'

// Only the icons used in SECTION_TITLES — avoids importing all of lucide-react
const ICON_MAP: Record<string, LucideIcon> = {
  Target, BarChart3, GitBranch, Layers, FileText, Zap, Gauge,
  FileSearch, Sliders, Activity, ShieldQuestion, Maximize2,
  AlertTriangle, Beaker, TrendingUp,
}

interface SectionTitleProps {
  icon: string
  label: string
}

export function SectionTitle({ icon, label }: SectionTitleProps) {
  const IconComponent = ICON_MAP[icon]

  return (
    <div
      className="flex items-center gap-1.5 mt-4 mb-2"
      style={{ letterSpacing: '0.5px' }}
    >
      {IconComponent && (
        <IconComponent size={13} className="text-text-light flex-shrink-0" aria-hidden="true" />
      )}
      <span className={`${typography.panelMeta} font-semibold uppercase text-text-light`}>
        {label}
      </span>
    </div>
  )
}
