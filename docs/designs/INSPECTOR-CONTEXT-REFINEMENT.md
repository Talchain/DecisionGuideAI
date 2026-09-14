# Inspector context refinement

## Purpose

Selecting an action or a risk should reveal the team's full authored context. Long text must remain readable, and entered risk estimates must be distinguishable from modelled results.

## Display contract

| Surface | Display | Source and behaviour |
| --- | --- | --- |
| Action and other generic inspectors | Complete description | Existing `data.description`; the existing textarea grows to its content. Its editing limit and save route are unchanged. |
| Generic inspector, further detail | Distinct body text | Existing `data.body`, shown as plain read-only text with line breaks. Matching description/body text is not repeated. |
| Risk inspector, context | Complete description and distinct body | Existing authored strings, with line breaks and long words wrapping. Invalid non-text values are not converted into visible object strings. |
| Risk inspector, estimate | Likelihood, impact and existing derived severity | Existing Risk schema validates the stored inputs before display. Missing or invalid inputs remain unset. Zero remains zero. Severity is derived from the entered likelihood and impact; it is not sensitivity or an analysis result. |
| Risk likelihood editor | Exact entered percentage | A stored `0.376` may read as `38%`, but the editor opens with `37.6`. Opening and blurring must not round the stored value. |

## Design-system integration

Reuse `PanelGroup`, `PrimaryControlCard`, the existing panel typography, colour tokens and connection rows. The inspector scroll contains long context; no node geometry, top shape, icon meaning, colour or prototype changes are introduced. The existing router permission boundary and target-specific mutations remain in place. Body text does not gain an editor.

## Validation and release boundary

Dedicated receiving specs cover long and malformed context, duplicate text, exact risk precision, selected-node mutation, the surrounding disabled fieldset and connection navigation. The generic textarea sizing assertion uses measured-height stand-ins; it does not establish browser layout quality. Hosted checks and a deployed visual check of long context remain necessary before claiming those behaviours witnessed.

This note specifies the component change; it is not a claim that the revision is deployed or that the full collaborative journey has passed.
