# Option node — current design reference

**9 September delivery update:** the premium V2 sheet below is the preserved visual foundation. The current application repairs, including reference values, missing/stale results, coaching recovery and the inspector, are tracked in the [V3 delivery specification](v3/DESIGN-SPEC.md) and [validation record](v3/VALIDATION.md). The sheet's simulated states describe the earlier #1333 scope; use the delivery register for subsequent behaviour and release status. No new prototype is being introduced.

Open [the premium V2, refined in place](v2/olumi-option-node-v2.html). This is the current **node and inspector component sheet**, updated at Paul's request on 8 September 2026. It replaces the earlier six-option exploration in that same file. The original project-output URL and this repository copy contain the same reference.

Use **At rest, Hover preview, Quick actions and Selected**, then try the example selector for long text, missing inputs and origin, a conditional coaching cue, and unavailable AI. The 125% review size magnifies existing geometry; 100% is available. The inspector is a separate component specimen and remains visible for comparison. The More menu shows the Open details excerpt, not every production entry.

Read [the implementation specification](v3/DESIGN-SPEC.md) for each element's producer, semantics and acceptance criteria. The sheet is aligned to the bounded application changes in [PR #1333](https://github.com/Talchain/DecisionGuideAI/pull/1333): it is not a live application, AI service or shared-model editor. On-node Ask sends an explanation request; inspector Ask and Challenge prepare drafts. These differences are explicitly explained by the local interactions.

## Current boundaries

- The example title, differentiator and values come from Paul's screenshot. It is a constructed pre-analysis fixture: no real-world units or before-values are inferred, and edges are omitted. Long/empty/guidance/unavailable variants are constructed robustness cases.
- The existing inspector body is read-only. Its authority notice, disabled controls and existing coaching fallback are retained. Header rename is simulated locally; the application uses its canonical save route.
- Post-analysis Support and its gated explanations remain in the application. This pre-analysis sheet does not demonstrate every results branch and does not claim their removal.
- The existing preview coaching chip can remain visible without a send/dispatch channel. The unavailable example calls out this source-level gap; it is not repaired by #1333.
- Static layout and local scripted interaction checks do not establish production timing, staging deployment, live AI quality or a collaborative journey.

## Superseded and historical material

The separate `v3/olumi-option-node-v3.html` and `v3/prototype.template.html` were rejected and must not be used as the design target. The template is build input, not an openable reference. `v2/source-fragment.html`, earlier V2 notes, screenshots and Figma exports describe historical versions. Do not rebuild the current reference from them.

The current specification is `v3/DESIGN-SPEC.md`; `v3/IMPLEMENTATION.md` and `v3/VALIDATION.md` retain application evidence with its exact boundaries. V1 and historical files remain preserved where present. Earlier review and product-context documents provide background; they do not override the current specification.

Claude Code Canvas is independently reviewing the actual application through [the review brief on #1333](https://github.com/Talchain/DecisionGuideAI/pull/1333#issuecomment-5592283113). Coordination and ACKs use [programme #38](https://github.com/Talchain/olumi-programme-docs/pull/38#issuecomment-5592307709). Design files are owned by Codex for this refinement; no competing prototype edits are requested.
