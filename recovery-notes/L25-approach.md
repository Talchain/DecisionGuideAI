# L25 stage 0
1. Source loss: `GoalNode:887` calls `goalTargetSourceMark` (`valueSourceMark.tsx:290`), which discards the saved goal's `from_brief` + `source_quote`.
2. Smallest fix: that ONE mark reader accepts those declared fields; inferred/proxy stays Olumi, no record stays unknown.
3. Reuse `resolveGoalTarget`, `isStatedTargetValue`, existing source mark kinds/words and the existing draft-to-canvas adapter in rows.
4. Replace the threshold-only brief test and duplicate validity checks; no second classifier, parser, writer, or UI component.
5. Reject changing limitSource (not this route) or the shared target resolver (unnecessary scope); do not borrow a current-level source.
6. Class proof: two synthetic briefs through mapDraftNodeToCanvas → GoalNode, exact node-id-bound source labels; unknown, missing quote and inferred/proxy negatives.
7. HIGH mutants: remove known-source mapping (under-credit); accept any quote or from_brief without quote (over-credit); inferred/proxy and unknown mutant pairs too.
8. S11 authorship display, local real-route rung only; 0 provider calls, one spec per process; DL owns commit/push/review/served witness.

Trace: user's exact target sentence → existing saved goal raw/unit + provenance/source_quote → mapper preserves the same node → GoalNode reads that target → source mark.
Approval: the existing brief already authors this target; no new approval or author is inferred. First loss: mark reader ignores the saved fields.
Buddy: correct: display the declared source without parsing words; simplest: amend one reader and remove duplicated validity checks.
OpenAI: no SDK replacement applies to this local label reader; AI already declared provenance/quote; no extra calls or latency.

Check constraint: ps is denied by the sandbox; pgrep also cannot obtain a process list (sysmond unavailable). No other typechecker has been launched by this builder.
