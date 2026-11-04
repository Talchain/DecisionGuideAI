# Serving DGAI on olumi-core-v3

DGAI has no host of its own on this lane. olumi-core serves DGAI's built `dist/` from its own process, on its own origin: DGAI at
`/`, core's own page at `/s/<scenario>`, `/debug` and `/admin`, with one cookie and no `/bff`. The build is committed to core's
branch `v3` as `ui-dist/`, and Render's `olumi-core-v3` service deploys that branch. DGAI's Netlify staging is not involved.

Nothing here deploys. The flip waits for the final whole-branch Codex review of `poc/dgai-core-v31` and the DL's go.

## Settings (names only)

**DGAI build** (baked in at build time; nothing is read at runtime, and none is a secret). They are set by
`scripts/olumi-core/env.sh`, which `scripts/olumi-core/run.sh build` sources:
`VITE_OLUMI_CORE`, `VITE_FEATURE_AI_PANEL_V2`, `VITE_AUTH_MODE`, `VITE_DISABLE_OPENAI`, `VITE_APP_ENV`, `VITE_POC_ONLY`,
`VITE_PLC_LAB`, `VITE_V5_ENDPOINT`, `VITE_ENABLE_V5_ORCHESTRATOR`, `VITE_ENABLE_ORCHESTRATOR_V2`, `VITE_V5_CANONICAL_ANALYSIS`,
`VITE_FEATURE_GRAPH_LENS`, `VITE_FEATURE_DECISION_OVERVIEW`, `VITE_FEATURE_STRENGTHEN_PANEL`, `VITE_FEATURE_PRE_ANALYSIS_V3`,
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. The last two are a dead address on purpose: this build has no Supabase.

**olumi-core-v3 service**:
- `OLUMI_UI_DIST`: the deployed `ui-dist/` directory. It is the only setting this lane adds. When it is unset, `/healthz` answers
  `ui: null` and `/` is core's own page.
- Unchanged: `OLUMI_DB`, `OLUMI_ADMIN_KEY`, `OPENAI_API_KEY`, `OLUMI_LEDGER`, `OLUMI_CALL_CAP`, `OLUMI_PERSON_CALL_CAP`,
  `OLUMI_BACKUP_DIR`.

UNVERIFIED (not read here; reading the live service is the release owner's call): whether `OLUMI_UI_DIST` is already set on
olumi-core-v3. The first check below answers it.

## The flip: one step, by core's release owner (github-a7)

Run this in a core checkout that tracks `origin/v3`, with DGAI checked out cleanly at the reviewed commit `<SHA>`:

```bash
scripts/build-ui-dist.sh <DGAI checkout> <SHA> && git push origin HEAD:v3
```

`build-ui-dist.sh` builds DGAI with the settings above, replaces `ui-dist/`, writes `ui-dist/BUILD.json` (the commit, the artifact
sha256, and View contract `olumi.view/2`) and commits. Push in the foreground, then check the remote with
`git ls-remote origin refs/heads/v3`. Render deploys `v3`.

If `/healthz` answered `ui: null` before the flip, `OLUMI_UI_DIST` also has to be set on the service, once.

## Checks after the deploy

1. `/healthz` answers `ui.dgai` equal to `<SHA>` and `ui.sha256` equal to `artifact_sha256` in `ui-dist/BUILD.json`.
2. `/` is DGAI and `/s/<scenario>` is core's page.
3. A link made by `POST /api/admin/people { name, scenario }` lands on `/#/scenario/00000000-0000-4000-8000-<the 12 hex>` (API v1.9).
4. Only with the DL's go: `CORE_BASE=https://<v3 host> scripts/olumi-core/two-people.mjs`. On a real core it makes paid AI calls
   (a brief, two messages, a figure edit, and Olumi's replies). It was written for the scripted core, so the checks that depend on
   Olumi's own replies (a proposal for "staff absence", a next step beside one card, a recorded disagreement) may not hold with a
   real AI. Those are findings about the replies, not failures of the screen.

## Rollback

Rebuild `ui-dist/` at the previous DGAI commit (BUILD.json names it), or unset `OLUMI_UI_DIST` so `/` is core's page again. No data
changes either way: DGAI writes only through core's routes.
