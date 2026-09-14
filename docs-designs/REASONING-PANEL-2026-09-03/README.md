# Reasoning panel — design pack

**Frozen snapshot. The dated directory name means FROZEN, per the estate's naming rule.**

| file | what it is |
|---|---|
| `REASONING-PANEL-V2.html` | The approved prototype, 3 Sep 2026, written against build `86786efb`. Scores eleven prototype rules, records three rules the wire cannot support, and commits to design picks **A2 + B1 + C2** with an explicit falsifiable test. |
| `REASONING-PANEL-V3.html` | The same document re-scored at the code on 8 Sep against deployed `80ccf768`. Not a redesign — v2 with its verdicts corrected and one addition. |

## Why this is in the repo at all

Nine files in `src/` cite a design document by path in their header comments, as the
authority a decision was made against. **At the time this pack was committed, every one of
those citations was dangling** — the cited file was not in version control:

```
docs-designs/V7-RENDER-CHECK-2026-07-28.md
docs-designs/COMPARE-BRIDGE-DESIGN-2026-07-29.md
docs-designs/MODEL-TAB-REDESIGN-2026-07-29.md
docs-designs/ANALYSIS-TAB-BUILD-2026-07-12
docs-designs/RESOLVE-NEXT-DECISION-EVPI-DESIGN-2026-08-13.md
docs-designs/V7C-EVPPI-RANKING-DESIGN-2026-07-30.md
docs-designs/RESEARCH-RESTORE-ASSESSMENT-2026-07-25.md
```

Only `ANALYSIS-TAB-BUILD-GUIDE-V6-2026-07-15/` and `DEMO-SCRIPT-2026-07-25.md` resolve.
So a reader who wants to check a claim against "the design pack" cannot, and a lane that
wants to change a surface cannot tell what was decided. That is the same failure mode as a
root instruction living outside the repo: everyone cites it, nobody can check it.

**This pack does not fix the other seven.** It stops the Reasoning panel adding an eighth.

## What v3 established, in one paragraph

Two of v2's five "genuine regressions" were never true — the type scale was already exactly
three tokens on 3 Sep, and no 2px border ever existed in `analysisNew` (the "2px teal box"
was a `ring-2 ring-info` on an active node mark). Two are worse than v2 said: **21** distinct
button treatments rather than eight, and amber carrying **six** jobs rather than four.
**v2's own acceptance test failed on one of three**: A2 (tint) and C2 (truncate + expand)
shipped on 5 Sep; **B1 did not** — a card renders one primary and three text-labelled
secondaries, which is B2, the option v2 explicitly rejected. The drivers seam went the
opposite way to v2's instruction: the chart stayed and the list was deleted.

The one addition: `factorIsConfirmable` is
`factorNeedsVerification && factorHasConfirmableValue`, so a factor with **no value at all**
cannot be "to verify" and is invisible to the strip's only review signal. On the live board
that is **4 of 5 factors**. v3 gives the strip both states.

## How to check a claim in here

Every figure was read from deployed staging or from the code at a named commit. Re-derive
rather than inherit — several of v2's own figures were taken from screenshots and were wrong.
