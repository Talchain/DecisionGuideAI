-- BIL Phase 1: Add latest_analysis_summary convenience cache to scenarios.
--
-- latest_analysis_summary is a JSONB convenience cache of the most recent
-- assembled AnalysisInputsSummary. Updated when analysis runs (mutable working
-- state). Snapshots remain the immutable truth store; this column is for
-- quick context retrieval without joining scenario_snapshots.
--
-- Safe to run multiple times (idempotent via ALTER TABLE ... ADD COLUMN IF NOT EXISTS).

ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS latest_analysis_summary jsonb;

COMMENT ON COLUMN scenarios.latest_analysis_summary IS
  'BIL Phase 1: Convenience cache of the most recent AnalysisInputsSummary (assembled by UI). '
  'Mutable — overwritten on each analysis run. Snapshots are the immutable truth.';
