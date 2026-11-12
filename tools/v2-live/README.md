# v2 on the live engine (banked copy)
The live wiring for the new design (output/olumi-moves-20261112/v2-live, a frozen copy of v2 taken 12 Nov; that folder is not in git).
- live/: data-live.js (the View from the engine that serves the page, as window.VIEWS), actions.js (the engine's acts, PL-640 scoped),
  review.js/.css (conversation + review panel: Olumi's questions, reading answers held until approval, set aside, message box),
  build-dist.sh (assembles OLUMI_UI_DIST from the copy; v2's app.js is served as olumi-app.js because core reserves /app.js).
- adapter-typed-only.diff: the copy's adapter reads no number from display text (gaps G1-G4 counted in model.gaps).
- app-hook-H7.diff: the one app.js change in the copy (no 0% meter for a chance served only as words).
- proof/: the driver and runner (replay core on :4051, zero calls, own store copies).
