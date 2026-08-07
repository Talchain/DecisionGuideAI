# CEE contract mirror — provenance

The `*.schema.json` files in this directory are **byte-for-byte copies of CEE's
exported contract schemas**. Do not hand-edit them — re-sync instead:

```bash
CEE_REPO_PATH=../olumi-assistants-service bash scripts/fetch-cee-contracts.sh
```

Keeping them byte-identical to CEE's export matters: the CI gate
(`.github/workflows/contract-validation.yml`) fetches the live schemas from
CEE's `staging` tip on every run and reports any drift between that tip and
these committed copies.

## Current sync

| | |
|---|---|
| Source repo | `Talchain/olumi-assistants-service` |
| Source branch | `staging` |
| Source commit | `53b817b6dfc9846049250b67c02352b7008dec34` |
| Synced | 2026-07-20 |
| Notable | Includes CEE #574 (`6a6e427e`): envelope stage vocabulary now DERIVED from the canonical `@talchain/schemas` `Stage` (`frame · analyse · decide · review`); retired `ideate`/`evaluate`/`optimise` gone from the response schema. |

## Provenance caveats (verified 2026-07-20 at the source commit above)

- CEE generates these files with `scripts/export-schemas.ts` (zod-to-json-schema
  over the source Zod schemas).
- **Output schemas** (`orchestrator-response-v2`, `stream-event`) derive from
  CEE's V2 contract-test surface (`response-envelope-schema.ts`,
  `stream-events.ts`). The live `/orchestrate/v2/turn` boundary itself validates
  with `@talchain/schemas/boundary`.
- **Input schemas** (`turn-request`, `system-event`, `analysis-state`,
  `graph-state`) derive from `src/orchestrator/route-schemas.ts`, which guards
  **`POST /orchestrate/v1/turn` — a surface that returns 410 on live deploys**
  (V4 disabled). They describe the legacy request surface, not the live V5
  payload shape. CEE's own #574 commit records the same caveat for
  `turn-request.schema.json` ("still carries the retired vocabulary — it
  derives from the V1 request schema … behind the /orchestrate/v1/turn 410").
- `stream-event.schema.json` `turn_start.stage` is still an untyped bare string
  (`minLength: 1`, no enum) — the KNOWN GAP tripwire in
  `tests/contracts/response-envelope-contract.test.ts` pins this and fails loud
  if CEE ever tightens it.
