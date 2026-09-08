# Option node V3 — PoC refinements

The reference is [DESIGN-SPEC.md](DESIGN-SPEC.md), which separates the current
implementation from the remaining node and inspector design work.
The current visual reference is [the original premium V2, refined in place](../v2/olumi-option-node-v2.html). It illustrates the node, hover and inspector at the application boundary below. The separate V3 prototype was rejected and is excluded from this PR. The component sheet is local simulation, not application evidence.

This version changes the application components. V1 and V2 remain comparison
artefacts. The scope is the existing node controls, hover preview behaviour,
and option inspector title; no new option taxonomy or inferred quantities.

## Implemented behaviour

- Three quick actions: Ask Olumi, Challenge, More. Existing capability gates
  remain authoritative. Ask uses the existing explanation request; Challenge
  opens a draft for the person to review.
- Open details is in the existing More menu and uses `openNodeInspector`,
  which selects the named node before raising its inspector. Clicking a node
  continues to open its inspector.
- Quick-action tooltips use the existing Floating UI tooltip, attached to the
  actual button. They wrap, reposition at viewport edges, appear on focus,
  remain readable when hovered, and dismiss with Escape or activation.
- The node preview yields while the action row is hovered or focused. Returning
  to the node body restores the normal delayed preview. Escape dismisses a body
  preview until the pointer leaves and returns.
- Option inspector titles wrap at full width. Header controls share the type
  row; rename semantics and the existing character limit are preserved.
- The top-centre type shape, node dimensions, provenance glyphs and graph
  connections retain their existing implementation.

The design-system quick reference and V5 specification record these behaviours.
`MenuItemDef.icon` now explicitly accepts the Lucide icon type already used by
the menu, without casting the new details icon or loosening the type to `any`.

## Producer and consumer trace

This change introduces no model-data producer or adapter. Pointer/focus events
reach `usePopoverHover` and the shared tooltip; their local state determines
which preview is visible. Quick actions retain the existing `askAI`,
`buildAskAIPrompt`, `requestAsk` and context-menu routes. The new menu entry calls
the existing `openNodeInspector` selection/visibility helper. The title remains
the inspector's existing `label`, with the same `EditableLabel` save callback.

Unknown origin, review, team contribution or result data is not manufactured.
The available-data signal proposals from earlier reviews are outside this
bounded implementation. Reopen those when a component brief binds each signal
to its actual producer, priority, explanation and action.

## Browser evidence

These are local application checks, using the repository's captured headcount
starter through `applyDraftResult`. They are not staging or backend journey
evidence. API calls were kept offline; service-failure notices in the captures
are expected from that test setup. The feature posture comes from the checked-in
Netlify feature declarations, not a measurement of deployment settings.

| Check | Evidence |
|---|---|
| Connected graph; ordinary body hover opens its preview | [Body preview](body-preview.png) |
| Challenge tooltip replaces the body preview; Escape dismisses it | [Action tooltip](action-tooltip.png) |
| Tab reaches Challenge and its associated tooltip | [Keyboard disclosure](keyboard-tooltip.png) |
| Enter opens the option-specific draft; no V5 request was sent | [Challenge draft](challenge-draft.png) |
| More supports keyboard navigation to Open details; inspector shows the full long title | [Inspector](inspector.png) |
| Long name and absent AI channel preserve the remaining menu affordance | [Long name](long-name.png) |
| Panning near the top edge makes the tooltip flip below its control | [Viewport edge](viewport-edge.png) |
| Actual zoom control changes to 100%; tooltip remains anchored | [100% zoom](zoom-100.png) |

Checked at 1440 × 900 and 1280 × 800, including the normal 50% canvas zoom.
The existing controls render at 10 px with 50% zoom and 20 px with 100% zoom;
this change does not claim a 24 px on-screen target at every zoom level.

The first headed screenshot captures were rejected: pointer events showed the
desktop pointer leaving the action during capture. The retained hover captures
come from an isolated headless browser. Inspector captures wait for full
opacity, not just DOM presence during the opening transition.

## Automated validation

Targeted checks cover quick-action routing, correct-node selection, menu
availability, tooltip/preview precedence, Escape, focus association, reference
and handler preservation, factor-node regressions, and inspector rename and
authority binding. The repository typecheck gate and lint are also required.

Validation command outcomes and the release boundary are recorded in
[VALIDATION.md](VALIDATION.md). No deployment is implied by these artefacts.
