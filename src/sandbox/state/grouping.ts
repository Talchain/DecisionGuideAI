// Mock grouping module for expand/collapse state (view-only)
// In the mock, we keep a simple Set of expanded group IDs.

const expanded = new Set<string>();

export type GroupMapping = { groupId: string; decisionId: string; optionIds: string[] };

export function expandGroup(groupId: string): void {
  expanded.add(groupId);
}

export function collapseGroup(groupId: string): void {
  expanded.delete(groupId);
}

export function isGroupExpanded(groupId: string): boolean {
  return expanded.has(groupId);
}
