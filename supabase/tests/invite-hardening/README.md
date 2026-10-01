Dry-run of `20261001140000_invite_team_function_hardening.sql` on PGlite (in-process Postgres), with stub tables and the live function bodies as the BEFORE state. It never touches Supabase.

```bash
cd supabase/tests/invite-hardening && npm i --no-save @electric-sql/pglite@0.2
node run.mjs                                                          # BEFORE: 7/18 (attack rows FAIL)
node run.mjs ../../migrations/20261001140000_invite_team_function_hardening.sql   # AFTER: 18/18
```
