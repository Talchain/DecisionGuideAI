/**
 * ⭐ A REAL CAPTURE, COMMITTED — the seven `enrichment.inference_warnings`
 * entries from Paul's run `1dd2133d`, exported 16 September 2026.
 *
 * ⛔ WHY IT LIVES HERE RATHER THAN BEING READ FROM DISK. The spec that uses it
 * first did `readFileSync('/Users/paulslee/Downloads/olumi-debug-…json')` at
 * MODULE LOAD. It passed on my machine and could not even COLLECT on a clean
 * checkout: hosted CI failed with `ENOENT` and took a whole shard with it. A
 * fixture that only resolves on the author's machine is not evidence about the
 * product, it is evidence about the author's Downloads folder.
 *
 * ⚠ IT IS A RECORD, NOT A FIXTURE TO KEEP CURRENT (CLAUDE.md trap 14b). These
 * are sentences the product ACTUALLY EMITTED on a dated run. Add to this file;
 * never edit an entry to match newer copy — a green suite over a rewritten
 * history is a suite agreeing with something that never happened.
 *
 * Trimmed to the fields any consumer reads (`code`, `severity`, `message`,
 * `field`, `affected_nodes`, `affected_labels`) with values verbatim. Note what
 * the capture shows: `affected_nodes` and `affected_labels` are absent on ALL
 * SEVEN, and `field` is absent on the one warning that names a real factor in
 * prose. That absence is the finding, so it is preserved exactly.
 */
export const INFERENCE_WARNINGS_1DD2133D = [
  {
    "code": "CONSTRAINT_TARGET_UNRELIABLE",
    "message": "The target on \"Budget Overrun Risk\" can't be scored against this model: \"Budget Overrun Risk\" is calculated from the factors feeding into it, so the analysis produces a modelled change for it, not a reading on the same scale as your target. Comparing the two would report a near-zero chance for every option no matter how good the options are, so goal-fit probabilities were withheld for this run rather than shown. Set a current value for \"Budget Overrun Risk\" — or state the target as the change you want from today — to make it comparable.",
    "severity": "warning"
  },
  {
    "code": "EDGE_E_VALUE_NON_FINITE_DROPPED",
    "message": "7 edge E-value entries were omitted from edge_e_values: 7 carried no finite E-value from the analysis engine (an unflippable edge, whose current and flip means coincide, has no evidence ratio). edge_e_values is shorter because those entries could not be represented, not because they were computed empty. All other analyses are unaffected.",
    "severity": "info"
  },
  {
    "code": "CONSTRAINT_NODE_DEFAULT_BASE",
    "message": "Node 'dac3fdc3' has no ParameterUncertainty — base offset defaulted to 0.0; its samples are the forward-propagated composition of its parents (all root ancestors carry data), so the constraint probability is model-derived, not a missing-data placeholder",
    "severity": "info",
    "field": "nodes[dac3fdc3].base"
  },
  {
    "code": "ROOT_NODE_DEFAULT_VALUE",
    "message": "No observed value provided for root node 'f91ee77c'; defaulted to 0.0. Results for downstream nodes may be unreliable.",
    "severity": "info",
    "field": "nodes[f91ee77c].observed_state.value"
  },
  {
    "code": "CONSTRAINT_NOT_CONVERTIBLE",
    "message": "A 'level' frame requires constraint target node 'dac3fdc3' to carry observed_state.baseline to convert the level into the samples' frame, but it carries no observed_state at all.",
    "severity": "warning",
    "field": "nodes[dac3fdc3].observed_state.baseline"
  },
  {
    "code": "GOAL_ANCESTOR_DATA_GAP",
    "message": "Goal node 'c3636f2d' is scored from its forward-propagated outcome distribution, but root ancestor(s) 'f91ee77c' carry no observed value or ParameterUncertainty and defaulted to 0.0 — goal-level probabilities partially rest on placeholder zeros (insufficient data).",
    "severity": "info",
    "field": "nodes[c3636f2d]"
  },
  {
    "code": "EVPI_UNAVAILABLE",
    "message": "Win-probability sensitivity (p_win_sensitivity) was skipped: its metric is P(joint_goal) and at least one goal constraint could not be resolved into its target's sample frame. Base analysis is unaffected.",
    "severity": "warning",
    "field": "p_win_sensitivity"
  }
] as const
