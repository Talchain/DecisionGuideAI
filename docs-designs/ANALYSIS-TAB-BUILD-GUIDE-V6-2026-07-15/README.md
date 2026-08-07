# Analysis Tab — Build Guide v6 (2026-07-15)

**Why this directory is in the repo:** these six files are the governing design authority for the v6 Analysis-tab build. Until 2026-07-15 they existed **only on one laptop** at `~/Documents/GitHub/docs-designs/` — a path that is not a git repository and has no remote. The code was safe on GitHub; the design authority governing the next build was one disk failure from gone, and no other workstream or machine could reach it. They are committed here so any workstream, on any machine, can read them at a pinned SHA:

```bash
gh api "repos/Talchain/DecisionGuideAI/contents/docs-designs/ANALYSIS-TAB-BUILD-GUIDE-V6-2026-07-15/ANALYSIS-TAB-BUILD-BRIEF.md?ref=staging" --jq .content | base64 -d
# or, in a checkout:
git show origin/staging:docs-designs/ANALYSIS-TAB-BUILD-GUIDE-V6-2026-07-15/ANALYSIS-TAB-BUILD-BRIEF.md
```

## What each file is — and which one wins

| File | Status |
|---|---|
| **`ANALYSIS-TAB-BUILD-BRIEF.md`** | ⭐ **THE AUTHORITY.** Paul's brief, saved verbatim. It governs intent, boundaries, and acceptance. **Where anything below disagrees with it, it wins.** |
| `analysis-tab-prototype-build-ready-v6.html` | **Layout reference ONLY — not a spec.** Supplied by Paul (this copy is byte-identical to the one he re-issued on 2026-07-15; git blob `8cee7e65…`). It *simulates* producer-owned states the wire does not yet supply — do not read simulated data as a contract. Brief §13.4 explicitly overrides its receipt copy (never expose "graph hash"). |
| `V6-BUILD-SPEC.md` | Derived component/behaviour spec. |
| `V6-STAGING-MAP.md` | Prototype → shipped-component map. |
| `V6-DATA-MATRIX.md` | Field-level wire availability per surface. |
| `V6-BUILD-PLAN.md` | Six-lane plan (V1–V6). ⚠️ **Reviewed → APPROVED-WITH-AMENDMENTS (11 amendments).** The plan is **not** safe to execute as written — the amendments are recorded in `parallel-briefs/HANDOVER-EXPERIENCE.md`; reconcile before dispatching any V-lane. |

## Before you build from this — read these first

1. **Paul-gated, not engineering calls.** The build is blocked on his rulings for **Options-section retirement** (WinGauge / OptionCards / RiskAppetiteFilter — *deliberately reinstated 2026-05-27; rationale verbatim at `ResultsBody.tsx:330-336`*) and **WhatChangedChip retirement**. Do not start those without his word.
2. **The prototype's own sha citation is unreliable.** `HANDOVER-EXPERIENCE.md` cites the prototype as "sha 080b4a04"; that value matches **none** of this file's git-blob / sha256 / md5. The bytes are what count — all copies found on the machine are identical to Paul's re-issued file.
3. **Re-verify every code reference against `origin/staging` before using it.** These docs were written against an earlier tip and much of Waves 1–3 was pre-merged (#284–#300). Lane briefs derived from them have already been wrong twice on this basis.
4. Cross-workstream state, decisions, and the current lane queue live in `parallel-briefs/HANDOVER-EXPERIENCE.md` (UI/Experience) and the orchestrator-owned boards.

**Provenance:** committed by the UI/Experience workstream on 2026-07-15 at Paul's instruction ("save it somewhere any other Workstream can access"). Content copied verbatim; nothing edited. The `docs-designs/` tree at the GitHub root remains the working copy — **this is the durable one.**
