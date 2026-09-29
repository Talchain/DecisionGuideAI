/**
 * The longest label a node takes — a LEAF module so a card can reuse the inspector's `EditableLabel` (E1c, rename on the
 * card) without importing `useInspectorMutations` and its whole graph into every node (the whole-module-mock hazard that
 * turned staging red on 29 Sep, #2308 → #2311). `useInspectorMutations` re-exports it, so existing importers are unchanged.
 */
export const NODE_LABEL_MAX_LENGTH = 100
