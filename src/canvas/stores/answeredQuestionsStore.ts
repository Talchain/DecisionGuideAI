/**
 * OLUMI'S QUESTIONS THE PERSON ANSWERED ON THE MODEL (Paul 22 Oct: answered becomes visible). When the person answers a
 * question on Olumi's note (`OlumiAttentionCard`), the item it was about keeps a small tick, its question and answer on
 * hover: a trace of the reasoning on the model, not a chat log.
 *
 * Kept OUT of the canvas store, like the what-if and the proposal ghost: nothing here enters `nodes`/`edges`, so it is
 * never saved into the model, sent in a turn or counted. The answer itself reached Olumi as the person's own message.
 *
 * It survives a reopen in this browser (localStorage, by scenario); it is not shared with another person or device.
 * Every storage read and write is guarded: blocked storage leaves the tick for this session only.
 */
import { create } from 'zustand'

export interface AnsweredQuestion {
  readonly question: string
  readonly answer: string
  /** ISO time of the answer. */
  readonly at: string
}

type ByItem = Readonly<Record<string, AnsweredQuestion>>

const STORAGE_KEY = 'olumi:answered-questions:v1'

function load(): Readonly<Record<string, ByItem>> {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed !== null && typeof parsed === 'object' ? parsed as Record<string, ByItem> : {}
  } catch {
    return {}
  }
}

function save(byScenario: Readonly<Record<string, ByItem>>): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(byScenario))
  } catch {
    // Storage blocked or full: the tick stays for this session.
  }
}

interface AnsweredQuestionsState {
  /** scenarioId -> item id -> the latest question answered on it. */
  readonly byScenario: Readonly<Record<string, ByItem>>
  record: (scenarioId: string, itemId: string, answered: AnsweredQuestion) => void
}

export const useAnsweredQuestionsStore = create<AnsweredQuestionsState>((set, get) => ({
  byScenario: load(),
  record: (scenarioId, itemId, answered) => {
    const byScenario = { ...get().byScenario, [scenarioId]: { ...(get().byScenario[scenarioId] ?? {}), [itemId]: answered } }
    set({ byScenario })
    save(byScenario)
  },
}))

/** The question last answered on this item in this scenario, or null. */
export function useAnsweredQuestion(scenarioId: string | null, itemId: string): AnsweredQuestion | null {
  return useAnsweredQuestionsStore((s) => (scenarioId === null ? null : s.byScenario[scenarioId]?.[itemId] ?? null))
}
