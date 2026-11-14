# 3 — First model awaiting approval

PASSED for the zero-provider interaction slice. The stage explicitly names the View's proposal and says it awaits approval. Existing per-card and per-link authorship/provisional marks remain intact. Ask for a change focuses the existing composer, preserves typed words and sends nothing automatically. Group review can be ticked and unticked; Approve ticked becomes usable. This does not claim an AI-generated revision.

The first pointer drive found the sticky action footer covering a ticked checkbox at 1128. Fixed at the root: the proposal has separate header, scrollable review body and action regions. The thread yields enough room for the proposal. No forced clicks.

Final drive: `03-approval-final/results.json`, six cases. At all three sizes, Approve POST returns 200, saves version 1, removes the pending proposal and persists across reload. Set aside POST returns 200, removes the unapproved model and returns to the brief entry, also after reload. Change focus and group selection checks pass in each case. No unlisted mutations; provider caller invocations 0.

Inspected approve-before at all sizes; approve-after at all sizes; discard-after 2000 and discard-reopen 1128 / 133; plus the earlier 1128 change-request capture. Every image has a side-by-side SHEET counterpart under `/Users/paulslee/olumi-work/ui-evidence/look/night-new/03-approval-final/`.
