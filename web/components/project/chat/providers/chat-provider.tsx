"use client"
import { useProjectContext } from "@/context/project-context"
import { fileRouter } from "@/lib/api"
import { sortFileExplorer } from "@/lib/utils"
import { useAppStore } from "@/store/context"
import { useQueryClient } from "@tanstack/react-query"
import { nanoid } from "nanoid"
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
import { useStreamChat } from "../hooks/use-stream-chat"

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
  const addMessage = useAppStore((s) => s.addMessage)
  const updateMessageById = useAppStore((s) => s.updateMessageById)

  // Get messages from active thread
  const messages = useAppStore((s) =>
    activeThreadId && s.threads[activeThreadId]
      ? s.threads[activeThreadId].messages
      : [],
  )

  // Streaming hook (handles abort + concurrent guard)
  const { streamChat, abort: abortStream, isStreamingRef } = useStreamChat()

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

  // Abort stream on thread switch (race condition #3)
  const prevThreadIdRef = useRef(activeThreadId)
  useEffect(() => {
    if (prevThreadIdRef.current !== activeThreadId) {
      abortStream()
      prevThreadIdRef.current = activeThreadId
    }
  }, [activeThreadId, abortStream])

  const [input, setInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [contextTabs, setContextTabs] = useState<ContextTab[]>([])
  const [fileActionStatuses, setFileActionStatuses] = useState<
    Record<string, Record<string, "applied" | "rejected">>
  >({})
  const [latestAssistantId, setLatestAssistantId] = useState<string | null>(
    null,
  )
  const [mergeStatuses, setMergeStatuses] = useState<
    Record<string, MergeState>
  >({})

  // Throttle ref for streaming updates (race condition #4: cleared in finally + unmount)
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup throttle on unmount (race condition #4)
  useEffect(() => {
    return () => {
      if (throttleRef.current) {
        clearTimeout(throttleRef.current)
        throttleRef.current = null
      }
    }
  }, [])

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

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || !activeThreadId) return
      // Concurrent guard is in useStreamChat, but also guard UI state
      if (isStreamingRef.current) return

      setIsGenerating(true)
      setIsLoading(true)

      // Capture context tabs before clearing (race condition #5)
      const capturedContextTabs = [...contextTabs]

      addMessage(activeThreadId, {
        role: "user",
        content: message,
        context: capturedContextTabs,
      })
      setInput("")

      const contextContent = await getCombinedContext({
        contextTabs: capturedContextTabs,
        queryClient,
        projectId,
        drafts,
      })
      setContextTabs([])

      const assistantMessageId = nanoid()
      setLatestAssistantId(assistantMessageId)

      addMessage(activeThreadId, {
        id: assistantMessageId,
        role: "assistant",
        content: "",
      })

      // Capture threadId for this stream — if user switches threads, writes go nowhere
      const streamThreadId = activeThreadId

      let buffer = ""
      let firstChunk = true

      await streamChat(
        {
          messages: [
            ...messages,
            { role: "user", content: message, context: capturedContextTabs },
          ],
          context: {
            templateType: projectType,
            activeFileContent,
            fileTree,
            contextContent,
            projectName,
            fileName: activeFileName,
          },
        },
        // onChunk — leading-edge throttle for instant first chunk
        (chunk) => {
          buffer += chunk
          if (firstChunk) {
            setIsLoading(false)
            firstChunk = false
            // Immediately update on first chunk (leading-edge)
            updateMessageById(streamThreadId, assistantMessageId, buffer)
            return
          }
          // Throttle subsequent updates to every 50ms
          if (!throttleRef.current) {
            throttleRef.current = setTimeout(() => {
              updateMessageById(streamThreadId, assistantMessageId, buffer)
              throttleRef.current = null
            }, 50)
          }
        },
        // onDone
        () => {
          // Clear any pending throttle (race condition #4)
          if (throttleRef.current) {
            clearTimeout(throttleRef.current)
            throttleRef.current = null
          }
          // Final update with complete buffer (race condition #1: ID-based)
          updateMessageById(streamThreadId, assistantMessageId, buffer)
          setIsGenerating(false)
          setIsLoading(false)
        },
        // onError
        (error) => {
          if (throttleRef.current) {
            clearTimeout(throttleRef.current)
            throttleRef.current = null
          }
          console.error("Stream error:", error)
          updateMessageById(
            streamThreadId,
            assistantMessageId,
            error.message || "Sorry, an error occurred.",
          )
          setIsGenerating(false)
          setIsLoading(false)
        },
      )
    },
    [
      activeThreadId,
      contextTabs,
      queryClient,
      projectId,
      drafts,
      projectType,
      activeFileContent,
      fileTree,
      projectName,
      activeFileName,
      messages,
      addMessage,
      updateMessageById,
      streamChat,
      isStreamingRef,
    ],
  )

  const stopGeneration = useCallback(() => {
    abortStream()
    setIsGenerating(false)
    setIsLoading(false)
    // Clear pending throttle (race condition #4)
    if (throttleRef.current) {
      clearTimeout(throttleRef.current)
      throttleRef.current = null
    }
  }, [abortStream])

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
      input,
      setInput,
      isGenerating,
      isLoading,
      contextTabs,
      addContextTab,
      removeContextTab,
      sendMessage,
      stopGeneration,
      fileActionStatuses,
      markFileActionStatus,
      latestAssistantId: latestAssistantId ?? undefined,
      mergeStatuses,
      setMergeStatuses,
    }),
    [
      activeFileContent,
      activeFileName,
      messages,
      input,
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
