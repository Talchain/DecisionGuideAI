# Graph coaching accel v1 — manual walkthrough checklist

Run on a staging-equivalent environment (local dev server against staging
backends, or the staging deploy). Use a realistic post-analysis model
(≈16 nodes, e.g. the "Product Team Growth Strategy" audit scenario) plus the
40-node capacity fixture where noted. This checklist covers the states the
2026-07-05 audit walked, plus the behaviours this brief changed.

## 1. Run-path convergence (no silent no-ops)

- [ ] Pre-analysis panel "Analyse first pass" starts a run OR shows a toast
      with the blocked reason. Never nothing.
- [ ] With the floating Olumi panel MINIMISED (pill), "Analyse first pass"
      still works (keep-mounted registration fix).
- [ ] Open the Olumi dock tab, switch away to Analysis — run CTAs still work
      (ownership-guarded unregistration fix).
- [ ] ⌘Enter runs the SAME pipeline (watch the network: no thin
      `{graph,seed,goal_node,detail_level}`-only body from the canvas path;
      request carries beliefs + goal threshold, or the run is CEE-brokered).
- [ ] Command palette → Run Analysis: same pipeline; blocked runs show the
      reason in the palette banner.
- [ ] Error card "Try Again" / stale banners "Rerun analysis": same pipeline,
      never silent.
- [ ] Canvas run and chat Rerun on the SAME unchanged model produce the same
      leader and the same win probabilities.

## 2. Browser analysis reliability (D1)

> **Lane B hard pause (ratified 2026-07-05):** the direct-origin fallback and
> the csp-nonce `excludedPath` change are NOT part of this branch — the 504
> evidence points to external Netlify/QUIC transport, diagnosed separately
> (csp-nonce hygiene lives on `chore/csp-nonce-bff-exclusion`).

- [ ] Browser DevTools → Network: POST run completes (200) through
      `/bff/engine/v1/run` (or the CEE-brokered turn on the canonical path).
- [ ] On failure: the error card appears (no silent timeout), and Try Again
      retries.

## 3. Capacity (D2)

- [ ] 40-node / ≤100-edge fixture: run completes; NO "Graph too large"
      critical issue (PLoT limit now 40; UI edge ceiling raised to
      min(160, engine-advertised)).
- [ ] 41+ nodes: honest blocker critique appears; results marked approximate;
      "(results marked approximate)" heading suffix — NOT "(blocks analysis)"
      — when results still render.
- [ ] >120 edges (only reachable when engine advertises >120): advisory
      density notice, non-blocking.

## 4. Display coherence (D4)

- [ ] Factor cards: pre-analysis pills read "▲ N% <target>" (title: link
      strength); post-analysis lists read "N% conf." — the two formats are
      visibly different; no unlabelled bare % for edge semantics anywhere.
- [ ] One intervention (e.g. Team seniority 0.5→0.6) reads consistently on:
      option card pill, option hover popover, on-canvas factor annotation,
      inspector row. No "Does not change" for a real change; "1 engineer"
      (singular) correct.
- [ ] Status-quo option card shows ONE win-probability line (no
      "win rate across simulations" duplicate).
- [ ] Identical "Behind:" reasons are suppressed rather than repeated on
      multiple losers.
- [ ] Robustness didn't run → stress-test section says fragility is
      UNCHECKED (never "your model is currently consistent"); degraded run →
      provisional wording; clean computed run → clean wording.
- [ ] Goal node: target set + no probability → "Target set. Rerun the
      analysis to see your chances." (never "Set a target…" with a target
      set); target set + probability → probability shown.
- [ ] Edit any factor/target after a run: win % bars, Leading badge,
      decision headline and goal stability bar all dim with "Model changed
      since this analysis" (canvas now matches the panels' stale state).
- [ ] Detailed view on the 16-node audit scenario: no node title occluded by
      a neighbouring card; capped lists show "+N more in inspector".

## 5. AI-to-graph highlighting (D5)

- [ ] Driver row focus affordance (What's driving this) centres + rings the
      factor node; ring clears after ~3 s.
- [ ] Fragile-edge card focus affordance centres the source factor.
- [ ] Leader card "Leads via X, the #1 driver" centres + rings X.
- [ ] Guidance item activation (when CEE emits guidance_items) pulses AND
      centres its target.
- [ ] Stale target (delete the node first): the affordance does nothing —
      no pan-to-nowhere, no error.
- [ ] No graph mutation from any highlight action (undo stack unchanged).

## 6. Protected areas (must be unchanged)

- [ ] Node positions, sizes, spacing, zoom level and auto-arrange behave
      exactly as before (layout systems untouched).
- [ ] No Apply/Reject, restore, compare or versioning behaviour changed.
