"use client"
import { useProjectContext } from "@/context/project-context"
import { fileRouter } from "@/lib/api"
import { sortFileExplorer } from "@/lib/utils"
import { useAppStore } from "@/store/context"
import { useQueryClient } from "@tanstack/react-query"
import { useChat as useAIChat } from "ai/react"
import type { Message as AIMessage } from "ai/react"
import React, {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"
import type { ContextTab, FileMergeResult, Message } from "../lib/types"
import { getCombinedContext, normalizePath } from "../lib/utils"

type ChatProviderProps = {
  children: ReactNode
}

export type MergeState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "ready"; result: FileMergeResult }
  | { status: "error"; error: string }

type ChatContextType = {
  activeFileContent?: string
  activeFileName?: string
  messages: Message[]
  input: string
  setInput: React.Dispatch<React.SetStateAction<string>>
  isGenerating: boolean
  isLoading: boolean
  contextTabs: ContextTab[]
  addContextTab: (newTab: ContextTab) => void
  removeContextTab: (id: string) => void
  sendMessage: (message: string, context?: string) => Promise<void>
  stopGeneration: () => void
  fileActionStatuses: Record<string, Record<string, "applied" | "rejected">>
  markFileActionStatus: (
    messageId: string,
    filePath: string,
    status: "applied" | "rejected",
  ) => void
  latestAssistantId?: string
  mergeStatuses: Record<string, MergeState>
  setMergeStatuses: React.Dispatch<
    React.SetStateAction<Record<string, MergeState>>
  >
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

/** Convert our Message type to AI SDK Message format */
function toAIMessages(messages: Message[]): AIMessage[] {
  return messages.map((m, i) => ({
    id: m.id ?? `${m.role}-${i}`,
    role: m.role,
    content: m.content,
  }))
}

/** Convert AI SDK Message back to our Message type, preserving context from original */
function fromAIMessage(aiMsg: AIMessage, originalMessages: Message[]): Message {
  const original = originalMessages.find((m) => m.id === aiMsg.id)
  return {
    id: aiMsg.id,
    role: aiMsg.role as "user" | "assistant",
    content: aiMsg.content,
    context: original?.context,
  }
}

function ChatProvider({ children }: ChatProviderProps) {
  const {
    project: { id: projectId, name: projectName, type: projectType },
  } = useProjectContext()
  const queryClient = useQueryClient()
  const drafts = useAppStore((s) => s.drafts)
  const activeTab = useAppStore((s) => s.activeTab)
  const activeDraft = useAppStore((s) => s.drafts[activeTab?.id ?? ""])

  // Thread management
  const hasHydrated = useAppStore((s) => s._hasHydrated)
  const threads = useAppStore((s) => s.threads)
  const activeThreadId = useAppStore((s) => s.activeThreadId)
  const createThread = useAppStore((s) => s.createThread)
  const setThreadMessages = useAppStore((s) => s.setThreadMessages)

  const { data: fileTree = [] } = fileRouter.fileTree.useQuery({
    variables: { projectId },
    select(data) {
      return sortFileExplorer(data.data ?? [])
    },
  })

  const { data: serverActiveFile = "" } = fileRouter.fileContent.useQuery({
    enabled: !!activeTab?.id,
    variables: { fileId: activeTab?.id ?? "", projectId },
    select(data) {
      return data.data
    },
  })

  const activeFileContent =
    activeDraft === undefined ? serverActiveFile : activeDraft
  const activeFileName = activeTab?.name || "untitled"

  // Ref to hold captured context tabs for the current request
  const pendingContextRef = useRef<{
    contextContent: string
    contextTabs: ContextTab[]
  } | null>(null)

  // Get thread messages for initializing useChat
  const threadMessages = activeThreadId
    ? (threads[activeThreadId]?.messages ?? [])
    : []

  // AI SDK useChat hook
  const {
    messages: aiMessages,
    append,
    stop,
    setMessages: setAIMessages,
    status: aiStatus,
    input: aiInput,
    setInput: aiSetInput,
  } = useAIChat({
    api: "/api/ai/stream-chat",
    streamProtocol: "text",
    experimental_throttle: 50,
    initialMessages: toAIMessages(threadMessages),
    experimental_prepareRequestBody: ({ messages: msgs }) => {
      const context = pendingContextRef.current
      return {
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        context: {
          templateType: projectType,
          activeFileContent,
          fileTree,
          contextContent: context?.contextContent ?? "",
          projectName,
          fileName: activeFileName,
        },
      }
    },
    onFinish: () => {
      // Persist to zustand when stream completes
      // We read aiMessages in the next effect cycle
    },
    onError: (error) => {
      console.error("Stream error:", error)
    },
  })

  // Sync AI SDK messages back to zustand thread store
  const prevAiMessagesLenRef = useRef(aiMessages.length)
  useEffect(() => {
    if (!activeThreadId) return
    // Only sync when messages actually changed (not on thread switch)
    if (aiMessages.length !== prevAiMessagesLenRef.current) {
      const converted = aiMessages.map((m) => fromAIMessage(m, threadMessages))
      setThreadMessages(activeThreadId, converted)
    }
    prevAiMessagesLenRef.current = aiMessages.length
  }, [aiMessages, activeThreadId, setThreadMessages, threadMessages])

  // Initialize thread on mount after hydration
  useEffect(() => {
    if (!hasHydrated) return

    const projectThreads = Object.values(threads).filter(
      (t) => t.projectId === projectId,
    )

    if (projectThreads.length === 0 || !activeThreadId) {
      createThread(projectId)
    }
  }, [hasHydrated, projectId, threads, activeThreadId, createThread])

  // Sync messages from zustand to useChat on thread switch
  const prevThreadIdRef = useRef(activeThreadId)
  useEffect(() => {
    if (prevThreadIdRef.current !== activeThreadId) {
      stop() // abort any in-flight stream
      if (activeThreadId && threads[activeThreadId]) {
        setAIMessages(toAIMessages(threads[activeThreadId].messages))
      } else {
        setAIMessages([])
      }
      prevThreadIdRef.current = activeThreadId
    }
  }, [activeThreadId, threads, stop, setAIMessages])

  const [contextTabs, setContextTabs] = useState<ContextTab[]>([])
  const [fileActionStatuses, setFileActionStatuses] = useState<
    Record<string, Record<string, "applied" | "rejected">>
  >({})
  const [mergeStatuses, setMergeStatuses] = useState<
    Record<string, MergeState>
  >({})

  const addContextTab = useCallback((newTab: ContextTab) => {
    setContextTabs((prev) => {
      if (prev.some((tab) => tab.id === newTab.id)) return prev

      const isDuplicate = prev.some((tab) => {
        if (tab.type !== newTab.type) return false
        if (
          tab.type === "file" ||
          tab.type === "image" ||
          tab.type === "code"
        ) {
          return tab.name === newTab.name
        }
        if (tab.type === "text" && tab.content && newTab.content) {
          return tab.content === newTab.content
        }
        return false
      })

      if (isDuplicate) {
        const isSnippet = newTab.type === "text" || newTab.type === "code"
        toast.info(
          isSnippet
            ? "Snippet is already added"
            : `"${newTab.name}" is already added`,
        )
        return prev
      }
      return [...prev, newTab]
    })
  }, [])

  const removeContextTab = useCallback((id: string) => {
    setContextTabs((prev) => prev.filter((tab) => tab.id !== id))
  }, [])

  // Derive status from AI SDK status
  const isGenerating = aiStatus === "streaming" || aiStatus === "submitted"
  const isLoading = aiStatus === "submitted"

  // Convert AI SDK messages to our Message type for consumers
  const messages: Message[] = useMemo(
    () => aiMessages.map((m) => fromAIMessage(m, threadMessages)),
    [aiMessages, threadMessages],
  )

  const latestAssistantId = useMemo(() => {
    for (let i = aiMessages.length - 1; i >= 0; i--) {
      if (aiMessages[i].role === "assistant") return aiMessages[i].id
    }
    return undefined
  }, [aiMessages])

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || !activeThreadId) return
      if (isGenerating) return

      // Capture context tabs before clearing
      const capturedContextTabs = [...contextTabs]

      // Prepare context content for the request
      const contextContent = await getCombinedContext({
        contextTabs: capturedContextTabs,
        queryClient,
        projectId,
        drafts,
      })

      // Store in ref so experimental_prepareRequestBody can access it
      pendingContextRef.current = {
        contextContent,
        contextTabs: capturedContextTabs,
      }

      setContextTabs([])
      aiSetInput("")

      // Append user message — AI SDK handles the streaming automatically
      await append({
        role: "user",
        content: message,
      })

      pendingContextRef.current = null
    },
    [
      activeThreadId,
      isGenerating,
      contextTabs,
      queryClient,
      projectId,
      drafts,
      append,
      aiSetInput,
    ],
  )

  const stopGeneration = useCallback(() => {
    stop()
  }, [stop])

  const markFileActionStatus = useCallback(
    (messageId: string, filePath: string, status: "applied" | "rejected") => {
      if (!messageId) return
      const normalized = normalizePath(filePath)
      setFileActionStatuses((prev) => ({
        ...prev,
        [messageId]: {
          ...(prev[messageId] ?? {}),
          [normalized]: status,
        },
      }))
    },
    [],
  )

  const contextValue = useMemo(
    () => ({
      activeFileContent,
      activeFileName,
      messages,
      input: aiInput,
      setInput: aiSetInput,
      isGenerating,
      isLoading,
      contextTabs,
      addContextTab,
      removeContextTab,
      sendMessage,
      stopGeneration,
      fileActionStatuses,
      markFileActionStatus,
      latestAssistantId,
      mergeStatuses,
      setMergeStatuses,
    }),
    [
      activeFileContent,
      activeFileName,
      messages,
      aiInput,
      aiSetInput,
      isGenerating,
      isLoading,
      contextTabs,
      addContextTab,
      removeContextTab,
      sendMessage,
      stopGeneration,
      fileActionStatuses,
      markFileActionStatus,
      latestAssistantId,
      mergeStatuses,
      setMergeStatuses,
    ],
  )

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  )
}

function useChat() {
  const context = React.useContext(ChatContext)
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider")
  }
  return context
}
export { ChatProvider, useChat }
