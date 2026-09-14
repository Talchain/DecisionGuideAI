# Factor and goal content — implementation and design-system addition

9 September 2026. Bounded application of the [whole-graph plan](https://github.com/Talchain/DecisionGuideAI/blob/b3ecc283/docs/designs/CANVAS-ELEMENT-PLAN.md). Existing geometry, top shapes, colours, typography and action routes are retained. Premium V2 is unchanged.

## What the user can do

The factor preview distinguishes the current value from the settings recorded for each option. Full option names remain readable and open that option's inspector. Four options are shown in stable canvas order, with an explicit control to expand the remainder in the same preview. The controllable-factor inspector shows the complete same set, including options without drawn edges to the factor.

The goal preview exposes recorded constraints while the model is being framed, with or without a numerical goal target. The preview and inspector state the same constraint name, operator, bound and supplied unit. An unlabelled constraint uses its referenced node's name; a missing bound is disclosed. Existing source quotes, goal results and coaching remain available.

## Shared component rules

| Information | Presentation rule | Meaning and fallback |
|---|---|---|
| Current factor value | Existing factor formatter, explicitly captioned in the preview with the shared value-provenance label and glyph. An absent/unrecognised source says “Source not recorded”. | No new units, before-values or quantities are inferred. Value origin is distinct from the origin of the factor node, and does not establish accuracy. |
| Option setting | Shared setting projection in preview and inspector. Retain authored display text and qualitative settings; numeric values use the existing intervention scale formatter. | A baseline flag or equal factor value does not erase an option's setting. Missing setting and explicitly unspecified value remain distinct. |
| Option name and overflow | Full wrapping name, clickable through the existing inspector route. First four in canvas order, with a visible remaining count and inline expansion. | This table describes settings; its order does not convey a simulation ranking. |
| Constraint | Full wrapping name, operator, recorded magnitude and its supplied unit. Inferred/proxy records append “Inferred limit”/“Proxy limit” in both views. | Origin is separate from the computed probability of satisfying a boundary. Explicit records are not labelled verified or necessarily from the brief; missing data does not become zero or another factor's label. |
| Coaching and evidence | Existing actions and source quotes remain. Goal coaching is accessible while framing a stated target. | No new diagnosis, score, calculation or auto-applied edit is introduced. |

This addition is kept separate from the active `DESIGN_SYSTEM.md` reconciliation in #1319 to avoid taking over that file. The existing Canvas reviewer owns reconciliation into that document; trigger is the accepted content delta and resolution of #1319's pending changes. It introduces no new token or glyph meaning.

## Validation and limits

Receiving tests mount the actual FactorNode/GoalNode and corresponding inspector panels against the same store data. They cover the normalised-price setting, current-value provenance, a baseline that changes a factor, long names, overflow navigation, missing/qualitative values, canonical option display text, pre-analysis constraints, units and absent bounds. Constraint helper checks preserve inferred/proxy origins independently of confidence and probability. The connected-add positive control uses a real outcome target, so neighbouring no-digit cases retain their discriminator. Existing node tests retain opposite cases such as external factors and no options.

Hosted checks and independent review are required before release. Portal positioning and the complete staging journey remain with Strategic Path's existing browser driver; a mocked portal-positioning layer in the receiving test does not prove browser geometry. There are no backend writer, model schema or calculation changes. Broader risk/outcome/action content follows the programme's priority and this batch's acceptance.

The existing normal/reduced-zoom corpus caught an internal unit descriptor leaking into the ordinary factor body. The card retains its shared unit-suppression guard before the common value reader; the corpus and its real-unit contrast cases are unchanged. Option links declare their existing graph target with `data-node-selection-target`. The portalled-control browser check requires that exact target on click, Enter and Space, with no additional selection and none on focus or the `q` contrast. This narrow check update was transferred from the #1301 owner; its Shift-drag and handle checks are retained.

External-factor context counts distinct linked outcomes, excluding other kinds and dangling links. The wider-range coaching invitation requires a stated current value and complete option settings close to it; a placeholder, missing setting or distant cluster does not generate an anchoring diagnosis.
