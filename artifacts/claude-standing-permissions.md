# Standing Permissions + Autopilot Charter

You will operate autonomously to advance the Scenario Sandbox PoC with zero hand-holding.

## GROUND RULES (do not deviate)
- PROTECTED folder (used by Windsurf): /Users/paulslee/Documents/GitHub/DecisionGuideAI  ← never edit, install, or run anything here.
- Your work folder: /Users/paulslee/Documents/GitHub/DecisionGuideAI-Claude  ← do all work here (or in your own worktree).
- Safety defaults: Sim Mode only; no Docker; no dev servers; all powerful features OFF by default (rate limit, cache, usage, monitoring, secret-hygiene blocking, SLOs).
- Privacy: never log request/response bodies or any personal data (PII).
- Contracts: keep schemas stable and additive only; Contract Wall must stay green.

## SAFETY HANDSHAKE (print only; no prompts)
1) Print: `pwd`, `git rev-parse --show-toplevel`, current branch, and `git status --porcelain`.
2) If you are in the PROTECTED folder, create/switch to a dedicated branch and worktree:
   `git checkout -b platform/autopilot-$(date +%Y%m%d-%H%M)` (reuse if exists)
   `git worktree add ../DecisionGuideAI-Claude $(git branch --show-current)`
   Then switch to ../DecisionGuideAI-Claude and push the branch.
3) Continue in /Users/paulslee/Documents/GitHub/DecisionGuideAI-Claude only.

## STANDING PERMISSIONS (no need to ask)
- Create/edit files inside your worktree (code, docs, scripts, CI, artefacts).
- Install/update **dev** dependencies in your worktree; update package.json/lockfile there.
- Run scripts: `npm ci`, `npm run typecheck`, `npm test`, CodeQL, Contract Wall, Integration/Determinism checks, SARB pack/replay/diff/transcript/report, preflight budget, policy check, artefacts scan, release:dry/poc (no Docker), any `tools/*.ts` CLI, `chmod +x`, `mkdir -p`.
- Git: create branches `platform/*`, commit, push, open PRs; use `git worktree add` for isolation.
- CI/Docs: add or edit GitHub Actions, PR/issue templates, README/Handbook, `/artifacts/**` HTML/MD/JSON, `/tools/**` utilities.
- Large files: write in numbered chunks (Chunk 1/4, 2/4, …) with small commits to avoid timeouts.

## MUST ASK FIRST (print one line starting with `CLARIFY:` and wait)
- Deleting/renaming many files or changing licences.
- Running Docker, starting servers, or calling live external APIs.
- Editing the PROTECTED folder or pushing directly to `main`.
- Turning ON powerful flags (usage, monitoring, rate-limit, cache, secret blocking, SLOs) outside a clearly labelled test.
- Changing secrets/env, enabling public GitHub Pages, force-pushes/rebase onto shared branches, publishing packages, DB migrations, or any schema change that would break the Contract Wall.

## QUALITY GATES (after every task)
- Run: `npm run typecheck && npm test`.
- If schemas/exports touched: `npm run contract:check`.
- If bundles/results touched: `npm run determinism:check`.
- CodeQL + Log guardrail must stay green.
- End each task with exactly:
  ACCEPTANCE: <what you finished>; tests/typecheck green; defaults OFF; artefacts updated; no edits in the PROTECTED folder.

## IDEMPOTENCY RULE
- If an artefact or tool already exists, verify it meets acceptance; improve if needed; otherwise skip. Never duplicate.

## ONE-TIME TIDY-UP (run once per repo to reduce future prompts)
1) Ensure you are in your own worktree/clone (above). If not, create it now.
2) Prefer npm scripts for common actions; add missing scripts so you can use `npm run …` instead of ad-hoc commands.
3) Enforce small, frequent PRs: branch names `platform/<ticket>-<slug>`, ~≤400 LOC per PR.
4) Save this charter to `/artifacts/claude-standing-permissions.md` and add a tiny helper `/tools/copy-standing-permissions.sh` that prints it to stdout for easy re-pasting.

## OPERATING LOOP (what to do next, autonomously)
- Resume any in-progress high-value backlog you were working on (e.g., experiment runner/scoreboards, SARB tools, transcripts, Report v1 synthesiser, UI view-models/fixtures, budget/policy advisory, SARB explorer, coverage maps, ranks, UI kick-start zip).
- If a TODO file exists (e.g., `/artifacts/*todo*.md`), consume that in priority order.
- If no TODO is present, select the next highest-value item that: (a) unblocks Windsurf integration with **fixtures/view-models/types**, (b) increases reproducibility or comparability (**SARB**, determinism, diff/score), or (c) de-risks delivery (**preflight budget/policy advisory**, coverage/scan reports).
- Work in small, reversible commits/PRs. Update `/artifacts/index.html` and `/artifacts/start-here.html` with links to any new outputs.
- Keep Sim Mode only; do not start servers or Docker.

## FINISHING STATEMENT
At the end of your session print exactly:
ACCEPTANCE: Autopilot session completed through <last-task-name>; tests/typecheck green; defaults OFF; artefacts updated; no edits in the PROTECTED folder.

### Extra No-Prompt Allowlist (this worktree only)
I pre-approve these routine commands in /Users/paulslee/Documents/GitHub/DecisionGuideAI-Claude:
- npm run artefacts:scan
- npm run artefacts:scan:strict
- npm run typecheck
- npm test

I also pre-approve edits to the following paths during this session:
- artifacts/poc-v1-release-kit.html
- artifacts/**, tools/**, integration/**, .github/**, docs/**, openapi/**

Not allowed without asking: starting servers, publishing, force pushes, editing the PROTECTED Windsurf folder, writing secrets/env files.

### Additions to No-Prompt Allowlist (this worktree only)
Pre-approved commands (read-only or local build/test only):
- `npm run pack:ui`
- `cd artifacts/ui-kickstart-pack && npm run build`
- `cd artifacts/ui-kickstart-pack && npx tsx smoke.test.ts`
- `node artifacts/ui-kickstart-pack-smoke-test.ts`
- `npm run contract:check`
- `npm run | grep contract` (listing scripts only)
- `npm run artefacts:scan`, `npm run artefacts:scan:strict`
- `npm run typecheck`, `npm test`

Shell utilities:
- `tar -tzf <file.tgz>` ; `zip -r <zipname> <dir under /artifacts>`
- `cat`, `head`, `tail`, `grep`, `sed`, `jq`, simple `bash` loops and pipes
- `chmod +x tools/** artifacts/**`
- Example: parse `/artifacts/pages-manifest-demo.json` or `/artifacts/reports/artefact-scan.md`

Approved edit paths: `artifacts/**`, `tools/**`, `integration/**`, `openapi/**`, `.github/**`, `docs/**`

Not allowed without asking: starting servers, publishing, force pushes, tags/releases, editing PROTECTED Windsurf, writing secrets/env files.