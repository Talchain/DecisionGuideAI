/**
 * ConfidenceBadge — glyph + optional percentage
 * DS v4 §11.4: Glyph coloured, label text-body. Border encodes level.
 * Thresholds: >=70% success, 40-69% warning, <40% danger
 */

import { typography } from '../../../../styles/typography'

interface ConfidenceBadgeProps {
  level: 'high' | 'medium' | 'low'
  value?: number // percentage (0-100)
}

const LEVELS = {
  high:   { glyph: '\u2713', colorClass: 'text-success', borderStyle: 'solid'  as const, borderColor: 'var(--color-success, #67C89E)' },
  medium: { glyph: '~',      colorClass: 'text-warning', borderStyle: 'dashed' as const, borderColor: 'var(--color-warning, #FFA656)' },
  low:    { glyph: '?',      colorClass: 'text-danger',  borderStyle: 'dotted' as const, borderColor: 'var(--color-danger,  #EA7B4B)' },
} as const

export function ConfidenceBadge({ level, value }: ConfidenceBadgeProps) {
  const cfg = LEVELS[level]

  return (
    <span
      className={`${typography.panelMeta} inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-transparent`}
      style={{ border: `1.5px ${cfg.borderStyle} ${cfg.borderColor}` }}
    >
      <span className={`font-semibold ${cfg.colorClass}`}>{cfg.glyph}</span>
      {value != null && (
        <span className="text-text-body">{value}%</span>
      )}
    </span>
  )
}
