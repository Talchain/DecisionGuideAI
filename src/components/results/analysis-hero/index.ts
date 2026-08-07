/**
 * Analysis hero panel — public surface.
 *
 * Only AnalysisHeroContainer is intended for external use, and only by the
 * ResultsBody mount (see __tests__/inertness.spec.ts).
 */
export { AnalysisHeroContainer } from './AnalysisHeroContainer'
// 2.466: the decision-quality key-question card — mounted ONLY by ResultsBody,
// directly beneath the hero, inside the same `analysisHeroPanel` arm (the
// inertness guard's allow-list applies to this module as a whole).
export { KeyQuestionCard } from './KeyQuestionCard'
