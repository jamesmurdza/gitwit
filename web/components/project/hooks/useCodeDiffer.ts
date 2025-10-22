import { DiffSession, LineRange } from "@/lib/types"
import * as monaco from "monaco-editor"
import { useCallback, useEffect, useRef } from "react"
import { DecorationManager } from "./lib/decoration-manager"
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
  forceClearAllDecorations: () => void
  getUnresolvedSnapshot: (fileId: string) => DiffSession | null
  restoreFromSnapshot: (session: DiffSession) => void
  clearVisuals: () => void
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
  const lastWidgetCountRef = useRef<number>(0)
  const suppressZeroNotifyRef = useRef<boolean>(false)

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
      ;(model as any).mergedContent = mergedCode

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
      widgetManagerRef.current = new WidgetManager(
        editorRef,
        model,
        (count) => {
          lastWidgetCountRef.current = count
          if (count === 0) {
            if (suppressZeroNotifyRef.current) {
              suppressZeroNotifyRef.current = false
              return
            }
            try {
              // No unresolved diffs left; clear any saved session for this file
              const fileId = model.uri.path || model.uri.toString()
              ;(window as any).__clearDiffSession?.(fileId)
            } catch {}
          }
        }
      )

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

  // Memoize functions to prevent unnecessary re-renders
  const hasActiveWidgets = useCallback(() => {
    return widgetManagerRef.current?.hasActiveWidgets() ?? false
  }, [])

  const forceClearAllDecorations = useCallback(() => {
    widgetManagerRef.current?.forceClearAllDecorations()
  }, [])

  const getUnresolvedSnapshot = useCallback(
    (fileId: string) => {
      if (!editorRef) return null
      const model = editorRef.getModel()
      if (!model) return null
      const decorationManager = new DecorationManager(model)
      const maxLines = model.getLineCount()
      const unresolved: {
        type: "added" | "removed"
        start: number
        end: number
      }[] = []

      const seenAnchors = new Set<number>()
      for (let line = 1; line <= maxLines; line++) {
        const isRemoved = decorationManager.lineHasClass(
          line,
          "removed-line-decoration"
        )
        const isAdded = decorationManager.lineHasClass(
          line,
          "added-line-decoration"
        )
        if (!isRemoved && !isAdded) continue
        const type: "added" | "removed" = isRemoved ? "removed" : "added"
        const range: LineRange = decorationManager.getLiveRange(type, line)
        const anchor = range.end
        if (seenAnchors.has(anchor)) {
          line = range.end
          continue
        }
        seenAnchors.add(anchor)
        unresolved.push({ type, start: range.start, end: range.end })
        line = range.end
      }

      const eolStr = model.getEOL()
      const eol: "LF" | "CRLF" = eolStr === "\r\n" ? "CRLF" : "LF"
      const originalCode = (model as any).originalContent ?? ""
      const mergedCode = (model as any).mergedContent ?? ""
      const combinedText = model.getValue()

      return {
        fileId,
        originalCode,
        mergedCode,
        combinedText,
        eol,
        unresolvedBlocks: unresolved,
      }
    },
    [editorRef]
  )

  const restoreFromSnapshot = useCallback(
    (session: DiffSession) => {
      if (!editorRef) return
      const model = editorRef.getModel()
      if (!model) return
      // Set combined text and EOL exactly as before
      model.setValue(session.combinedText)
      model.setEOL(
        session.eol === "CRLF"
          ? monaco.editor.EndOfLineSequence.CRLF
          : monaco.editor.EndOfLineSequence.LF
      )
      ;(model as any).originalContent = session.originalCode
      ;(model as any).mergedContent = session.mergedCode

      // Recreate diff decorations only for unresolved blocks
      const decorations: monaco.editor.IModelDeltaDecoration[] = []
      for (const block of session.unresolvedBlocks) {
        for (let line = block.start; line <= block.end; line++) {
          decorations.push({
            range: new monaco.Range(line, 1, line, 1),
            options: {
              isWholeLine: true,
              className:
                block.type === "added"
                  ? "added-line-decoration"
                  : "removed-line-decoration",
              glyphMarginClassName:
                block.type === "added"
                  ? "added-line-glyph"
                  : "removed-line-glyph",
              linesDecorationsClassName:
                block.type === "added"
                  ? "added-line-number"
                  : "removed-line-number",
            },
          })
        }
      }

      editorRef.createDecorationsCollection(decorations)

      // Rebuild widgets for current decorations
      if (widgetManagerRef.current) {
        widgetManagerRef.current.cleanupAllWidgets()
      }
      widgetManagerRef.current = new WidgetManager(
        editorRef,
        model,
        (count) => {
          lastWidgetCountRef.current = count
          if (count === 0) {
            if (suppressZeroNotifyRef.current) {
              suppressZeroNotifyRef.current = false
              return
            }
            try {
              const fileId = model.uri.path || model.uri.toString()
              ;(window as any).__clearDiffSession?.(fileId)
            } catch {}
          }
        }
      )
      widgetManagerRef.current.buildAllWidgetsFromDecorations()
    },
    [editorRef]
  )

  const clearVisuals = useCallback(() => {
    // Suppress session clearing when we intentionally clear visuals on tab switch
    suppressZeroNotifyRef.current = true
    widgetManagerRef.current?.forceClearAllDecorations()
  }, [])

  return {
    handleApplyCode,
    hasActiveWidgets,
    forceClearAllDecorations,
    getUnresolvedSnapshot,
    restoreFromSnapshot,
    clearVisuals,
  }
}
