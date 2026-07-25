# Olumi design-partner demo — 10 minutes

Written for the P1-2 demo on-ramp (starter scenarios, shipped 2026-07-25).
Staging is the product: `https://staging--olumi.netlify.app/#/canvas`.

**Read §0 before you run this.** It contains the scope statement the roadmap's
red team asked for. A partner who discovers a limit by surprise mid-demo is
worse than the limit.

---

## §0 — SAY THIS OUT LOUD, IN THE FIRST MINUTE

Do not save it for the Q&A. Say it while the empty canvas is still on screen:

> "Two things before I start, so nothing surprises you.
>
> **First — this models one goal at a time.** You give it a decision with a
> single success criterion, and it reasons about which option best reaches it.
> It does not yet do multi-objective trade-offs where you're balancing, say,
> revenue against retention against risk appetite as three separate goals. You
> can represent those as factors feeding one goal, which is what these examples
> do — but if your real decision has two bosses pulling in opposite directions,
> that's honest future work, not something I'm going to pretend around today.
>
> **Second — the examples I'm about to open are saved.** Olumi drafted them
> against the live model last night; I'm loading them from disk so you see the
> product rather than a loading spinner. I'll show you live drafting too, and
> I'll show you what happens when it fails, because it does."

Then, if it comes up, the honest detail:

- Live drafting of an **enterprise-shaped** brief succeeds about **57%** of the
  time today (n=21). For the three shapes partners ask for most — vendor
  selection, market entry, build-vs-buy — it's **36%**. It is an output-budget
  wall inside a single request, it is understood, and the fix (staged/async
  drafting) is on the roadmap. Simpler briefs draft at ~100%.
- **Analysis is held on a saved example.** The banner says so. That is deliberate:
  the analysis engine works from its own copy of your decision, and a saved
  example was never sent to it. **Re-drafting is what makes it analysable** —
  saving does not, because the saved-example marker rides the save.
  It is a refusal, not a failure — the product would
  rather decline than give you a number about a model it never received.

---

## The 10 minutes

### 1 · Empty state → starter (0:00–1:30)

Open `#/canvas`. Let them see it cold: the Olumi mark, one composer, and
**"Or open a saved example — a real decision Olumi has modelled"** with five cards.

> "This is what a new user sees. One box, or five worked examples."

Click **International Expansion Strategy** (market entry — 18 nodes, 35 edges,
3 options). It lands instantly.

> "That's a real model Olumi produced from a four-sentence brief. Nothing here
> was hand-drawn."

The saved-example banner appears. **Point at it, don't skip it.** It is the
credibility move: the product volunteering that this was not just generated.

**Choose your card for the room:**

| card | shape | reach for it when |
|---|---|---|
| Customer Data Platform Selection | vendor selection | procurement / IT-heavy audience |
| International Expansion Strategy | market entry | exec / board audience |
| Usage-Based Billing System Approach | build vs buy | engineering leadership |
| Headcount Allocation Decision | resource trade-off | any — fastest, cleanest graph (16/26) |
| Pricing Model Transition Strategy | pricing | commercial / RevOps |

### 2 · Explore the model (1:30–4:00)

Walk the graph, don't narrate every node.

> "Goal at the top. The decision. The options underneath. Then the factors that
> actually move the outcome, and the risks."

Three beats that land:

1. **Options are real alternatives, including the status quo.** Every one of
   these graphs carries a "keep doing what we're doing" option. Most tools
   quietly omit it.
2. **Uncertainty is on the edges, not hidden.** Open one edge. Strength and
   confidence are separate numbers.
3. **The coaching is specific, not generic.** Open the Analysis tab and read the
   model's own critique of itself aloud — e.g. for market entry: it flags that
   "material ARR growth" has no quantified threshold. *It is telling you what is
   weak about its own model.* This is usually the moment the room leans in.

### 3 · Edit it (4:00–6:00)

Ask them for one real change from their world. Change a factor estimate, or add
a factor they name.

> "Your version of this decision — what's missing?"

Make their edit live. The readiness panel updates. This is the beat that proves
it is a model, not a picture.

### 4 · Re-draft live (6:00–8:30) — the honest beat

Click **Re-draft this live** on the banner. Read the confirm dialog aloud; it
says the example will be replaced and that live drafting can fail.

> "This sends the original brief to the model, right now, in front of you."

Then narrate the wait honestly (45–95s):

> "This is the part we're still fixing. An enterprise brief makes a big graph,
> and a big graph sometimes runs past the output budget."

**Both outcomes are good demo:**
- **Succeeds** → you have just shown the real product end to end, and analysis
  is now available because the graph came from a live draft.
- **Fails** → the failure copy is honest and specific, the brief is returned to
  the composer, nothing is lost. **Say: "That's the 43%. You just saw the thing
  I told you about in minute one."** A partner who was warned and then sees it
  behave gracefully trusts you more, not less.

> ⚠ If you have exactly ten minutes and one shot, do the re-draft on
> **Headcount Allocation** (4/4 in probing) rather than Market Entry (1/5).

### 5 · Analyse (8:30–9:30)

On a live-drafted graph, run the analysis. Monte Carlo over the uncertainty,
option ranking, and the sensitivity view showing which factors actually decide it.

> "This is the bit that isn't an LLM. It's a simulation over the uncertainty you
> just looked at."

If the re-draft failed, say so and move on — do **not** click Analyse on the
saved example to fill the gap. It is held, the banner explains why, and forcing
it is exactly the dishonesty this product is built against.

### 6 · Brief (9:30–10:00)

Generate the decision brief. Land it:

> "That's the artefact you take to your board. It carries the reasoning, the
> uncertainty, and what would change the answer."

---

## Pre-flight (5 minutes before)

1. `#/canvas` loads and all five cards render.
2. Click one card, confirm the graph and banner appear, then reset the canvas.
3. CEE is warm — a cold Render instance adds ~30s to the first draft. Send one
   throwaway draft beforehand.
4. Know which card you'll open and which one you'll re-draft.

## Do not

- Do not claim a starter was generated live. The banner contradicts you.
- Do not shorten the briefs to make drafting more reliable. They are the real
  enterprise briefs on purpose; shortening hides the wall instead of clearing it.
- Do not click Analyse on a saved example to fill dead air.
- Do not promise multi-goal support. Say it's future work.

---

## Provenance of the examples

All five are verbatim `POST /assist/v1/draft-graph` responses from CEE build
`1b9d596`, captured 2026-07-24. Source captures are committed at
`docs/evidence/starters/raw/`; the shipped fixtures are derived from them by
`scripts/build-starter-fixtures.mjs`, and CI re-derives and byte-compares on
every run (`pnpm run ci:guard:starters`). The evidence behind the 57% / 36%
figures is `parallel-briefs/STARTER-BRIEF-VALIDATION-2026-07-24.md` (n=34 live
probes, single build, positive control passed).
