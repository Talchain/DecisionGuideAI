# Canvas d78b4aa9 — BANKED AT RESTART HOLD, 9 Sep 2026

Unfinished asset. Measured but never committed anywhere else. Owner of the
follow-up: **Codex schema-canonicalisation workstream** (Paul assigned it).

## THE SCHEMA HAS FORKED — and a local check says the opposite

Measured on the REMOTES, 8–9 Sep, `gh api .../contents/...?ref=<branch>`:

| Copy | Blob | Lines | Bytes | Last moved |
|---|---|---|---|---|
| UI `DecisionGuideAI` @ staging, `docs/` | `bff1aff2b5dc` | 871 | 32,950 | 2026-01-20 `b574ab50` |
| CEE `olumi-assistants-service` @ staging, `Docs/` | `bff1aff2b5dc` **identical** | 871 | 32,950 | 2026-01-28 `b3e8981e` |
| **ISL `Inference-Service-Layer` @ staging, `docs/`** | `017f0f3a165e` | **981** | **39,732** | **2026-08-02 `f35975dc`** |
| ISL @ **main** | `bff1aff2b5dc` — the OLD one | 871 | 32,950 | — |

File: `Olumi_Decision_Model_Schema_v2_6.md` (note the differing directory case:
UI/ISL `docs/`, CEE `Docs/`).

**It is not a three-way drift.** UI and CEE are byte-identical and seven months
stale. ISL's staging is the only fork, and it is ahead of ISL's own `main`.
It arrived with `f35975dc fix(analyzer): anchor level->delta goal conversion` —
a code fix, not a doc tidy.

## What it changes — one section, NOT additively

`## B.5 Goal Threshold and Units` → `## B.5 Goal Threshold, Units and FRAME`,
gaining four subsections: *Why a frame is required* · *The two frames* ·
*The resolution* · *Fail-closed*. Diff shape: **120 lines only in ISL, 10 only
in UI/CEE**; ISL is a strict superset at heading level apart from the renamed
B.5.

The 10 deleted lines include the boundary-contract claim:

> "**Note:** ISL is unit-agnostic. It computes with whatever values it receives.
> PLoT handles normalisation/denormalisation (see B.6)."

and

> "`goal_threshold` must be in the **same units** as your factor values."

**That is the compute service retracting a boundary-contract claim that UI and
CEE still hold.**

## Two traps for whoever picks this up

**1. Nothing inside either document discriminates them.** Both read
`**Version:** 2.6` and `**Date:** 15 January 2026`, identically. A session
opening UI's copy believes it holds the current contract. Whatever is made
canonical needs a version or hash that actually moves, or this recurs silently.

**2. DO NOT VERIFY FROM THE LOCAL TREES — a local checksum returns a clean
"no fork", and I ran exactly that.** All three LOCAL copies are 871 lines with
identical MD5 `9c8328f30e9e03c004e4fe307810bacf`: ISL's local checkout does not
match ISL's own staging. CLAUDE.md trap 1, fired live. Had that result been
relayed it would have told the workstream there was nothing to reconcile.

## Adjacent, and NOT established

The superseded section is about goal-threshold units and normalisation. Measured
separately on 8 Sep: of 34 factor nodes only 3 carry a unit, and the
intersection of *factors with a unit* and *factors any option moves* is
**empty**; all 55 live interventions carry `unit`/`raw_value`/`display_value`/
`value_type` at zero. These MAY be the same problem. **I have not established
any causal link and it should not be assumed.**

## Method note

Every figure above is from the remotes via `gh api`, with a contrast control
(`DESIGN_SYSTEM.md` resolved, blob `5cf66380943f`) proving the probe could see a
file that exists. Line counts of local copies via `wc -l` on the working trees.
