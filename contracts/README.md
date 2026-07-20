# Cross-service contract validation

This directory contains JSON Schema files defining the boundary contracts
between the UI and consuming services (currently CEE orchestrator).

The UI validates its outbound payloads (turn requests) and inbound
consumption (response envelopes, stream events) against these schemas
at CI-time and in contract tests.

## Schema files

| File | Direction | Description |
|------|-----------|-------------|
| `cee/turn-request.schema.json` | UI → CEE | Turn request payload (all 7 turn types) |
| `cee/analysis-state.schema.json` | UI → CEE | analysis_state included in post-analysis turns |
| `cee/graph-state.schema.json` | UI → CEE | graph_state with V3 nodes and edges |
| `cee/system-event.schema.json` | UI → CEE | Wire system event payload |
| `cee/orchestrator-response-v2.schema.json` | CEE → UI | Orchestrator response envelope |
| `cee/stream-event.schema.json` | CEE → UI | SSE stream events |

## Updating contracts

Sync from the CEE repo (sibling directory or explicit path):

```bash
CEE_REPO_PATH=../olumi-assistants-service bash scripts/fetch-cee-contracts.sh
```

If the CEE repo doesn't yet export a `contracts/` directory, the script
will look for `schemas/` as a fallback. In local (permissive) mode, missing
schemas are skipped with a warning and the committed reference copies in
`cee/` are used instead; in CI the sync is strict and any missing schema
fails the job. Provenance of the committed copies (source repo/branch/SHA and
what each file derives from) is recorded in [`cee/README.md`](cee/README.md) —
update it whenever you re-sync.

## Running contract tests

```bash
npx vitest run tests/contracts/
```

## What this catches

- UI sending fields CEE doesn't expect (forbidden additionalProperties)
- UI omitting fields CEE requires (missing required)
- UI sending wrong shapes (e.g. analysis_state without response_hash)
- analysis_state with option_comparison (not legacy results) passes validation
- CEE response shape changes breaking UI consumption (envelope, stream events)
- Structural regressions in turn request builders

## CI integration

The `Contract Validation` workflow (`.github/workflows/contract-validation.yml`)
runs on every push/PR to staging and main:

1. Checks out `Talchain/olumi-assistants-service@staging` — a failed checkout
   **fails the job** (no silent fallback; the pre-2026-07-20 version silently
   fell back to the committed mirror for the gate's entire life)
2. Strict-syncs CEE's exported schemas over `contracts/cee/`
3. Emits a loud warning annotation if the committed mirror has drifted from
   CEE's staging tip (non-blocking — breaking drift fails via the tests)
4. Runs all contract tests against the fetched (real) schemas
5. Fails the build if any payload mismatch is detected
