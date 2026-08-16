/**
 * Act-on-it row tokens — DS token + Lucide icon mappings.
 *
 * Salvaged from `analysisHeroV17/tokens.ts`. The two exports that belonged to
 * the deleted readiness strip (`STRIP_FILL_CLASS`, `DIMENSION_DESCRIPTION`)
 * are NOT carried over — they had exactly one consumer each and it is gone.
 */

import {
  Sparkles, MessageCircle, Pencil, Check as CheckIcon,
  Plus, Flag, FileText,
} from 'lucide-react'
import type { ElementType } from 'react'
import type { IconBtn } from '@/canvas/components/pre-analysis/primitives/IconBtn'
import type { RowAction, RowCategory } from './types'

export const ROW_TINT_CLASS: Record<RowCategory, string> = {
  evidence: 'bg-warning/[0.07]',
  risk: 'bg-danger/[0.07]',
  coverage: 'bg-info/[0.07]',
  reflect: 'bg-option/[0.07]',
  causal: 'bg-factor/[0.07]',
  ready: 'bg-success/[0.07]',
}

export const CATEGORY_DOT_CLASS: Record<RowCategory, string> = {
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
