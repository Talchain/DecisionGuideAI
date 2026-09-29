/**
 * ⭐ A RUN THE SERVER DECLINED WITH A QUESTION IS NOT A DEAD BUTTON (served 29 Sep, R3-B's model `823bc028`).
 *
 * "Analyse first pass" sent `run_analysis`; CEE answered 200 with no analysis and a question instead ("I can't put
 * ‘New paying subscribers’ on the same scale as ‘Incremental MRR’: what unit is it in?" + a "Give the unit" chip,
 * `run_state` still `never_run`). The reply landed in the Olumi tab while the person was on the Analysis tab, so the
 * button looked dead. A run turn that ends with NO answer landed, and was not aborted, now brings the conversation —
 * where the server's reason is — into view (`revealOlumiSurface`). A run that landed changes nothing.
 *
 * The UI decides nothing about WHY: it only notices that no answer arrived and shows the server's own reply.
 */
export function runTurnEndedUnanswered(
  results: { status: string; report?: unknown },
  aborted: boolean,
): boolean {
  return !aborted && results.status === 'preparing' && !results.report
}
