"use client"
import { useProjectContext } from "@/context/project-context"
import { fileRouter } from "@/lib/api"
import { sortFileExplorer } from "@/lib/utils"
import { useAppStore } from "@/store/context"
import { useChat as useAIChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import type { UIMessage } from "ai"
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
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  useResponseVariants,
  type VariantInfo,
} from "../hooks/use-response-variants"
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

export type { VariantInfo } from "../hooks/use-response-variants"

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
  retry: () => void
  stopGeneration: () => void
  /** Get variant info for an assistant message (keyed by preceding user msg ID) */
  getVariantInfo: (userMsgId: string) => VariantInfo | null
  /** Navigate between response variants */
  navigateVariant: (userMsgId: string, direction: "prev" | "next") => void
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

/** Extract text content from a UIMessage's parts array */
function getTextContent(msg: UIMessage): string {
  let text = ""
  for (const part of msg.parts) {
    if (part.type === "text") {
      text += part.text
    }
  }
  return text
}

/** Convert our Message type to AI SDK UIMessage format */
function toUIMessages(messages: Message[]): UIMessage[] {
  return messages.map((m, i) => ({
    id: m.id ?? `${m.role}-${i}`,
    role: m.role,
    parts: [{ type: "text" as const, text: m.content }],
  }))
}

/** Convert AI SDK UIMessage back to our Message type, restoring context from map */
function fromUIMessage(
  aiMsg: UIMessage,
  contextMap: Map<string, ContextTab[]>,
): Message {
  return {
    id: aiMsg.id,
    role: aiMsg.role as "user" | "assistant",
    content: getTextContent(aiMsg),
    context: contextMap.get(aiMsg.id),
    parts: aiMsg.parts,
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

  // Map of messageId → ContextTab[] to preserve context across AI SDK round-trips
  const contextMapRef = useRef(new Map<string, ContextTab[]>())

  // Ref to hold request-scoped data (context content + reactive values)
  // so prepareSendMessagesRequest always reads fresh values
  const requestBodyRef = useRef({
    contextContent: "",
    projectId,
    projectType,
    activeFileContent,
    fileTree,
    projectName,
    activeFileName,
  })
  requestBodyRef.current = {
    contextContent: requestBodyRef.current.contextContent,
    projectId,
    projectType,
    activeFileContent,
    fileTree,
    projectName,
    activeFileName,
  }

  // Get thread messages for initializing useChat
  const threadMessages = activeThreadId
    ? (threads[activeThreadId]?.messages ?? [])
    : []

  // Stable transport — reads fresh values from requestBodyRef
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/stream-chat",
        prepareSendMessagesRequest: ({ messages: msgs, trigger }) => {
          const ref = requestBodyRef.current
          // Both submit and regenerate send the same shape —
          // the backend just needs messages + context to produce a response.
          // For regeneration, the AI SDK already removes the old assistant
          // message from `msgs` before calling this.
          return {
            body: {
              messages: msgs
                .map((m) => ({
                  role: m.role,
                  content: getTextContent(m),
                }))
                .filter((m) => m.content.length > 0),
              context: {
                projectId: ref.projectId,
                templateType: ref.projectType,
                activeFileContent: ref.activeFileContent,
                fileTree: ref.fileTree,
                contextContent:
                  trigger === "regenerate-message" ? "" : ref.contextContent,
                projectName: ref.projectName,
                fileName: ref.activeFileName,
              },
            },
          }
        },
      }),
    [],
  )

  // AI SDK useChat hook (v6)
  const {
    messages: aiMessages,
    sendMessage: aiSendMessage,
    regenerate: aiRegenerate,
    stop,
    setMessages: setAIMessages,
    status: aiStatus,
  } = useAIChat({
    transport,
    messages: toUIMessages(threadMessages),
    experimental_throttle: 50,
    onError: (error) => {
      console.error("Stream error:", error)
      toast.error("Failed to get AI response. Please try again.")
    },
  })

  // Local input state (v6 useChat no longer manages input)
  const [input, setInput] = useState("")

  // Sync AI SDK messages back to zustand thread store
  useEffect(() => {
    if (!activeThreadId) return
    const converted = aiMessages.map((m) =>
      fromUIMessage(m, contextMapRef.current),
    )
    setThreadMessages(activeThreadId, converted)
  }, [aiMessages, activeThreadId, setThreadMessages])

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

      // Rebuild context map from thread messages
      contextMapRef.current.clear()
      if (activeThreadId && threads[activeThreadId]) {
        for (const msg of threads[activeThreadId].messages) {
          if (msg.id && msg.context?.length) {
            contextMapRef.current.set(msg.id, msg.context)
          }
        }
        setAIMessages(toUIMessages(threads[activeThreadId].messages))
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

  const { pushVariant, getVariantInfo, navigateVariant, resolveContent } =
    useResponseVariants()

  // Convert AI SDK messages to our Message type for consumers,
  // applying variant overrides for regenerated responses.
  const messages: Message[] = useMemo(() => {
    return aiMessages.map((m, i) => {
      const msg = fromUIMessage(m, contextMapRef.current)

      if (
        m.role === "assistant" &&
        i > 0 &&
        aiMessages[i - 1].role === "user"
      ) {
        const userMsgId = aiMessages[i - 1].id
        return { ...msg, content: resolveContent(userMsgId, msg.content) }
      }

      return msg
    })
  }, [aiMessages, resolveContent])

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

      // Store context content in ref so prepareSendMessagesRequest reads it
      requestBodyRef.current.contextContent = contextContent

      // Generate user message ID and store context tabs before sending
      const userMessageId = nanoid()
      if (capturedContextTabs.length > 0) {
        contextMapRef.current.set(userMessageId, capturedContextTabs)
      }

      setContextTabs([])
      setInput("")

      // Send user message — AI SDK handles the streaming automatically
      await aiSendMessage({
        id: userMessageId,
        role: "user",
        parts: [{ type: "text" as const, text: message }],
      })

      requestBodyRef.current.contextContent = ""
    },
    [
      activeThreadId,
      isGenerating,
      contextTabs,
      queryClient,
      projectId,
      drafts,
      aiSendMessage,
    ],
  )

  const retry = useCallback(() => {
    if (isGenerating) return

    // Find the last assistant message and the user message before it
    let lastAssistantIdx = -1
    let userMsgId: string | undefined
    for (let i = aiMessages.length - 1; i >= 0; i--) {
      if (aiMessages[i].role === "assistant") {
        lastAssistantIdx = i
        if (i > 0 && aiMessages[i - 1].role === "user") {
          userMsgId = aiMessages[i - 1].id
        }
        break
      }
    }
    if (lastAssistantIdx === -1 || !userMsgId) return

    pushVariant(userMsgId, getTextContent(aiMessages[lastAssistantIdx]))
    aiRegenerate({ messageId: aiMessages[lastAssistantIdx].id })
  }, [isGenerating, aiMessages, aiRegenerate, pushVariant])

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
      input,
      setInput,
      isGenerating,
      isLoading,
      contextTabs,
      addContextTab,
      removeContextTab,
      sendMessage,
      retry,
      stopGeneration,
      getVariantInfo,
      navigateVariant,
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
      input,
      setInput,
      isGenerating,
      isLoading,
      contextTabs,
      addContextTab,
      removeContextTab,
      sendMessage,
      retry,
      stopGeneration,
      getVariantInfo,
      navigateVariant,
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
