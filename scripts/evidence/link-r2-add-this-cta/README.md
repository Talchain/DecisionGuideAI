# "Not modelled yet" CTA — the live-router derivation

The `Where does this fit?` control in `V7WhatIWasGivenSection` used to read **"Add this"**
and fire a turn that changed nothing. What it does now was decided by measurement against
the deployed router, and **this directory is that measurement** — the probes, the corrected
classifier, and the raw captures.

It lives in the repo because the alternative was a claim in a PR body about files in
`/private/tmp`, for a shipped user-facing behaviour. A derivation that cannot be re-run is
a sentence, not evidence.

## What it establishes

**No add instruction has ever been observed to be accepted — 15 arms, 5 rounds.**

| Phrasing | Live outcome |
|---|---|
| bare figure (`Please add "£31m" from my brief to the model.`) | no mutation; a specific, grounded question back |
| figure + its brief sentence | **REFUSED** `ORPHAN_NODE` |
| named factor + value | **REFUSED** `ORPHAN_NODE` |
| named factor + "connect it to the options" | **REFUSED** `NO_PATH_TO_GOAL` |
| named factor + a causal target that feeds the goal | **REFUSED** `PIPELINE_OWNED_FIELD` |
| **control** — `Change <factor> to £64,000.`, target derived from the run's own graph | **APPLIED** |
| the three ASK phrasings | answered with concrete, model-grounded options; no orphan, no error |

The control is what makes the refusals readable: without it they are equally consistent
with a sick service.

The acceptance condition for an add is knowledge the receipt does not have — what the
figure should causally influence — which is why the CTA asks. The engine ends in the same
place: *"connect 'Annual revenue' to a factor that already feeds your goal. Which factor
should it relate to?"*

**The ladder is UNMEASURED.** Whether a user's own answer can land an add is not
established here, and nothing in the product claims it.

## Two instrument defects this directory exists to prevent recurring

**1. The classifier disjunct (rounds 1–3, caught in review).** `classifier.mjs` replaces:

```js
return d.verdict === 'held' || !!d.blocker_code;   // ← overrides an explicit rejection
```

Two arms returned `{verdict:"rejected", blocker_code:"PIPELINE_OWNED_FIELD"}` with no
`held_proposal` block, and were scored **HELD**. That false reading reached shipped source
comments. `classifier.mjs` now reads an explicit verdict **first**, in both directions, and
ships a self-test whose first case is the exact arm-F payload:

```
node scripts/evidence/link-r2-add-this-cta/classifier.mjs   # exits non-zero on regression
```

Note what this defeats: the PR's 13-mutant kit bit on every mutant. **A mutant kit measures
whether the tests can detect a change, never whether the expectation is right.**

**2. A control bound by value, not identity (round 4, void).** Its positive control sent
`Change Annual CRM Licence Cost to £64,000.` — a label hardcoded from an earlier run. That
run's draft named the factor *"Annual CRM Spend"*, so the control asked the engine to change
a node that did not exist, and every arm in the round became unreadable. Round 5 derives both
the control's and the add's target from **that run's own committed graph**. Draft labels vary
per run; a harness that hardcodes one is bound by a value another object could satisfy.

## Running them

Guest posture, **no credential is read, embedded or printed** — the product journey is a
guest journey by construction. Each probe mints fresh scenario UUIDs and sends a
byte-identical brief, one arm per scenario, so only the phrasing varies.

```bash
node scripts/evidence/link-r2-add-this-cta/probe-addthis-r5.mjs
```

They import the programme's shared wire recipe by absolute path
(`scripts/golden-journey/lib/wire.mjs`, in the platform root above this repo). Re-point that
import if you run them from elsewhere.

`captures/` holds each round's `probe.log` and `summary.json`, plus the raw
`F_CONNECT_TO_BUDGET.json` / `G_CONNECT_CHAIN_TO_GOAL.json` bodies — the two payloads the
old classifier misread, kept so the correction can be checked against the bytes rather than
against this file.

⚠ **`captures/` is an append-only record of what the deployed service actually said on a
dated build.** Add rounds; never edit an existing one to match a newer expectation.
