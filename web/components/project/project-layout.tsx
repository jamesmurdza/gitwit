"use client"

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
import { useCallback, useRef, useState } from "react"
import { ImperativePanelHandle } from "react-resizable-panels"
import Tab from "../ui/tab"
import AIEditElements from "./ai-edit/ai-edit-elements"
import { SessionTimeoutDialog } from "./alerts/session-timeout-dialog"
import { AIChat } from "./chat"
import { ChatProvider } from "./chat/providers/chat-provider"
import { useCodeDiffer } from "./hooks/useCodeDiffer"
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
  const draft = useAppStore((s) => s.drafts[activeTab?.id ?? ""])
  const setDraft = useAppStore((s) => s.setDraft)
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

  // Code diff and merge logic
  const {
    handleApplyCode,
    hasActiveWidgets,
    acceptAllChanges,
    forceClearAllDecorations,
  } = useCodeDiffer({
    editorRef: editorRef || null,
  })

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

  const updateActiveFileContent = (content?: string) => {
    if (!activeTab) {
      return
    }
    setDraft(activeTab.id, content ?? "")
  }

  // Handler for applying code from chat
  const handleApplyCodeFromChat = useCallback(
    (code: string, language?: string) => {
      if (!activeTab) {
        return
      }
      // Apply the diff view
      const originalCode = activeFileContent
      handleApplyCodeWithDecorations(code, originalCode)
    },
    [activeTab, activeFileContent, handleApplyCodeWithDecorations]
  )

  // Handler for rejecting code from chat
  const handleRejectCodeFromChat = useCallback(() => {
    // Clear any existing decorations
    if (mergeDecorationsCollection) {
      mergeDecorationsCollection.clear()
      setMergeDecorationsCollection(undefined)
    }
  }, [mergeDecorationsCollection])

  // Enhanced setActiveTab that handles widget acceptance before switching
  const handleSetActiveTab = useCallback((tab: TTab) => {
    // Check if there are active widgets (accept/reject buttons)
    if (hasActiveWidgets()) {
      try {
        // Accept all pending changes before switching
        acceptAllChanges()
      } catch (error) {
        console.warn("Failed to accept changes, force clearing:", error)
        // Fallback: force clear all decorations
        forceClearAllDecorations()
      }
    }
    // Switch to the new tab
    setActiveTab(tab)
  }, [])

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
                    onClose={() => removeTab(tab)}
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
                      onChange={updateActiveFileContent}
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
