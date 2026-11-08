/**
 * Where each link's chip sits on the board (core's `collab.link_marks`, drawn on its line by ViewLinkEdge.tsx), in flow units, so that:
 * - every link's words keep clear of every chip, as they keep clear of the chips on a card's rail (railBoxes.ts);
 * - each chip keeps clear of the chips of the links before it (core's order of `links`), so two chips never sit on each other.
 * A chip is a person's word on the link and stays put: the words move round it, never the other way, so nothing here goes round in a circle
 * (a chip depends only on the cards, the rails and the chips before it).
 */
import { create } from 'zustand'

/** One drawn chip: its edge, its link's index in `links`, and its box (flow units, with a unit to spare on every side). */
export type ChipBox = { readonly id: string; readonly i: number; readonly x: number; readonly y: number; readonly w: number; readonly h: number }

interface LineChipsState {
  readonly chips: Readonly<Record<string, ChipBox>>
  put(box: ChipBox): void
  drop(id: string): void
}

const same = (a: ChipBox | undefined, b: ChipBox): boolean => a !== undefined && a.i === b.i && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h

export const useLineChips = create<LineChipsState>((set, get) => ({
  chips: {},
  put: (box) => { if (!same(get().chips[box.id], box)) set((s) => ({ chips: { ...s.chips, [box.id]: box } })) },
  drop: (id) => { if (get().chips[id] !== undefined) set((s) => { const next = { ...s.chips }; delete next[id]; return { chips: next } }) },
}))

/** The chips of the links before link `i` (every chip for `i` = Infinity), in their edges' order. */
export function chipsBefore(chips: Readonly<Record<string, ChipBox>>, i: number): ChipBox[] {
  return Object.keys(chips).sort().map((k) => chips[k]!).filter((c) => c.i < i)
}

/** The room kept round a chip, so words never graze it. */
export const CHIP_ROOM = 2
