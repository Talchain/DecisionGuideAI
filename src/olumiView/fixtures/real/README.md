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
