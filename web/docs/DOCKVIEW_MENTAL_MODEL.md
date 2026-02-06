# Dockview Mental Model: Understanding Our Layout System

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Architecture](#architecture)
4. [Layout Hierarchy](#layout-hierarchy)
5. [Component Types](#component-types)
6. [State Management](#state-management)
7. [Drag and Drop System](#drag-and-drop-system)
8. [Terminal State Preservation](#terminal-state-preservation)
9. [Lifecycle Management](#lifecycle-management)
10. [Best Practices](#best-practices)

---

## Overview

Our application uses [Dockview](https://github.com/mathuo/dockview) - a sophisticated layout library that provides VS Code-like panel management, drag-and-drop functionality, and flexible workspace layouts. Think of Dockview as the "window manager" for our web application.

### Why Dockview?

- **Professional UX**: Provides VS Code-quality panel management
- **Flexibility**: Users can customize their workspace layout
- **State Preservation**: Panels maintain state during moves
- **Native Feel**: Drag-and-drop with visual feedback
- **Split Views**: Multiple panels can coexist in complex layouts

---

## Core Concepts

### 1. Gridview vs Dockview

**Gridview** (Outer Container)

- Top-level layout manager
- Manages major application sections (sidebar, main content, chat, terminal)
- Think: "Application sections"
- Uses: `<GridviewReact />`

**Dockview** (Inner Container)

- Panel-level layout manager
- Manages individual panels (editor tabs, terminal tabs, preview)
- Think: "Tabbed workspaces"
- Uses: `<DockviewReact />`

```
┌────────────────────────────────────────┐
│          GridviewReact                  │  ← Application Layout
│  ┌──────┬──────────────────┬─────────┐ │
│  │      │   DockviewReact   │         │ │  ← Panel Management
│  │ Side │ ┌──────┬────────┐│  Chat   │ │
│  │ bar  │ │ Tab1 │  Tab2  ││         │ │
│  │      │ └──────┴────────┘│         │ │
│  │      ├──────────────────┤         │ │
│  │      │  Terminal Dock   │         │ │
│  └──────┴──────────────────┴─────────┘ │
└────────────────────────────────────────┘
```

### 2. Panels

A **Panel** is a content container with:

- Unique ID
- Component type (editor, terminal, preview)
- Tab component (what shows in the tab bar)
- Parameters (data passed to the panel)
- Lifecycle hooks

```typescript
interface Panel {
  id: string                    // e.g., "editor-/src/App.tsx"
  component: string             // e.g., "editor"
  tabComponent?: string         // Custom tab appearance
  title?: string                // Display name
  params?: Record<string, any>  // Data for the panel
}
```

### 3. Groups

A **Group** is a collection of panels displayed together:

- Contains one or more panels
- Shows tabs for each panel
- One panel is active at a time
- Can be split to create new groups

```
Group 1               Group 2
┌─────────────────┐   ┌─────────────────┐
│ [Tab1] [Tab2]   │   │ [Tab3]          │
│ ─────────────── │   │ ─────────────── │
│ Content for     │   │ Content for     │
│ active tab      │   │ Tab3            │
└─────────────────┘   └─────────────────┘
```

---

## Architecture

### Layout Structure

```typescript
<GridviewReact>                    // Top-level application layout
  ├─ Panel: "sidebar"              // File explorer
  │
  ├─ Panel: "dock"                 // Main workspace
  │   └─ <DockviewReact>           // Editor and preview panels
  │       ├─ Component: "editor"
  │       ├─ Component: "preview"
  │       └─ Component: "terminal"
  │
  ├─ Panel: "terminal"             // Terminal dock
  │   └─ <DockviewReact>           // Terminal panels only
  │       └─ Component: "terminal"
  │
  └─ Panel: "chat"                 // AI chat sidebar
```

### Container Hierarchy

```
index.tsx (Main Layout)
  │
  ├─ gridRef ──────────┐
  │                     │
  ├─ dockRef ───────┐   │
  │                 │   │
  ├─ terminalRef ┐  │   │
  │              │  │   │
  └─ ContainerContext {
       gridRef,      │  │
       dockRef, ─────┘  │
       terminalRef ─────┘
     }
```

---

## Component Types

### 1. Panel Components

**Purpose**: Render panel content

**Location**: `web/components/project/layout/components/`

**Types**:

```typescript
// Editor Panel
export function EditorPanel(props: IDockviewPanelProps<EditorPanelParams>) {
  const { params } = props
  // params contains: filePath, fileContent, saved, etc.
}

// Terminal Panel
export function TerminalPanel(props: IDockviewPanelProps<TerminalPanelParams>) {
  const { params } = props
  // params contains: terminalId, theme, etc.
}

// Preview Panel
export function PreviewPanel(props: IDockviewPanelProps<PreviewPanelParams>) {
  const { params } = props
  // params contains: url, sandbox info, etc.
}
```

**Key Props**:

- `api`: Panel API for controlling the panel
- `params`: Custom data passed to the panel
- `containerApi`: Reference to parent Dockview API

### 2. Tab Components

**Purpose**: Customize tab appearance and behavior

**Location**: `web/components/project/layout/components/tab-components.tsx`

**Structure**:

```typescript
export const tabComponents = {
  editor: (props: IDockviewPanelHeaderProps<EditorPanelParams>) => {
    return <DockviewDefaultTab {...props} icon={<FileIcon />} />
  },
  
  terminal: (props: IDockviewPanelHeaderProps) => {
    return <DockviewDefaultTab {...props} icon={<SquareTerminal />} />
  },
  
  preview: (props: IDockviewPanelHeaderProps) => {
    return <DockviewDefaultTab {...props} icon={<TvMinimal />} />
  }
}
```

**Customization Points**:

- Close button behavior (`closeActionOverride`)
- Icon display
- Saved state indicator (dot vs X)
- Middle-click handling

### 3. Watermark Components

**Purpose**: Shown when container is empty

**Usage**:

```typescript
<DockviewReact
  watermarkComponent={MainWatermark}
  // ... other props
/>
```

---

## State Management

### Container References

```typescript
// ContainerContext provides refs to all dockview instances
const { gridRef, dockRef, terminalRef } = useContainer()

// Access panel APIs
const editorPanel = dockRef.current?.getPanel("editor-/src/App.tsx")
const terminalPanel = terminalRef.current?.getPanel("terminal-abc123")
const chatPanel = gridRef.current?.getPanel("chat")
```

### Panel Lifecycle

```typescript
// Creating a panel
dockRef.current?.addPanel({
  id: "editor-/src/App.tsx",
  component: "editor",
  tabComponent: "editor",
  title: "App.tsx",
  params: {
    filePath: "/src/App.tsx",
    fileContent: "...",
    saved: true
  }
})

// Updating panel params
panel.api.updateParameters({ saved: false })

// Closing a panel
panel.api.close()

// Showing/hiding panels
panel.api.setVisible(true)
panel.api.setVisible(false)
```

### Terminal State Preservation

**Challenge**: XTerm.js instances can't be recreated - `terminal.open()` can only be called once.

**Solution**: Keep terminal instances alive outside React lifecycle:

```typescript
// TerminalContext stores terminal instances
interface TerminalState {
  id: string
  terminal: Terminal | null  // XTerm instance
  isBusy: boolean
}

const [terminals, setTerminals] = useState<TerminalState[]>([])
```

**Lifecycle**:

1. **Creation**: Terminal instance created in TerminalContext
2. **Mounting**: DOM element attached to panel
3. **Moving**: Panel moves, but terminal instance persists
4. **Reattachment**: DOM element reattached to new location
5. **Disposal**: Only disposed on explicit close

```typescript
// In terminal.tsx - reattachment logic
if (terminalElement && terminalElement.parentElement !== terminalContainerRef.current) {
  terminalContainerRef.current.appendChild(terminalElement)
  setTimeout(() => fitAddonRef.current?.fit(), 10)
}
```

---

## Drag and Drop System

### Drop Event Flow

```
User drags panel
       ↓
onDidDrop event fires
       ↓
getData() returns { panelId, api }
       ↓
Check if terminal panel
       ↓
Determine drop intent (split vs tab)
       ↓
Move panel to target container
       ↓
Auto-hide source if empty
```

### Drop Position Mapping

```typescript
const DIRECTION_MAP = {
  left: 'left',
  right: 'right',
  top: 'above',    // Note: 'top' → 'above'
  bottom: 'below',  // Note: 'bottom' → 'below'
  center: undefined // Center = add as tab
}
```

### Split Detection

**Edge Drops** (left/right/top/bottom):

```
┌─────────────────┐
│ ↓ Top (above)   │
│ ← ┌─────────┐ → │
│   │ Content │   │
│   └─────────┘   │
│ ↑ Bottom (below)│
└─────────────────┘
```

**Center Drop** (add as tab):

```
┌─────────────────┐
│ [Tab1] [+Tab2]  │
│ ─────────────── │
│                 │
└─────────────────┘
```

### Implementation

```typescript
// 1. Accept drags
const handleDockUnhandledDragOver = useCallback(
  (event: DockviewDndOverlayEvent) => {
    event.accept() // Allow drops even in empty containers
  },
  []
)

// 2. Handle drops
const handleDockDidDrop = useCallback(
  (event: DockviewDidDropEvent) => {
    const data = event.getData()
    const panelId = data?.panelId
    
    // Check if it's a terminal
    if (!panelId?.startsWith("terminal-")) return
    
    // Use utility function
    const result = handleTerminalDrop({
      event,
      sourceContainerRef: terminalRef,
      targetContainerRef: dockRef,
    })
    
    // Auto-hide source if empty
    if (terminalRef.current?.panels.length === 0) {
      gridRef.current?.getPanel("terminal")?.api.setVisible(false)
    }
  },
  [terminalRef, dockRef, gridRef]
)
```

### Bidirectional Movement

**Terminal → Dock**:

- Allows terminal panels in main workspace
- Useful for split layouts with code + terminal

**Dock → Terminal**:

- Returns terminals to dedicated dock
- Filters non-terminal panels
- Maintains organized workspace

```typescript
// handleTerminalDrop utility handles both directions
export function handleTerminalDrop({
  event,
  sourceContainerRef,
  targetContainerRef,
}: HandleTerminalDropConfig): HandleTerminalDropResult {
  // 1. Extract panel info
  // 2. Validate it's a terminal
  // 3. Check if cross-container move
  // 4. Calculate drop position
  // 5. Move panel with state preservation
  // 6. Return result
}
```

---

## Lifecycle Management

### Panel Creation Flow

```
1. User Action (click file, run command, etc.)
        ↓
2. Generate unique panel ID
        ↓
3. Prepare panel parameters
        ↓
4. Call containerRef.current?.addPanel()
        ↓
5. Dockview creates panel
        ↓
6. Panel component mounts
        ↓
7. Panel rendered with content
```

### Panel Disposal

**Automatic Disposal** (DON'T DO):

```typescript
// ❌ Bad - loses state during moves
useEffect(() => {
  return () => {
    terminal.dispose() // Destroys terminal on unmount
  }
}, [])
```

**Explicit Disposal** (DO THIS):

```typescript
// ✅ Good - only dispose on explicit close
const closeActionOverride = () => {
  terminal.terminal.dispose()
  setTerminals(prev => prev.filter(t => t.id !== terminalId))
  api.close()
}
```

### Auto-Hide Logic

```typescript
// Close panel
api.close()

// Check if container is now empty
if (terminalRef.current?.panels.length === 0) {
  // Hide the grid panel
  gridRef.current?.getPanel("terminal")?.api.setVisible(false)
}
```

---

## Best Practices

### 1. Always Use Refs, Not Direct Access

```typescript
// ✅ Good
const { dockRef } = useContainer()
const panel = dockRef.current?.getPanel(panelId)

// ❌ Bad
const panel = document.querySelector('[data-panel-id]')
```

### 2. Generate Unique Panel IDs

```typescript
// ✅ Good - includes context
const editorId = `editor-${filePath}`
const terminalId = `terminal-${terminalId}`

// ❌ Bad - generic IDs
const editorId = "editor1"
```

### 3. Preserve State During Moves

```typescript
// ✅ Good - keep instances alive
const [terminals] = useState<TerminalState[]>([])

// ❌ Bad - recreate on mount
useEffect(() => {
  const term = new Terminal()
  term.open(ref.current)
}, [])
```

### 4. Handle Empty Containers

```typescript
// ✅ Good - accept all drags
const handleUnhandledDragOver = (event) => {
  event.accept()
}

// ❌ Bad - reject empty drops
const handleUnhandledDragOver = (event) => {
  if (hasExistingPanels) event.accept()
}
```

### 5. Type Panel Parameters

```typescript
// ✅ Good - typed params
interface EditorPanelParams {
  filePath: string
  fileContent: string
  saved: boolean
}

export function EditorPanel(props: IDockviewPanelProps<EditorPanelParams>) {
  const { filePath } = props.params
}

// ❌ Bad - untyped params
export function EditorPanel(props: IDockviewPanelProps<any>) {
  const filePath = props.params.filePath
}
```

### 6. Clean Up Event Listeners

```typescript
// ✅ Good - cleanup
useEffect(() => {
  const disposable = panel.api.onDidClose(() => {
    // cleanup
  })
  return () => disposable.dispose()
}, [])
```

### 7. Use Utility Functions

```typescript
// ✅ Good - DRY
const result = handleTerminalDrop({ event, sourceContainerRef, targetContainerRef })

// ❌ Bad - repeated logic
const data = event.getData()
const panelId = data?.panelId
// ... 50 lines of logic repeated in multiple places
```

### 8. Provide User Feedback

```typescript
// ✅ Good - visual feedback
panel.api.setActive() // Focus the panel after creation

// ✅ Good - show/hide panels
if (panel && !panel.api.isVisible) {
  panel.api.setVisible(true)
}
```

---

## Common Patterns

### Opening a File in Editor

```typescript
const openFile = async (filePath: string) => {
  const panelId = `editor-${filePath}`
  
  // Check if already open
  const existingPanel = dockRef.current?.getPanel(panelId)
  if (existingPanel) {
    existingPanel.api.setActive()
    return
  }
  
  // Load file content
  const content = await fetchFileContent(filePath)
  
  // Create panel
  dockRef.current?.addPanel({
    id: panelId,
    component: "editor",
    tabComponent: "editor",
    title: path.basename(filePath),
    params: {
      filePath,
      fileContent: content,
      saved: true,
    },
  })
}
```

### Creating a Terminal

```typescript
const createNewTerminal = async () => {
  // Create terminal instance in context
  const terminalId = await createNewTerminal()
  
  // Show terminal dock if hidden
  const terminalPanel = gridRef.current?.getPanel("terminal")
  if (terminalPanel && !terminalPanel.api.isVisible) {
    terminalPanel.api.setVisible(true)
  }
  
  // Add panel to terminal dock
  terminalRef.current?.addPanel({
    id: `terminal-${terminalId}`,
    component: "terminal",
    title: "Shell",
    tabComponent: "terminal",
    params: {
      terminalId,
      theme: resolvedTheme,
    },
  })
}
```

### Keyboard Shortcuts

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Toggle terminal (Ctrl+`)
    if (e.ctrlKey && e.key === "`") {
      const panel = gridRef.current?.getPanel("terminal")
      panel?.api.setVisible(!panel.api.isVisible)
    }
    
    // Toggle sidebar (Cmd+B)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
      e.preventDefault()
      const panel = gridRef.current?.getPanel("sidebar")
      panel?.api.setVisible(!panel.api.isVisible)
    }
  }
  
  window.addEventListener("keydown", handleKeyDown)
  return () => window.removeEventListener("keydown", handleKeyDown)
}, [])
```

---

## Debugging Tips

### Check Panel Existence

```typescript
const panel = dockRef.current?.getPanel(panelId)
console.log("Panel exists:", !!panel)
console.log("Panel visible:", panel?.api.isVisible)
```

### List All Panels

```typescript
const panels = dockRef.current?.panels || []
console.log("All panels:", panels.map(p => ({ id: p.id, visible: p.api.isVisible })))
```

### Monitor Drop Events

```typescript
const handleDockDidDrop = (event: DockviewDidDropEvent) => {
  console.log("Drop event:", {
    position: event.position,
    panelId: event.getData()?.panelId,
    groupId: event.getData()?.groupId,
  })
}
```

### Check Container State

```typescript
console.log("Terminal panels:", terminalRef.current?.panels.length)
console.log("Dock panels:", dockRef.current?.panels.length)
console.log("Grid panels:", gridRef.current?.panels.length)
```

---

## Further Reading

- [Dockview Documentation](https://dockview.dev/)
- [Dockview GitHub](https://github.com/mathuo/dockview)
- [XTerm.js Documentation](https://xtermjs.org/)
- Our implementation: `web/components/project/layout/`

---

## Quick Reference

### Common APIs

```typescript
// Panel API
panel.api.close()
panel.api.setVisible(true/false)
panel.api.setActive()
panel.api.updateParameters({ key: value })
panel.api.isVisible
panel.api.isActive

// Container API
container.addPanel({ id, component, title, params })
container.getPanel(id)
container.panels // array of all panels
container.onDidAddPanel(handler)
container.onDidRemovePanel(handler)
container.onDidDrop(handler)
container.onUnhandledDragOverEvent(handler)

// Grid API (same as Container API plus:)
grid.getPanel(id) // get grid panel
grid.layout(config) // set layout configuration
```

### Event Types

```typescript
DockviewDidDropEvent      // Drop completed
DockviewDndOverlayEvent   // Drag over container
IDockviewPanelProps       // Panel component props
IDockviewPanelHeaderProps // Tab component props
IGridviewPanelProps       // Grid panel props
```
