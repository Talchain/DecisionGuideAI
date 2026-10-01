This is a dry run of the invite/team migrations on PGlite (Postgres running in-process). It never touches Supabase.

- `setup.sql` mirrors the live tables, keys, CHECK constraints and the `team_members` trigger.
- `before.sql` holds the five rewritten functions exactly as they are live (`pg_get_functiondef`, 1 Oct 2026).
- Every row binds to exact ids, error text and row tuples. The script exits 1 if any row fails.

```bash
cd supabase/tests/invite-hardening && npm i --no-save @electric-sql/pglite@0.2
M=../../migrations
node run.mjs                                     # BEFORE (live): 8/28
node run.mjs $M/20261001130338_contain_team_invite_functions_anon_20261001.sql \
             $M/20261001193210_invite_team_function_revoke_only_20261001.sql \
             $M/20261001210000_invite_team_function_rewrites.sql   # AFTER: 28/28
```

Each P1 of the #2402 review has a row that fails on the round-1 draft (`20261001140000` @ 58a5bc08) and passes on round 2:

| P1 | Row(s) |
|---|---|
| P1-1 | A5b |
| P1-2 | S3, S6 |
| P1-3 | T1 (a caller's TEMP table shadows `organisation_members` and `organisations`) |
| P1-4 | A6, A7 |
| P1-5 | C3 |
