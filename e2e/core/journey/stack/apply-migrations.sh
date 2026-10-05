#!/usr/bin/env bash
# J1: apply the merged DGAI + CEE migrations to the local Supabase, one file at a
# time, and report EVERY file's outcome rather than stopping at the first failure.
#
#   OK       the file applied as one transaction.
#   PARTIAL  the transaction failed; the file was re-applied statement by statement
#            (ON_ERROR_STOP=0), so its other statements took effect. Its errors are
#            in the report.
#
# Why not `supabase start` applying them: it stops at the first failure, which
# turns a 142-file history into one CI run per legacy defect. The report is itself
# a finding: the two repos' migrations, applied in order, do not rebuild a fresh
# database cleanly. The journey then shows whether any PARTIAL matters to the spine.
#
# usage: apply-migrations.sh <migrations dir> <report.tsv>
set -uo pipefail
DIR="$1"; REPORT="$2"
DB="${J1_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
# J1_PSQL overrides the client, e.g. on a Mac without psql:
#   J1_PSQL="docker exec -i supabase_db_j1-journey psql -U postgres -d postgres"
# Every file goes in on stdin, so the same calls work through `docker exec -i`.
read -ra PSQL <<< "${J1_PSQL:-psql $DB}"
: > "$REPORT"
ok=0; partial=0
# The CLI keeps this ledger when IT applies migrations; some migrations alter it
# (20260307000000_rls_audit_hardening), so create and fill it the same way.
"${PSQL[@]}" -q -X -v ON_ERROR_STOP=1 > /dev/null <<'SQL'
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text PRIMARY KEY, statements text[], name text);
SQL
LOG="$(mktemp)"
for f in $(ls "$DIR"/*.sql | sort); do
  name="$(basename "$f")"
  version="${name%%_*}"
  if "${PSQL[@]}" -q -X -v ON_ERROR_STOP=1 --single-transaction -f - < "$f" > "$LOG" 2>&1; then
    printf 'OK\t%s\n' "$name" >> "$REPORT"; ok=$((ok + 1))
    "${PSQL[@]}" -q -X -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$version', '${name%.sql}') ON CONFLICT DO NOTHING;" > /dev/null
  else
    first="$(grep -m1 'ERROR' "$LOG" | tr '\t' ' ' | cut -c1-200)"
    "${PSQL[@]}" -q -X -v ON_ERROR_STOP=0 -f - < "$f" > "$LOG" 2>&1
    n="$(grep -c 'ERROR' "$LOG")"
    printf 'PARTIAL\t%s\t%s statement error(s)\t%s\n' "$name" "$n" "$first" >> "$REPORT"; partial=$((partial + 1))
    "${PSQL[@]}" -q -X -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$version', '${name%.sql}') ON CONFLICT DO NOTHING;" > /dev/null
  fi
done
rm -f "$LOG"
# PostgREST caches the schema: make it see the tables just created.
"${PSQL[@]}" -q -X -c "NOTIFY pgrst, 'reload schema';" > /dev/null
echo "[migrations] applied: $ok OK, $partial PARTIAL (report: $REPORT)"
grep '^PARTIAL' "$REPORT" || true
# Zero files applied means a wrong path, not a clean history.
[ $((ok + partial)) -gt 0 ] || { echo "[migrations] no files applied"; exit 1; }
