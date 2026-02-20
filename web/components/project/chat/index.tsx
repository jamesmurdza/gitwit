import { TTab } from "@/lib/types"
import { debounce } from "@/lib/utils"
import { useAppStore } from "@/store/context"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import * as monaco from "monaco-editor"
import { useParams } from "next/navigation"
import React, { useCallback, useEffect, useRef } from "react"
import {
  ChatContainerAction,
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
  const params = useParams()
  const projectId = params.id as string
  const createThread = useAppStore((s) => s.createThread)

  return (
    <ChatContainerRoot>
      <ChatContainerHeader>
        <ChatContainerTitle>Chat</ChatContainerTitle>
        <ChatContainerActions>
          <ChatContainerAction
            label="New chat"
            onClick={() => createThread(projectId)}
          >
            <Plus className="h-4 w-4" />
          </ChatContainerAction>
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
  ) => Promise<void>
  onRejectCode?: () => void
  getCurrentFileContent?: GetCurrentFileContentFn
  onOpenFile?: (filePath: string) => void
}) {
  const { messages, isLoading, mergeStatuses, sendMessage } = useChat()
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
    return <ChatContainerEmpty onSuggestionClick={sendMessage} />
  }
  return (
    <ChatScrollContainer className="flex-1 relative w-full max-w-5xl mx-auto">
      <ChatContainerContent className="px-2 py-4 overflow-x-hidden">
        {messages.map((message, i) => {
          // For assistant messages, find the preceding user message ID
          const precedingUserMsgId =
            message.role === "assistant" &&
            i > 0 &&
            messages[i - 1].role === "user"
              ? messages[i - 1].id
              : undefined
          return (
            <Message
              messageId={message.id ?? `${message.role}-${i}`}
              role={message.role}
              context={message.context}
              precedingUserMsgId={precedingUserMsgId}
              key={i}
              onApplyCode={wrappedOnApplyCode}
              onRejectCode={onRejectCode}
              onOpenFile={onOpenFile}
            >
              <MessageContent parts={message.parts}>
                {message.content}
              </MessageContent>
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
    <div className="px-1 py-3">
      <motion.span
        className="text-sm font-medium bg-clip-text text-transparent"
        style={{
          backgroundImage:
            "linear-gradient(90deg, hsl(var(--muted-foreground)) 40%, hsl(var(--foreground)) 50%, hsl(var(--muted-foreground)) 60%)",
          backgroundSize: "300% 100%",
        }}
        animate={{ backgroundPosition: ["100% 0%", "-100% 0%"] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        Thinking...
      </motion.span>
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
