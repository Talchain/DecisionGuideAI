/**
 * Shared Components - Barrel Export
 *
 * Centralizes exports for all shared UI components.
 * Enables cleaner imports: `import { Button, Badge } from '../shared'`
 */

export { Badge } from './Badge'
export type { BadgeProps, BadgeVariant } from './Badge'

export { Button } from './Button'
export type { ButtonProps } from './Button'

export { Card } from './Card'
export type { CardProps } from './Card'

export { ExpandableSection } from './ExpandableSection'
export type { ExpandableSectionProps } from './ExpandableSection'

export { MetricRow } from './MetricRow'
export type { MetricRowProps } from './MetricRow'

export { HelpModal } from './HelpModal'
export type { HelpModalProps } from './HelpModal'

export { CopilotErrorBoundary } from './CopilotErrorBoundary'
