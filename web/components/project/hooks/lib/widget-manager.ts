import { LineRange } from "@/lib/types"
import * as monaco from "monaco-editor"
import { DecorationManager } from "./decoration-manager"
import {
  createContentWidget,
  createDiffButton,
  createWidgetContainer,
} from "./widget-factory"

/**
 * Manages diff widgets and their lifecycle
 */
export class WidgetManager {
  private widgets: monaco.editor.IContentWidget[] = []
  private anchorDecorations: string[] = []
  private decorationManager: DecorationManager

  /**
   * Creates a new WidgetManager instance
   *
   * @param editorRef - Reference to the Monaco editor instance
   * @param model - The Monaco editor model to manage widgets for
   */
  constructor(
    private editorRef: monaco.editor.IStandaloneCodeEditor,
    private model: monaco.editor.ITextModel
  ) {
    this.decorationManager = new DecorationManager(model)
    this.attachCleanupToEditor()
  }

  /**
   * Cleans up all existing widgets and their anchor decorations
   */
  cleanupAllWidgets(): void {
    // Remove all content widgets
    this.widgets.forEach((widget) => {
      try {
        this.editorRef.removeContentWidget(widget)
      } catch (error) {
        // Ignore errors if widget doesn't exist
      }
    })

    // Clear all anchor decorations
    if (this.anchorDecorations.length > 0) {
      try {
        this.model.deltaDecorations(this.anchorDecorations, [])
      } catch (error) {
        // Ignore errors if decorations don't exist
      }
    }

    this.widgets = []
    this.anchorDecorations = []
  }

  /**
   * Builds all widgets from current decorations in the model
   */
  buildAllWidgetsFromDecorations(): void {
    this.cleanupAllWidgets()

    const processedAnchors = new Set<number>()
    const maxLines = this.model.getLineCount()
    const newWidgets: monaco.editor.IContentWidget[] = []
    const newAnchorDecorations: string[] = []

    for (let lineNumber = 1; lineNumber <= maxLines; lineNumber++) {
      const isRemoved = this.decorationManager.lineHasClass(
        lineNumber,
        "removed-line-decoration"
      )
      const isAdded = this.decorationManager.lineHasClass(
        lineNumber,
        "added-line-decoration"
      )

      if (!isRemoved && !isAdded) continue

      const type: "added" | "removed" = isRemoved ? "removed" : "added"
      const range = this.decorationManager.getLiveRange(type, lineNumber)
      const partner = this.decorationManager.getModificationPartner(range, type)

      // For modification pairs, only show widget on the red (removed) block
      if (type === "added" && partner) {
        lineNumber = range.end
        continue
      }

      // Prevent duplicate widgets for the same contiguous block
      const anchorLine = range.end
      if (processedAnchors.has(anchorLine)) {
        lineNumber = range.end
        continue
      }
      processedAnchors.add(anchorLine)

      const widget = this.createWidgetForBlock(type, range, anchorLine)
      if (widget) {
        newWidgets.push(widget.widget)
        newAnchorDecorations.push(widget.anchorDecorationId)
      }

      lineNumber = range.end
    }

    this.widgets = newWidgets
    this.anchorDecorations = newAnchorDecorations
  }

  /**
   * Creates a widget for a specific diff block
   *
   * @param type - The type of diff block (added or removed)
   * @param range - The line range of the diff block
   * @param anchorLine - The line number to anchor the widget to
   * @returns Widget and anchor decoration ID, or null if creation fails
   */
  private createWidgetForBlock(
    type: "added" | "removed",
    range: LineRange,
    anchorLine: number
  ): {
    widget: monaco.editor.IContentWidget
    anchorDecorationId: string
  } | null {
    const container = createWidgetContainer()
    const anchorDecorationId =
      this.decorationManager.createAnchorDecoration(anchorLine)

    const { acceptHandler, rejectHandler } = this.createActionHandlers(
      type,
      anchorLine,
      anchorDecorationId
    )

    const acceptButton = createDiffButton({
      kind: "accept",
      color: "#22c55e",
      title: "Accept block",
      onClick: acceptHandler,
    })

    const rejectButton = createDiffButton({
      kind: "reject",
      color: "#ef4444",
      title: "Reject block",
      onClick: rejectHandler,
    })

    container.appendChild(acceptButton)
    container.appendChild(rejectButton)

    // Create content widget
    const widget = createContentWidget(
      `diff-block-actions-${anchorLine}-${type}`,
      container,
      () => this.calculateWidgetPosition(anchorDecorationId, anchorLine, type)
    )

    this.editorRef.addContentWidget(widget)

    return { widget, anchorDecorationId }
  }

  /**
   * Creates action handlers for accept/reject operations
   *
   * @param type - The type of diff block (added or removed)
   * @param anchorLine - The line number to anchor the widget to
   * @param anchorDecorationId - The decoration ID for the anchor
   * @returns Object containing accept and reject handlers
   */
  private createActionHandlers(
    type: "added" | "removed",
    anchorLine: number,
    anchorDecorationId: string
  ) {
    const acceptHandler = () => {
      const safeAnchor = Math.min(anchorLine, this.model.getLineCount())
      const liveRange = this.decorationManager.getLiveRange(type, safeAnchor)
      const livePartner = this.decorationManager.getModificationPartner(
        liveRange,
        type
      )

      if (type === "removed") {
        this.decorationManager.clearBlockDecorations(liveRange)
        if (livePartner) {
          this.decorationManager.clearBlockDecorations(livePartner)
        }
        this.decorationManager.removeLines(liveRange)
      } else {
        this.decorationManager.clearBlockDecorations(liveRange)
      }

      this.removeWidget(anchorDecorationId)
      this.rebuildWidgets()
    }

    const rejectHandler = () => {
      const safeAnchor = Math.min(anchorLine, this.model.getLineCount())
      const liveRange = this.decorationManager.getLiveRange(type, safeAnchor)
      const livePartner = this.decorationManager.getModificationPartner(
        liveRange,
        type
      )

      this.removeWidget(anchorDecorationId)

      if (type === "added") {
        this.decorationManager.clearBlockDecorations(liveRange)
        this.decorationManager.removeLines(liveRange)
      } else {
        this.decorationManager.clearBlockDecorations(liveRange)
        if (livePartner) {
          this.decorationManager.clearBlockDecorations(livePartner)
          this.decorationManager.removeLines(livePartner)
        }
      }

      this.rebuildWidgets()
    }

    return { acceptHandler, rejectHandler }
  }

  /**
   * Calculates the position for a widget based on its anchor
   *
   * @param anchorDecorationId - The decoration ID for the anchor
   * @param seedLine - The starting line number for position calculation
   * @param type - The type of diff block (added or removed)
   * @returns Monaco content widget position
   */
  private calculateWidgetPosition(
    anchorDecorationId: string,
    seedLine: number,
    type: "added" | "removed"
  ): monaco.editor.IContentWidgetPosition {
    const anchorRange = this.model.getDecorationRange(anchorDecorationId)
    const anchorLine = anchorRange
      ? anchorRange.startLineNumber
      : Math.min(seedLine, this.model.getLineCount())

    const liveRange = this.decorationManager.getLiveRange(type, anchorLine)
    const lineNumber = Math.min(liveRange.end, this.model.getLineCount())

    return {
      position: {
        lineNumber,
        column: this.model.getLineMaxColumn(lineNumber) + 2,
      },
      preference: [
        monaco.editor.ContentWidgetPositionPreference.BELOW,
        monaco.editor.ContentWidgetPositionPreference.ABOVE,
        monaco.editor.ContentWidgetPositionPreference.EXACT,
      ],
    }
  }

  /**
   * Removes a specific widget and its anchor decoration
   *
   * @param anchorDecorationId - The decoration ID of the widget to remove
   */
  private removeWidget(anchorDecorationId: string): void {
    const widgetIndex = this.widgets.findIndex(
      (widget) =>
        widget.getId() ===
        `diff-block-actions-${anchorDecorationId
          .split("-")
          .pop()}-${anchorDecorationId}`
    )

    if (widgetIndex >= 0) {
      try {
        this.editorRef.removeContentWidget(this.widgets[widgetIndex])
      } catch (error) {
        // Ignore errors if widget doesn't exist
      }
      this.widgets.splice(widgetIndex, 1)
    }

    this.decorationManager.removeAnchorDecoration(anchorDecorationId)
  }

  /**
   * Rebuilds all widgets after changes
   */
  private rebuildWidgets(): void {
    requestAnimationFrame(() => {
      try {
        this.buildAllWidgetsFromDecorations()
      } catch (error) {
        console.warn("Failed to rebuild widgets:", error)
      }
    })
  }

  /**
   * Attaches cleanup function to the editor for external access
   */
  private attachCleanupToEditor(): void {
    ;(this.editorRef as any).cleanupDiffWidgets = () => this.cleanupAllWidgets()
  }
}
