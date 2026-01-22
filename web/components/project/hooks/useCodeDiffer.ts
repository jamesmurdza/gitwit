import { DiffSession, LineRange } from "@/lib/types"
import * as monaco from "monaco-editor"
import { useCallback, useEffect, useRef, useState } from "react"
import { normalizePath } from "../chat/lib/utils"
import { DecorationManager } from "./lib/decoration-manager"
import { calculateDiff } from "./lib/diff-calculator"
import { WidgetManager } from "./lib/widget-manager"

export interface UseCodeDifferProps {
  editorRef: monaco.editor.IStandaloneCodeEditor | null
  onDiffChange?: (session: DiffSession | null) => void
  onDiffResolved?: (fileId: string, status: "applied" | "rejected") => void
}

export interface UseCodeDifferReturn {
  handleApplyCode: (
    mergedCode: string,
    originalCode: string,
  ) => monaco.editor.IEditorDecorationsCollection | null
  hasActiveWidgets: () => boolean
  forceClearAllDecorations: () => void
  getUnresolvedSnapshot: (fileId: string) => DiffSession | null
  restoreFromSnapshot: (session: DiffSession) => void
  clearVisuals: () => void
  acceptAll: () => void
  rejectAll: () => void
  scrollToNextDiff: () => void
  scrollToPrevDiff: () => void
  // State to trigger re-renders in parent components
  activeWidgetsState: boolean
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
  onDiffChange,
  onDiffResolved,
}: UseCodeDifferProps): UseCodeDifferReturn {
  const widgetManagerRef = useRef<WidgetManager | null>(null)
  const lastWidgetCountRef = useRef<number>(0)
  const suppressZeroNotifyRef = useRef<boolean>(false)

  // Expose state for UI components to react to widget presence
  const [activeWidgetsState, setActiveWidgetsState] = useState(false)

  // Keep a ref to editorRef so callbacks can access the latest value
  const editorRefRef = useRef(editorRef)
  useEffect(() => {
    editorRefRef.current = editorRef
  }, [editorRef])

  // Internal getUnresolvedSnapshot ref to use inside callback
  const getUnresolvedSnapshotRef = useRef<
    ((fileId: string) => DiffSession | null) | null
  >(null)

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
      originalCode: string,
    ): monaco.editor.IEditorDecorationsCollection | null => {
      // Use the ref to get the latest editorRef value
      const currentEditorRef = editorRefRef.current
      if (!currentEditorRef) return null
      const model = currentEditorRef.getModel()
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
      const newDecorations = currentEditorRef.createDecorationsCollection(
        diffResult.decorations,
      )

      ;(model as any).granularBlocks = diffResult.granularBlocks

      const checkAndResolve = (count: number) => {
        // Update state for UI
        setActiveWidgetsState(count > 0)

        if (suppressZeroNotifyRef.current) {
          return
        }

        // Notify about diff changes
        if (onDiffChange && getUnresolvedSnapshotRef.current) {
          const fileId = normalizePath(model.uri.fsPath)
          const session = getUnresolvedSnapshotRef.current(fileId)
          onDiffChange(session)
        }

        if (count === 0) {
          try {
            // Use fsPath to ensure we get backslashes on Windows if applicable, or consistent path logic
            // Normalize immediately to ensure consistent use across the app
            const fileId = normalizePath(model.uri.fsPath)
            // Detect if applied or rejected (simplistic check: if content == merged, it's applied)
            const currentContent = model.getValue()
            const original = (model as any).originalContent || ""
            const status = currentContent !== original ? "applied" : "rejected"

            ;(window as any).__clearDiffSession?.(fileId)

            if (onDiffResolved) {
              onDiffResolved(fileId, status)
            }
          } catch {}
        }
      }

      // Always create a new widget manager for each diff application
      // This ensures it's bound to the current model
      if (widgetManagerRef.current) {
        suppressZeroNotifyRef.current = true
        widgetManagerRef.current.cleanupAllWidgets()
        suppressZeroNotifyRef.current = false
      }
      widgetManagerRef.current = new WidgetManager(
        currentEditorRef,
        model,
        (count) => {
          lastWidgetCountRef.current = count
          checkAndResolve(count)
        },
      )

      // Suppress during BUILD of NEW widgets because it might trigger cleanup internally
      // or start at 0 before adding.
      suppressZeroNotifyRef.current = true
      widgetManagerRef.current.buildAllWidgetsFromDecorations()
      suppressZeroNotifyRef.current = false

      // Manually check once after build is done
      checkAndResolve(widgetManagerRef.current.hasActiveWidgets() ? 1 : 0)

      return newDecorations
    },
    [onDiffResolved], // editorRef is accessed via ref, so no dependency needed
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
          setActiveWidgetsState(false)
        }

        const currentEditorRef = editorRefRef.current
        const cleanup = (currentEditorRef as any)?.cleanupDiffWidgets as
          | (() => void)
          | undefined
        if (cleanup) cleanup()
      } catch (error) {
        console.warn("Failed to cleanup diff widgets:", error)
      }
    }
  }, []) // editorRef is accessed via ref

  // Memoize functions to prevent unnecessary re-renders
  const hasActiveWidgets = useCallback(() => {
    return widgetManagerRef.current?.hasActiveWidgets() ?? false
  }, [])

  const forceClearAllDecorations = useCallback(() => {
    widgetManagerRef.current?.forceClearAllDecorations()
    setActiveWidgetsState(false)
  }, [])

  const getUnresolvedSnapshot = useCallback(
    (fileId: string) => {
      const currentEditorRef = editorRefRef.current
      if (!currentEditorRef) return null
      const model = currentEditorRef.getModel()
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
          "removed-line-decoration",
        )
        const isAdded = decorationManager.lineHasClass(
          line,
          "added-line-decoration",
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
    [], // editorRef is accessed via ref
  )

  // Update ref for internal access
  getUnresolvedSnapshotRef.current = getUnresolvedSnapshot

  const restoreFromSnapshot = useCallback(
    (session: DiffSession) => {
      const currentEditorRef = editorRefRef.current
      if (!currentEditorRef) return
      const model = currentEditorRef.getModel()
      if (!model) return
      // Set combined text and EOL exactly as before
      model.setValue(session.combinedText)
      model.setEOL(
        session.eol === "CRLF"
          ? monaco.editor.EndOfLineSequence.CRLF
          : monaco.editor.EndOfLineSequence.LF,
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

      currentEditorRef.createDecorationsCollection(decorations)

      const checkAndResolve = (count: number) => {
        // Update state for UI
        setActiveWidgetsState(count > 0)

        if (suppressZeroNotifyRef.current) {
          return
        }

        // Notify about diff changes
        if (onDiffChange && getUnresolvedSnapshotRef.current) {
          const fileId = normalizePath(model.uri.fsPath)
          const session = getUnresolvedSnapshotRef.current(fileId)
          onDiffChange(session)
        }

        if (count === 0) {
          try {
            const fileId = normalizePath(model.uri.fsPath)
            ;(window as any).__clearDiffSession?.(fileId)
          } catch {}
        }
      }

      // Rebuild widgets for current decorations
      if (widgetManagerRef.current) {
        suppressZeroNotifyRef.current = true
        widgetManagerRef.current.cleanupAllWidgets()
        suppressZeroNotifyRef.current = false
      }
      widgetManagerRef.current = new WidgetManager(
        currentEditorRef,
        model,
        (count) => {
          lastWidgetCountRef.current = count
          checkAndResolve(count)
        },
      )

      suppressZeroNotifyRef.current = true
      widgetManagerRef.current.buildAllWidgetsFromDecorations()
      suppressZeroNotifyRef.current = false

      // Manually check once after build is done
      checkAndResolve(widgetManagerRef.current.hasActiveWidgets() ? 1 : 0)
    },
    [], // editorRef is accessed via ref
  )

  const clearVisuals = useCallback(() => {
    // Suppress session clearing when we intentionally clear visuals on tab switch
    suppressZeroNotifyRef.current = true
    widgetManagerRef.current?.forceClearAllDecorations()
    widgetManagerRef.current = null
    setActiveWidgetsState(false)
  }, [])

  return {
    handleApplyCode,
    hasActiveWidgets,
    // Return reactive state for UI
    activeWidgetsState,
    forceClearAllDecorations,
    getUnresolvedSnapshot,
    restoreFromSnapshot,
    clearVisuals,
    acceptAll: useCallback(() => widgetManagerRef.current?.acceptAll(), []),
    rejectAll: useCallback(() => widgetManagerRef.current?.rejectAll(), []),
    scrollToNextDiff: useCallback(() => {
      const currentEditorRef = editorRefRef.current
      if (!currentEditorRef || !widgetManagerRef.current) return

      const blocks = widgetManagerRef.current.getDiffBlocks()
      if (blocks.length === 0) return

      const currentLine = currentEditorRef.getPosition()?.lineNumber || 1
      const nextBlock = blocks.find((b) => b.start > currentLine) || blocks[0]

      if (nextBlock) {
        currentEditorRef.revealLineInCenter(nextBlock.start)
        currentEditorRef.setPosition({
          lineNumber: nextBlock.start,
          column: 1,
        })
      }
    }, []),
    scrollToPrevDiff: useCallback(() => {
      const currentEditorRef = editorRefRef.current
      if (!currentEditorRef || !widgetManagerRef.current) return

      const blocks = widgetManagerRef.current.getDiffBlocks()
      if (blocks.length === 0) return

      const currentLine = currentEditorRef.getPosition()?.lineNumber || 1
      // Find last block that starts before current line
      const prevBlock =
        [...blocks].reverse().find((b) => b.end < currentLine) ||
        blocks[blocks.length - 1]

      if (prevBlock) {
        currentEditorRef.revealLineInCenter(prevBlock.start)
        currentEditorRef.setPosition({
          lineNumber: prevBlock.start,
          column: 1,
        })
      }
    }, []),
  }
}
