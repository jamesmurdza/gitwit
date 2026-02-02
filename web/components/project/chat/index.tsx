import { TTab } from "@/lib/types"
import { cn, debounce } from "@/lib/utils"
import { useAppStore } from "@/store/context"
import { Brain } from "lucide-react"
import * as monaco from "monaco-editor"
import React, { useCallback, useEffect, useRef } from "react"
import {
  ChatContainerActions,
  ChatContainerCollapse,
  ChatContainerContent,
  ChatContainerEmpty,
  ChatContainerHeader,
  ChatContainerMaximizeToggle,
  ChatContainerRoot,
  ChatContainerTitle,
  ChatScrollContainer,
  ScrollButton,
} from "./components/chat-container"
import { ChatHistory } from "./components/chat-history"
import {
  ChatInput,
  ChatInputActionBar,
  ChatInputActions,
  ChatInputContextMenu,
  ChatInputModelSelect,
  ChatInputSubmit,
  ChatInputTextarea,
} from "./components/chat-input"
import { ContextTab } from "./components/context-tab"
import { GeneratedFilesPreview } from "./components/generated-files-preview"
import { Message, MessageContent } from "./components/message"
import type {
  ApplyMergedFileArgs,
  FileMergeResult,
  GetCurrentFileContentFn,
  PrecomputeMergeArgs,
} from "./lib/types"
import { useChat } from "./providers/chat-provider"

type PrecomputeMergeFn = (args: PrecomputeMergeArgs) => Promise<FileMergeResult>
type ApplyPrecomputedMergeFn = (args: ApplyMergedFileArgs) => Promise<void>
type RestorePrecomputedMergeFn = (args: ApplyMergedFileArgs) => Promise<void>

type AIChatProps = {
  onApplyCode?: (
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
  ) => Promise<void>
  onRejectCode?: () => void
  precomputeMergeForFile?: PrecomputeMergeFn
  applyPrecomputedMerge?: ApplyPrecomputedMergeFn
  restoreOriginalFile?: RestorePrecomputedMergeFn

  getCurrentFileContent?: GetCurrentFileContentFn

  onOpenFile?: (filePath: string) => void
}

function AIChatBase({
  onApplyCode,
  onRejectCode,
  precomputeMergeForFile,
  applyPrecomputedMerge,
  restoreOriginalFile,

  getCurrentFileContent,
  onOpenFile,
}: AIChatProps) {
  return (
    <ChatContainerRoot>
      <ChatContainerHeader>
        <ChatContainerTitle>Chat</ChatContainerTitle>
        <ChatContainerActions>
          <ChatHistory />
          <ChatContainerMaximizeToggle />
          <ChatContainerCollapse />
        </ChatContainerActions>
      </ChatContainerHeader>
      <MainChatContent
        onApplyCode={onApplyCode}
        onRejectCode={onRejectCode}
        getCurrentFileContent={getCurrentFileContent}
        onOpenFile={onOpenFile}
      />
      <MainChatInput
        precomputeMergeForFile={precomputeMergeForFile}
        applyPrecomputedMerge={applyPrecomputedMerge}
        restoreOriginalFile={restoreOriginalFile}
        getCurrentFileContent={getCurrentFileContent}
        onApplyCode={onApplyCode}
        onOpenFile={onOpenFile}
      />
    </ChatContainerRoot>
  )
}

export const AIChat = React.memo(
  AIChatBase,
  (prev, next) =>
    prev.onApplyCode === next.onApplyCode &&
    prev.onRejectCode === next.onRejectCode &&
    prev.precomputeMergeForFile === next.precomputeMergeForFile &&
    prev.applyPrecomputedMerge === next.applyPrecomputedMerge &&
    prev.restoreOriginalFile === next.restoreOriginalFile &&
    prev.getCurrentFileContent === next.getCurrentFileContent &&
    prev.onOpenFile === next.onOpenFile,
)
function MainChatContent({
  onApplyCode,
  onRejectCode,
  getCurrentFileContent,
  onOpenFile,
}: {
  onApplyCode?: (
    code: string,
    language?: string,
    options?: {
      mergeStatuses?: Record<
        string,
        { status: string; result?: any; error?: string }
      >
      getCurrentFileContent?: (filePath: string) => Promise<string> | string
      getMergeStatus?: (
        filePath: string,
      ) => { status: string; result?: any; error?: string } | undefined
    },
  ) => Promise<void>
  onRejectCode?: () => void
  getCurrentFileContent?: GetCurrentFileContentFn
  onOpenFile?: (filePath: string) => void
}) {
  console.log("onOpenFile :", onOpenFile)
  const { messages, isLoading, mergeStatuses } = useChat()
  const isEmpty = messages.length === 0
  const mergeStatusesRef = React.useRef(mergeStatuses)
  React.useEffect(() => {
    mergeStatusesRef.current = mergeStatuses
  }, [mergeStatuses])

  const wrappedOnApplyCode = React.useCallback(
    async (code: string, language?: string): Promise<void> => {
      if (onApplyCode) {
        await onApplyCode(code, language, {
          mergeStatuses,
          getCurrentFileContent,
          getMergeStatus: (filePath: string) =>
            mergeStatusesRef.current[filePath],
        })
      }
    },
    [onApplyCode, mergeStatuses, getCurrentFileContent],
  )

  if (isEmpty) {
    return <ChatContainerEmpty />
  }
  return (
    <ChatScrollContainer className="flex-1 relative w-full max-w-5xl mx-auto">
      <ChatContainerContent className="px-2 py-4  overflow-x-hidden">
        {messages.map((message, i) => {
          return (
            <Message
              messageId={message.id ?? `${message.role}-${i}`}
              role={message.role}
              context={message.context}
              key={i}
              onApplyCode={wrappedOnApplyCode}
              onRejectCode={onRejectCode}
              onOpenFile={onOpenFile}
            >
              <MessageContent>{message.content}</MessageContent>
            </Message>
          )
        })}
        {isLoading && <ChatLoading />}
      </ChatContainerContent>
      <div className="flex justify-end absolute bottom-2 right-2">
        <ScrollButton />
      </div>
    </ChatScrollContainer>
  )
}

function ChatLoading() {
  return (
    <div className="flex gap-2 items-center">
      <Brain className="size-[1.125rem] text-foreground" />
      <div
        className={cn(
          "bg-[linear-gradient(to_right,hsl(var(--muted-foreground))_40%,hsl(var(--foreground))_60%,hsl(var(--muted-foreground))_80%)]",
          "bg-[length:200%_auto] bg-clip-text font-medium text-transparent",
          "animate-[shimmer_4s_infinite_linear] text-sm",
        )}
      >
        Gitwit is thinking...
      </div>
    </div>
  )
}
function MainChatInput({
  precomputeMergeForFile,
  applyPrecomputedMerge,
  restoreOriginalFile,
  getCurrentFileContent,
  onApplyCode,
  onOpenFile,
}: {
  precomputeMergeForFile?: PrecomputeMergeFn
  applyPrecomputedMerge?: ApplyPrecomputedMergeFn

  restoreOriginalFile?: RestorePrecomputedMergeFn
  getCurrentFileContent?: GetCurrentFileContentFn
  onApplyCode?: (code: string, language?: string) => Promise<void>
  onOpenFile?: (filePath: string) => void
}) {
  const { input, setInput, isLoading, isGenerating, sendMessage } = useChat()
  const handleSubmit = () => {
    console.log("Submitting message:", input)
    sendMessage(input)
  }
  const handleValueChange = (value: string) => {
    setInput(value)
  }

  return (
    <div className="from-transparent via-background to-background bg-gradient-to-b px-2 pb-4 bottom-0">
      <GeneratedFilesPreview
        precomputeMerge={precomputeMergeForFile}
        applyPrecomputedMerge={applyPrecomputedMerge}
        restoreOriginalFile={restoreOriginalFile}
        getCurrentFileContent={getCurrentFileContent}
        onApplyCode={onApplyCode}
        onOpenFile={onOpenFile}
      />
      <ChatInput
        value={input}
        onValueChange={handleValueChange}
        isLoading={isGenerating || isLoading}
        onSubmit={handleSubmit}
        className="w-full"
      >
        <ChatContexts />
        <ChatInputTextarea placeholder="Ask me anything..." />
        <ChatInputActionBar className="justify-between pt-2">
          <ChatInputActions className="flex gap-1">
            <ChatInputContextMenu />
            <ChatInputModelSelect />
          </ChatInputActions>
          <ChatInputSubmit />
        </ChatInputActionBar>
      </ChatInput>
    </div>
  )
}

function ChatContexts() {
  const { contextTabs, removeContextTab, addContextTab } = useChat()
  const activeTab = useAppStore((s) => s.activeTab)
  const editorRef = useAppStore((s) => s.editorRef)
  const previousTabIdRef = useRef<string | null>(null)

  // Direct selection update handler
  const updateSelection = useCallback(
    (selection: monaco.Selection, activeTab?: TTab) => {
      // Remove existing selection tab first
      if (activeTab) {
        const tabId = `selection-${activeTab.id}`
        removeContextTab(tabId)
      }

      // Only add if there's an actual selection (not empty)
      if (!selection.isEmpty() && activeTab) {
        const tabId = `selection-${activeTab.id}`
        const content = editorRef?.getModel()?.getValueInRange(selection)
        console.log("Adding context tab with content:", content)
        addContextTab({
          id: tabId,
          type: "code",
          name: activeTab.name,
          content,
          lineRange: {
            start: selection.startLineNumber,
            end: selection.endLineNumber,
          },
        })
      }
    },
    [editorRef, addContextTab, removeContextTab],
  )

  // Debounced variant for cursor selection changes
  const debouncedUpdateSelection = useRef(
    debounce((selection: monaco.Selection, activeTab?: TTab) => {
      updateSelection(selection, activeTab)
    }, 500),
  ).current

  useEffect(() => {
    if (!activeTab) return

    // Remove previous tab's selection context if it exists
    if (previousTabIdRef.current) {
      const previousSelectionId = `selection-${previousTabIdRef.current}`
      removeContextTab(previousSelectionId)
    }

    // Update the ref with current tab ID
    previousTabIdRef.current = activeTab.id

    const editorSelection = editorRef?.getSelection()
    if (!editorSelection) return
    updateSelection(editorSelection, activeTab)
  }, [activeTab?.id])

  // Handle cursor selection changes
  useEffect(() => {
    if (!editorRef || !activeTab) return

    const disposable = editorRef.onDidChangeCursorSelection((e) => {
      debouncedUpdateSelection(e.selection, activeTab)
    })

    return () => {
      disposable.dispose()
    }
  }, [editorRef, activeTab, debouncedUpdateSelection])

  return (
    <div className="flex gap-2 w-full flex-wrap">
      {contextTabs.map((tab) => (
        <ContextTab key={tab.id} {...tab} removeContext={removeContextTab} />
      ))}
    </div>
  )
}
