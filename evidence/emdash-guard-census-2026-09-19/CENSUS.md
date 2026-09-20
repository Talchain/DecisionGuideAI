# Em-dash guard: `ScriptKind` before/after census

The census the #1744 seat asked for, **executed** (not reasoned).

- **Repo:** `Talchain/DecisionGuideAI`, branch `staging`
- **Tree:** fresh blobless clone at `/private/tmp/emdash-tsx-census-lane-20260919/dgai`, `HEAD = fd65f97106c34d7da2509974f6d4c1590751e9a3`
- **Date:** 19 Sep 2026
- **cwd during the run:** `/private/tmp/emdash-tsx-census-lane-20260919/dgai`
- **Subject:** `src/components/results/analysisNew/__tests__/noEmDashesInRenderedCopy.spec.ts`, `function literals()`

## Exact command

```sh
export VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=...   # the two vars only; .env.local NEVER copied
pnpm exec vitest run "src/test/helpers/__tests__/zzzTmpCensus.spec.ts"
```

The instrument imported the REAL `reasoningTabCopyScope()` and copied `literals()`/`isConsoleCall()`
verbatim from the spec, parameterised only on `ts.ScriptKind`. It ran inside vitest so cwd, module
resolution and the corpus walk matched the guard's own conditions exactly.

## 1 - The corpus, enumerated

**It is DERIVED, not listed.** `COVERED_FILES` comes from `reasoningTabCopyScope()`
(`src/test/helpers/reasoningTabCopyScope.ts`): an import-graph walk from
`TAB_RENDER_ROOT = src/components/results/analysisNew/AnalysisNewTabBody.tsx`, filtered to
`COPY_SCOPE_PREFIX = src/components/results/` with tests/fixtures/stories excluded.

- **118 files** (37 `.tsx`, 81 `.ts`)
- `unresolved` = `[]` (empty, so the walk's own precondition holds)

> The brief's "4 `.ts` + 2 `.tsx`" was a misread of the two CONTROL lists
> (`MUST_BE_IN_SCOPE`, 4 entries; `MUST_NOT_BE_IN_SCOPE`, 2), not the corpus.
> `SectionShell.tsx` enters the corpus because it sits under the prefix and the tab imports it -
> there is no dynamic/run-dependent mechanism. The spec's own header records 94 files; it is now
> 118, which is the derivation doing its job as the surface grows.

## 2 - The five arms

| arm | parse | comments blanked first | literals seen | em-dash offenders |
|---|---|---|---|---|
| **A** (status quo) | `ScriptKind.TS` | no | 5701 | **1** |
| **B** | `ScriptKind.TSX` | no | 5721 | 0 |
| **C** | `ScriptKind.TS` | yes | 5699 | 0 |
| **D** | `ScriptKind.TSX` | yes | 5721 | 0 |
| **E (SHIPPED)** | derived from extension | no | 5721 | 0 |

Two equalities settle the remedy, and both were measured rather than argued:

- **D == B as a MULTISET, across all 118 files (0 mismatches).** Blanking comments is a
  provable NO-OP once the file is parsed as what it is. This is the spec header's own claim -
  *"comments are trivia to the parser and are never string-literal nodes, so they are excluded
  STRUCTURALLY rather than by a stripping pass that could get it wrong"* - confirmed by execution.
- **E == B as a MULTISET (0 mismatches), because all 8 disagreeing files are `.tsx`** and the 81
  `.ts` files parse identically either way. So deriving the kind from the extension buys TSX's
  full coverage while keeping `.ts` files on the TS grammar (no angle-bracket-assertion risk).

### Arm C is NOT the cheaper equivalent fix

Blanking alone reaches green, but it reads **5699 literals - FEWER than the 5701 the
status quo reads, and 22 fewer than TSX.** It removes the false POSITIVE and leaves the false
NEGATIVES untouched, because the literals TS-mode cannot see in a `.tsx` file are JSX attribute
values, not comments. A guard that goes green while seeing less than it did is the wrong direction.

## 3 - The three sets

### UNCHANGED (caught under both TS and TSX): **0**

### DROPPED (caught under TS, NOT under TSX): **1** - triaged

`src/components/results/analysisNew/sections/SectionShell.tsx`

```
"}\n            >\n              {subtitle}\n            </span>\n          ) : null}\n
        </span>\n        {/* ** ONE FACT, SAID ONCE - AND THE SUBTITLE WINS. ..."
```

**Verdict: a demonstrable mis-parse artefact, not a coverage regression.** The reported "string
literal" is raw JSX source: a `</span>`, a `) : null}`, and the opening of the `{/* ... */}` JSX
comment at `SectionShell.tsx:267`. No string literal in the file has that shape.

**Mechanism, measured:** the span is delimited by BACKTICKS, not double quotes. With JSX off,
`data-testid={`${testId}-subtitle`}` has its CLOSING backtick re-read as an OPENING one, so the
next template runs from there to the backtick before `` `showCount` `` inside the comment -
swallowing the prose between them. #1744 converted three `className="..."` attributes to
`` className={`${icon(...)} ...`} ``, taking the file from 108 to 114 backticks and shifting every
subsequent pairing. That is why the comment sat inert from #1738 until #1744.

> The docblock's wording - *"the attribute quotes pair across the comment"* - is right in mechanism
> and imprecise in one detail: at this tip the pairing character is the BACKTICK. Recorded, not corrected away.

### NEW (caught under TSX, NOT under TS): **0**

No genuine em-dash offender was being hidden by the mis-parse **today**. The verdict is honestly
clean under the corrected parse - so this change surfaces no new copy defect and hands nothing off.

## 4 - The blind spot the census found anyway (the real reason to fix the parse)

**TS-mode reads 5701 literals; TSX-mode reads 5721. It silently loses 20, in 8 of the 37 `.tsx` files.**
These are real product literals, invisible to the guard at the status quo - so an em dash landing
in any of them would NOT have been caught. `NEW = 0` is a statement about today's copy, not about
the guard's reach.

| file | literals TS | literals TSX | real literals TS could not see |
|---|---|---|---|
| `AtAGlance.tsx` | 158 | 160 | `warning`, ` ` |
| `DecisionRecorded.tsx` | 77 | 78 | `neutral` |
| `ModelHeldUp.tsx` | 25 | 26 | `success` |
| `RobustnessCaveat.tsx` | 27 | 28 | `neutral` |
| `SectionShell.tsx` | 38 | 48 | ` text-text-light`, `min-w-0 flex-1`, ` text-text-header block`, `-title` +8 more |
| `StrengthenTheReasoning.tsx` | 299 | 301 | `inline`, ` ` |
| `TrustLine.tsx` | 26 | 28 | `neutral`, `inline` |
| `WhatsChanged.tsx` | 69 | 70 | `neutral` |

`SectionShell.tsx` is the extreme case: TS-mode fabricates **12** bogus mega-spans of JSX source
and comment prose, and misses **12** real literals plus 10 empty strings.

## 5 - Verdict

**Ship arm E: derive `ScriptKind` from the file extension.** (Landed on `staging` as #1756's
`scriptKindFor`, independently and in the same shape; this census is the evidence that it was the
right arm, plus the `.jsx` limb and the coverage assertion #1756 did not carry.) It is simultaneously the smaller and
the more complete fix - it removes the false positive, closes a 20-literal blind spot, needs no
second pass over the source, and adds no hand-rolled lexer to keep in step with the grammar
(CLAUDE.md trap 12: the parser IS the grammar; a comment-blanker is a mirror of it).

**`blankComments()` is recorded as an OBSERVATION and deliberately not adopted here:** measured
redundant under a correct parse (D == B, 0 mismatches). It remains the right tool for
`nodeCopyNeverCentred.sourceScan.spec.ts`, which greps class tokens over raw text and has no AST.
