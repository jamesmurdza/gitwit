"use client"

import { mergeCode } from "@/app/actions/ai"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useEditorLayout } from "@/context/EditorLayoutContext"
import { fileRouter } from "@/lib/api"
import { defaultEditorOptions } from "@/lib/monaco/config"
import { TTab } from "@/lib/types"
import { processFileType, sortFileExplorer } from "@/lib/utils"
import { useAppStore } from "@/store/context"
import Editor from "@monaco-editor/react"
import { FileJson, TerminalSquare } from "lucide-react"
import * as monaco from "monaco-editor"
import { useTheme } from "next-themes"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { ImperativePanelHandle } from "react-resizable-panels"
import Tab from "../ui/tab"
import AIEditElements from "./ai-edit/ai-edit-elements"
import { SessionTimeoutDialog } from "./alerts/session-timeout-dialog"
import { AIChat } from "./chat"
import type {
  ApplyMergedFileArgs,
  FileMergeResult,
  PrecomputeMergeArgs,
} from "./chat/lib/types"
import { normalizePath, pathMatchesTab } from "./chat/lib/utils"
import { ChatProvider } from "./chat/providers/chat-provider"
import { useCodeDiffer } from "./hooks/useCodeDiffer"
import { useDiffSessionManager } from "./hooks/useDiffSessionManager"
import { useEditorSocket } from "./hooks/useEditorSocket"
import { useMonacoEditor } from "./hooks/useMonacoEditor"
import PreviewWindow from "./preview"
import Terminals from "./terminals"
export interface ProjectLayoutProps {
  isOwner: boolean
  projectName: string
  projectType: string
}

/**
 * Main editor layout component that handles the resizable panels structure,
 * Monaco editor, preview window, terminals, and AI chat
 */
export default function ProjectLayout({
  isOwner,
  projectName,
  projectType,
}: ProjectLayoutProps) {
  const { id: projectId } = useParams<{ id: string }>()
  const { resolvedTheme: theme } = useTheme()
  // Store States
  const tabs = useAppStore((s) => s.tabs)
  const activeTab = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const removeTab = useAppStore((s) => s.removeTab)
  const saveDiffSession = useAppStore((s) => s.saveDiffSession)
  const getDiffSession = useAppStore((s) => s.getDiffSession)
  const clearDiffSession = useAppStore((s) => s.clearDiffSession)
  const setEditorRef = useAppStore((s) => s.setEditorRef)
  const draft = useAppStore((s) => s.drafts[activeTab?.id ?? ""])
  const setDraft = useAppStore((s) => s.setDraft)
  const getDraft = useAppStore((s) => s.getDraft)
  const editorLanguage = activeTab?.name
    ? processFileType(activeTab.name)
    : "plaintext"

  const { data: serverActiveFile = "" } = fileRouter.fileContent.useQuery({
    enabled: !!activeTab?.id,
    variables: {
      fileId: activeTab?.id ?? "",
      projectId,
    },
    select(data) {
      return data.data
    },
  })

  const activeFileContent = draft === undefined ? serverActiveFile : draft
  // Layout refs
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const editorPanelRef = useRef<ImperativePanelHandle>(null)
  const previewWindowRef = useRef<{ refreshIframe: () => void }>(null)

  // Apply Button merger decoration state
  const [mergeDecorationsCollection, setMergeDecorationsCollection] =
    useState<monaco.editor.IEditorDecorationsCollection>()
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

  // Editor layout and state management
  const {
    isHorizontalLayout,
    isPreviewCollapsed,
    isAIChatOpen,
    previewURL,
    togglePreviewPanel,
    toggleLayout,
    toggleAIChat,
    loadPreviewURL,
    setIsAIChatOpen,
    setIsPreviewCollapsed,
    previewPanelRef,
  } = useEditorLayout()

  const { data: fileTree = [] } = fileRouter.fileTree.useQuery({
    variables: {
      projectId,
    },
    select(data) {
      return sortFileExplorer(data.data ?? [])
    },
  })

  useEditorSocket({
    loadPreviewURL,
  })

  // Monaco editor management
  const {
    editorRef,
    cursorLine,
    isSelected,
    showSuggestion,
    generate,
    setGenerate,
    generateRef,
    suggestionRef,
    generateWidgetRef,
    lastCopiedRangeRef,
    handleEditorWillMount,
    handleEditorMount,
    handleAiEdit,
  } = useMonacoEditor({
    editorPanelRef,
    setIsAIChatOpen,
  })

  // Keep a ref to editorRef so callbacks can access the latest value
  const editorRefRef = useRef(editorRef)
  useEffect(() => {
    editorRefRef.current = editorRef
  }, [editorRef])

  // Set editor ref in store so sidebar can access it
  useEffect(() => {
    if (editorRef) {
      setEditorRef(editorRef)
    }
  }, [editorRef, setEditorRef])

  // Code diff and merge logic
  const {
    handleApplyCode,
    hasActiveWidgets,
    forceClearAllDecorations,
    getUnresolvedSnapshot,
    restoreFromSnapshot,
    clearVisuals,
  } = useCodeDiffer({
    editorRef: editorRef || null,
  })

  // Use the session manager for tab switching
  const { handleSetActiveTab: handleSetActiveTabWithSession } =
    useDiffSessionManager(
      hasActiveWidgets,
      getUnresolvedSnapshot,
      restoreFromSnapshot,
      clearVisuals,
      forceClearAllDecorations
    )

  // Store diff functions so sidebar can use them
  const setDiffFunctions = useAppStore((s) => s.setDiffFunctions)
  useEffect(() => {
    setDiffFunctions({
      hasActiveWidgets,
      getUnresolvedSnapshot,
      restoreFromSnapshot,
      clearVisuals,
      forceClearAllDecorations,
    })
  }, [
    hasActiveWidgets,
    getUnresolvedSnapshot,
    restoreFromSnapshot,
    clearVisuals,
    forceClearAllDecorations,
    setDiffFunctions,
  ])

  // Wrapper for handleApplyCode to manage decorations collection state
  const handleApplyCodeWithDecorations = useCallback(
    (mergedCode: string, originalCode: string) => {
      const decorationsCollection = handleApplyCode(mergedCode, originalCode)
      if (decorationsCollection) {
        setMergeDecorationsCollection(decorationsCollection)
      }
    },
    [handleApplyCode]
  )

  const updateFileDraft = useCallback(
    (fileId: string, content?: string) => {
      setDraft(fileId, content ?? "")
    },
    [setDraft]
  )

  const handleEditorChange = useCallback(
    (value?: string) => {
      if (!activeTab?.id) {
        return
      }
      updateFileDraft(activeTab.id, value)
    },
    [activeTab?.id, updateFileDraft]
  )

  const waitForEditorModel = useCallback(async () => {
    if (!activeTab?.id) {
      return null
    }

    const editorRefMaxAttempts = 100
    const delayMs = 50
    const uri = monaco.Uri.parse(activeTab.id)

    for (let attempt = 0; attempt < editorRefMaxAttempts; attempt++) {
      // Check the ref which always has the latest value
      const currentEditorRef = editorRefRef.current
      if (currentEditorRef) {
        const maxAttempts = 60

        for (let modelAttempt = 0; modelAttempt < maxAttempts; modelAttempt++) {
          // Try getting model from editor first
          let model = currentEditorRef.getModel()

          // If not found, try getting it by URI (might be created but not set yet)
          if (!model) {
            model = monaco.editor.getModel(uri)
          }

          // Verify the model is set on the editor and matches the expected URI
          if (model) {
            const editorModel = currentEditorRef.getModel()
            if (
              editorModel === model &&
              model.uri.toString() === uri.toString()
            ) {
              return model
            }
            // If model exists in registry but not on editor yet, wait a bit more
            // @monaco-editor/react should set it automatically
            if (modelAttempt % 10 === 0) {
            }
          } else if (modelAttempt % 10 === 0) {
          }

          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }

        // If we got here, the editor exists but model never appeared
        // This might mean the Editor component hasn't fully initialized
        return null
      }

      // Editor not mounted yet, wait and retry
      if (attempt % 20 === 0) {
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }

    // Editor never mounted
    return null
  }, [activeTab?.id])

  const precomputeMergeForFile = useCallback(
    async ({
      filePath,
      code,
    }: PrecomputeMergeArgs): Promise<FileMergeResult> => {
      const normalizedPath = normalizePath(filePath)
      let originalCode = ""

      if (projectId) {
        try {
          const response = await fileRouter.fileContent.fetcher({
            fileId: normalizedPath,
            projectId,
          })
          originalCode = response?.data ?? ""
        } catch (error) {
          console.warn(
            "Failed to fetch original file content for merge:",
            error
          )
        }
      }

      try {
        const mergedCode = await mergeCode(
          code,
          originalCode,
          normalizedPath.split("/").pop() || normalizedPath,
          projectId
        )
        return { mergedCode, originalCode }
      } catch (error) {
        console.error("Auto-merge failed:", error)
        return { mergedCode: code, originalCode }
      }
    },
    [projectId]
  )

  // Get current file content (from draft or server)
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
    [projectId, getDraft]
  )

  // Handler for applying code from chat
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
          filePath: string
        ) =>
          | { status: string; result?: FileMergeResult; error?: string }
          | undefined
      }
    ) => {
      if (!activeTab) {
        return
      }
      try {
        const normalizedPath = normalizePath(activeTab.id)
        const mergeStatus = options?.mergeStatuses?.[normalizedPath]

        // Check if there's a precomputed merge
        if (mergeStatus?.status === "ready" && mergeStatus.result) {
          // Check if current content matches the original code used in merge
          if (options?.getCurrentFileContent) {
            try {
              const currentContent = await Promise.resolve(
                options.getCurrentFileContent(normalizedPath)
              )
              if (currentContent === mergeStatus.result.originalCode) {
                // Content matches, use precomputed merge
                const model = await waitForEditorModel()
                if (model) {
                  handleApplyCodeWithDecorations(
                    mergeStatus.result.mergedCode,
                    mergeStatus.result.originalCode
                  )
                  return
                }
              }
            } catch (error) {
              console.warn("Failed to check current file content:", error)
              // Fall through to recalculate
            }
          }
        } else if (mergeStatus?.status === "pending") {
          // Wait for merge to complete
          let waited = 0
          const maxWait = 10000 // 10 seconds max
          const pollInterval = 100 // Check every 100ms

          while (waited < maxWait) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval))
            waited += pollInterval

            // Re-check merge status using the getter function
            const updatedStatus = options?.getMergeStatus?.(normalizedPath)
            if (updatedStatus?.status === "ready" && updatedStatus.result) {
              // Merge completed, check content and use it
              if (options?.getCurrentFileContent) {
                try {
                  const currentContent = await Promise.resolve(
                    options.getCurrentFileContent(normalizedPath)
                  )
                  if (currentContent === updatedStatus.result.originalCode) {
                    const model = await waitForEditorModel()
                    if (model) {
                      handleApplyCodeWithDecorations(
                        updatedStatus.result.mergedCode,
                        updatedStatus.result.originalCode
                      )
                      return
                    }
                  }
                } catch (error) {
                  console.warn("Failed to check current file content:", error)
                }
              }
              // Content changed or check failed, fall through to recalculate
              break
            } else if (updatedStatus?.status === "error") {
              // Merge failed, recalculate
              break
            }
          }
        }

        let originalCode = activeFileContent

        // When the file is opened for the first time, the content may still be loading.
        // If we don't have the original code yet, fetch it directly before merging.
        if (!originalCode && activeTab.id && projectId) {
          try {
            const response = await fileRouter.fileContent.fetcher({
              fileId: activeTab.id,
              projectId,
            })
            const fetchedContent = response?.data ?? ""
            if (fetchedContent) {
              originalCode = fetchedContent
              updateFileDraft(activeTab.id, fetchedContent)
            }
          } catch (fetchError) {
            console.warn("Failed to fetch original file content:", fetchError)
          }
        }

        // Wait for the Monaco editor model to be ready before applying the diff
        // This is especially important when opening a file for the first time
        const model = await waitForEditorModel()
        if (!model) {
          return
        }

        // First, merge the partial code with the original using aider diff
        const mergedCode = await mergeCode(
          code,
          originalCode,
          activeTab.name,
          projectId
        )

        // Then apply the diff view with the merged code
        handleApplyCodeWithDecorations(mergedCode, originalCode)
      } catch (error) {
        console.error("📝 Apply Code - Failed to merge code:", error)
        // Fallback: apply the partial code directly
        const originalCode = activeFileContent
        handleApplyCodeWithDecorations(code, originalCode)
      }
    },
    [
      activeTab,
      activeFileContent,
      handleApplyCodeWithDecorations,
      projectId,
      updateFileDraft,
      waitForEditorModel,
    ]
  )

  // Handler for rejecting code from chat
  const handleRejectCodeFromChat = useCallback(() => {
    // Clear any existing decorations
    if (mergeDecorationsCollection) {
      mergeDecorationsCollection.clear()
      setMergeDecorationsCollection(undefined)
    }
  }, [mergeDecorationsCollection])

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

    const matchBy = (tab: TTab) => pathMatchesTab(next.filePath, tab)
    let targetTab = tabs.find(matchBy)
    if (!targetTab) {
      targetTab = {
        id: next.filePath,
        name: next.filePath.split("/").pop() || next.filePath,
        type: "file",
        saved: true,
      }
    }

    const isAlreadyActive = activeTab ? matchBy(activeTab) : false
    if (!isAlreadyActive) {
      setActiveTab(targetTab)
    }
  }, [activeTab, setActiveTab, tabs])

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
    [processNextInQueue]
  )

  const applyPrecomputedMerge = useCallback(
    ({ filePath, mergedCode }: ApplyMergedFileArgs) => {
      return enqueueFileContentUpdate(filePath, mergedCode)
    },
    [enqueueFileContentUpdate]
  )

  const restoreOriginalFile = useCallback(
    ({ filePath, originalCode }: ApplyMergedFileArgs) => {
      return enqueueFileContentUpdate(filePath, originalCode)
    },
    [enqueueFileContentUpdate]
  )

  useEffect(() => {
    const pending = pendingPreviewApplyRef.current
    if (!pending) {
      return
    }
    if (!activeTab || !pathMatchesTab(pending.filePath, activeTab)) {
      return
    }

    let isCancelled = false
    const applyMergedCode = async () => {
      try {
        const model = await waitForEditorModel()
        if (!model || isCancelled) {
          throw new Error("Editor not ready")
        }
        const editorInstance = editorRefRef.current
        const fullRange = model.getFullModelRange()

        if (editorInstance) {
          editorInstance.pushUndoStop()
          editorInstance.executeEdits("ai-chat-apply-merged-file", [
            {
              range: fullRange,
              text: pending.content,
              forceMoveMarkers: true,
            },
          ])
          editorInstance.pushUndoStop()
        } else {
          model.setValue(pending.content)
        }

        updateFileDraft(pending.filePath, pending.content)

        if (mergeDecorationsCollection) {
          mergeDecorationsCollection.clear()
          setMergeDecorationsCollection(undefined)
        }

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
    activeTab?.name,
    mergeDecorationsCollection,
    pendingApplyTick,
    setMergeDecorationsCollection,
    updateFileDraft,
    waitForEditorModel,
    processNextInQueue,
  ])

  // Close tab with snapshot if closing the active tab with unresolved diffs
  const handleCloseTab = useCallback(
    (tab: TTab) => {
      const isClosingActive = activeTab?.id === tab.id
      if (isClosingActive && hasActiveWidgets()) {
        try {
          const session = getUnresolvedSnapshot(tab.id)
          if (session) {
            saveDiffSession(tab.id, session)
          }
        } catch (error) {
          console.warn("Failed to snapshot unresolved diffs on close:", error)
        }
        // Clear widgets before closing the tab
        try {
          clearVisuals()
        } catch (error) {
          forceClearAllDecorations()
        }
      }
      removeTab(tab)
    },
    [
      activeTab?.id,
      hasActiveWidgets,
      getUnresolvedSnapshot,
      saveDiffSession,
      clearVisuals,
      forceClearAllDecorations,
      removeTab,
    ]
  )

  // Use the session manager for tab switching
  const handleSetActiveTab = handleSetActiveTabWithSession

  // Bridge to allow diff hook to clear saved session when all widgets are gone
  useEffect(() => {
    ;(window as any).__clearDiffSession = (fileId: string) => {
      try {
        const session = getDiffSession(fileId)
        if (session) {
          // remove only if it matches current active or by id
          clearDiffSession(fileId)
        }
      } catch {}
    }
    return () => {
      try {
        delete (window as any).__clearDiffSession
      } catch {}
    }
  }, [getDiffSession, clearDiffSession])

  return (
    <ChatProvider
      {...{
        fileTree,
        activeFileContent,
        activeFileName: activeTab?.name ?? "",
        projectName,
        projectType,
      }}
    >
      <ResizablePanelGroup
        direction={isHorizontalLayout ? "horizontal" : "vertical"}
      >
        <ResizablePanel defaultSize={isAIChatOpen ? 80 : 100} minSize={50}>
          <ResizablePanelGroup
            direction={isHorizontalLayout ? "vertical" : "horizontal"}
          >
            {/* Editor Panel */}
            <ResizablePanel
              className="p-2 flex flex-col"
              maxSize={80}
              minSize={30}
              defaultSize={70}
              ref={editorPanelRef}
            >
              {/* Tabs */}
              <div className="pb-2 w-full flex gap-2 overflow-x-auto tab-scroll">
                {tabs.map((tab) => (
                  <Tab
                    key={tab.id}
                    saved={tab.saved}
                    selected={activeTab?.id === tab.id}
                    onClick={() => handleSetActiveTab(tab)}
                    onClose={() => handleCloseTab(tab)}
                  >
                    {tab.name}
                  </Tab>
                ))}
              </div>

              {/* Monaco Editor Container */}
              <div
                ref={editorContainerRef}
                className="grow w-full overflow-hidden rounded-md relative"
              >
                {!activeTab?.id ? (
                  <div className="w-full h-full flex items-center justify-center text-xl font-medium text-muted-foreground/50 select-none">
                    <FileJson className="w-6 h-6 mr-3" />
                    No file selected.
                  </div>
                ) : (
                  <>
                    <Editor
                      height="100%"
                      language={editorLanguage}
                      beforeMount={handleEditorWillMount}
                      onMount={handleEditorMount}
                      path={activeTab.id}
                      onChange={handleEditorChange}
                      theme={theme === "light" ? "vs" : "vs-dark"}
                      options={defaultEditorOptions}
                      value={activeFileContent}
                    />
                    <AIEditElements
                      editorRef={editorRef}
                      cursorLine={cursorLine}
                      isSelected={isSelected}
                      showSuggestion={showSuggestion}
                      generate={generate}
                      setGenerate={setGenerate}
                      generateRef={generateRef}
                      suggestionRef={suggestionRef}
                      generateWidgetRef={generateWidgetRef}
                      handleAiEdit={handleAiEdit}
                      tabs={tabs}
                      activeFileId={activeTab.id}
                      editorLanguage={editorLanguage}
                      projectId={projectId}
                      projectName={projectName}
                    />
                  </>
                )}
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Preview & Terminal Panel */}
            <ResizablePanel defaultSize={30}>
              <ResizablePanelGroup
                direction={
                  isAIChatOpen && isHorizontalLayout
                    ? "horizontal"
                    : isAIChatOpen
                    ? "vertical"
                    : isHorizontalLayout
                    ? "horizontal"
                    : "vertical"
                }
              >
                {/* Preview Panel */}
                <ResizablePanel
                  ref={previewPanelRef}
                  defaultSize={isPreviewCollapsed ? 4 : 20}
                  minSize={25}
                  collapsedSize={isHorizontalLayout ? 20 : 4}
                  className="p-2 flex flex-col gap-2"
                  collapsible
                  onCollapse={() => setIsPreviewCollapsed(true)}
                  onExpand={() => setIsPreviewCollapsed(false)}
                >
                  <PreviewWindow
                    open={togglePreviewPanel}
                    collapsed={isPreviewCollapsed}
                    src={previewURL}
                    ref={previewWindowRef}
                    toggleLayout={toggleLayout}
                    isHorizontal={isHorizontalLayout}
                    isAIChatOpen={isAIChatOpen}
                  />
                </ResizablePanel>

                <ResizableHandle />

                {/* Terminal Panel */}
                <ResizablePanel
                  defaultSize={50}
                  minSize={20}
                  className="p-2 flex flex-col"
                >
                  {isOwner ? (
                    <Terminals />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-medium text-muted-foreground/50 select-none">
                      <TerminalSquare className="w-4 h-4 mr-2" />
                      No terminal access.
                    </div>
                  )}
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        {/* AI Chat Panel */}
        {isAIChatOpen && (
          <>
            <ResizableHandle />
            <ResizablePanel defaultSize={30} minSize={15}>
              <AIChat
                onApplyCode={handleApplyCodeFromChat}
                onRejectCode={handleRejectCodeFromChat}
                precomputeMergeForFile={precomputeMergeForFile}
                applyPrecomputedMerge={applyPrecomputedMerge}
                restoreOriginalFile={restoreOriginalFile}
                getCurrentFileContent={getCurrentFileContent}
              />
            </ResizablePanel>
          </>
        )}
        {/* Session Timeout Dialog */}
        <SessionTimeoutDialog isOwner={isOwner} />
      </ResizablePanelGroup>
    </ChatProvider>
  )
}
