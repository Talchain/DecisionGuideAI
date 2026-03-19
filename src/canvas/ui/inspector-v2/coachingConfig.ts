/**
 * coachingConfig — centralised coaching card text for all inspector panels.
 *
 * Each entry is keyed by panel/context so callers can import exactly what they need.
 * Moving these here prevents coaching copy from drifting silently across 8 files.
 */

export const COACHING = {
  /** EdgePanel — auto-generated weight calibration nudge */
  edgeWeight: 'This value was generated automatically. Even a rough calibration \u2014 is the effect strong, moderate, or weak? \u2014 would improve the analysis.',

  /** DecisionPanel — option differentiation nudge */
  decisionOptions: 'Consider options that pull different levers to increase differentiation.',

  /** OptionPanel — factor coverage nudge */
  optionCoverage: 'Consider whether this option changes enough factors to differentiate from alternatives.',

  /** FactorControllablePanel — evidence quality nudge */
  factorControllableEvidence: "This factor\u2019s evidence quality could be improved. Consider anchoring with an industry benchmark.",

  /** FactorObservablePanel — data freshness nudge */
  factorObservableData: 'If you have more recent data for this measurement, updating it would sharpen the analysis.',

  /** FactorExternalPanel — uncertainty calibration nudge */
  factorExternalUncertainty: 'This is a source of uncertainty. Even a rough estimate would significantly sharpen the analysis.',

  /** OutcomePanel — model completeness nudge */
  outcomeCompleteness: 'Consider whether all the relevant factors driving this outcome are captured in the model.',

  /** RiskPanel — control levers nudge */
  riskControlLevers: 'Consider which factors you control that most affect this risk, and whether options address them.',

  /** GoalPanel — connections completeness nudge */
  goalConnections: 'Consider whether all relevant outcomes and risks are connected to your goal.',

  /** GoalPanel — success target unlock nudge */
  goalNoTarget: 'Adding a specific target unlocks probability calculations',
} as const

export type CoachingKey = keyof typeof COACHING
