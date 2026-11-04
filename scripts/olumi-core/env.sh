# The build/dev environment for DGAI on olumi-core: the staging build's flags (netlify.toml [build.environment] +
# [context.staging.environment]) plus the same-origin V5 endpoint and the olumi-core lane flag. Source this, do not execute it.
#   VITE_OLUMI_CORE=1   this build talks to olumi-core only: the core route is the default lane and CEE-only chrome is hidden
#   VITE_FEATURE_COMPARE_TAB=1  the dock's Compare tab, which on this lane reads core's own comparison (src/olumiCore/compare.tsx)
#   VITE_V5_ENDPOINT    the legacy chat turn, which this lane never sends (src/olumiCore/bffGuard.ts answers /bff/ with a 404)
export VITE_V5_ENDPOINT=/bff/orchestrate/v2/turn VITE_ENABLE_V5_ORCHESTRATOR=true VITE_ENABLE_ORCHESTRATOR_V2=true \
       VITE_AUTH_MODE=guest VITE_DISABLE_OPENAI=1 VITE_POC_ONLY=0 VITE_PLC_LAB=1 VITE_APP_ENV=staging \
       VITE_FEATURE_AI_PANEL_V2=true VITE_V5_CANONICAL_ANALYSIS=true VITE_FEATURE_GRAPH_LENS=true \
       VITE_FEATURE_DECISION_OVERVIEW=1 VITE_FEATURE_STRENGTHEN_PANEL=1 VITE_FEATURE_PRE_ANALYSIS_V3=1 \
       VITE_OLUMI_CORE=1 VITE_FEATURE_COMPARE_TAB=1 \
       VITE_SUPABASE_URL=http://127.0.0.1:1 VITE_SUPABASE_ANON_KEY=olumi-core-lane-no-supabase
