/**
 * ResultsPanel Components Index
 *
 * Brief H: Four-panel Results structure components
 *
 * Panel 1: Recommendation - "What should I do?"
 * Panel 2: Key Drivers - "Why?"
 * Panel 3: Validate & Improve - "Can I trust it?"
 * Panel 4: Next Steps - "What's next?"
 */

// Panel components
export { KeyDriversPanel } from './KeyDriversPanel'
// OptionComparisonReveal DELETED (ROADMAP 2.724): it rendered a Trophy icon +
// literal "Best option" badge — a SYSTEM VERDICT the doctrine bans — and had
// ZERO render sites (barrel-exported only; `<OptionComparisonReveal` appeared
// nowhere in src/, and its "Best option" string was absent from the deployed
// staging bundle at tip a81121d1). Unmounted verdict copy is a loaded weapon,
// not dead weight: a remount would have shipped it.

// Sub-components for Panel 2
export { SensitivityList } from './SensitivityList'
export { TippingPointsList } from './TippingPointsList'
export { ValueOfInformationList } from './ValueOfInformationList'

// Panel 3 sub-components
export { ConfidenceRange } from './ConfidenceRange'
export { RiskToleranceControl } from './RiskToleranceControl'

// Panel 4 sub-components
export { KeyInsight } from './KeyInsight'
export { RecommendedNextSteps } from './RecommendedNextSteps'

// Utility components
export { EvidencePackExport } from './EvidencePackExport'
