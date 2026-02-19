import { apiClient } from "@/server/client"
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
import { applyKeepToSession, applyRejectToSession } from "./lib/diff-session-utils"
import { resolveMergeResult } from "./lib/merge-resolver"

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
    targetFileId?: string,
  ) => unknown
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

  const pendingDiffsQueueRef = useRef<Map<string, any>>(new Map())
  const pendingApplyReadyRef = useRef<
    Map<string, { mergedCode: string; originalCode: string }>
  >(new Map())
  const [retryApplyTick, setRetryApplyTick] = useState(0)
  const retryCountRef = useRef(0)

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

      const originalCode = await getCurrentFileContent(normalizedPath)

      try {
        const res = await apiClient.ai["merge-code"].$post({
          json: {
            partialCode: code,
            originalCode,
            fileName: normalizedPath.split("/").pop() || normalizedPath,
            projectId,
          },
        })
        if (!res.ok) {
          throw new Error("Merge request failed")
        }
        const { mergedCode } = await res.json()
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
        targetFilePath?: string
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
      // Determine target file path
      const targetFilePath = options?.targetFilePath
      const normalizedTargetPath = targetFilePath
        ? normalizePath(targetFilePath)
        : null

      let targetTab: TTab | undefined

      if (normalizedTargetPath) {
        const matchBy = (tab: TTab) => pathMatchesTab(normalizedTargetPath, tab)
        targetTab = tabs.find(matchBy)

        // If tab doesn't exist, create it
        if (!targetTab) {
          const fileName =
            normalizedTargetPath.split("/").pop() || normalizedTargetPath
          targetTab = {
            id: normalizedTargetPath,
            name: fileName,
            type: "file",
            saved: true,
          }
        }

        // Get current activeTab from tabs array (more reliable than closure)
        const currentActiveTab =
          tabs.find((t) => t.id === activeTab?.id) || activeTab
        // Check if target tab is currently active (compare with current activeTab)
        const isTargetActive = currentActiveTab
          ? matchBy(currentActiveTab)
          : false

        if (!isTargetActive) {
          pendingDiffsQueueRef.current.set(normalizedTargetPath, {
            code,
            language,
            options: {
              ...options,
              targetFilePath: normalizedTargetPath,
            },
          })
          // Open and activate the target file (openFile handles tab creation and activation)
          openFile(normalizedTargetPath)
          return
        }
      } else {
        // No target path specified, use active tab
        targetTab = activeTab
      }

      if (!targetTab) {
        return
      }

      // Use target path if provided, otherwise use target tab
      const targetPath = normalizedTargetPath || normalizePath(targetTab.id)
      try {
        const mergeResult = await resolveMergeResult(
          targetPath,
          code,
          targetTab.name,
          projectId,
          getCurrentFileContent,
          options,
        )

        // Apply to Editor
        if (mergeResult) {
          const applied = handleApplyCodeWithDecorations(
            mergeResult.mergedCode,
            mergeResult.originalCode,
            targetTab.id,
          )
          // If editor wasn't ready (e.g. newly created file tab still loading), queue for retry
          if (applied === null) {
            pendingApplyReadyRef.current.set(targetTab.id, {
              mergedCode: mergeResult.mergedCode,
              originalCode: mergeResult.originalCode,
            })
            retryCountRef.current = 0
            setRetryApplyTick((t) => t + 1)
          }
        }
      } catch (error) {
        console.error("[ai-file-actions] Apply Code Failed:", error)
        // Fallback
        const original = await getCurrentFileContent(targetTab.id)
        handleApplyCodeWithDecorations(code, original)
      }
    },
    [
      activeTab,
      tabs,
      setActiveTab,
      openFile,
      projectId,
      getCurrentFileContent,
      waitForEditorModel,
      handleApplyCodeWithDecorations,
    ],
  )

  // Retry pending diffs when active tab changes; also retry ready-to-apply when editor mounts
  useEffect(() => {
    if (!activeTab?.id) return

    const normalizedPath = normalizePath(activeTab.id)

    // First try ready-to-apply (editor was not ready on first attempt)
    const ready = pendingApplyReadyRef.current.get(normalizedPath)
    if (ready) {
      const applied = handleApplyCodeWithDecorations(
        ready.mergedCode,
        ready.originalCode,
        normalizedPath,
      )
      if (applied !== null) {
        pendingApplyReadyRef.current.delete(normalizedPath)
        retryCountRef.current = 0
      } else if (retryCountRef.current < 5) {
        retryCountRef.current += 1
        const id = setTimeout(() => setRetryApplyTick((t) => t + 1), 150)
        return () => clearTimeout(id)
      } else {
        pendingApplyReadyRef.current.delete(normalizedPath)
        retryCountRef.current = 0
      }
    }

    // Then process queue (tab switch case)
    const pending = pendingDiffsQueueRef.current.get(normalizedPath)
    if (pending) {
      pendingDiffsQueueRef.current.delete(normalizedPath)
      handleApplyCodeFromChat(pending.code, pending.language, pending.options)
    }
  }, [
    activeTab?.id,
    handleApplyCodeFromChat,
    handleApplyCodeWithDecorations,
    retryApplyTick,
  ])

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

  const getDiffSession = useAppStore((s) => s.getDiffSession)
  const clearDiffSession = useAppStore((s) => s.clearDiffSession)

  // Shared: resolve diff session and apply content update
  const resolveAndEnqueue = useCallback(
    (
      filePath: string,
      fallbackCode: string,
      sessionTransform: (session: any) => string,
      errorLabel: string,
    ) => {
      const normalizedPath = normalizePath(filePath)
      const session = getDiffSession(normalizedPath)

      let contentToApply = fallbackCode
      if (session && session.unresolvedBlocks.length > 0) {
        try {
          contentToApply = sessionTransform(session)
          clearDiffSession(normalizedPath)
        } catch (error) {
          console.error(`Failed to apply session ${errorLabel} logic:`, error)
        }
      }

      return enqueueFileContentUpdate(filePath, contentToApply)
    },
    [enqueueFileContentUpdate, getDiffSession, clearDiffSession],
  )

  const applyPrecomputedMerge = useCallback(
    ({ filePath, mergedCode }: ApplyMergedFileArgs) =>
      resolveAndEnqueue(filePath, mergedCode, applyKeepToSession, "keep"),
    [resolveAndEnqueue],
  )

  const restoreOriginalFile = useCallback(
    ({ filePath, originalCode }: ApplyMergedFileArgs) =>
      resolveAndEnqueue(filePath, originalCode, applyRejectToSession, "reject"),
    [resolveAndEnqueue],
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
