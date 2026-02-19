import { useEditor } from "@/context/editor-context"
import { useProjectContext } from "@/context/project-context"
import { TTab } from "@/lib/types"
import { useAppStore } from "@/store/context"
import { useCallback } from "react"
import { ApplyMergedFileArgs } from "../../chat/lib/types"
import { findPanelByPath, normalizePath } from "../../chat/lib/utils"
import { useAIFileActions } from "../../hooks/useAIFileActions"

/**
 * Hook to track active editor panel and provide chat handlers
 * This bridges the new Dockview layout with the existing chat/diff functionality
 */
export function useChatPanelHandlers() {
  const { dockRef, getHandlers } = useEditor()
  const {
    project: { id: projectId },
  } = useProjectContext()
  // Source of truth for activeTab + tabs: editor store
  const activeTab = useAppStore((s) => s.activeTab)
  const tabs = useAppStore((s) => s.tabs)
  const storeSetActiveTab = useAppStore((s) => s.setActiveTab)
  const activeFileId = activeTab?.id ?? null

  // setActiveTab adapter - activates panel in Dockview (reuse existing panel if same file)
  const setActiveTab = useCallback(
    (tab: TTab) => {
      // Update editor store's active tab
      storeSetActiveTab(tab)

      const dock = dockRef.current
      if (!dock) return
      // Prefer exact id, then find by path so we don't open a duplicate tab
      const panel = dock.getPanel(tab.id) ?? findPanelByPath(dock, tab.id)
      if (panel) {
        panel.api.setActive()
      } else {
        dock.addPanel({
          id: tab.id,
          component: "editor",
          title: tab.name,
          tabComponent: "editor",
        })
      }
    },
    [dockRef, storeSetActiveTab],
  )

  // Get handlers for active file
  const activeHandlers = activeFileId ? getHandlers(activeFileId) : undefined

  // Get current editor ref from handlers
  const editorRef = activeHandlers?.editorRef || undefined

  // waitForEditorModel adapter - can accept optional fileId to get model for specific file
  const waitForEditorModel = useCallback(
    async (fileId?: string) => {
      const fileIdToUse = fileId || activeFileId
      if (!fileIdToUse) return null

      const handlers = getHandlers(fileIdToUse)
      const editor = handlers?.editorRef

      if (editor) {
        const model = editor.getModel()
        if (model) return model
      }

      return null
    },
    [activeFileId, getHandlers],
  )

  // handleApplyCodeWithDecorations adapter - applies diff to active editor
  // Can optionally accept a targetFileId to apply diff to a specific file
  const handleApplyCodeWithDecorations = useCallback(
    (mergedCode: string, originalCode: string, targetFileId?: string) => {
      // Use provided targetFileId, or fall back to activeFileId
      const fileIdToUse = targetFileId || activeFileId
      if (!fileIdToUse) {
        return null
      }

      const handlers = getHandlers(fileIdToUse)
      if (handlers?.handleApplyCode) {
        return handlers.handleApplyCode(mergedCode, originalCode)
      }
      return null
    },
    [activeFileId, getHandlers],
  )

  // updateFileDraft adapter - get setDraft from store
  const setDraft = useAppStore((s) => s.setDraft)
  const updateFileDraft = useCallback(
    (fileId: string, content?: string) => {
      setDraft(fileId, content ?? "")
    },
    [setDraft],
  )

  // Wire useAIFileActions with adapters
  const {
    getCurrentFileContent,
    precomputeMergeForFile,
    handleApplyCodeFromChat,
    openFile,
  } = useAIFileActions({
    projectId,
    activeTab,
    tabs,
    setActiveTab,
    editorRef,
    waitForEditorModel,
    handleApplyCodeWithDecorations,
    updateFileDraft,
  })

  const forceClearAllDecorations = useCallback(() => {
    activeHandlers?.forceClearAllDecorations()
  }, [activeHandlers])

  // Smart apply/reject that uses active handlers
  const applyPrecomputedMerge = useCallback(
    async (args: ApplyMergedFileArgs) => {
      const normalizedTargetPath = normalizePath(args.filePath)
      // Get handlers for the target file (not just active file)
      const targetHandlers = getHandlers(normalizedTargetPath)
      const targetHasWidgets = targetHandlers?.hasActiveWidgets() || false

      // Smart Keep: If there are active widgets on the target file, "Keep" means "Accept All Remaining"
      if (targetHasWidgets && targetHandlers) {
        targetHandlers.acceptAll()
        // Only clear decorations if this is the active file
        if (activeFileId === normalizedTargetPath) {
          forceClearAllDecorations()
        }
        return
      }

      updateFileDraft(normalizedTargetPath, args.mergedCode)
      // Only clear decorations if this is the active file
      if (activeFileId === normalizedTargetPath) {
        forceClearAllDecorations()
      }
    },
    [activeFileId, getHandlers, updateFileDraft, forceClearAllDecorations],
  )

  const restoreOriginalFile = useCallback(
    async (args: ApplyMergedFileArgs) => {
      const normalizedTargetPath = normalizePath(args.filePath)

      // Get handlers for the target file (not just active file)
      const targetHandlers = getHandlers(normalizedTargetPath)
      const targetHasWidgets = targetHandlers?.hasActiveWidgets() || false

      // Smart Reject: If there are active widgets on the target file, "Reject" means "Reject All Remaining"
      if (targetHasWidgets && targetHandlers) {
        targetHandlers.rejectAll()
        // Only clear decorations if this is the active file
        if (activeFileId === normalizedTargetPath) {
          forceClearAllDecorations()
        }
        return
      }

      updateFileDraft(normalizedTargetPath, args.originalCode)
      // Only clear decorations if this is the active file
      if (activeFileId === normalizedTargetPath) {
        forceClearAllDecorations()
      }
    },
    [activeFileId, getHandlers, updateFileDraft, forceClearAllDecorations],
  )

  // Handler for rejecting code from chat
  const handleRejectCodeFromChat = useCallback(() => {
    forceClearAllDecorations()
  }, [forceClearAllDecorations])

  // onOpenFile adapter - opens/activates editor panel (reuse existing panel if same file)
  const onOpenFile = useCallback(
    (filePath: string) => {
      // 1) Let useAIFileActions manage tabs + activeTab + pending diff queue
      openFile(filePath)

      const dock = dockRef.current
      if (!dock) return
      const normalizedPath = normalizePath(filePath)
      const panel =
        dock.getPanel(normalizedPath) ?? findPanelByPath(dock, normalizedPath)
      if (panel) {
        panel.api.setActive()
      } else {
        const fileName = normalizedPath.split("/").pop() || normalizedPath
        dock.addPanel({
          id: normalizedPath,
          component: "editor",
          title: fileName,
          tabComponent: "editor",
        })
      }
    },
    [dockRef, openFile],
  )

  // Wrap onApplyCode to add logging
  const onApplyCode = useCallback(
    (
      code: string,
      language?: string,
      options?: Parameters<typeof handleApplyCodeFromChat>[2],
    ) => {
      return handleApplyCodeFromChat(code, language, options)
    },
    [handleApplyCodeFromChat, activeFileId, activeTab, activeHandlers],
  )

  return {
    onApplyCode,
    onRejectCode: handleRejectCodeFromChat,
    precomputeMergeForFile,
    applyPrecomputedMerge,
    restoreOriginalFile,
    getCurrentFileContent,
    onOpenFile,
  }
}
