import { streamChat } from "@/app/actions/ai"
import { TFile, TFolder } from "@/lib/types"
import { useAppStore } from "@/store/context"
import { useQueryClient } from "@tanstack/react-query"
import { readStreamableValue } from "ai/rsc"
import { nanoid } from "nanoid"
import { useParams } from "next/navigation"
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
  activeFileContent: string
  activeFileName: string
  projectType: string
  fileTree: (TFile | TFolder)[]
  projectName: string
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
    status: "applied" | "rejected"
  ) => void
  latestAssistantId?: string
  mergeStatuses: Record<string, MergeState>
  setMergeStatuses: React.Dispatch<
    React.SetStateAction<Record<string, MergeState>>
  >
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

function ChatProvider({
  activeFileContent,
  activeFileName,
  projectType,
  fileTree,
  projectName,
  children,
}: ChatProviderProps) {
  const { id: projectId } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const drafts = useAppStore((s) => s.drafts)

  // Thread management
  const hasHydrated = useAppStore((s) => s._hasHydrated)
  const threads = useAppStore((s) => s.threads)
  const activeThreadId = useAppStore((s) => s.activeThreadId)
  const createThread = useAppStore((s) => s.createThread)
  const addMessage = useAppStore((s) => s.addMessage)
  const updateMessage = useAppStore((s) => s.updateMessage)

  // Get messages from active thread
  const messages = useAppStore((s) =>
    s.activeThreadId && s.threads[s.activeThreadId]
      ? s.threads[s.activeThreadId].messages
      : []
  )

  // Initialize thread on mount after hydration
  useEffect(() => {
    if (!hasHydrated) return

    const projectThreads = Object.values(threads).filter(
      (t) => t.projectId === projectId
    )

    // If no threads exist for this project or no active thread, create one
    if (projectThreads.length === 0 || !activeThreadId) {
      createThread(projectId)
    }
  }, [hasHydrated, projectId, threads, activeThreadId, createThread])

  const [input, setInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [contextTabs, setContextTabs] = useState<ContextTab[]>([])
  const [fileActionStatuses, setFileActionStatuses] = useState<
    Record<string, Record<string, "applied" | "rejected">>
  >({})
  const [latestAssistantId, setLatestAssistantId] = useState<string | null>(
    null
  )
  const [mergeStatuses, setMergeStatuses] = useState<
    Record<string, MergeState>
  >({})
  const abortControllerRef = useRef<AbortController | null>(null)

  const addContextTab = useCallback((newTab: ContextTab) => {
    setContextTabs((prev) => {
      // Check for duplicate by id
      if (prev.some((tab) => tab.id === newTab.id)) {
        return prev
      }

      // Check for duplicate by type and name/content
      const isDuplicate = prev.some((tab) => {
        if (tab.type !== newTab.type) return false

        // For files, images, and code (file context), check by name
        if (
          tab.type === "file" ||
          tab.type === "image" ||
          tab.type === "code"
        ) {
          return tab.name === newTab.name
        }

        // For text snippets, check by content
        if (tab.type === "text" && tab.content && newTab.content) {
          return tab.content === newTab.content
        }

        return false
      })

      if (isDuplicate) {
        const isSnippet = newTab.type === "text" || newTab.type === "code"
        const message = isSnippet
          ? "Snippet is already added"
          : `"${newTab.name}" is already added`
        toast.info(message)
        return prev
      }

      return [...prev, newTab]
    })
  }, [])

  const removeContextTab = useCallback((id: string) => {
    setContextTabs((prev) => prev.filter((tab) => tab.id !== id))
  }, [])

  // Throttle streaming updates to reduce render frequency
  const throttledSetMessages = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const updateAssistantMessage = useCallback(
    (buffer: string, messageIndex: number) => {
      if (!activeThreadId) return
      updateMessage(activeThreadId, messageIndex, buffer)
    },
    [activeThreadId, updateMessage]
  )

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || !activeThreadId) return
      setIsGenerating(true)
      setIsLoading(true)

      // Add user message to thread
      addMessage(activeThreadId, {
        role: "user",
        content: message,
        context: contextTabs,
      })
      setInput("")

      const contextContent = await getCombinedContext({
        contextTabs,
        queryClient,
        projectId,
        drafts,
      })
      setContextTabs([])

      abortControllerRef.current = new AbortController()

      // Track latest assistant message ID for HEAD compatibility
      const assistantMessageId = nanoid()
      setLatestAssistantId(assistantMessageId)

      // Add empty assistant message
      addMessage(activeThreadId, {
        id: assistantMessageId,
        role: "assistant",
        content: "",
      })
      const assistantMessageIndex = messages.length + 1 // +1 for user message just added

      try {
        const { output } = await streamChat(
          [
            ...messages,
            { role: "user", content: message, context: contextTabs },
          ],
          {
            templateType: projectType,
            activeFileContent,
            fileTree,
            contextContent,
            projectName,
            fileName: activeFileName,
          }
        )

        let buffer = ""
        let firstChunk = true
        for await (const chunk of readStreamableValue(output)) {
          if (abortControllerRef.current?.signal.aborted) break
          buffer += chunk
          if (firstChunk) {
            setIsLoading(false)
            firstChunk = false
          }
          // Throttle updates to every 50ms
          if (!throttledSetMessages.current) {
            throttledSetMessages.current = setTimeout(() => {
              updateAssistantMessage(buffer, assistantMessageIndex)
              throttledSetMessages.current = null
            }, 50)
          }
        }
        // Final update after stream ends
        updateAssistantMessage(buffer, assistantMessageIndex)
      } catch (error: any) {
        if (error.name === "AbortError") {
          console.log("Generation aborted")
        } else {
          console.error("Error:", error)
          updateAssistantMessage(
            error.message || "Sorry, an error occurred.",
            assistantMessageIndex
          )
        }
      } finally {
        setIsGenerating(false)
        setIsLoading(false)
        abortControllerRef.current = null
        if (throttledSetMessages.current) {
          clearTimeout(throttledSetMessages.current)
          throttledSetMessages.current = null
        }
      }
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
      updateAssistantMessage,
    ]
  )

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

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
    []
  )

  // Memoize context value to avoid unnecessary re-renders
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
    ]
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
