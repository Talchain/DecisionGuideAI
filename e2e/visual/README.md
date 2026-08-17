# Visual regression harness

Fixed-viewport screenshot comparison of the canvas product surfaces against
committed reference images.

## Why it exists

Between 2026-08-15 and 2026-08-17 roughly fifteen UI PRs merged into `staging`,
every one green, and together they shipped a layout regression that only the
founder's eyes caught. He was the programme's only instrument capable of
detecting a visual or layout defect. This harness is here to stop that being
true.

## Running it

```bash
pnpm visual            # compare against committed references
pnpm visual:bless      # RE-CAPTURE references (see "Re-blessing" below)
```

Both boot their own Vite dev server on port **5187** (`strictPort`, never
reusing an existing one) with the proxy targets pointed at an unroutable
address, so the run is hermetic and cannot reach a real service.

For a targeted local run, add `VISREG_PARTIAL=1` so the completeness guard does
not fail the run for the states you deliberately filtered out:

```bash
VISREG_PARTIAL=1 pnpm visual -- -g "Model tab"
```

## What it captures

Six states, each at **1280×800** and **1440×900** — twelve references.

| State | What it is | Framing |
|---|---|---|
| `fresh-draft` | a real CEE draft just applied | full viewport (graph **and** dock) |
| `blocked-provisional` | the "not ready for analysis" readiness verdict | clipped to the dock |
| `model-tab` | the Model tab (id `diagnostics`) | clipped to the dock |
| `olumi-tab` | the Olumi conversation tab | clipped to the dock |
| `inspector-node-selected` | node inspector open on `fac_vendor_cost` | full viewport |
| `graph-default-zoom` | after the product's own fit-to-view | full viewport |

The full-viewport states deliberately include the graph **and** the right-hand
panel in one frame, because the defects being caught are the relationship
between them — a panel that has eaten the graph is invisible in a shot of
either one alone.

### Viewports, and why these two

- **1280×800** — the smallest desktop this product commits to (DS v5 desktop
  minimum; the repo's two pre-existing visual baselines already use 1280). It is
  where a widening right-hand panel does the most damage, because the graph gets
  whatever is left.
- **1440×900** — the MacBook Air/Pro logical resolution the founder and testers
  actually use, and therefore the size the regressions were *seen* at.

### Not captured: completed analysis

The founder's list includes a completed-analysis state. It is **deliberately
absent**, and the reason is recorded in the header of `states.visual.spec.ts`:
the only real captured analysis turns in this repo
(`src/v5/__tests__/fixtures/live-analysis-turn-*.json`) carry no graph, and
their option ids do not correspond to any starter graph (measured overlap: at
most 2 of 4). Pairing them would render an incoherent screen that we would then
bless as canonical, and hand-writing a report would be a fixture from the
author's head presented as the product's output.

**To unblock it:** capture a real CEE analysis turn for one of the five starter
graphs and commit it beside them with the same provenance discipline
(`docs/evidence/starters/raw/`). Then the state can be seeded through
`applyV5State` and added to `STATE_NAMES`.

## Determinism

A harness that flakes is muted within a week and is then worse than nothing.
Everything variable is pinned:

- **Clock** frozen (`page.clock.setFixedTime`, 2026-08-17T09:00:00Z).
- **Motion** — `prefers-reduced-motion: reduce` plus a stylesheet zeroing all
  animation and transition durations and hiding the caret.
- **Network** hermetic — `/bff/**` and `/api/**` are served a fixed, instant 503
  so the offline path has no timing variance; anything off-origin is aborted.
- **Seeding** through the product's own `applyDraftResult`, from a *real*
  captured CEE draft-graph response (`src/canvas/starters/data/`, drift-guarded
  by `pnpm ci:guard:starters`), then a wait for the layout store to reach
  quiescence — `!pendingLayout && !layoutInProgress && layoutVersion > 0` — never
  a sleep.
- **Geometry** — the shutter waits for three consecutive identical samples of
  every element's bounding box. It counts polls, not milliseconds, because the
  clock is frozen.
- **Notifications** dismissed and *asserted* absent, so no capture races a
  toast's auto-expiry.
- **Flag posture** pinned from `netlify.toml` × `src/flags.ts`, so the
  references show the surface a staging user mounts rather than the dev default.
  ⚠ `netlify.toml` is not the deployed environment — dashboard variables
  override it and this repo cannot see them. The claim is only "captured under
  the posture `netlify.toml` declares", and the posture fingerprint is printed
  in every run's log.

Measured result: **0 differing pixels out of 1,296,000** between a fresh capture
and the committed reference, across process runs.

## Tolerance

`maxDiffPixelRatio = 0.0005` (0.05%), `threshold = 0.2` (Playwright's default
per-pixel YIQ distance, which is what absorbs font antialiasing).

Chosen from measurement, not habit. `selftest.visual.spec.ts` measures, at
1440×900 (1,296,000 px), each perturbation in its own browser context:

| | diff | pixels |
|---|---|---|
| noise floor (fresh capture vs committed reference) | **0.0000%** | 0 |
| marginal: 1px nudge of one small control | 0.0077% | 100 |
| **regression: sticky footer overlapping content** | **0.6346%** | 8,225 |
| **regression: right-hand panel widened by 35%** | **2.0319%** | 26,333 |

Measured at `289b730d`. The panel-width perturbation is **derived from the dock's
live width** (416px → 562px), not hardcoded: it was hardcoded at 378px when the
dock was 280px, and the 416px restore would have silently turned "+35%" into
"−9%" — still a big diff, so the assertion would have passed while measuring the
wrong thing.

0.05% sits 12× under the smaller real regression and above a noise floor that
measured exactly zero. The self-test asserts both margins (≥10×) on **every
run**, so the constant cannot drift into being too slack to fail or too tight to
trust.

**What it will not catch, stated honestly:** a sub-650px change at full-viewport
scale — the 1px control nudge above does not trip it. Panel states are clipped
to the dock (~216,000 px), where the same ratio is ~108 px, so small copy and
spacing changes there *do* trip it. That is deliberate.

## The self-test — why this harness is allowed to be believed

An instrument that reports "no difference" fails silently by definition. So
`selftest.visual.spec.ts` does not test the product; it tests the instrument,
and it runs alongside every comparison:

1. the tolerance separates measured noise from two real regressions, by ≥10× in
   both directions (numbers above, printed on every run);
2. the **real** assertion path — `toHaveScreenshot` with the harness's own
   options — **throws** when pointed at a 35%-widened panel;
3. a **missing** reference is a hard error naming the re-bless command, never a
   silent write (`updateSnapshots: 'none'`, plus an explicit existence check, so
   it cannot pass on a retry that finds the file the first attempt wrote);
4. a **blank** reference is rejected;
5. a reference that is large, colourful *and still 99.7% one colour* is rejected
   by a separate non-modal-pixel guard — the case that slips past the other two.

And `globalTeardown` asserts the captured set **by name, in both directions**
against `STATE_NAMES × VIEWPORTS`. Zero captures is a hard failure. It lives in
teardown rather than in a spec so that `--grep` cannot exclude the check that
proves the run measured anything.

## Re-blessing references

References are **platform-scoped** (`e2e/visual/references/<platform>/`).
Chromium renders text differently on darwin and linux, so a darwin reference
compared on linux is a guaranteed false positive.

```bash
scripts/visual/rebless.sh          # your platform
scripts/visual/rebless.sh --check  # show what would change, write nothing
```

Then review the images and commit them **on their own**:

```bash
git add e2e/visual/references
git commit -m "chore(visreg): re-bless visual references — <why>"
```

Re-blessing is deliberately a separate, reviewable commit. Nothing overwrites a
reference automatically, and no CI job ever commits one. If a reference changes,
a human has to have looked at the image and said so in a commit message.

### ⚠ These references are PROVISIONAL

They were captured from `staging` at `42f6cb6a`, which still carries the
panel-width regression the founder reported. **They are a record of the product
as it currently renders, not a statement that it renders correctly.** When the
panel-width containment revert lands, every affected reference must be
re-blessed in its own commit and the diff reviewed as the *fix* being accepted.

`archive/2026-08-17-pre-convergence` (`6a7e07bb`) was deliberately **not** used
as the source: that build is the regression.

## CI

Advisory (`continue-on-error: true`), reporting only — it does **not** gate
merges, and it is absent from the `Staging Gate` aggregator's `needs`. It
uploads the HTML report, every `-expected/-actual/-diff` triplet, and the
self-test's measurement table, so a human adjudicates an image rather than
reading "pixels differ".

It is advisory *for now*: flipping it to required is a later decision, to be
taken once its false-positive rate on `ubuntu-latest` has been observed. It can
never report success having executed nothing — the completeness guard fails the
run if zero screenshots were captured, and `continue-on-error` marks the job red
without blocking the gate.

**Linux references** must be generated on Linux. The first CI run on a branch
with no `references/linux/` will fail loudly and upload the images it captured
as the `visual-references-generated` artefact; download it, review the images,
and commit them under `e2e/visual/references/linux/`.
