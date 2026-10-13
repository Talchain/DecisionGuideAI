- Progress: moved both served fixtures into conversation-local `fixtures/t1ui3/`; the inertness guard and both requested conversation specs pass.
- Next: DL to commit the correction and rerun CI; run the unmodified typecheck gate in a git-authorized environment.
- Mistakes: I imported fixtures across the protected analysis-hero boundary and missed its inertness guard in the prior discovery.
- Corrections: copied exact bytes, added one provenance line per fixture, and changed only the two import paths. Guard, allow-list, assertions and production code are unchanged.

| Spec | Passed | Failed | Skipped |
|---|---:|---:|---:|
| `src/components/results/analysis-hero/__tests__/inertness.spec.ts` | 29 | 0 | 0 |
| `src/canvas/conversation/__tests__/useConversation.hook.spec.ts` | 83 | 0 | 22 existing |
| `src/canvas/conversation/__tests__/resultFirstExplanation.spec.tsx` | 6 | 0 | 0 |
| **Total** | **118** | **0** | **22** |

Ran one spec per process with the required Supabase test placeholders. [Recorded counts](recovery-notes/t1ui3/spec-results.json).

`npm run typecheck` ran **once**, exit **1**: blocked at `scripts/ci/typecheck-gate.sh:251`, whose mandatory `git ls-files` inventory conflicts with “No git.” The PATH guard refused git execution; no inventory or baseline was fabricated. [Output](recovery-notes/t1ui3/typecheck.log). This is not a green typecheck claim.

New fixtures under `src/canvas/conversation/__tests__/fixtures/t1ui3/`:

| File | Bytes | SHA-256 (source = copy) |
|---|---:|---|
| `p45-b1-0eba01bb-run2-turn.json` | 45540 | `d138a0a2e28b0c22c88357ae041d00e785a89db60c120684986a3fb5e8b2f6e2` |
| `unseen-1.turn.json` | 44059 | `db1c85e6ccd761fcb6453ed6135750e1ff5424f59d90ed8408c81dbaae4a38f6` |

Each source path is named in the fixture [README](src/canvas/conversation/__tests__/fixtures/t1ui3/README.md). Byte equality and unchanged guard/spec hashes verified after testing: [integrity record](recovery-notes/t1ui3/integrity.json). No rows weakened; no mutations or CEE checks repeated. No git operations or cleanup; space freed: 0 bytes.
