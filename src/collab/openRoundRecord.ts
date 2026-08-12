/**
 * COLLAB — the open-round record: the NON-SECRET half of what a mint returns,
 * kept so the owner can come back.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * Participant tokens are shown once and never stored — that is a design
 * property this module must not erode. But the tip this branch left forgot
 * MORE than the tokens: it forgot the ROUND, so an owner who navigated away
 * could never close it and the answers already given were stranded forever.
 * The round id is not a credential — every owner route also demands the
 * owner's Supabase JWT — so remembering it trades no security for recovery.
 *
 * ── THE RULE, ENFORCED BY CONSTRUCTION AND BY TEST ─────────────────────────
 * `rememberOpenRound` PICKS the two non-secret participant fields explicitly.
 * It never spreads its input: the caller's natural argument is the mint
 * response's participant array, which carries `token`, and a spread would
 * smuggle every token into localStorage in one keystroke.
 * `__tests__/openRoundRecord.spec.ts` feeds this module token-bearing input
 * and proves, against the whole store, that no token lands.
 *
 * One record per scenario, latest wins — matching the page, which shows one
 * round at a time. Storage failures (private mode, quota) are swallowed: the
 * record is a convenience, never a correctness dependency.
 */

const KEY_PREFIX = 'olumi.collab.open-round.'

export interface OpenRoundParticipant {
  participant_id: string
  display_name: string
}

export interface OpenRoundRecord {
  round_id: string
  scenario_id: string
  /** ISO timestamp, stamped at remember time. */
  opened_at: string
  participants: OpenRoundParticipant[]
}

function keyFor(scenarioId: string): string {
  return `${KEY_PREFIX}${scenarioId}`
}

export function rememberOpenRound(args: {
  roundId: string
  scenarioId: string
  /**
   * Deliberately WIDER than what is stored: callers hand this the mint
   * response's participants (token and all); only the two named fields survive.
   */
  participants: ReadonlyArray<{ participant_id: string; display_name: string }>
}): void {
  if (args.scenarioId === '' || args.roundId === '') return
  const record: OpenRoundRecord = {
    round_id: args.roundId,
    scenario_id: args.scenarioId,
    opened_at: new Date().toISOString(),
    // PICKED, never spread — see the module header.
    participants: args.participants.map((p) => ({
      participant_id: p.participant_id,
      display_name: p.display_name,
    })),
  }
  try {
    localStorage.setItem(keyFor(args.scenarioId), JSON.stringify(record))
  } catch {
    /* storage unavailable — the page still works, only the reminder is lost */
  }
}

export function recallOpenRound(scenarioId: string): OpenRoundRecord | null {
  if (scenarioId === '') return null
  try {
    const raw = localStorage.getItem(keyFor(scenarioId))
    if (raw === null) return null
    const parsed = JSON.parse(raw) as Partial<OpenRoundRecord> | null
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      typeof parsed.round_id !== 'string' ||
      parsed.round_id === '' ||
      typeof parsed.scenario_id !== 'string' ||
      typeof parsed.opened_at !== 'string' ||
      !Array.isArray(parsed.participants)
    ) {
      return null
    }
    return {
      round_id: parsed.round_id,
      scenario_id: parsed.scenario_id,
      opened_at: parsed.opened_at,
      // Re-picked on the way OUT too, so a hand-edited or legacy value cannot
      // hand the page fields this type never promised.
      participants: parsed.participants
        .filter(
          (p): p is OpenRoundParticipant =>
            p !== null &&
            typeof p === 'object' &&
            typeof (p as OpenRoundParticipant).participant_id === 'string' &&
            typeof (p as OpenRoundParticipant).display_name === 'string',
        )
        .map((p) => ({ participant_id: p.participant_id, display_name: p.display_name })),
    }
  } catch {
    return null
  }
}

export function forgetOpenRound(scenarioId: string): void {
  if (scenarioId === '') return
  try {
    localStorage.removeItem(keyFor(scenarioId))
  } catch {
    /* nothing to do — an unremovable reminder is still only a reminder */
  }
}
