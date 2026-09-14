# Action node content refinement

The resting and selected card use the existing Action shape, colours, typography and controls. A two-line preview shows the authored description, or the longer body when the description is absent. Selecting the card does not expand its content. Missing text reads “No action details captured.”

The existing description chevron opens both authored fields in its scrollable disclosure. This is a display-only composition; it does not update either stored field. Matching description and body are shown once. The preview hides while the disclosure is open. Long text is retained, including line breaks; malformed non-text values are treated as unavailable.

One neutral line names the first linked element in graph order and counts any additional links. Only edges whose other endpoint still exists are included. The full connection list remains in the existing inspector. “Linked” makes no assertion about test coverage, causality, confidence or completion. No owner, date or review status is inferred.

Ask retains the existing exact-node selection and conversation route. More and its existing inspector route are unchanged; Action does not acquire a new Challenge route. The generic inspector still edits description only: the body is available through the node’s explicit disclosure, not a new editor.

## Acceptance and verification

- A long description stays at two lines when resting or selected; explicit expansion exposes the complete description and any distinct body without a duplicate preview.
- A body-only action receives the same preview and expansion; an empty action does not invent a plan.
- Existing connections appear before analysis, with unnamed nodes shown as “Untitled” and dangling endpoints excluded.
- Ask on the second of two actions selects that exact action before sending and retains its original description and body.
- Focused receiving tests cover these states. Local execution was attempted with the existing Vitest installation, but stopped after more than two minutes with no test results during loading. No install, full build or full local suite was run. Hosted checks are required.
- Source candidate only: deployed layout, keyboard disclosure and the joined user journey have not been witnessed. After a hosted candidate is available, check these interactions on that exact bundle before claiming deployed acceptance.
