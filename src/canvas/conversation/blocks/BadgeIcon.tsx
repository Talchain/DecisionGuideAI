/**
 * BadgeIcon — Shared badge icon resolver for patch/proposal block renderers.
 * Maps cardBadge metadata (icon name + semantic colour class) to a Lucide icon.
 */

import { Check, X as XIcon, AlertTriangle } from 'lucide-react'
import type { CardBadge } from '../utils/getPatchCardLabels'

const BADGE_ICONS = {
  'check': Check,
  'x': XIcon,
  'alert-triangle': AlertTriangle,
} as const

export function BadgeIcon({ badge }: { badge: CardBadge }) {
  const Icon = BADGE_ICONS[badge.icon]
  return <Icon size={14} aria-hidden="true" className={badge.colour} />
}
