/**
 * Is the goal's sample band (each option's p10 / p50 / p90) in the user's own
 * units? NOT ON ANY RUN TODAY.
 *
 * The engine's goal samples carry no intercept (`intercept_populated: false`
 * on both of Paul's 27 Sep exports), so a £ goal's band is a model level, not
 * the user's figure: Paul's MRR model printed "£15,320" as the status quo's
 * median beside a stated £75,000 (MG #70 5854878511, by hand: 0.8 × weighted
 * inputs × the £125k cap). The goal-fit chance is anchored separately (ISL
 * level mode: the user's baseline plus each option's delta) and is untouched.
 *
 * ⚠ ONE SWITCH. DL 5854887316 item 1: "don't show raw goal samples as the
 * user's unit" until a level-anchored band exists. When AI Quality names that
 * field, read it here, and every reader below follows.
 *
 * Readers: the values table in About (`AboutThisAnalysis`), the "Modelled
 * outcome" axis (`OptionsComparison`), and the outcome claim's readout
 * (`buildAnalysisNewViewModel`).
 */
export function goalBandIsInUserUnits(): boolean {
  return false
}
