This is a dry run of the invite/team migrations on PGlite (Postgres running in-process). It never touches Supabase.

- `setup.sql` mirrors the live tables, keys, CHECK constraints and the `team_members` trigger.
- `before.sql` holds the six rewritten functions exactly as they are live (`pg_get_functiondef`, 1 Oct 2026), including the email helper's real body.
- Only the transport is mocked: `extensions.http` and `extensions.http_header` record the Brevo request into `email_outbox`.
- Every row binds to exact ids, error text and row tuples. The script exits 1 if any row fails.

```bash
cd supabase/tests/invite-hardening && npm i --no-save @electric-sql/pglite@0.2
M=../../migrations
node run.mjs                                     # BEFORE (live): 9/33
node run.mjs $M/20261001130338_contain_team_invite_functions_anon_20261001.sql \
             $M/20261001193210_invite_team_function_revoke_only_20261001.sql \
             $M/20261001201416_invite_team_function_rewrites_20261001.sql   # AFTER: 33/33
```

Each P1 of the #2402 review has a row that fails on the round-1 draft (`20261001140000` @ 58a5bc08) and passes on round 2:

| P1 | Row(s) |
|---|---|
| P1-1 | A5b |
| P1-2 | S3, S6 |
| P1-3 | T1 (a caller's TEMP table shadows `organisation_members` and `organisations`) |
| P1-4 | A6, A7 |
| P1-5 | C3 |
| Round-2 P2: production-shaped team invite (no `organisation_id`, as `TeamsContext.tsx:189` writes it) | PS1, PA1, PA2 (PA3 is the hostile twin) |
| Round-2 P2: email transport under `search_path = ''` | S4, S6, PS1 (the real helper body; only transport mocked) |

Mutants: scope taken from the nullable row instead of the stored team reddens PA1, PA2 and PS1. Dropping team-admin authority reddens PA2. An unqualified transport reddens S4, S6 and PS1.
| Round-3 P1: an outsider's team that claims an org (teams INSERT RLS checks only `created_by`) | RLS1 runs through the real `teams` / `invitations` RLS as `authenticated`. It fails on the round-3 head `35b5d95e`, which is also the mutant without the membership check. |

Follow-up (ACCESS lane, not in this migration): the `teams` INSERT/UPDATE policies let any user create or retarget a team to any `organisation_id`.
