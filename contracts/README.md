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
will look for `schemas/` as a fallback. Missing schemas are skipped —
the committed reference copies in this directory are used instead.

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

1. Optionally fetches latest CEE contracts from the CEE repo
2. Falls back to committed reference schemas if CEE repo is unavailable
3. Runs all contract tests
4. Fails the build if any payload mismatch is detected
