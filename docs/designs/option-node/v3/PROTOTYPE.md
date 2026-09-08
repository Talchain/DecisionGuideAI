# V3 interactive prototype

Open [olumi-option-node-v3.html](olumi-option-node-v3.html) in a browser.
It is a single offline HTML file. No dependencies, AI calls or installation
are required to view it. Inter is used when available, with the system sans
font as fallback; this is not a promise of pixel-identical font rendering.

This is an interactive reference for the bounded V3 implementation, not the
running React application. Its source is [prototype.template.html](prototype.template.html).
The build script exports actual brand tokens, the ratified provenance
classifier and icon registry, existing Lucide action icons, and two options
from the repository's captured headcount starter. V1 and V2 are preserved.

## Try these interactions

1. Hover the node body, then Challenge. The node preview gives way to the
   action explanation. Tab also reveals the explanation; Escape dismisses it.
2. Activate Challenge. The option-specific draft is visible and unsent.
   Ask demonstrates the existing send-on-activation route with a clearly
   labelled simulation. No generated answer is fabricated.
3. Open More → Open details. Click the inspector title to rename it; Enter
   saves within the example and Escape cancels. Changes reset on reload.
4. Switch to Long option name, Missing values and origin, or AI unavailable.
   Unavailable provenance disappears without inventing a replacement, and an
   unavailable AI channel leaves More accessible.
5. Compare 50% and 100% scale. The shape stays above the node, and the compact
   action targets scale with it, matching the documented limitation.

## Scope and limits

The graph is a connected excerpt with static edge routing. It does not emulate
React Flow dragging, camera behaviour, the full context menu, analysis,
collaboration or persistence. The inspector and conversation demonstrate the
specific interactions in the V3 specification; they do not implement every
current product control. Modelled levels are displayed without inventing
before-values or real-unit deltas. No new readiness, bias or review badges have
been added in this slice.

The application tests and screenshots in [IMPLEMENTATION.md](IMPLEMENTATION.md)
and [VALIDATION.md](VALIDATION.md) remain the evidence for the actual PoC code.
Prototype interactions do not upgrade that evidence to a deployed journey.

## Browser verification

Checked in Chromium at 1440 × 900 and 1280 × 800. Passed: body preview,
action/preview priority, Escape, focus description, option-specific unsent
Challenge draft, keyboard details menu, long-title wrapping, rename save and
cancel, missing values/origin, unavailable-AI controls, both zoom settings,
Ask/send simulation, hoverable tooltip, and no network requests during those
AI interaction previews. No script errors were observed.

The first pointer test attempted to click a shortcut before revealing it;
it was corrected to hover the node first, matching the user interaction.
No product change or forced click was used to make that check pass.

- [Overview](prototype-overview.png)
- [Action tooltip](prototype-actions.png)
- [Challenge draft](prototype-challenge.png)
- [Long-title inspector](prototype-inspector.png)

## Rebuild

From the repository root, with its existing dependencies installed:

```sh
node docs/designs/option-node/v3/build-prototype.mjs
```

The build writes only `olumi-option-node-v3.html` alongside this document.
It reads the current brand and provenance modules rather than maintaining a
second icon classification table. Inspect deliberate token changes before
rebuilding; the script checks the option-colour snapshot used for this version.
