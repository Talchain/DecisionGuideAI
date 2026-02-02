/**
 * Pre-Analysis Panel (M1)
 *
 * Rebuilt pre-analysis Results tab right panel content.
 * Replaces existing PreAnalysisReadinessPanel with new component architecture.
 */

// Main component
export { PreAnalysisPanel } from './PreAnalysisPanel'

// Sub-components
export { Header } from './Header'
export { M1TopActions } from './M1TopActions'
export { AllImprovements } from './AllImprovements'
export { ModelSnapshot } from './ModelSnapshot'
export { AnalysisSettings } from './AnalysisSettings'
export { StickyFooter } from './StickyFooter'

// Hooks
export {
  usePreAnalysisData,
  type ImprovementCategory,
  type ImprovementItem,
  type EvidenceQuality,
  type EvidenceQualityLevel,
  type NodesByKind,
  type PreAnalysisData,
  type CoachingPayload,
} from './hooks'

// Primitives
export {
  NodeLink,
  Pill,
  IconBtn,
  BiasIcon,
  type BiasType,
  Accordion,
  TextBtn,
} from './primitives'
