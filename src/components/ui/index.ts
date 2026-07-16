/**
 * Phase 1B: Component Library Index
 *
 * Centralized exports for all UI components
 *
 * Usage:
 * import { Button, ScoreChip, FieldLabel } from '@/components/ui'
 */

// Phase 1A Components
export { FieldLabel } from './FieldLabel'
export { FlipDropdown } from './FlipDropdown'
export type { FlipDropdownProps } from './FlipDropdown'

// Phase 1A Canvas Components (re-exported for convenience)
export { ScoreChip } from '../../canvas/components/ScoreChip'
export { RangeChips } from '../../canvas/components/RangeChips'
export { RangeLabels } from '../../canvas/components/RangeLabels'
export { VerdictCard } from '../../canvas/components/VerdictCard'
export { DeltaInterpretation } from '../../canvas/components/DeltaInterpretation'
export { ObjectiveBanner } from '../../canvas/components/ObjectiveBanner'

// DS bricks (2026-07-16, extraction-first — see DESIGN_SYSTEM.md):
export { Button } from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button'
export { Pill } from './Pill'
export type { PillProps, PillTone } from './Pill'
export { Skeleton } from './Skeleton'
export type { SkeletonProps } from './Skeleton'
// Modal: promote the existing token-compliant dialog rather than rebuild.
export { ConfirmDialog } from '../../canvas/components/ConfirmDialog'
// Toasts: the brick is ToastContext (severity owns persistence) — import
// useShowToastSafe from src/canvas/ToastContext; do NOT build local toasts.
