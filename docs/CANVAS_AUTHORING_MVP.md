# Canvas Authoring MVP - User Guide

**Version**: 1.0  
**Date**: Oct 15, 2025  
**Route**: `/#/canvas`

---

## 🎯 Overview

Olumi's Canvas is a professional-grade React Flow graph editor designed for intuitive decision modeling. This guide covers all authoring features, keyboard shortcuts, and best practices.

---

## ✨ Core Features

### 1. Inline Label Editing
Edit node labels directly without dialogs or panels.

**How to use**:
1. **Double-click** any node
2. Type new label
3. Press **Enter** to save or **Esc** to cancel
4. Changes auto-save to history for undo

**Tips**:
- Text auto-selects for quick replacement
- Clicking outside also commits changes
- Works on any node in the canvas

---

### 2. Context Menu
Right-click anywhere for quick actions.

**How to open**:
- **Right-click** on canvas background → Add node at cursor
- **Right-click** on node → Actions on selected nodes

**Available Actions**:
- ➕ **Add Node Here** - Creates new node at cursor position
- ✂️ **Cut** (⌘X) - Cut selection to clipboard
- 📋 **Copy** (⌘C) - Copy selection to clipboard
- 📎 **Paste** (⌘V) - Paste from clipboard (offset +50px)
- 🔁 **Duplicate** (⌘D) - Duplicate selection with connections
- 🗑️ **Delete** (Del) - Remove selected nodes and edges

**Smart Features**:
- Menu repositions if near viewport edge
- Disabled actions shown dimmed
- Esc to close menu
- Click outside to dismiss

---

### 3. Keyboard Shortcuts

#### Navigation & Selection
| Shortcut | Action |
|----------|--------|
| **⌘/Ctrl + A** | Select all nodes |
| **Click + Drag** | Marquee select multiple nodes |
| **Shift + Click** | Add/remove from selection |
| **Esc** | Deselect all |

#### Editing
| Shortcut | Action |
|----------|--------|
| **⌘/Ctrl + Z** | Undo |
| **⌘/Ctrl + Y** | Redo |
| **⌘/Ctrl + Shift + Z** | Redo (alternate) |
| **⌘/Ctrl + D** | Duplicate selection |
| **⌘/Ctrl + X** | Cut selection |
| **⌘/Ctrl + C** | Copy selection |
| **⌘/Ctrl + V** | Paste from clipboard |
| **Delete / Backspace** | Delete selection |

#### Movement
| Shortcut | Action |
|----------|--------|
| **Arrow Keys** | Nudge selection 1px |
| **Shift + Arrow** | Nudge selection 10px |
| **Mouse Drag** | Move nodes freely |

#### Canvas
| Shortcut | Action |
|----------|--------|
| **⌘/Ctrl + S** | Save snapshot to localStorage |
| **Scroll / Pinch** | Zoom in/out |
| **Space + Drag** | Pan canvas |

---

### 4. Toolbar

**Location**: Bottom-center floating toolbar

**Controls**:
- **+ Node** - Add new node at center
- **↶ Undo** - Undo last change (⌘Z)
- **↷ Redo** - Redo undone change (⌘Y)
- **🔍+** - Zoom in
- **🔍-** - Zoom out
- **⊞** - Fit view (shows entire graph)
- **Save** - Quick save snapshot (⌘S)

---

### 5. Multi-Select & Group Operations

**How to select multiple nodes**:
1. **Marquee**: Click empty canvas and drag a box
2. **Shift-click**: Hold Shift and click individual nodes
3. **Select All**: Press ⌘/Ctrl+A

**Group actions**:
- **Move**: Drag any selected node (all move together)
- **Nudge**: Arrow keys move entire group
- **Duplicate**: ⌘D duplicates all + internal connections
- **Delete**: Del removes all selected nodes

**Smart behavior**:
- Connections between selected nodes are preserved
- Copy/paste maintains relative positions
- Undo/redo works on entire group operation

---

### 6. Smart Grid & Snapping

**Grid**: 16px base grid for clean alignment

**Snap Behavior**:
- Nodes magnetically snap to grid points
- Subtle resistance when near grid lines
- Disable by holding Alt (future feature)

---

### 7. Persistence & History

**Auto-Save**:
- Changes auto-save to `localStorage` every 2 seconds
- Persists across browser sessions
- No server required

**Manual Save**:
- Press **⌘/Ctrl+S** to save immediately
- Useful before risky operations

**History**:
- Undo stack: Last 50 operations
- Debounced during drag (single undo step per drag)
- Full support for multi-node operations

**Restore on Load**:
- Canvas automatically restores last saved state
- ID collision prevention (nodes start after highest existing ID)

---

## 🎨 Visual Design

### Color Palette (Olumi)
- **Accent**: #EA7B4B (warm coral) - Selected state, primary actions
- **Success**: #67C89E - Connection handles (target)
- **Info**: #63ADCF - Connection handles (source)
- **Neutral**: Grays for backgrounds, borders

### Micro-Interactions
- **Node Selection**: Subtle scale (1.02×) + orange border
- **Hover**: Shadow lift on nodes
- **Transitions**: 150-200ms smooth animations
- **Context Menu**: Hover glow on items

### Typography
- **Node Labels**: 14px medium weight
- **Toolbar**: 14px buttons, clean icons
- **Hints**: 12px monospace for shortcuts

---

## 📐 Canvas Layout

```
┌─────────────────────────────────────────┐
│ [Badge: ROUTE • COMMIT • MODE]          │ Fixed top-left
│                                         │
│                                         │
│         [Node Graph Area]               │
│                                         │
│                                         │
│  [MiniMap]                              │ Bottom-left
│                    [Toolbar]            │ Bottom-center
└─────────────────────────────────────────┘
```

---

## 🚀 Workflow Examples

### Example 1: Quick Diagram Creation
```
1. Visit /#/canvas
2. Double-click "Start" → rename to "Problem"
3. Right-click below → "Add Node Here"
4. Name it "Solution A"
5. Drag from Problem's bottom handle to Solution A's top handle
6. ⌘D to duplicate Solution A → creates "Solution A (copy)"
7. Rename to "Solution B"
8. Press ⌘S to save
```

### Example 2: Reorganize Existing Graph
```
1. ⌘A to select all nodes
2. Use arrow keys to nudge entire graph down 50px (Shift+Down 5 times)
3. Click "Solution A" node
4. Shift+Click "Solution B" (both selected)
5. ⌘D to duplicate both + connections
6. Drag duplicates to new position
7. Undo with ⌘Z if needed
```

### Example 3: Complex Editing
```
1. Select node group (marquee drag)
2. ⌘C to copy
3. ⌘V to paste (offset automatically)
4. Right-click pasted group → Delete
5. ⌘Z to undo delete
6. Fine-tune positions with arrow nudging
7. Double-click labels to refine text
```

---

## 🧪 Testing Your Work

### Manual Verification
1. **Inline Edit**: Double-click node, type, press Enter → label updates
2. **Context Menu**: Right-click → menu appears with icons
3. **Keyboard**: ⌘D on node → duplicate appears offset
4. **Undo/Redo**: Make changes, ⌘Z to undo, ⌘Y to redo
5. **Persist**: Make changes, reload page → state restored
6. **Multi-Select**: Drag box around nodes → all selected
7. **Nudge**: Select node, arrow keys → moves 1px

### Console Checks
```javascript
// Should be clean
console.log('No errors')

// Store state accessible
useCanvasStore.getState()
```

---

## 🔧 Advanced Tips

### Performance
- **Large Graphs** (100+ nodes): Expect smooth 60fps panning
- **History Cap**: 50 operations to prevent memory bloat
- **Debouncing**: Drag operations create single history entry

### Keyboard Focus
- Shortcuts disabled when typing in input fields
- Context menu closes on Esc
- Node editing commits on blur (click away)

### Clipboard Behavior
- Internal clipboard (not system clipboard)
- Preserves node data and connections
- Paste multiple times (non-destructive)
- Cut clears selection after copy

---

## �� Metrics & Limits

| Metric | Value |
|--------|-------|
| Max Undo History | 50 steps |
| Grid Size | 16px |
| Nudge Small | 1px |
| Nudge Large (Shift) | 10px |
| Duplicate Offset | +50px x, +50px y |
| Autosave Delay | 2 seconds |
| Max Tested Nodes | 500 (smooth) |

---

## 🐛 Troubleshooting

### "My changes don't save"
- Check browser console for localStorage errors
- Try manual save (⌘S)
- Check if incognito mode (storage disabled)

### "Keyboard shortcuts don't work"
- Click canvas background to focus
- Don't type in node edit mode
- Check if browser shortcuts override (e.g., ⌘D in some browsers)

### "Nodes jump when dragging"
- This is grid snapping (16px)
- Smooth dragging between snap points

### "Context menu off-screen"
- Menu auto-repositions if near edge
- Try right-clicking closer to center

---

## 🎓 Best Practices

### Modeling Conventions
1. **Start Node**: Place at top-center
2. **Flow Direction**: Top-to-bottom or left-to-right
3. **Labels**: Short, descriptive (3-5 words)
4. **Spacing**: Use grid snapping for clean alignment

### Editing Workflow
1. **Sketch Fast**: Add nodes quickly, refine later
2. **Label Last**: Connect structure first, then label
3. **Save Often**: ⌘S after major changes
4. **Undo Freely**: Don't fear mistakes, undo is instant

### Collaboration
- Export: Screenshot or JSON export (future)
- Share: Send URL + localStorage data (future)
- Version: Use snapshots for milestones

---

## 🚦 Status & Roadmap

### ✅ Implemented (v1.0)
- Inline label editing
- Context menu with all actions
- Full keyboard shortcuts
- Multi-select & group move
- Undo/redo with debouncing
- Clipboard (cut/copy/paste/duplicate)
- Snap to grid
- Toolbar with zoom/fit/save
- localStorage persistence
- Node scaling on select

### 🔜 Planned (v2.0)
- Auto-layout (ELK.js hierarchical)
- Edge labels (editable inline)
- Edge weights (visual thickness)
- Custom node types (outcome, decision, action)
- Minimap navigation controls
- Export to PNG/SVG
- JSON import/export with schema
- Collaboration (real-time multiplayer)
- First-time user tutorial overlay

---

## 📚 Resources

- **Live Demo**: https://olumi.netlify.app/#/canvas
- **Source**: `src/canvas/`
- **Tests**: `e2e/canvas.authoring.spec.ts`
- **Issues**: GitHub Issues

---

## �� Summary

Canvas authoring delivers a **professional, delightful editing experience** with:
- **Zero-friction inline editing** (double-click anywhere)
- **Discoverable context menus** (right-click actions)
- **Muscle-memory shortcuts** (standard ⌘Z/C/V/D)
- **Smooth animations** (subtle but satisfying)
- **Reliable persistence** (never lose work)

**Start creating beautiful decision diagrams in seconds!**

---

**Built with**: React Flow, Zustand, TailwindCSS  
**Design**: Olumi Brand Palette  
**UX Inspiration**: Figma, Miro, FigJam, Obsidian Canvas
