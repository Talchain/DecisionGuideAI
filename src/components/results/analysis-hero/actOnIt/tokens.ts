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
  // ⚠ `edit` IS DECLARED BUT UNREACHABLE, and its label is NOT settled.
  //
  // Derived 19 Aug 2026, at the bytes: `actionsForCategory` (`rankActOnItRows
  // .ts:231`) returns `'edit'` for exactly two categories — `evidence` (with a
  // target) and `causal`. NEITHER IS PRODUCED. `rankActOnItRows` composes only
  // `readyRow` / `reflectRows` / `fragileEdgeRow` (risk) / `coverageRow`;
  // evidence gaps are owned by the triage queue (pinned by that file's spec §4)
  // and `causal` is documented in `types.ts` as declared-but-unemitted. Contrast
  // control for the absence: `category: 'risk' | 'coverage' | 'reflect' |
  // 'ready'` all return hits in this directory, `'evidence' | 'causal'` return
  // none. `ACTION_ICON` has one consumer (`ActOnItActionRow.tsx:42`), which has
  // one consumer (`ActOnItSection.tsx:255`), fed only by `rankActOnItRows` via
  // `AnalysisHeroContainer.tsx:101-102`. So this Pencil never reaches a screen.
  //
  // It was NOT relabelled to `FOCUS_ON_CANVAS_LABEL` alongside the OptionCards
  // chip, deliberately. `dispatchAction.ts:39-41` gives `edit` TWO behaviours —
  // `onFocusNode(targetNodeId)` when a target and handler exist, and a chat send
  // otherwise — so neither "Edit" nor "Show on canvas" is true across both
  // branches. Relabelling a dark control to a word that is false on one of its
  // own arms is not convergence; it is the same defect one spelling along.
  // Whoever first makes a builder emit `edit` must settle the label against BOTH
  // dispatch arms (and the Pencil glyph, which promises editing on its own).
  edit: { Icon: Pencil, tooltip: 'Edit', variant: 'edit' },
  confirm: { Icon: CheckIcon, tooltip: 'Confirm', variant: 'confirm' },
  add: { Icon: Plus, tooltip: 'Add', variant: 'default' },
  challenge: { Icon: Flag, tooltip: 'Challenge this', variant: 'assume' },
  brief: { Icon: FileText, tooltip: 'Create brief', variant: 'primary' },
}
