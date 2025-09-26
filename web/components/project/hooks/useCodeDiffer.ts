import * as monaco from "monaco-editor"
import { useCallback, useEffect, useRef } from "react"
import { calculateDiff } from "./lib/diff-calculator"
import { WidgetManager } from "./lib/widget-manager"

export interface UseCodeDifferProps {
  editorRef: monaco.editor.IStandaloneCodeEditor | null
}

export interface UseCodeDifferReturn {
  handleApplyCode: (
    mergedCode: string,
    originalCode: string
  ) => monaco.editor.IEditorDecorationsCollection | null
  hasActiveWidgets: () => boolean
  acceptAllChanges: () => void
  forceClearAllDecorations: () => void
}

/**
 * Hook for handling code diff visualization using Monaco Editor's built-in diff algorithm
 *
 * This hook provides sophisticated diff functionality similar to VS Code/Cursor IDE:
 * - Calculates differences between original and merged code
 * - Creates visual diff view with color-coded decorations
 * - Manages interactive accept/reject buttons for each diff block
 * - Handles cleanup of widgets and decorations on unmount
 *
 * @param props - Configuration object
 * @param props.editorRef - Reference to the Monaco editor instance
 * @returns Object containing the handleApplyCode function
 *
 */
export function useCodeDiffer({
  editorRef,
}: UseCodeDifferProps): UseCodeDifferReturn {
  const widgetManagerRef = useRef<WidgetManager | null>(null)

  /**
   * Applies a diff view to the Monaco editor with interactive accept/reject buttons
   *
   * @param mergedCode - The new code content to compare against
   * @param originalCode - The original code content
   * @returns Monaco decorations collection for the diff view, or null if editor is not available
   */
  const handleApplyCode = useCallback(
    (
      mergedCode: string,
      originalCode: string
    ): monaco.editor.IEditorDecorationsCollection | null => {
      if (!editorRef) return null

      const model = editorRef.getModel()
      if (!model)
        return null

        // Store original content on model for potential restoration
      ;(model as any).originalContent = originalCode

      const originalModelEOL = model.getEOL()
      const eolSequence =
        originalModelEOL === "\r\n"
          ? monaco.editor.EndOfLineSequence.CRLF
          : monaco.editor.EndOfLineSequence.LF

      // Calculate diff using the modular diff calculator
      const diffResult = calculateDiff(originalCode, mergedCode, {
        ignoreWhitespace: false,
      })

      // Apply the combined diff view to the editor
      model.setValue(diffResult.combinedLines.join("\n"))
      // Reapply original EOL style so the last line does not appear changed on CRLF files
      model.setEOL(eolSequence)

      // Create and return decorations collection
      const newDecorations = editorRef.createDecorationsCollection(
        diffResult.decorations
      )

      ;(model as any).granularBlocks = diffResult.granularBlocks

      // Always create a new widget manager for each diff application
      // This ensures it's bound to the current model
      if (widgetManagerRef.current) {
        widgetManagerRef.current.cleanupAllWidgets()
      }
      widgetManagerRef.current = new WidgetManager(editorRef, model)

      // Build all widgets from the new decorations
      widgetManagerRef.current.buildAllWidgetsFromDecorations()

      return newDecorations
    },
    [editorRef]
  )

  /**
   * Cleanup effect: removes all widgets and decorations when component unmounts
   */
  useEffect(() => {
    return () => {
      try {
        if (widgetManagerRef.current) {
          widgetManagerRef.current.cleanupAllWidgets()
          widgetManagerRef.current = null
        }

        const cleanup = (editorRef as any)?.cleanupDiffWidgets as
          | (() => void)
          | undefined
        if (cleanup) cleanup()
      } catch (error) {
        console.warn("Failed to cleanup diff widgets:", error)
      }
    }
  }, [editorRef])

  return {
    handleApplyCode,
    hasActiveWidgets: () =>
      widgetManagerRef.current?.hasActiveWidgets() ?? false,
    acceptAllChanges: () => widgetManagerRef.current?.acceptAllChanges(),
    forceClearAllDecorations: () =>
      widgetManagerRef.current?.forceClearAllDecorations(),
  }
}
