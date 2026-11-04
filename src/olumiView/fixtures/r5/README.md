# R5 stand-in fixtures (core ahead of DGAI's vendor)

- **`proposal.view3.json`:** core `wip/r5-if-approved` c91f363's own proposal golden, `src/view/__tests__/golden/proposal.view3.json`, unedited.
  - It carries R5's `if_approved: { glyph, title } | null` on chance rows, band entries and `run.most_likely` (poc-core-server, 4 Nov).
  - It is read through `src/olumiView/standin.ts` until DGAI vendors the R5 core. Then it goes, and the goldens carry the field.
