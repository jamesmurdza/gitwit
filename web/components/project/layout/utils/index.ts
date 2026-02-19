import {
  LayoutPriority,
  type DockviewApi,
  type DockviewDidDropEvent,
  type GridviewApi,
} from "dockview"

/**
 * Direction mapping from drop position to dockview direction parameter.
 * Maps edge drop positions to their corresponding split directions.
 */
const DIRECTION_MAP = {
  left: "left",
  right: "right",
  top: "above",
  bottom: "below",
} as const

/**
 * Type guard to check if a position indicates a split intent.
 * Split positions are edge drops (left, right, top, bottom).
 *
 * @param position - The drop position from the event
 * @returns True if the position indicates a split, false otherwise
 */
function isSplitPosition(
  position: string,
): position is keyof typeof DIRECTION_MAP {
  return ["left", "right", "top", "bottom"].includes(position)
}

/**
 * Calculates the positioning options for adding a panel based on drop event data.
 * Handles three scenarios:
 * 1. Split creation (edge drops) - creates new group in specified direction
 * 2. Tab addition (center drops) - adds as tab to existing group
 * 3. Empty container - adds panel without positioning constraints
 *
 * @param event - The dockview drop event containing position and group information
 * @returns Position configuration for addPanel or undefined for empty containers
 */
export function calculateDropPosition(event: DockviewDidDropEvent):
  | {
      referenceGroup: string
      direction?: "left" | "right" | "above" | "below"
    }
  | undefined {
  // Empty container - no positioning needed
  if (!event.group) {
    return undefined
  }

  // Check if user intends to create a split
  if (isSplitPosition(event.position)) {
    return {
      referenceGroup: event.group.id,
      direction: DIRECTION_MAP[event.position],
    }
  }

  // Center drop - add as tab to existing group
  return {
    referenceGroup: event.group.id,
  }
}

/**
 * Configuration for handling cross-container terminal panel moves.
 */
interface HandleTerminalDropConfig {
  /** The drop event from dockview */
  event: DockviewDidDropEvent
  /** Reference to the source container API */
  sourceContainerRef: React.MutableRefObject<DockviewApi | null | undefined>
  /** Reference to the target container API (same as event.api, provided for clarity) */
  targetContainerRef: React.MutableRefObject<DockviewApi | null | undefined>
}

/**
 * Result of attempting to handle a terminal drop operation.
 */
interface HandleTerminalDropResult {
  /** Whether the drop was handled */
  handled: boolean
  /** Optional message describing the result */
  message?: string
}

/**
 * Handles cross-container terminal panel drop operations with proper state preservation.
 * This function manages moving terminal panels between dockview containers while:
 * - Preserving terminal state (buffer, processes, connections)
 * - Respecting user intent (split vs tab addition)
 * - Handling empty containers
 * - Rejecting invalid drops
 *
 * @param config - Configuration object containing event and container references
 * @returns Result indicating whether the drop was handled and any relevant message
 *
 * @example
 * ```typescript
 * const result = handleTerminalDrop({
 *   event,
 *   sourceContainerRef: terminalRef,
 *   targetContainerRef: dockRef,
 * })
 * if (result.handled) {
 *   console.log(result.message)
 * }
 * ```
 */
export function handleTerminalDrop(
  config: HandleTerminalDropConfig,
): HandleTerminalDropResult {
  const { event, sourceContainerRef, targetContainerRef } = config
  const data = event.getData()

  // Validate panel data exists
  if (!data?.panelId) {
    return {
      handled: false,
      message: "No panel data in drop event",
    }
  }

  // Only handle terminal panels
  if (!data.panelId.startsWith("terminal-")) {
    return {
      handled: false,
      message: "Not a terminal panel",
    }
  }

  // Find source panel
  const sourcePanel = sourceContainerRef.current?.getPanel(data.panelId)
  if (!sourcePanel || !sourceContainerRef.current) {
    console.error("Could not find source terminal panel")
    return {
      handled: false,
      message: "Source panel not found",
    }
  }

  // Check if it's a cross-container move
  const targetApi = event.api
  if (sourceContainerRef.current === targetApi) {
    // Same container - let dockview handle it natively
    return {
      handled: false,
      message: "Same container move - handled by dockview",
    }
  }

  // Extract panel state for recreation
  const panelState = {
    id: sourcePanel.id,
    title: sourcePanel.title,
    params: sourcePanel.params,
  }

  // Remove from source container
  sourceContainerRef.current.removePanel(sourcePanel)

  // Calculate positioning based on drop location
  const position = calculateDropPosition(event)

  // Add to target container
  targetApi.addPanel({
    id: panelState.id,
    component: "terminal",
    title: panelState.title,
    tabComponent: "terminal",
    params: panelState.params,
    position,
  })

  return {
    handled: true,
    message: `Terminal panel moved successfully (${position ? "positioned" : "no positioning"})`,
  }
}

export function loadDefaultGridviewLayout({ grid }: { grid: GridviewApi }) {
  grid.addPanel({
    id: "dock",
    component: "dock",
    priority: LayoutPriority.High,
  })
  grid.addPanel({
    id: "terminal",
    component: "terminal",
    minimumHeight: 100,
    size: 200,
    snap: true,
    position: {
      direction: "below",
      referencePanel: "dock",
    },
  })
  grid.addPanel({
    id: "sidebar",
    component: "sidebar",
    minimumWidth: 272,
    size: 272,
    snap: true,
  })
  const panel = grid.addPanel({
    id: "chat",
    component: "chat",
    location: [2],
    minimumWidth: 350,
    size: 420,
    snap: true,
  })
  panel.api.setVisible(false)
}
