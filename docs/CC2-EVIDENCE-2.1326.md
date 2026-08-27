# 2.1326 build evidence — `optionCoverage`

**Clone:** `/private/tmp/cc2-ui-sa` @ `f287c012` · **26 Aug 2026** · CC2

## Targeted spec
`npx vitest run src/components/results/utils/__tests__/optionCoverage.spec.ts`
→ **1 file, 10 tests, 10 passed, exit 0.** Asserted BY NAME and by expected count — never inferred
from a suite total (a new spec collecting `(0 test)` is invisible to every aggregate).
Env: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` set.

## Mutation kit — 8/8 as expected, exit 0
Isolation **proven by WRITING a sentinel**, not by locating a path: inodes compared, sentinel
confirmed not to propagate into the source. Restores read a **pristine archive outside the repo**,
never the mutated tree. Every mutant asserts its anchor is **unique** (an unapplied mutation is
indistinguishable from an equivalent one) and that it **applied**. Control reads exactly `0`;
trailing control GREEN.

| id | mutation | expect | got |
|---|---|---|---|
| M1 | truthiness instead of key presence | RED | RED |
| M2 | drop the denominator dedupe | RED | RED |
| M3 | `kind` always `even` | RED | RED |
| M4 | accept a single option | RED | RED |
| M5 | provisional on every reading | RED | RED |
| M6 | set/unset swapped | RED | RED |
| **M7a** | **reverse `perOption` ORDER** | **GREEN** | **GREEN** |
| **M7b** | **assign a different option id** | **RED** | **RED** |

**M7a/M7b are a discriminating PAIR, and neither alone proves anything.** M7a green shows the test
does not bind by position; M7b red shows it still discriminates. A single biting mutant proves
sensitivity to *something*; the pair proves sensitivity to *the named object*.

## ⚠ M1 SURVIVED ON THE FIRST RUN, AND THAT IS THE MOST USEFUL THING HERE
The first fixture wrote each intervention as `{ normalised_value: 0 }`. **The wire sends a BARE
NUMBER** — `{"6886a726": 0}` — with `intervention_details` as the separate object map (re-read at the
capture, not guessed). An object is always truthy, so the truthiness mutant survived: the
*"counts ZERO as SET"* test asserted exactly the right thing and **could not fail**.

**The assertion was right, the fixture made it vacuous, and only the mutant could see that.** The spec
header had itself quoted *"a fixture you wrote yourself is not evidence about the wire"* — while
getting the shape wrong. Corrected to the wire shape; M1 now bites. The note is kept in the spec so
the next reader knows why the shape is spelled that way.

## Process, stated accurately
**This was NOT written RED-first** — the module came before the spec. Rather than claim an ordering
that did not happen, the evidence is the mutation kit above: every assertion is shown to fail when
the behaviour it names is removed, and the identity binding is proven with a discriminating pair.

## Not yet done
- The render half (`V5AnalysisResultBlock`) and its wiring to the readiness slice.
- The repo's named typecheck gate (heavy; announced to CC before running, per the throttling note).

---
## Update — render half wired, kit extended to 11/11

Rebased onto `842f5267` (was 15 commits behind at `f287c012`, and did not know it). Insertion point had
moved — cosmetically. Spec **15/15**, kit **11/11**, typecheck gate **PASSED at baseline 2250 exactly**.

**Gate green proven, not assumed:** phase 1 derives coverage from `git ls-files` and my files were
UNTRACKED, so a green could have meant "never looked". Injected a deliberate type error → the compiler
named the file (`optionCoverage.ts(147,14) TS2322`); `--listFilesOnly` confirms all three files in the set.

**The pure module had ZERO importers while it was being built.** Merging it alone would have shipped a
module with no readers — the precise thing 2.1326 exists to expose. The render half is in the same change.

### M8–M10: do the NEGATIVE copy guards bite?
A `not.toMatch` passes trivially when the phrase was never going to appear. Each banned phrase is forced
INTO the rendered copy; all three RED. **M8** "unreliable" (the `ready`-and-uneven contradiction) ·
**M9** a direction · **M10** dropping the provisional register.

⚠ **M9 v1 WAS A FALSE SURVIVOR OF MY OWN MAKING.** It added a DEAD constant carrying the banned phrase,
which never reached the rendered copy — so the mutation applied to the FILE and not to the BEHAVIOUR, and
a working guard read as decoration. **An unapplied-in-effect mutant is worse than no mutant: it accuses a
healthy guard.** Repaired to inject into the copy itself; it now bites.

⚠ Also caught: a stray double comma from a scripted edit put an **elision** in the mutant array, so the kit
**crashed after M7b** while printing eight plausible result lines. `node --check` is now run before the kit.
**Eight healthy-looking lines and a non-zero exit is not a result.**

### Still not done
No render-level spec on `V5AnalysisResultBlock`; **no mutants on the render half**. Wire-derived, not
journey-witnessed.
