# Real dense boards (DL 4 Nov)

Three R2 defects showed only on real-AI models, never on scripted boards:

- the open note over its own card;
- the note's measured copy, which duplicated its test ids;
- the OC1 run-on.

These two Views are the real models. They're fixtures for `fit-real-model.mjs`, `viewCard.spec` and `viewUnderParents.spec`, so dense-board defects are caught in DGAI's own gates. Nothing here is ever served.

- **`capacity.view3.json`:** "Weekly ticket capacity and staffing", scenario `s_f79b0d4c6864`.
  - Source: github-3c's R2 real-AI witness store (`witness-20261104T193723Z`, core a051a13, UI c7c569121). It was read as `olumi.view/3` from a copy of that store on a local scripted core, with no AI calls.
  - Olumi's next step sits on its own card, `test_net_contribution`, with a Why.
  - Two hand edits, so it reads as Ada saw it, alone in her scenario:
    - `members`, `collab.owners`, `signature`, `you` and `you_id` set to Ada only (the reader was a person minted for the read);
    - `gated: false`, `collab.alone: true` and `collab.waiting: null` (that person hadn't given a view, so the read came back gated).
- **`hiring.view3.json`:** "Hiring for productivity and the next feature launch", R2-shaped.
  - Source: `~/olumi-work/local-dgai/demo-case0/hiring.view3.r2-1c1bc10.json`, unchanged.
- **`together.view3.json`:** a proposal with Olumi's figure and the option that sets it, which core marks as a pair (`proposal.changes[].together`, R4, API v1.13).
  - Source: core `wip/r4-science` 1dd2ca9's own approve path (`src/app/__tests__/confirm-selected.test.ts`, the R4 pair: `two_specialists`, `add_two`, plus an unpaired `c_extra`). Read as `ViewV3.parse(viewOf(svc.view(...), undefined, 3))` with no AI calls. Unedited.

- **`hosting.view3.json`:** a real fresh brief about managed hosting, scenario `s_0aa84c97289f` (R25, DL 7 Nov).
  - Source: the DL's live candidate check `20261107T032625Z-a5829-live` (core a582999d, 7 calls). Read as `olumi.view/3` from a copy of that store on a local core at 29a198cf with no AI key, as a member minted for the read. No hand edits.
  - Card `own_hosting`, row 1 (`kind: 'none'`): core's whole Run sentence, 789 characters, which drew ~25 lines a card. It binds `viewDisclosed.spec`.
