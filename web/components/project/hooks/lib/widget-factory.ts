import { WidgetOptions } from "@/lib/types"
import * as monaco from "monaco-editor"

/**
 * Creates a styled button element for diff widget actions
 *
 * @param options - Configuration for the button
 * @returns HTML button element
 */
export function createDiffButton(options: WidgetOptions): HTMLButtonElement {
  const button = document.createElement("button")

  button.title = options.title
  button.setAttribute("aria-label", options.title)
  button.setAttribute("data-action", options.kind)

  applyButtonStyles(button, options.color)

  const svg = createButtonIcon(options.kind)
  button.appendChild(svg)

  addButtonEventHandlers(button, options.kind)

  button.onclick = options.onClick

  return button
}

/**
 * Creates a container DOM element for diff widgets
 *
 * @returns HTML div element configured for widget container
 */
export function createWidgetContainer(): HTMLDivElement {
  const container = document.createElement("div")

  container.style.display = "inline-flex"
  container.style.gap = "6px"
  container.style.alignItems = "center"
  container.style.border = "none"
  container.style.background = "transparent"
  container.style.borderRadius = "0"
  container.style.padding = "0"
  container.style.boxShadow = "none"
  container.style.zIndex = "1000"
  container.style.userSelect = "none"
  container.style.pointerEvents = "auto"
  container.style.fontSize = "12px"

  return container
}

/**
 * Creates a Monaco content widget for diff actions
 *
 * @param id - Unique identifier for the widget
 * @param domNode - DOM node to display
 * @param getPosition - Function to calculate widget position
 * @returns Monaco content widget
 */
export function createContentWidget(
  id: string,
  domNode: HTMLElement,
  getPosition: () => monaco.editor.IContentWidgetPosition
): monaco.editor.IContentWidget {
  return {
    getId: () => id,
    getDomNode: () => domNode,
    getPosition,
    allowEditorOverflow: true,
  }
}

/**
 * Applies consistent styling to a button element
 *
 * @param button - The button element to style
 * @param color - The color for the button
 */
function applyButtonStyles(button: HTMLButtonElement, color: string): void {
  button.style.cursor = "pointer"
  button.style.background = "#ffffff"
  button.style.border = "1px solid hsl(var(--border))"
  button.style.color = color
  button.style.borderRadius = "6px"
  button.style.width = "24px"
  button.style.height = "24px"
  button.style.display = "inline-flex"
  button.style.alignItems = "center"
  button.style.justifyContent = "center"
  button.style.boxShadow = "0 1px 2px rgba(0,0,0,0.08)"
  button.style.padding = "0"
  button.style.lineHeight = "0"
  button.style.pointerEvents = "auto"
  button.style.transition =
    "background-color 120ms ease, box-shadow 120ms ease, transform 60ms ease"
}

/**
 * Creates SVG icon for the button based on action type
 *
 * @param kind - The type of button (accept or reject)
 * @returns SVG element for the button icon
 */
function createButtonIcon(kind: "accept" | "reject"): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("viewBox", "0 0 24 24")
  svg.setAttribute("fill", "none")
  svg.setAttribute("stroke", "currentColor")
  svg.style.width = "14px"
  svg.style.height = "14px"

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
  path.setAttribute("stroke-linecap", "round")
  path.setAttribute("stroke-linejoin", "round")
  path.setAttribute("stroke-width", "2")

  // Set path data based on button type
  if (kind === "accept") {
    path.setAttribute("d", "M5 13l4 4L19 7")
  } else {
    path.setAttribute("d", "M6 18L18 6M6 6l12 12")
  }

  svg.appendChild(path)
  return svg
}

/**
 * Adds interactive event handlers to a button
 *
 * @param button - The button element to add handlers to
 * @param kind - The type of button (accept or reject)
 */
function addButtonEventHandlers(
  button: HTMLButtonElement,
  kind: "accept" | "reject"
): void {
  const hoverColor =
    kind === "accept" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)"

  button.onmouseenter = () => {
    button.style.background = hoverColor
    button.style.boxShadow = "0 2px 6px rgba(0,0,0,0.12)"
  }

  button.onmouseleave = () => {
    button.style.background = "#ffffff"
    button.style.boxShadow = "0 1px 2px rgba(0,0,0,0.08)"
  }

  button.onmousedown = () => {
    button.style.transform = "translateY(0.5px)"
  }

  button.onmouseup = () => {
    button.style.transform = "translateY(0)"
  }

  button.onfocus = () => {
    button.style.boxShadow = `0 0 0 2px rgba(99,102,241,0.35), 0 1px 2px rgba(0,0,0,0.08)`
  }

  button.onblur = () => {
    button.style.boxShadow = "0 1px 2px rgba(0,0,0,0.08)"
  }
}
