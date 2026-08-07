/**
 * L60 PRODUCER-BYTE FIXTURES — the three witnessed frame-broken shapes.
 *
 * ⚠ GENERATED, NOT HAND-WRITTEN. Every object below is a verbatim
 * `option_comparison[]` entry lifted from L60's captured artefacts in
 * `PHASE0-EVIDENCE-2026-07-28/l60-artefacts/`. Nothing here was invented to
 * make a test pass; the numbers are what the deployed producer emitted.
 *
 * Source artefacts and their SHA-256 at generation time:
 *   runfact-04f53491-run1.json  4df65cac576231015281e72bb53400ecb9f4deaa4f64f1f564ea9f217c5153c3
 *   runfact-7fe412ba-run3.json  e4c24be0d4d46810cc94f72c153f71b5257689fddce09698578f65d3c91edf3d
 *   probe-plot-response.json    27f438ba25593f0d937fbda67bf84dd7fe05fdeb7616d1fb6af3e17d93875e19
 *
 * WHAT EACH SHAPE IS (L60 §6 / §8.2 — all three are the SAME defect):
 *
 *  · PRICING  real session, 3 Aug. Draft-minted margin constraint
 *    `out_gross_margin >= 0.8 'fraction'`, `scale_provenance.source: 'default'`,
 *    `constraints_decision_grade: FALSE` — and it rendered anyway.
 *  · PEOPLE   real session, same night. Chat-minted COUNT constraint
 *    `risk_ae_attrition <= 2 'count'`, `scale_provenance.source: 'explicit_cap'`,
 *    `constraints_decision_grade: TRUE` — decision-grade-stamped and still
 *    frame-broken ("≤2 AEs of 8" evaluated as P(risk-score-sample ≤ 0.25)).
 *    Note it carries NO `goal_fit_basis` at all.
 *  · PROBE    synthetic run against deployed PLoT/ISL (`_meta.builds` =
 *    plot 2864b0c / isl 80aa83f). Goal-target constraint
 *    `goal_mrr >= 250000 'level'`, `goal_threshold_cap`, decision-grade TRUE.
 *
 * In all three, `probability_of_goal` / `goal_probability` is ABSENT (the
 * honest channel failed closed) and `probability_of_joint_goal` is present and
 * structurally ≈0 — the exact input that drove the substitution.
 */

/** Verbatim `option_comparison` entries — pricing scenario, run 1. */
export const L60_PRICING_OPTIONS = [
  {
    "id": "opt_hold",
    "label": "Hold at £49 Per Seat (Status Quo)",
    "status": "computed",
    "outcome": {
      "p10": -0.03613319044678028,
      "p50": 0.12757593878224927,
      "p90": 0.2629372109066514,
      "std": 0.11796575608786203,
      "mean": 0.12102572420856127,
      "n_samples": 10000,
      "validity_ratio": 1,
      "n_valid_samples": 10000
    },
    "option_id": "opt_hold",
    "option_label": "Hold at £49 Per Seat (Status Quo)",
    "goal_fit_basis": {
      "node_ids": [
        "out_gross_margin"
      ],
      "scored_from": "modelled_outcome_distribution"
    },
    "win_probability": 0.020675,
    "constraint_margins": [
      {
        "constraint_id": "constraint_out_gross_margin_min",
        "near_miss_fraction": 0,
        "failure_margin_median": 0.5630574027128157
      }
    ],
    "constraint_probabilities": {
      "constraint_out_gross_margin_min": 0
    },
    "probability_of_joint_goal": 0,
    "constraints_decision_grade": false
  },
  {
    "id": "opt_pilot",
    "label": "Raise to £59 with 90-Day Grandfathering Pilot",
    "status": "computed",
    "outcome": {
      "p10": 0.00009992473409735536,
      "p50": 0.17835204350068484,
      "p90": 0.344992029859525,
      "std": 0.1366007846593304,
      "mean": 0.17479962109701008,
      "n_samples": 10000,
      "validity_ratio": 1,
      "n_valid_samples": 10000
    },
    "option_id": "opt_pilot",
    "option_label": "Raise to £59 with 90-Day Grandfathering Pilot",
    "goal_fit_basis": {
      "node_ids": [
        "out_gross_margin"
      ],
      "scored_from": "modelled_outcome_distribution"
    },
    "win_probability": 0.423625,
    "constraint_margins": [
      {
        "constraint_id": "constraint_out_gross_margin_min",
        "near_miss_fraction": 0,
        "failure_margin_median": 0.5147017706133903
      }
    ],
    "constraint_probabilities": {
      "constraint_out_gross_margin_min": 0
    },
    "probability_of_joint_goal": 0,
    "constraints_decision_grade": false
  },
  {
    "id": "opt_raise",
    "label": "Raise to £59 Per Seat",
    "status": "computed",
    "outcome": {
      "p10": -0.03281096682804376,
      "p50": 0.15424030709835906,
      "p90": 0.30498816558265374,
      "std": 0.13214061015506698,
      "mean": 0.14572138842656235,
      "n_samples": 10000,
      "validity_ratio": 1,
      "n_valid_samples": 10000
    },
    "option_id": "opt_raise",
    "option_label": "Raise to £59 Per Seat",
    "goal_fit_basis": {
      "node_ids": [
        "out_gross_margin"
      ],
      "scored_from": "modelled_outcome_distribution"
    },
    "win_probability": 0.17807499999999998,
    "constraint_margins": [
      {
        "constraint_id": "constraint_out_gross_margin_min",
        "near_miss_fraction": 0,
        "failure_margin_median": 0.5147017706133903
      }
    ],
    "constraint_probabilities": {
      "constraint_out_gross_margin_min": 0
    },
    "probability_of_joint_goal": 0,
    "constraints_decision_grade": false
  },
  {
    "id": "opt_tiers",
    "label": "Introduce £39 / £69 Two-Tier Pricing",
    "status": "computed",
    "outcome": {
      "p10": -0.04372169657168537,
      "p50": 0.17425489983657472,
      "p90": 0.3729525314022953,
      "std": 0.1610180859004306,
      "mean": 0.16882110388736365,
      "n_samples": 10000,
      "validity_ratio": 1,
      "n_valid_samples": 10000
    },
    "option_id": "opt_tiers",
    "option_label": "Introduce £39 / £69 Two-Tier Pricing",
    "goal_fit_basis": {
      "node_ids": [
        "out_gross_margin"
      ],
      "scored_from": "modelled_outcome_distribution"
    },
    "win_probability": 0.377625,
    "constraint_margins": [
      {
        "constraint_id": "constraint_out_gross_margin_min",
        "near_miss_fraction": 0,
        "failure_margin_median": 0.538879586663103
      }
    ],
    "constraint_probabilities": {
      "constraint_out_gross_margin_min": 0
    },
    "probability_of_joint_goal": 0,
    "constraints_decision_grade": false
  }
] as const

/** Verbatim `option_comparison` entries — people scenario, run 3. */
export const L60_PEOPLE_OPTIONS = [
  {
    "id": "opt_coach",
    "label": "Coach VP for 90 Days",
    "status": "computed",
    "outcome": {
      "p10": -0.1389575634478105,
      "p50": -0.016253818769636996,
      "p90": 0.13874885280628005,
      "std": 0.11018187732741158,
      "mean": -0.006684217345643961,
      "n_samples": 10000,
      "validity_ratio": 1,
      "n_valid_samples": 10000
    },
    "option_id": "opt_coach",
    "option_label": "Coach VP for 90 Days",
    "win_probability": 0.2887083333333336,
    "constraint_margins": [
      {
        "constraint_id": "gc-e9543857-e145-4ed5-a729-905529d9b0dd",
        "near_miss_fraction": 0,
        "failure_margin_median": 18.002137272472513
      }
    ],
    "constraint_probabilities": {
      "gc-e9543857-e145-4ed5-a729-905529d9b0dd": 0
    },
    "probability_of_joint_goal": 0,
    "constraints_decision_grade": true
  },
  {
    "id": "opt_cro",
    "label": "Hire CRO Above VP of Sales",
    "status": "computed",
    "outcome": {
      "p10": -0.148624082727891,
      "p50": 0.03512728507637698,
      "p90": 0.2182432775177721,
      "std": 0.1445043548037945,
      "mean": 0.034499101227603676,
      "n_samples": 10000,
      "validity_ratio": 1,
      "n_valid_samples": 10000
    },
    "option_id": "opt_cro",
    "option_label": "Hire CRO Above VP of Sales",
    "win_probability": 0.544441666666666,
    "constraint_margins": [
      {
        "constraint_id": "gc-e9543857-e145-4ed5-a729-905529d9b0dd",
        "near_miss_fraction": 0.00010015022533800701,
        "failure_margin_median": 31.8966279077316
      }
    ],
    "constraint_probabilities": {
      "gc-e9543857-e145-4ed5-a729-905529d9b0dd": 0.0015
    },
    "probability_of_joint_goal": 0.0015,
    "constraints_decision_grade": true
  },
  {
    "id": "opt_replace",
    "label": "Replace VP of Sales Now",
    "status": "computed",
    "outcome": {
      "p10": -0.4095583881241738,
      "p50": -0.14789361453182195,
      "p90": 0.10510100578028671,
      "std": 0.1995890317988956,
      "mean": -0.15211272555890115,
      "n_samples": 10000,
      "validity_ratio": 1,
      "n_valid_samples": 10000
    },
    "option_id": "opt_replace",
    "option_label": "Replace VP of Sales Now",
    "win_probability": 0.10380833333333335,
    "constraint_margins": [
      {
        "constraint_id": "gc-e9543857-e145-4ed5-a729-905529d9b0dd",
        "near_miss_fraction": 0,
        "failure_margin_median": 51.66854604312486
      }
    ],
    "constraint_probabilities": {
      "gc-e9543857-e145-4ed5-a729-905529d9b0dd": 0
    },
    "probability_of_joint_goal": 0,
    "constraints_decision_grade": true
  },
  {
    "id": "opt_status_quo",
    "label": "Continue as-is (Status Quo)",
    "status": "computed",
    "outcome": {
      "p10": -0.1475729164398055,
      "p50": -0.062381410253707616,
      "p90": 0.02494799344555471,
      "std": 0.07007526440098573,
      "mean": -0.061863238018065474,
      "n_samples": 10000,
      "validity_ratio": 1,
      "n_valid_samples": 10000
    },
    "option_id": "opt_status_quo",
    "option_label": "Continue as-is (Status Quo)",
    "win_probability": 0.06304166666666666,
    "constraint_margins": [
      {
        "constraint_id": "gc-e9543857-e145-4ed5-a729-905529d9b0dd",
        "near_miss_fraction": 0,
        "failure_margin_median": 18.002137272472513
      }
    ],
    "constraint_probabilities": {
      "gc-e9543857-e145-4ed5-a729-905529d9b0dd": 0
    },
    "probability_of_joint_goal": 0,
    "constraints_decision_grade": true
  }
] as const

/** Verbatim `option_comparison` entries — synthetic goal-target probe. */
export const L60_PROBE_OPTIONS = [
  {
    "option_id": "option_hold",
    "option_label": "Hold at £49",
    "id": "option_hold",
    "label": "Hold at £49",
    "outcome": {
      "mean": 0.027282928494601323,
      "std": 0.15387841718359827,
      "p10": -0.18113270723803077,
      "p50": 0.035861632979633684,
      "p90": 0.2245363849396803,
      "n_samples": 2000,
      "n_valid_samples": 2000,
      "validity_ratio": 1
    },
    "status": "computed",
    "win_probability": 0.04975,
    "probability_of_joint_goal": 0,
    "constraint_probabilities": {
      "gc-l60-probe": 0
    },
    "constraints_decision_grade": true,
    "constraint_margins": [
      {
        "constraint_id": "gc-l60-probe",
        "failure_margin_median": 238793.23969386448,
        "near_miss_fraction": 0
      }
    ],
    "goal_fit_basis": {
      "scored_from": "modelled_outcome_distribution",
      "node_ids": [
        "goal_mrr"
      ]
    }
  },
  {
    "option_id": "option_raise",
    "option_label": "Raise to £59",
    "id": "option_raise",
    "label": "Raise to £59",
    "outcome": {
      "mean": 0.14038738666155756,
      "std": 0.1933410584098391,
      "p10": -0.14154574157001282,
      "p50": 0.15782836832512714,
      "p90": 0.376322484211003,
      "n_samples": 2000,
      "n_valid_samples": 2000,
      "validity_ratio": 1
    },
    "status": "computed",
    "win_probability": 0.95025,
    "probability_of_joint_goal": 0,
    "constraint_probabilities": {
      "gc-l60-probe": 0
    },
    "constraints_decision_grade": true,
    "constraint_margins": [
      {
        "constraint_id": "gc-l60-probe",
        "failure_margin_median": 200678.63489839778,
        "near_miss_fraction": 0
      }
    ],
    "goal_fit_basis": {
      "scored_from": "modelled_outcome_distribution",
      "node_ids": [
        "goal_mrr"
      ]
    }
  }
] as const

/** Verbatim run-level `constraint_results` — pricing (decision_grade FALSE). */
export const L60_PRICING_CONSTRAINT_RESULTS = [
  {
    "value": 0.8,
    "node_id": "out_gross_margin",
    "operator": ">=",
    "option_id": "opt_hold",
    "probability": 0,
    "constraint_id": "constraint_out_gross_margin_min",
    "scale_provenance": {
      "source": "default",
      "range_unified": true,
      "decision_grade": false
    }
  }
] as const

/** Verbatim run-level `constraint_results` — people (decision_grade TRUE). */
export const L60_PEOPLE_CONSTRAINT_RESULTS = [
  {
    "value": 2,
    "node_id": "risk_ae_attrition",
    "operator": "<=",
    "option_id": "opt_coach",
    "probability": 0,
    "constraint_id": "gc-e9543857-e145-4ed5-a729-905529d9b0dd",
    "scale_provenance": {
      "source": "explicit_cap",
      "range_unified": true,
      "decision_grade": true
    }
  }
] as const

/** Verbatim run-level `constraint_results` — probe (decision_grade TRUE). */
export const L60_PROBE_CONSTRAINT_RESULTS = [
  {
    "constraint_id": "gc-l60-probe",
    "node_id": "goal_mrr",
    "operator": ">=",
    "value": 250000,
    "probability": 0,
    "option_id": "option_hold",
    "scale_provenance": {
      "source": "goal_threshold_cap",
      "range_unified": true,
      "decision_grade": true
    }
  }
] as const
