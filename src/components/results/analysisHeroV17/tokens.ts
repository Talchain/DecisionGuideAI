/**
 * AnalysisHeroV17 — DS token mappings + Lucide icon mappings.
 *
 * Centralised so every subcomponent reads the same table. No `color-mix`;
 * row tints use Tailwind opacity utilities (`bg-{token}/[0.07]`) per
 * docs/investigations/analysis-hero-v17.md §3.1.
 */

import {
  Sparkles, MessageCircle, Pencil, Check as CheckIcon,
  Plus, Flag, FileText,
} from 'lucide-react'
import type { ElementType } from 'react'
import type { IconBtn } from '@/canvas/components/pre-analysis/primitives/IconBtn'
import type {
  DimensionSegment, HeroRow, RowAction,
} from './analysisHeroVM.types'

export const STRIP_FILL_CLASS: Record<DimensionSegment['token'], string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-info',
  option: 'bg-option',
}

export const ROW_TINT_CLASS: Record<HeroRow['category'], string> = {
  evidence: 'bg-warning/[0.07]',
  risk: 'bg-danger/[0.07]',
  coverage: 'bg-info/[0.07]',
  reflect: 'bg-option/[0.07]',
  causal: 'bg-factor/[0.07]',
  ready: 'bg-success/[0.07]',
}

export const CATEGORY_DOT_CLASS: Record<HeroRow['category'], string> = {
  evidence: 'bg-warning',
  risk: 'bg-danger',
  coverage: 'bg-info',
  reflect: 'bg-option',
  causal: 'bg-factor',
  ready: 'bg-success',
}

interface ActionIconDef {
  Icon: ElementType
  tooltip: string
  variant: Parameters<typeof IconBtn>[0]['variant']
}

export const ACTION_ICON: Record<RowAction, ActionIconDef> = {
  ai: { Icon: Sparkles, tooltip: 'Work through with AI', variant: 'primary' },
  discuss: { Icon: MessageCircle, tooltip: 'Discuss with AI', variant: 'default' },
  edit: { Icon: Pencil, tooltip: 'Edit', variant: 'edit' },
  confirm: { Icon: CheckIcon, tooltip: 'Confirm', variant: 'confirm' },
  add: { Icon: Plus, tooltip: 'Add', variant: 'default' },
  challenge: { Icon: Flag, tooltip: 'Challenge this', variant: 'assume' },
  brief: { Icon: FileText, tooltip: 'Create brief', variant: 'primary' },
}
