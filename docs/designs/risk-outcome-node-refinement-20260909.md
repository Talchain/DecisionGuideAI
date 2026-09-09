# Risk and Outcome card refinement

The resting cards should explain what the model says about a risk or consequence without requiring a long card or an analysis result. This change keeps the existing node shapes, widths, handles, shared header and selection behaviour.

## Component treatment

| Surface | Treatment | Source and meaning |
| --- | --- | --- |
| Risk context | Two-line neutral preview; full text remains behind the existing description chevron and inspector | `data.description` or `data.body`, authored model context |
| Risk estimate | Existing likelihood, impact and severity display with visible “Entered estimate” wording; malformed values are withheld using the existing schema | `RiskNodeDataSchema.probability` and `impact`; severity still uses `calculateRiskSeverity` |
| Risk exploration | Existing reduction and mitigation prompts include the complete authored context | Existing `NodeChip` conversation route; “Explore mitigation” accurately describes a request for suggestions |
| Outcome context | Two-line neutral consequence preview; full text remains expandable | `data.description` or `data.body`, authored model context |
| Outcome exploration | “Explore consequences” remains available before and after analysis; asks about benefits and downsides | Existing `NodeChip` route, with the current label and complete authored context |
| Outcome assumptions | Preserve the full upstream name and include the outcome in the validation question | Existing connected node and authored description; no inferred causal importance |
| Outcome goal probability | Existing Detailed-only figure reads “Goal chance” | Existing `useNodeDisplayMetadata.achievementProbability` goal measurement; eligibility and modelled-basis caveat unchanged |

Previews use the existing `typography.nodeLabel`, `text-text-light`, line clamp and word-wrap patterns. As with Action, `group-aria-expanded:hidden` hides the preview while the existing description control is expanded. The display-only full text combines description and a distinct body, without writing either canonical field or duplicating matching text. When both authored fields are blank, there is no empty preview or expansion button. The visible entered-estimate qualifier does not add a native tooltip. Missing labels receive a type-specific untitled label. Context is not rewritten or shortened in the model or sent prompt.

Standard selection stays compact. Coaching stays in the existing Standard hover and Detailed treatments; full description and distinct body text remain keyboard-expandable and persistently available through the inspector. Ask, Challenge and More remain owned by the untouched shared node.

## Data boundary

Bridge strengths retain their existing provenance and human-settlement gates. They are not recast as sensitivity, risk likelihood, outcome forecasts or computed contributions. No scores, measurements, classifiers or metadata are added.

The existing goal-probability field is borrowed from the analysis goal, so its caption is made precise within its current Detailed-only branch. This change does not increase its eligibility or infer a recommendation from the pointer that supplied it.

The inspected likelihood and impact setters are `useInspectorMutations.setProbability` and `setImpact`, called by the manual controls in `RiskPanel`. The card therefore labels these as entered estimates. This narrow writer check is not a claim that every possible import path has been audited.

Source availability does not establish live payload coverage. Risk sensitivity support, authored probability coverage and outcome-specific forecasts remain unverified here; this change makes no claim that engine support is absent.

## Validation state

- Receiving checks cover full-description and body recovery, matching-body deduplication, expanded-preview hiding, missing context, malformed and zero risk likelihood, complete contextual AI messages, long upstream names and the existing Standard/Detailed probability boundary.
- Risk/Outcome expectations are updated in the shared rendering matrix and copy census; other node expectations are unchanged.
- Two attempts using the existing local test runtime reached the runner banner but produced no test results. Both were stopped; there is no local passing-test claim. No installation, build or full test suite was run.
- Hosted CI and a deployed visual witness remain required. No deployment or ordinary-user journey is claimed by this component change.
