# Canvas User Guide

**Olumi Canvas** - A delightful decision-mapping editor

---

## Getting Started

### First Time?

When you open Canvas for the first time, you'll see a friendly welcome overlay with quick actions:
- **Add Your First Node** - Start building your decision graph
- **Import Existing Canvas** - Load from a JSON file
- **Open Command Palette** - Press ⌘K (Mac) or Ctrl+K (Windows/Linux)

You can dismiss this overlay and it won't show again.

---

## Core Features

### Adding & Editing Nodes

**Add a Node:**
- Click the **+ Node** button in the toolbar
- Or use the Command Palette (⌘K) → "Add Node"
- Or right-click on canvas → "Add Node Here"

**Edit a Node:**
- Double-click the node to enter edit mode
- Type your label (max 100 characters)
- Press **Enter** to save or **Escape** to cancel

**Delete Nodes:**
- Select node(s) and press **Delete** or **Backspace**
- Or right-click → "Delete"

### Connecting Nodes

**Create an Edge:**
- Drag from a node's handle (circle) to another node
- Edges are automatically styled with smooth curves

**Delete an Edge:**
- Click the edge to select it
- Press **Delete** or **Backspace**

### Selection & Multi-Select

**Select Single:**
- Click a node or edge

**Select Multiple:**
- Hold **Shift** and click nodes
- Or click and drag to create a selection box (marquee)

**Select All:**
- Press **⌘A** (Mac) or **Ctrl+A** (Windows/Linux)

### Moving & Nudging

**Move Nodes:**
- Click and drag nodes
- Multiple selected nodes move together

**Nudge (Precision):**
- Arrow keys: Move 1px
- Shift + Arrow keys: Move 10px
- All nudges in a burst are grouped into one undo frame

### Copy, Cut, Paste, Duplicate

- **Copy**: ⌘C / Ctrl+C
- **Cut**: ⌘X / Ctrl+X
- **Paste**: ⌘V / Ctrl+V (offset by 50px)
- **Duplicate**: ⌘D / Ctrl+D (offset by 50px)

Edges between selected nodes are also copied!

### Undo & Redo

- **Undo**: ⌘Z / Ctrl+Z
- **Redo**: ⌘Shift+Z or ⌘Y / Ctrl+Shift+Z or Ctrl+Y

History is smart:
- Burst operations (nudges, marquee) = single undo frame
- Atomic operations (cut, layout) = single undo frame

---

## Advanced Features

### Command Palette (⌘K)

Press **⌘K** (Mac) or **Ctrl+K** (Windows/Linux) to open the fuzzy-search command palette:

- Add Node
- Tidy Layout
- Select All
- Undo / Redo
- Save Snapshot
- Import / Export
- Clear Canvas
- Fit View

Type to filter, use arrow keys to navigate, Enter to execute.

### Properties Panel

Select a node to see the Properties Panel on the right:

- **Label**: Edit the node label
- **Position**: View X/Y coordinates
- **Locked**: Toggle to prevent layout changes
- **Delete**: Remove the node

Changes auto-save after 200ms of inactivity.

### Alignment Guides

When dragging nodes, visual guides appear to help you align with other nodes:
- Vertical and horizontal snap lines
- Fade in/out smoothly
- Can be disabled in Settings

### Grid & Snapping

Open **Settings** (gear icon) to configure:

- **Show Grid**: Toggle grid visibility
- **Grid Size**: 8px, 16px, or 24px
- **Snap to Grid**: Snap nodes to grid points
- **Alignment Guides**: Show/hide snap lines

All settings persist across sessions.

### Layout Options

Click **🔧 Layout** to open the layout panel:

- **Direction**: Top-Bottom, Left-Right, Bottom-Top, Right-Left
- **Node Spacing**: 10-100px (distance between nodes)
- **Layer Spacing**: 20-150px (distance between layers)
- **Respect Locked Nodes**: Keep locked nodes in place

Click **Apply Layout** to run the ELK auto-layout algorithm. Layout is undoable!

### Snapshots

Click **Snapshots** to manage saved states:

- **Save Current Canvas**: Create a snapshot (max 10)
- **Restore**: Load a previous snapshot
- **Rename**: Give snapshots meaningful names
- **Download**: Export snapshot as JSON
- **Copy JSON**: Copy to clipboard
- **Delete**: Remove a snapshot

Snapshots are stored in your browser's localStorage and survive page reloads.

### Import & Export

**Import:**
- Click **Import** → Choose JSON file
- Auto-validation with helpful error messages
- Auto-fix for common issues (missing IDs, invalid edges)
- All labels are sanitized for security

**Export:**
- **JSON**: Full canvas data (nodes, edges, metadata)
- **PNG**: High-resolution image (2x scale)
- **SVG**: Vector graphic (scalable)

### Context Menu

Right-click on canvas or nodes for quick actions:
- Add Node Here
- Duplicate
- Delete
- Copy / Cut / Paste
- Tidy Layout

### Keyboard Cheatsheet

Press **?** to open the full keyboard shortcuts reference:
- Organized by category (Editing, Selection, Actions, History, Navigation, Tools)
- 24 shortcuts documented
- Close with Escape or X button

---

## Settings & Preferences

### Visual Settings

**Grid Controls:**
- Show/hide grid
- Adjust density (8/16/24px)
- Snap to grid toggle

**Alignment Guides:**
- Show/hide snap lines during drag

**High Contrast Mode:**
- Increase contrast for better visibility

### Layout Settings

**Direction:**
- Choose graph flow direction

**Spacing:**
- Fine-tune node and layer spacing

**Locked Nodes:**
- Respect or ignore locked nodes during layout

All settings persist in localStorage and survive page reloads.

---

## Performance & Limits

### Recommended Limits

- **Nodes**: Up to 250 nodes for 60fps
- **Edges**: Up to 400 edges for smooth interactions
- **Snapshot Size**: Max 5MB per snapshot

### Performance Tips

- Use **Tidy Layout** to organize large graphs
- Lock nodes you don't want to move
- Export large graphs to JSON and work in smaller chunks
- Use **Fit View** to see the entire graph

---

## Keyboard Shortcuts Reference

### Editing
- **Double-click**: Edit node label
- **Enter**: Commit edit
- **Escape**: Cancel edit

### Selection
- **⌘/Ctrl + A**: Select all
- **Click + Drag**: Marquee select
- **Shift + Click**: Toggle selection

### Actions
- **⌘/Ctrl + D**: Duplicate selected
- **⌘/Ctrl + C**: Copy selected
- **⌘/Ctrl + X**: Cut selected
- **⌘/Ctrl + V**: Paste
- **Delete/Backspace**: Delete selected

### History
- **⌘/Ctrl + Z**: Undo
- **⌘/Ctrl + Shift + Z**: Redo
- **⌘/Ctrl + Y**: Redo (alt)

### Navigation
- **Arrow Keys**: Nudge selected (1px)
- **Shift + Arrow**: Nudge selected (10px)
- **Mouse Wheel**: Pan canvas
- **⌘/Ctrl + Wheel**: Zoom canvas

### Tools
- **⌘/Ctrl + K**: Command Palette
- **⌘/Ctrl + S**: Save Snapshot
- **Right-click**: Context Menu
- **?**: Keyboard Cheatsheet

---

## Troubleshooting

### Canvas Won't Load

1. Check browser console for errors (F12)
2. Clear localStorage: `localStorage.clear()`
3. Reload the page
4. Try a different browser (Chrome, Firefox, Safari, Edge)

### Snapshot Save Failed

- **Cause**: Storage quota exceeded
- **Solution**: Delete old snapshots or export to JSON file

### Import Failed

- **Cause**: Invalid JSON format
- **Solution**: Use the auto-fix feature or manually fix JSON structure

### Performance Issues

- **Cause**: Too many nodes/edges
- **Solution**: Export and work in smaller chunks, or upgrade hardware

### Lost Work

- Canvas auto-saves every 2 seconds
- Check **Snapshots** for recent saves
- Use **Import** to restore from exported JSON

---

## Tips & Tricks

1. **Use Command Palette**: Fastest way to execute actions (⌘K)
2. **Lock Important Nodes**: Prevent accidental moves during layout
3. **Save Snapshots Often**: Create checkpoints before major changes
4. **Use Alignment Guides**: Drag slowly to see snap lines
5. **Keyboard-First**: Learn shortcuts for 10x productivity
6. **Export Regularly**: Keep JSON backups of important graphs
7. **Tidy Layout**: Use ELK auto-layout to organize messy graphs
8. **High Contrast Mode**: Better visibility in bright environments

---

## Accessibility

Canvas is designed to be fully accessible:

- **Keyboard Navigation**: All actions available via keyboard
- **Screen Reader Support**: ARIA labels on all controls
- **Focus Indicators**: Visible focus rings on all interactive elements
- **High Contrast Mode**: Available in Settings
- **No Color-Only Indicators**: Icons and text accompany all colors

---

## Privacy & Data

- **Local Storage**: All data stored in your browser
- **No Server**: Canvas runs entirely client-side
- **No Tracking**: Zero analytics or telemetry
- **Export Control**: You own your data, export anytime

---

## Support & Feedback

- **Bug Reports**: Use "Report Issue" in Error Boundary
- **Feature Requests**: Contact support@example.com
- **Documentation**: See docs/ folder in repository

---

**Version**: 2.0.0  
**Last Updated**: Oct 16, 2025  
**License**: MIT
