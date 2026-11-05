# R5 stand-in fixtures (core ahead of DGAI's vendor)

- **`proposal.view3.json`:** core `wip/r5-if-approved` c91f363's own proposal golden, `src/view/__tests__/golden/proposal.view3.json`, unedited.
  - It carries R5's `if_approved: { glyph, title } | null` on chance rows, band entries and `run.most_likely` (poc-core-server, 4 Nov).
  - It is read through `src/olumiView/standin.ts` until DGAI vendors the R5 core. Then it goes, and the goldens carry the field.
- **`effects*.view3.json`:** the D7 view effects (`collab.shared[].effects` with `gap_text`, `collab.effect_headings` with its eight labels), from core `wip/science-d7-labels` 066287e. They are read through `standin.ts` until DGAI vendors that core.
  - Source: core's own `src/app/__tests__/view-effects.test.ts` paths, scripted, with no AI calls. Each file is `ViewV3.parse(v3(svc, scenario, who))`, unedited.
  - **`effects` / `effects-gated`:** the `team()` path.
    - Paul gives `per_specialist` 5, `existing_capacity` 80 and `capacity_target` 90 (changes, same, moves).
    - Sam gives `per_specialist` 20–40 and `existing_capacity` 70 (two `limit` refusals).
    - Paul reveals, then Kim joins after the reveal and is gated.
  - **`effects-if-absent`:** core's "drawer" describe. Its unsized risk `slow_ramp` gives Sam's effect `if_absent: ['slow_ramp']`.
  - **`effects-leaders`:** the same describe. `existing_capacity` is 90–110; Paul gives `per_specialist` −10, so leader is `hold` and model_leader is `add_one`.
