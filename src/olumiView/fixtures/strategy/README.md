# Strategy lane fixtures

- `growth-reveal.view3.json`: a REAL View (olumi.view/3) from olumi-core `wip/strategy-debate` (the strategy lane on the debate lane: wip/debate-r2 f3aedd9a plus wip/strategy), read as
  "Maya" on a local zero-call core seeded by `~/olumi-work/strategy-serve/seed.mts` on 7 Nov 2026: the 2027 growth strategy case (four
  routes, three drivers without figures, one outcome, one risk, the £50M aim), three SEEDED demo people (Maya, Tom, Priya) whose words and
  stances were written for the demo, their views revealed together, three strategy items and one piece of evidence. Every value under
  `strategy` (items, views, marks, gate, overview) and everything else in the View is core's own output. The core of that branch has no
  debate-lane fields (`collab.shared[].kind`, `collab.marks`, `collab.next`), so the specs that need those read the V11 fixtures.

- The seed's scripted coach reply reads "Seeded for the strategy demo: Olumi does not reply on this link…": a fixture sentence, labelled
  as such on screen, never Olumi's output (the core has no provider key). Every other word is core's or a seeded person's.
