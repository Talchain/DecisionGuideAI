# Collaboration-track branch inventory and preservation plan

**Date:** 2026-06-04
**Type:** Read-only inventory. No branch was pushed, merged, rebased, consolidated, switched destructively, or altered. Inspection only (`git branch`, `git show`, `git log`, `git status`, `git worktree list`, `git diff-tree`).
**Purpose:** the collaboration-track documentation lives entirely in unpushed local branches on a single worktree, which is an operational risk (loss if the worktree is pruned or the local repo cleaned). This inventory records each branch and recommends a preservation route. **No push until Paul explicitly approves.**

---

## 1. Inventory

All branches were authored on the one worktree `…/.claude/worktrees/stoic-torvalds-0015be`; none of the collaboration branches is checked out in a separate worktree, so there is a single working tree and it is clean. "Clean working tree" below means no uncommitted changes are associated; "documentation-only" means the branch's commits touch only `docs/` markdown.

| Branch | Commit | Document(s) produced | Clean tree | Doc-only | Recommended route |
|---|---|---|---|---|---|
| `claude/collab-phase0-audit` | `1e1028bf` | `docs/audits/collab-phase0-audit-v1.md` | yes | yes | Push or consolidate (standalone; predates this session, 2026-05-09; confirm whether already tracked) |
| `claude/collab-surface-recon` | `5c98a57c` | `docs/audits/collab-surface-recon-v1.md` | yes | yes | Consolidate (standalone off staging) |
| `claude/collab-teams-disposition-audit` | `a9d80d12` | `docs/audits/collab-teams-disposition-audit-v1.md` | yes | yes | Consolidate (standalone off staging) |
| `claude/tenancy-rls-migration-spec-v1_3` | `7b2ce689` | `docs/specs/tenancy-rls-migration-spec-v1_3-draft.md` | yes | yes | Preserved via chain tip; superseded by v1.6 (keep for history) |
| `claude/collab-environment-namespace-verification` | `22b8135e` | `docs/audits/collab-environment-namespace-verification-v1.md` | yes | yes | Preserved via chain tip (in chain) |
| `claude/tenancy-rls-migration-spec-v1_4` | `e62e5f11` | `docs/specs/tenancy-rls-migration-spec-v1_4-draft.md` | yes | yes | Preserved via chain tip; superseded by v1.6 |
| `claude/tenancy-rls-migration-spec-v1_5` | `9d670e76` | `docs/specs/tenancy-rls-migration-spec-v1_5-draft.md` | yes | yes | Preserved via chain tip; superseded by v1.6 (keep for history) |
| `claude/collab-multiuser-design` | `2bf8b774` | `docs/designs/collab-multiuser-design-recommendations-v1.md` | yes | yes | Preserved via chain tip (in chain) |
| `claude/tenancy-collab-spec-v1_6` | this commit | `docs/specs/tenancy-collab-migration-spec-v1_6-draft.md`, `docs/audits/collab-branch-inventory-v1.md` | yes | yes | Consolidation base / chain tip |

Note: commit hashes above are each branch's own tip before this v1.6 commit; the v1.6 branch advances to a new hash when this consolidation commits (recorded by the runner).

## 2. Chain versus standalone structure

The spec and design branches form a **chain**, each cut from the previous, so the later branch contains all earlier chain documents:

`v1.3 (7b2ce689)` to `environment (22b8135e)` to `v1.4 (e62e5f11)` to `v1.5 (9d670e76)` to `design (2bf8b774)` to `v1.6 (this branch)`.

Verified on this branch's tip, the chain carries: `tenancy-rls-migration-spec-v1_3/_4/_5-draft.md`, `collab-environment-namespace-verification-v1.md`, `collab-multiuser-design-recommendations-v1.md`, and now `tenancy-collab-migration-spec-v1_6-draft.md` plus this inventory. That is **seven of the ten** collaboration documents in one branch.

**Standalone** off staging, not in the chain: `collab-phase0-audit-v1.md` (`1e1028bf`, predates this session), `collab-surface-recon-v1.md` (`5c98a57c`), `collab-teams-disposition-audit-v1.md` (`a9d80d12`). These three are the only documents not already gathered by the v1.6 chain tip.

## 3. Recommended overall preservation route (pending Paul approval)

**Recommended: consolidate all collaboration documentation onto one docs branch and open a single documentation pull request.** Rationale: every branch is documentation-only and mutually referential (the docs cross-cite each other by path and commit), so a single review preserves the cross-references and is far easier to review than nine separate pull requests; the chain has already consolidated seven of the ten documents.

Ordering (all steps require Paul's explicit approval before any push, merge, cherry-pick, or rebase; this document performs none of them):
1. Use `claude/tenancy-collab-spec-v1_6` as the consolidation base. It already carries the v1.3, v1.4, v1.5 specs, the environment audit, the design recommendations, the v1.6 spec, and this inventory.
2. Bring the three standalone audit documents onto the base by cherry-picking each branch's single one-file commit: `collab-surface-recon` (`5c98a57c`), `collab-teams-disposition-audit` (`a9d80d12`), and, if not already tracked elsewhere, `collab-phase0-audit` (`1e1028bf`). Each is a clean, one-file, documentation-only commit, so cherry-pick is low-risk and conflict-free (distinct file paths).
3. Open one documentation pull request from the consolidated branch.

**Caveats.** `collab-phase0-audit` predates this session (2026-05-09); confirm whether it is already tracked or merged before re-introducing it, to avoid a duplicate. The superseded spec drafts (v1.3, v1.4, v1.5) are retained for history within the consolidated branch; v1.6 is the live baseline.

**Alternative route:** push each of the nine branches as its own pull request. This preserves the most granular history but produces nine reviews and loses the single-document-set coherence; not recommended for documentation-only drafts.

## 4. Risk if not preserved

These are unpushed local branches on one worktree. If that worktree is pruned (the `git worktree list` shows many `prunable` worktrees on this machine) or the local clone is cleaned, the entire collaboration documentation track is lost, because none of it exists on a remote. Preservation (push of the consolidated branch) should happen soon, on Paul's approval.

## 5. Method and constraints honoured

Read-only inspection only: `git branch`, `git for-each-ref`, `git log`, `git show`, `git diff-tree --name-only`, `git status`, `git worktree list`. No branch was pushed, merged, rebased, consolidated, or altered; no worktree was dirtied; branch switching occurred only within the single `stoic-torvalds-0015be` worktree, which remained clean throughout. No push performed or implied without Paul's approval.

---

*End of branch inventory v1*
