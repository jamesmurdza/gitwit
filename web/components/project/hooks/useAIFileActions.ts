import { logFileDetected, mergeCode } from "@/app/actions/ai"
import { fileRouter } from "@/lib/api"
import { TTab } from "@/lib/types"
import { useAppStore } from "@/store/context"
import * as monaco from "monaco-editor"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  ApplyMergedFileArgs,
  FileMergeResult,
  PrecomputeMergeArgs,
} from "../chat/lib/types"
import { normalizePath, pathMatchesTab } from "../chat/lib/utils"

interface UseAIFileActionsProps {
  projectId: string
  activeTab: TTab | undefined
  tabs: TTab[]
  setActiveTab: (tab: TTab) => void
  editorRef: monaco.editor.IStandaloneCodeEditor | undefined
  waitForEditorModel: () => Promise<monaco.editor.ITextModel | null>
  handleApplyCodeWithDecorations: (
    mergedCode: string,
    originalCode: string,
  ) => void
  updateFileDraft: (fileId: string, content?: string) => void
}

export function useAIFileActions({
  projectId,
  activeTab,
  tabs,
  setActiveTab,
  editorRef,
  waitForEditorModel,
  handleApplyCodeWithDecorations,
  updateFileDraft,
}: UseAIFileActionsProps) {
  const getDraft = useAppStore((s) => s.getDraft)

  // Queue for failed diff applies (when model was null)
  const pendingDiffsQueueRef = useRef<Map<string, any>>(new Map())

  // Retry pending diffs when active tab changes
  useEffect(() => {
    if (!activeTab?.id || !editorRef) return

    // Check if current active tab has a pending diff
    const pending = pendingDiffsQueueRef.current.get(
      normalizePath(activeTab.id),
    )
    if (pending) {
      pendingDiffsQueueRef.current.delete(normalizePath(activeTab.id))
      handleApplyCodeFromChat(pending.code, pending.language, pending.options)
    }
  }, [activeTab?.id, editorRef])

  // --- Queue Management for "Keep All" ---
  const pendingPreviewApplyRef = useRef<{
    filePath: string
    content: string
    resolve: () => void
    reject: (error: unknown) => void
  } | null>(null)

  const pendingUpdatesQueueRef = useRef<
    Array<{
      filePath: string
      content: string
      resolve: () => void
      reject: (error: unknown) => void
    }>
  >([])

  const [pendingApplyTick, setPendingApplyTick] = useState(0)
  const isProcessingQueueRef = useRef(false)

  // Keep editor ref current for async operations
  const editorRefRef = useRef(editorRef)
  useEffect(() => {
    editorRefRef.current = editorRef
  }, [editorRef])

  const openFile = useCallback(
    (filePath: string) => {
      const normalizedPath = normalizePath(filePath)
      const matchBy = (tab: TTab) => pathMatchesTab(normalizedPath, tab)
      let targetTab = tabs.find(matchBy)

      if (!targetTab) {
        targetTab = {
          id: normalizedPath,
          name: normalizedPath.split("/").pop() || normalizedPath,
          type: "file",
          saved: true,
        }
      }

      const isAlreadyActive = activeTab ? matchBy(activeTab) : false
      if (!isAlreadyActive) {
        setActiveTab(targetTab)
      }
    },
    [tabs, activeTab, setActiveTab],
  )

  const processNextInQueue = useCallback(() => {
    if (
      isProcessingQueueRef.current ||
      pendingUpdatesQueueRef.current.length === 0
    ) {
      return
    }

    const next = pendingUpdatesQueueRef.current.shift()
    if (!next) return

    isProcessingQueueRef.current = true
    pendingPreviewApplyRef.current = next
    setPendingApplyTick((tick) => tick + 1)

    setPendingApplyTick((tick) => tick + 1)

    openFile(next.filePath)
  }, [openFile])

  // --- Helper: Get Content ---
  const getCurrentFileContent = useCallback(
    async (filePath: string): Promise<string> => {
      const normalizedPath = normalizePath(filePath)

      // First, check if there's a draft (unsaved changes)
      const draftContent = getDraft(normalizedPath)
      if (draftContent !== undefined) {
        return draftContent
      }

      // If no draft, fetch from server
      if (projectId) {
        try {
          const response = await fileRouter.fileContent.fetcher({
            fileId: normalizedPath,
            projectId,
          })
          return response?.data ?? ""
        } catch (error) {
          console.warn("Failed to fetch current file content:", error)
          return ""
        }
      }

      return ""
    },
    [projectId, getDraft],
  )

  // --- Action: Precompute Merge ---
  const precomputeMergeForFile = useCallback(
    async ({
      filePath,
      code,
    }: PrecomputeMergeArgs): Promise<FileMergeResult> => {
      const normalizedPath = normalizePath(filePath)

      // Log when file is detected from AI response
      await logFileDetected(normalizedPath)

      const originalCode = await getCurrentFileContent(normalizedPath)

      try {
        const mergedCode = await mergeCode(
          code,
          originalCode,
          normalizedPath.split("/").pop() || normalizedPath,
          projectId,
        )
        return { mergedCode, originalCode }
      } catch (error) {
        console.error("Auto-merge failed:", error)
        return { mergedCode: code, originalCode }
      }
    },
    [projectId, getCurrentFileContent],
  )

  // --- Action: Apply Logic (Diff View) ---
  const handleApplyCodeFromChat = useCallback(
    async (
      code: string,
      language?: string,
      options?: {
        mergeStatuses?: Record<
          string,
          { status: string; result?: FileMergeResult; error?: string }
        >
        getCurrentFileContent?: (filePath: string) => Promise<string> | string
        getMergeStatus?: (
          filePath: string,
        ) =>
          | { status: string; result?: FileMergeResult; error?: string }
          | undefined
      },
    ) => {
      if (!activeTab) return

      try {
        const normalizedPath = normalizePath(activeTab.id)
        let mergeResult: FileMergeResult | null = null

        // 1. Check Precomputed Status
        const mergeStatus = options?.getMergeStatus?.(normalizedPath)
        // 2. If ready, verify content matches
        if (mergeStatus?.status === "ready" && mergeStatus.result) {
          const currentContent = await getCurrentFileContent(normalizedPath)
          if (currentContent === mergeStatus.result.originalCode) {
            mergeResult = mergeStatus.result
          }
        }
        // 3. If pending, wait (poll)
        else if (mergeStatus?.status === "pending" && options?.getMergeStatus) {
          // Simple polling logic
          let waited = 0
          while (waited < 10000) {
            await new Promise((r) => setTimeout(r, 100))
            waited += 100
            const updated = options.getMergeStatus(normalizedPath)
            if (updated?.status === "ready" && updated.result) {
              const current = await getCurrentFileContent(normalizedPath)
              if (current === updated.result.originalCode) {
                mergeResult = updated.result
                break
              }
            }
            if (updated?.status === "error") break
          }
        }

        // 4. If still no result, calculate fresh
        if (!mergeResult) {
          const originalCode = await getCurrentFileContent(activeTab.id)
          const mergedCode = await mergeCode(
            code,
            originalCode,
            activeTab.name,
            projectId,
          )
          mergeResult = { mergedCode, originalCode }
        }

        // 5. Apply to Editor
        const model = await waitForEditorModel()
        if (model && mergeResult) {
          handleApplyCodeWithDecorations(
            mergeResult.mergedCode,
            mergeResult.originalCode,
          )
        } else if (!model) {
          // Failed to get model, save to queue for retry
          console.log("Saving diff apply to queue for:", activeTab.id)
          pendingDiffsQueueRef.current.set(normalizedPath, {
            code,
            language,
            options,
          })
        }
      } catch (error) {
        console.error("Apply Code Failed:", error)
        // Fallback
        const original = await getCurrentFileContent(activeTab.id)
        handleApplyCodeWithDecorations(code, original)
      }
    },
    [
      activeTab,
      projectId,
      getCurrentFileContent,
      waitForEditorModel,
      handleApplyCodeWithDecorations,
    ],
  )

  const enqueueFileContentUpdate = useCallback(
    (filePath: string, content: string) => {
      const normalizedPath = normalizePath(filePath)
      const completion = new Promise<void>((resolve, reject) => {
        pendingUpdatesQueueRef.current.push({
          filePath: normalizedPath,
          content,
          resolve,
          reject,
        })
        processNextInQueue()
      })
      return completion
    },
    [processNextInQueue],
  )

  // Effect to process the actual update on the editor
  // This stays a bit tied to the component lifecycle due to waitForEditorModel
  useEffect(() => {
    const pending = pendingPreviewApplyRef.current
    if (!pending) return
    if (!activeTab || !pathMatchesTab(pending.filePath, activeTab)) return

    let isCancelled = false
    const applyMergedCode = async () => {
      try {
        // Wait for editor model with retry logic for newly opened tabs
        // When a tab is just created, the editor might need extra time to mount
        let model = await waitForEditorModel()

        // Retry up to 3 times with increasing delays if model is null
        if (!model) {
          for (let attempt = 0; attempt < 3; attempt++) {
            if (isCancelled) {
              pending.reject(new Error("Operation cancelled"))
              return
            }
            await new Promise((resolve) =>
              setTimeout(resolve, 300 * (attempt + 1)),
            )
            model = await waitForEditorModel()
            if (model) break
          }
        }

        if (!model || isCancelled) {
          // Reject gracefully instead of throwing uncaught error
          pending.reject(new Error("Editor not ready"))
          return
        }

        const editorInstance = editorRefRef.current
        const fullRange = model.getFullModelRange()

        if (editorInstance) {
          editorInstance.pushUndoStop()
          editorInstance.executeEdits("ai-chat-apply-merged-file", [
            { range: fullRange, text: pending.content, forceMoveMarkers: true },
          ])
          editorInstance.pushUndoStop()
        } else {
          model.setValue(pending.content)
        }

        updateFileDraft(pending.filePath, pending.content)
        pending.resolve()
      } catch (error) {
        pending.reject(error)
      } finally {
        if (!isCancelled) {
          pendingPreviewApplyRef.current = null
          isProcessingQueueRef.current = false
          processNextInQueue()
        }
      }
    }
    applyMergedCode()
    return () => {
      isCancelled = true
    }
  }, [
    activeTab?.id,
    pendingApplyTick,
    waitForEditorModel,
    processNextInQueue,
    updateFileDraft,
  ])

  // --- Helper: Diff Session Logic ---
  const applyKeepToSession = (session: {
    combinedText: string
    unresolvedBlocks: {
      type: "added" | "removed"
      start: number
      end: number
    }[]
  }) => {
    const lines = session.combinedText.split("\n")
    const rangesToRemove: { start: number; end: number }[] = []

    session.unresolvedBlocks.forEach((block) => {
      if (block.type === "removed") {
        rangesToRemove.push({ start: block.start, end: block.end })
      }
    })

    rangesToRemove.sort((a, b) => b.start - a.start)

    rangesToRemove.forEach((range) => {
      // 1-based index to 0-based
      lines.splice(range.start - 1, range.end - range.start + 1)
    })

    return lines.join("\n")
  }

  const applyRejectToSession = (session: {
    combinedText: string
    unresolvedBlocks: {
      type: "added" | "removed"
      start: number
      end: number
    }[]
  }) => {
    const lines = session.combinedText.split("\n")
    const rangesToRemove: { start: number; end: number }[] = []

    // For "Reject" (Reject Remaining):
    // - Remove lines from "added" blocks (reject addition)
    // - Keep lines from "removed" blocks (reject deletion -> keep original)
    session.unresolvedBlocks.forEach((block) => {
      if (block.type === "added") {
        rangesToRemove.push({ start: block.start, end: block.end })
      }
    })

    // Sort ranges descending to remove successfully
    rangesToRemove.sort((a, b) => b.start - a.start)

    rangesToRemove.forEach((range) => {
      // 1-based index to 0-based
      lines.splice(range.start - 1, range.end - range.start + 1)
    })

    return lines.join("\n")
  }

  const getDiffSession = useAppStore((s) => s.getDiffSession)
  const clearDiffSession = useAppStore((s) => s.clearDiffSession)

  const applyPrecomputedMerge = useCallback(
    ({ filePath, mergedCode }: ApplyMergedFileArgs) => {
      const normalizedPath = normalizePath(filePath)
      const session = getDiffSession(normalizedPath)

      let contentToApply = mergedCode

      // If we have a diff session with unresolved blocks, applying "Keep" means
      // we should apply the logic to the *session state*, not the raw merged code.
      if (session && session.unresolvedBlocks.length > 0) {
        try {
          contentToApply = applyKeepToSession(session)
          // Clear session after applying because we are fully resolving it
          clearDiffSession(normalizedPath)
        } catch (error) {
          console.error("Failed to apply session keep logic:", error)
        }
      }

      return enqueueFileContentUpdate(filePath, contentToApply)
    },
    [enqueueFileContentUpdate, getDiffSession, clearDiffSession],
  )

  const restoreOriginalFile = useCallback(
    ({ filePath, originalCode }: ApplyMergedFileArgs) => {
      const normalizedPath = normalizePath(filePath)
      const session = getDiffSession(normalizedPath)

      let contentToApply = originalCode

      // If we have a diff session, applying "Reject" means we should reject
      // the remaining changes in the session, preserving what was already accepted/rejected/original.
      if (session && session.unresolvedBlocks.length > 0) {
        try {
          contentToApply = applyRejectToSession(session)
          // Clear session after resolving
          clearDiffSession(normalizedPath)
        } catch (error) {
          console.error("Failed to apply session reject logic:", error)
        }
      }

      return enqueueFileContentUpdate(filePath, contentToApply)
    },
    [enqueueFileContentUpdate, getDiffSession, clearDiffSession],
  )

  return {
    getCurrentFileContent,
    precomputeMergeForFile,
    handleApplyCodeFromChat,
    applyPrecomputedMerge,
    restoreOriginalFile,
    openFile,
  }
}
