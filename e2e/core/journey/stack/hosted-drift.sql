-- J1 stack: objects the HOSTED project has that NO migration in either repo creates.
-- Applied after the merged migrations, and reported in MIGRATION-REPORT.tsv as
-- DRIFT-SHIM rows, so each is a visible finding, not a silent fix. Add an item only
-- with the measurement that proved it.

-- 1. user_profiles.email. The auth.users trigger ensure_user_profile() inserts it
--    (DGAI 20260306000000_auth_hub_profiles.sql:44, which says the email sync
--    "already" exists), but no migration adds the column. Without it, every sign-up on a
--    fresh database fails: GoTrue 500 "Database error saving new user", 42703
--    (local stack 5 Oct 11:59Z; thin-client spike runs 37304861052/37305001956).
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email text;
