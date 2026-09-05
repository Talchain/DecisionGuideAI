# Wave A — copy and behaviour spec

Written before implementation so the wording is a design decision, not a side effect of the
refactor. Each rule states the **property**, not just the replacement string, because a guard
written against one example string is a guard that only sees that example.

Voice already established in this panel and to be matched exactly:
*"Olumi estimated how strongly Technical Leadership Capacity affects Team Productivity Uplift,
but your team has not confirmed it."* — names Olumi, names the nodes, states who has not done
what. Second person for the user, "Olumi" for the system. Never "the producer", "the engine",
"the model" as an actor.

---

## A1 — a code never reaches the screen

**Property:** no rendered text node in this panel matches `/^[A-Z][A-Z0-9_]{6,}$/`.

The human sentence is the whole content. The code moves to `data-gap-code` on the row, so
support and tests can still find it and nothing loses traceability.

**Not a rename.** Do not "humanise" the code into title case — `Edge E Value Non Finite Dropped`
is the same defect wearing a hat.

---

## A2 — every gap names its node, and duplicates collapse

Group by code, then list affected nodes by name.

| state | rendered |
|---|---|
| one node | `One starting factor has no value recorded, so zero was assumed: **Raw Development Headcount**. Anything downstream of it may be unreliable.` |
| two or more | `Two starting factors have no value recorded, so zero was assumed: **Raw Development Headcount**, **Technical Leadership Capacity**. Anything downstream of them may be unreliable.` |
| node name unavailable | `Two starting factors have no value recorded, so zero was assumed. Anything downstream of them may be unreliable.` — the sentence loses the list, never gains a placeholder id |

**Agreement rules, derived once rather than per-branch** (this panel has already paid for getting
this wrong in a figure tally):
- the count word agrees with the number of nodes: `One` / `Two` / `Three` … / `12`
- `factor` / `factors` agrees with that same count
- `it` / `them` agrees with that same count
- `has` / `have` agrees with that same count

**Invariant to assert, written against the spec and not against the failure I happened to see:**
for every count `n ≥ 1`, the sentence contains exactly `n` node names, and no sentence ever
renders a numeral where a name should be. A count of `0` renders **nothing** — not an empty row.

**Remedy must be actionable.** "Add its current value" becomes a canvas link on each named node,
reusing the panel's existing show-on-canvas helper rather than a new one.

---

## A3 — one number format, one authority

**Property:** the same flip point rendered on two surfaces produces **byte-identical** number
strings.

Percentages, because that is what a user sets. `0.5 → 50%`, `0.31 → 31%`.

⚠ **Only correct for unit-interval values.** A formatter that multiplies by 100 unconditionally
will corrupt a raw quantity (a headcount of 12 must never render as 1200%). The formatter takes
the value **and** its kind; if the kind is unknown it renders the raw value unchanged rather than
guessing. Guessing here is how a confidently wrong number ships.

**Assert as equality between the two surfaces**, not against a literal — a literal drifts, an
equality cannot.

---

## A4 — the internal lexicon leaves user-facing copy

| now | becomes | why |
|---|---|---|
| `Fields the producer did not supply` | `Not included in this run` | the user has no model of a "producer"; what they need is that the run omitted something |
| `Grounded in the producer influence score.` | `Based on Olumi's influence score.` | matches the established voice, which already names Olumi as the actor |
| `Run identity` | `Reference` | it is a support handle, not an identity the user has |
| `Analysis status / Drivers status / Robustness status: computed` | render only when **not** computed | three rows reading "computed" in the healthy state is confirmation noise; an exception is information |

**Banned in rendered copy** (the property, so the guard outlives these four strings): `producer`,
`non-finite`, `payload`, `adapter`, `enum`, `null`, `undefined`, `NaN`, `upstream`, `downstream`
as a bare noun. **Scope stated honestly in the guard's own failure message:** this panel and its
shared components, not the whole app — a guard that claims more reach than it enforces is the
next stale mirror.

⚠ `downstream` survives in `anything downstream of it may be unreliable` — that is ordinary
English about causality, not architecture vocabulary. The guard bans the **bare noun** ("the
downstream"), and the rule says so, because a blanket ban would delete a good sentence.

---

## A5 — the value-of-information line states a figure or does not render

Current: *"Measured for the decision as a whole, this run did not come back at zero."* A double
negative with no figure, in a heading slot, so it reads as a finding while telling the reader
nothing.

- **A figure is available** → state it and what it buys, in the panel's existing voice.
- **No figure** → the section does not render. An absent section is honest; a present section
  that says nothing trains the reader to skip that region of the panel.

**Never** keep the hedge sentence as a fallback. It is the worst of both: it occupies the slot
and withholds the content.

**Blocked on:** whether a decision-level figure reaches the UI at all. Routed to Primary. If the
answer is "no", A5 is a deletion and is the cheapest fix in the wave.

---

## What Wave A deliberately does NOT touch

- The two influence charts (that is B1/B2, and it is blocked on which producer fields feed each).
- Any sentence in the "What we checked" block. Those are the best writing on the surface and the
  reason the panel is trustworthy at all.
- The absence of a hero number. It held under build pressure; nothing here reintroduces one.
