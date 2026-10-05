#!/usr/bin/env bash
# J1: apply the merged DGAI + CEE migrations to the local Supabase, one file at a
# time, and report EVERY file's outcome rather than stopping at the first failure.
#
#   OK          the file applied as one transaction.
#   PARTIAL     the transaction failed; the file was re-applied statement by statement
#               (ON_ERROR_STOP=0), so its other statements took effect.
#   DRIFT-SHIM  a `_j1_drift_` pre-shim (hosted-only object a later migration needs),
#               or a hosted-drift.sql line. Never counted as a repo migration.
#
# X7 (SPINE, Integrator): a PARTIAL is tolerated ONLY statement by statement, against
# expected-partials.tsv, keyed by file + line of the failed statement + SQLSTATE + the
# exact error text (which names the affected object). Every statement error goes to
# MIGRATION-ERRORS.tsv; X7-MIGRATIONS.txt holds the verdict:
#   MATCH      every error is listed (the schema result is still labelled PARTIAL);
#   UNLISTED   an error the list does not hold: the schema seam moved. Red.
# A listed error that no longer happens is STALE: reported, not red.
#
# Why not `supabase start` applying them: it stops at the first failure, which
# turns a 142-file history into one CI run per legacy defect.
#
# usage: apply-migrations.sh <migrations dir> <report.tsv>
set -uo pipefail
DIR="$1"; REPORT="$2"
OUT="$(dirname "$REPORT")"
ERRORS="$OUT/MIGRATION-ERRORS.tsv"
VERDICT="$OUT/X7-MIGRATIONS.txt"
EXPECTED="$(dirname "$0")/expected-partials.tsv"
DB="${J1_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
# J1_PSQL overrides the client, e.g. on a Mac without psql:
#   J1_PSQL="docker exec -i supabase_db_j1-journey psql -U postgres -d postgres"
# Every file goes in on stdin, so the same calls work through `docker exec -i`.
read -ra PSQL <<< "${J1_PSQL:-psql $DB}"
: > "$REPORT"; : > "$ERRORS"; rm -f "$VERDICT"
ok=0; partial=0; shim=0
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
    case "$name" in
      *_j1_drift_*) printf 'DRIFT-SHIM\t%s\n' "$name" >> "$REPORT"; shim=$((shim + 1)); continue ;;
    esac
    printf 'OK\t%s\n' "$name" >> "$REPORT"; ok=$((ok + 1))
  else
    case "$name" in
      *_j1_drift_*) echo "[migrations] pre-shim $name FAILED:"; cat "$LOG"; exit 1 ;;
    esac
    # Re-apply statement by statement; VERBOSITY verbose puts the SQLSTATE on every ERROR line:
    #   psql:<stdin>:57: ERROR:  42P01: relation "public.x" does not exist
    "${PSQL[@]}" -q -X -v ON_ERROR_STOP=0 -v VERBOSITY=verbose -f - < "$f" > "$LOG" 2>&1
    # perl, not sed: BSD sed (the Mac record script runs this too) has no \t in a replacement.
    N="$name" perl -ne 'print "$ENV{N}\t$1\t$2\t$3\n" if /^psql:<stdin>:(\d+): ERROR:  ([0-9A-Z]{5}): (.*?)\r?$/' "$LOG" >> "$ERRORS"
    n="$(grep -c "^$name	" "$ERRORS")"
    raw="$(grep -c 'ERROR' "$LOG")"
    # A failed transaction that yields no parseable ERROR line is unmeasured, never tolerated.
    [ "$n" -gt 0 ] || { echo "[migrations] $name failed but no ERROR line parsed ($raw raw): could not measure"; cat "$LOG"; exit 1; }
    printf 'PARTIAL\t%s\t%s statement error(s)\n' "$name" "$n" >> "$REPORT"; partial=$((partial + 1))
  fi
  "${PSQL[@]}" -q -X -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$version', '${name%.sql}') ON CONFLICT DO NOTHING;" > /dev/null
done
rm -f "$LOG"
# Hosted-only objects no migration creates (hosted-drift.sql): applied last, reported.
DRIFT="$(dirname "$0")/hosted-drift.sql"
if "${PSQL[@]}" -q -X -v ON_ERROR_STOP=1 --single-transaction -f - < "$DRIFT" > /dev/null 2>&1; then
  grep -E '^ALTER|^CREATE' "$DRIFT" | sed 's/^/DRIFT-SHIM\t/' >> "$REPORT"
else
  echo "[migrations] hosted-drift.sql FAILED to apply"; exit 1
fi
# PostgREST caches the schema: make it see the tables just created.
"${PSQL[@]}" -q -X -c "NOTIFY pgrst, 'reload schema';" > /dev/null
# Zero files applied means a wrong path, not a clean history.
[ $((ok + partial)) -gt 0 ] || { echo "[migrations] no files applied"; exit 1; }

# ── X7: every statement error must be on the allow-list, exactly ──────────────
[ -s "$EXPECTED" ] || { echo "[migrations] $EXPECTED is missing: could not measure X7"; exit 1; }
KEYS="$(mktemp)"; grep -v '^#' "$EXPECTED" | awk -F'\t' 'NF >= 4 { print $1 "\t" $2 "\t" $3 "\t" $4 }' > "$KEYS"
unlisted="$(awk -F'\t' 'NR == FNR { k[$0] = 1; next } !(($1 "\t" $2 "\t" $3 "\t" $4) in k)' "$KEYS" "$ERRORS")"
stale="$(awk -F'\t' 'NR == FNR { k[$1 "\t" $2 "\t" $3 "\t" $4] = 1; next } !($0 in k)' "$ERRORS" "$KEYS")"
errs="$(wc -l < "$ERRORS" | tr -d ' ')"
{
  if [ -n "$unlisted" ]; then
    echo "UNLISTED"
    echo "The schema seam moved: $(printf '%s\n' "$unlisted" | wc -l | tr -d ' ') statement error(s) not on expected-partials.tsv:"
    printf '%s\n' "$unlisted" | sed 's/^/  /'
  else
    echo "MATCH"
    echo "PARTIAL: $partial file(s), $errs statement error(s), every one on expected-partials.tsv"
  fi
  [ -z "$stale" ] || { echo "STALE (listed, no longer happens):"; printf '%s\n' "$stale" | sed 's/^/  /'; }
} > "$VERDICT"
echo "[migrations] applied: $ok OK, $partial PARTIAL ($errs statement errors), $shim DRIFT-SHIM pre + $(grep -c '^DRIFT-SHIM	ALTER\|^DRIFT-SHIM	CREATE' "$REPORT") post (report: $REPORT)"
cat "$VERDICT"
