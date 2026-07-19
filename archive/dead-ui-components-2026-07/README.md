# Archived: dead UI components (2026-07-19)

Two components moved here after a full reference census at staging
`d3fa9c58` found **zero live references** for each — no static import, no
lazy `import()`, no JSX use, no re-export, no registry entry, no string
path. Same treatment as `../dead-canvas-components-2026-07/` (PR #347).

| File | Census result | Last live context |
|---|---|---|
| `KPIHeadline.tsx` | Only self-references (3, all inside its own file). No spec ever existed. | Never mounted; superseded by the analysis hero's headline/readout rows |
| `StabilityGauge.tsx` | Only self-references (2) + its own co-located spec (9) | Never mounted; the stability figure is rendered by the hero/robustness surfaces instead |

## The census

Case-insensitive, whole-repo, excluding only `node_modules/`, `.git/`,
`dist/` and `coverage/` — i.e. covering `src/`, `tests/`, `e2e/`,
`scripts/`, `docs/`, `contracts/`, `integration/`, `netlify/`, `tools/`,
`vendor/`, `supabase/`, `public/`, `archive/` and both `playwright-report`
trees:

```
/usr/bin/grep -rniI "<name>" . --exclude-dir=node_modules --exclude-dir=.git \
  --exclude-dir=dist --exclude-dir=coverage
```

The exported symbol name matches the filename in both cases, so the
filename search also covers every import form. Neither directory has an
`index.ts` barrel, and no `export * from` re-exports either file. The only
`import.meta.glob` in the tree targets `fixtures/plot/templates.byId/*.json`,
not components — so there is no glob-import path into either file.

**Positive control (mandatory).** The identical pattern was run against
`GhostOptionNode`, known live via `src/canvas/nodes/registry.ts:34`. It
returned that registry consumer (2 hits) alongside the component and its
spec. A search that finds a known positive is what makes the two zeros
above mean something.

Non-consumer hits, both deliberate:

- `scripts/isolation-results/external-files.txt:193` names `KPIHeadline.tsx`.
  That file is a **generated artefact** — `scripts/verify-isolation.sh:45`
  rewrites it from a `find` on every run — not a consumer.
- `tests/ci-guards/css-var-resolution.spec.ts` pins `StabilityGauge.tsx` by
  path as one of the tree's dynamic `var(--${…})` sites. The guard walks the
  filesystem; it does not import the component. See the pin note below.

## Why archived rather than deleted

Same reasoning as PR #347: `archive/` sits outside the `src/` globs of
`tsconfig.app.json` (`include: ["src"]`), `tsconfig.ci.json` (an explicit
file list) and `vitest.config.ts` (`src/**/__tests__/**`, `src/**/tests/**`,
`tests/**`), so these files leave every gate and every DS/CSS metric while
staying one `git mv` from resurrection — and the move records *why* they
left, which a bare deletion buries.

Note both files had CSS-token fixes landed in PR #370 only days earlier.
Those fixes leave `src/` with the files; that is expected, not a conflict —
the guard's scope is `src/`, and the files are no longer in it.

## The spec moved with its component

`StabilityGauge.test.tsx` was moved, not deleted, matching PR #347's
handling of its four co-located specs: this is honest retirement of
**dead-component** coverage, not silencing of live coverage. The spec tests
only `StabilityGauge`, which nothing renders, so it was proving nothing
about the product. Keeping it beside the component means a resurrection
recovers the behaviour proof in the same `git mv`; deleting it would make
resurrection a rewrite. `KPIHeadline` never had a spec.

## The one pin edit this required

`EXPECTED_DYNAMIC_SITE_FILES` in `tests/ci-guards/css-var-resolution.spec.ts`
is an exact, bidirectional pin, so it failed the moment `StabilityGauge.tsx`
left `src/` — the intended behaviour. It was **narrowed** to the one
remaining site (`src/styles/evaluative.ts`), never relaxed to
additions-only. `EXPECTED_DYNAMIC_NAMES` and `KNOWN_FALLBACK_DRIFT` needed
no edit, and this is empirical rather than argued: with the files moved and
the pins untouched, the suite failed on the file list **alone**. Both files'
`var()` fallbacks matched their definitions post-#370, and `evaluative.ts`
expands to the same `success | warning | danger` union `getThresholdToken`
did.

## Resurrection

`git mv` the file back and re-run the census on its imports (the archived
files keep their original relative import paths, which do not resolve from
`archive/` — deliberate, and harmless because nothing compiles them). Full
pre-archive history: `git log --follow -- 'archive/dead-ui-components-2026-07/<file>'`.
Archived at staging tip `d3fa9c58` by the UI/Experience workstream.
