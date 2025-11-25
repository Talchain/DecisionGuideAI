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

// Phase 1A Canvas Components (re-exported for convenience)
export { ScoreChip } from '../../canvas/components/ScoreChip'
export { RangeChips } from '../../canvas/components/RangeChips'
export { RangeLabels } from '../../canvas/components/RangeLabels'
export { VerdictCard } from '../../canvas/components/VerdictCard'
export { DeltaInterpretation } from '../../canvas/components/DeltaInterpretation'
export { ObjectiveBanner } from '../../canvas/components/ObjectiveBanner'

// Existing UI Components (to be added as they're discovered)
// export { Button } from './Button'
// export { Tooltip, TooltipTrigger, TooltipContent } from './Tooltip'
// export { Spinner } from './Spinner'
// export { ErrorAlert } from './ErrorAlert'
