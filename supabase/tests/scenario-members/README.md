A dry run of the viewer-share migration on PGlite (Postgres running in-process). It never touches Supabase.

- `setup.sql` mirrors the live `scenarios` table, **including its four live RLS policies**, plus Supabase's default ACL. So a member's direct reads and writes go through the real policy, and a forgotten REVOKE would show.
- `live-write-doors.sql` holds the live bodies of every Supabase write door a member could reach (`apply_patch_and_log`, `append_scenario_event`, `create_shared_snapshot`, `duplicate_scenario`), verbatim from `pg_get_functiondef` (2 Oct 2026). Only pgcrypto's `gen_random_bytes` is stubbed; it runs after the ownership check.
- Every row binds to exact ids, SQLSTATE + message, or row tuples. The script exits 1 on any failure.

```bash
cd supabase/tests/scenario-members && npm i --no-save @electric-sql/pglite@0.2
node run.mjs ../../migrations/20261002073706_scenario_members_viewer_share_20261002.sql   # 29/29
```

| Rows | Claim |
|---|---|
| S1–S6 | Owner shares (normalised, idempotent). A non-owner, someone else's decision and a guest decision are refused with identical SM403 bytes. anon is refused. Bad or own email → SM400. An address with no account answers the same `{shared:true}`, so there is no account oracle. |
| M1–M7 | The member sees it in "Shared with me". `scenario_access` gives owner / viewer / none. `is_scenario_member` is service_role only. An UNCONFIRMED matching email sees nothing. The members table is closed to direct reads and writes. Memberships on a guest decision or the member's own decision never surface. |
| W1–W7 | Every Supabase write door refuses a member, against the LIVE bodies and LIVE RLS: graph patch, event-only patch, event append, share snapshot, duplicate, direct UPDATE (0 rows), direct SELECT (0 rows). The row is byte-unchanged. |
| R0–R2, L1 | Only the owner can list and revoke. A revoke removes list, access and CEE read, and KEEPS the row with `revoked_at` (no delete). Sharing again restores access. |
| H1–H2 | SECURITY DEFINER, `search_path=''`, exact EXECUTE grants. A caller's TEMP `scenario_members` cannot forge access. |

Mutants, each turning named rows RED:

| Mutant | Rows it turns RED |
|---|---|
| share owner check removed | S3 S3b S3c M1 R1 |
| confirmed-email check removed | M4 |
| `is_scenario_member` open to authenticated | M3b H1 |
| revoked filter dropped from Shared-with-me | R1 |
| unshare owner check removed | R0 L1 R1 |
| Shared-with-me admits guest/own rows | M7 R1 |
| CEE member check admits guest rows | M7 |
