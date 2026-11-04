# R5 stand-in fixtures (core ahead of DGAI's vendor)

- **`proposal.view3.json`:** core `wip/r5-if-approved` c91f363's own proposal golden, `src/view/__tests__/golden/proposal.view3.json`, unedited.
  - It carries R5's `if_approved: { glyph, title } | null` on chance rows, band entries and `run.most_likely` (poc-core-server, 4 Nov).
  - It is read through `src/olumiView/standin.ts` until DGAI vendors the R5 core. Then it goes, and the goldens carry the field.
- **`effects.view3.json`** and **`effects-gated.view3.json`:** core `wip/science-d7-wire` 307a70c's D7 view effects (`collab.shared[].effects`, `collab.effect_headings`). They are read through `standin.ts` until DGAI vendors that core.
  - Source: core's own `src/app/__tests__/view-effects.test.ts` `team()` path, scripted, with no AI calls.
  - Contributions:
    - Paul gives `per_specialist` 5, `existing_capacity` 80 and `capacity_target` 90.
    - Sam gives `per_specialist` 20–40 (plausible) and `existing_capacity` 70.
  - Paul then reveals, and Kim joins after the reveal.
  - The files are `ViewV3.parse(viewOf(svc.view(scenario, who, null, true), undefined, 3))` for Paul, and for Kim (gated, no shared views). Unedited.
  - What they carry:
    - Paul's effects: `changes`, `same` and `moves`.
    - Sam's: two `limit` refusals.
    - `if_absent` is `[]` on every effect, so the wire case is not yet witnessed.
