# V11 reveal fixtures

- `consulting-reveal.view3.json`: a REAL View from olumi-core e38d9f4c (olumi.view/3), read as "Maya" on a local zero-call core over a COPY
  of Paul's consulting board (s_a88ba245176e) on 7 Nov 2026. Proposal 11 was approved on the copy; Priya, Tom and Maya are SEEDED demo
  people whose words and figures were written for the V11 demo (`~/olumi-work/v11-serve/seed.env`). Each view was shared early; Paul's
  own view was not given, so the round waits for him. Every effect, heading and value is core's own output.
- The specs add core's REQUESTED V11 fields (`collab.shared[].kind`, `effects[].chip`, `shared[].about`, `collab.next`; asked of the DL on
  7 Nov) to a copy of this View in code. Those values are invented placeholders of the requested shape, labelled where they are made.
- `consulting-whatif-priya.json`: core's REAL answer to `POST …/whatif { base: 18, variants: [{ edits: [{ quantity:
  "diagnostic_time_to_contract", typed: "6 to 12 months" }] }] }` on the same copy (Priya's figure as core words it), 7 Nov.
- `consulting-disagreement.view3.json`: a REAL View from olumi-core wip/debate eaab1331 (which carries core's V11 fields `kind`, `about`,
  `effects[].chip`, `collab.next`), read as "Maya" on a fresh copy of the same board, seed 2 (7 Nov): Priya and Tom give different
  figures for "Time to first signed contract for the paid diagnostic" (6 to 12 vs 1 to 3 months; core: both `disagreement`, Tom's effect
  `changes` with core's chip sentence, core's round question in `next`); Maya's figure is on another card (`unique`). Seeded demo people.
- `consulting-evidence.view3.json`: the same REAL View (core eaab1331, seed 2) after two pieces of evidence were added through core's
  zero-call `POST …/evidence` by the seeded Priya and Tom (words in `~/olumi-work/v11-serve/seed.env`). Not considered by Olumi (that
  is an AI turn, refused on the zero-call core), so `considered` is null and core sends no `chain` yet.
- `consulting-marks.view3.json`: the same REAL View (seed 2 with evidence) read through olumi-core wip/debate-r2 5a61369a, which adds
  `collab.marks` (one per record the revealed views concern, core's own short words: "Priya and Tom differ", "Only Maya raised it").
- `consulting-proposal.view3.json`: a REAL View from olumi-core e38d9f4c on a fresh copy of Paul's board read as the seeded "Priya",
  before anything was approved: Olumi's held proposal 11 ("Olumi proposes 15 changes"). The specs add core's requested
  `proposal.verdict` to a copy in code, labelled FIXTURE.
- `consulting-stance.view3.json`: a REAL View from olumi-core wip/debate-r2 f3aedd9a on a fresh copy of the same board, seed 3 (7 Nov),
  read as "Maya" on a zero-call core (ledger 0 calls). Each seeded person set a stance on their own view while it was still private, then
  shared it: Priya "Knows from experience", Tom "Suspects", Maya "Others may miss this". Priya and Tom each added one piece of evidence on
  the diagnostic's time to contract. Core sends `collab.marks` of three of its four kinds (no "shared" mark on this board): "Priya and Tom differ" (disagreement, with
  core's `reading` and `options`), "Only Maya raised it" (unique), "Priya and Tom added evidence" (evidence, its ids in `evidence`), and
  `collab.next`. Every word and value is core's output.
