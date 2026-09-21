/**
 * ⭐ A RECORD OF WHAT THE PRODUCER ACTUALLY SENT — append-only, never edited.
 *
 * `inference_warnings` exactly as received on Paul's manual-test run
 * `olumi-debug-95b92672`, 21 Sep 2026. This is the payload whose humanised form
 * rendered TWO rows both reading "Part of this analysis was limited".
 *
 * ⛔ CLAUDE.md trap 14b: a dated capture is EVIDENCE, not a fixture to keep
 * current. If the producer's vocabulary changes, add a new record beside this
 * one; do not rewrite this one to match.
 */
export const INFERENCE_WARNINGS_95B92672 = [
  {
    "code": "EDGE_E_VALUE_NON_FINITE_DROPPED",
    "message": "2 edge E-value entries were omitted from edge_e_values: 2 carried no finite E-value from the analysis engine (an unflippable edge, whose current and flip means coincide, has no evidence ratio). edge_e_values is shorter because those entries could not be represented, not because they were computed empty. All other analyses are unaffected.",
    "severity": "info"
  },
  {
    "code": "GOAL_DIRECTION_UNATTESTED",
    "field": "goal_direction",
    "message": "No objective sense was stated for the goal node, so options were ranked by largest goal value. That is an assumption, not the team's stated aim: if the goal is a quantity to reduce, or the aim is to land near a target rather than as high as possible, this ranking answers a different question. Send goal_direction to rank against the stated objective.",
    "severity": "warning"
  },
  {
    "code": "FACTOR_EVPPI_NOT_COMPUTED",
    "field": "factor_evppi",
    "message": "Value-of-information ran but produced no rows. The reason is not known at this layer and has deliberately not been inferred.",
    "severity": "info"
  }
] as const
