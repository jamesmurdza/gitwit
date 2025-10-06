import { streamChat } from "@/app/actions/ai"
import { TFile, TFolder } from "@/lib/types"
import { useAppStore } from "@/store/context"
import { useQueryClient } from "@tanstack/react-query"
import { readStreamableValue } from "ai/rsc"
import { useParams } from "next/navigation"
import React, { createContext, ReactNode, useRef, useState } from "react"
import type { ContextTab, Message } from "../lib/types"
import { getCombinedContext } from "../lib/utils"

type ChatProviderProps = {
  activeFileContent: string
  activeFileName: string
  projectType: string
  fileTree: (TFile | TFolder)[]
  projectName: string
  children: ReactNode
}

type ChatContextType = {
  activeFileContent?: string
  activeFileName?: string
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  input: string
  setInput: React.Dispatch<React.SetStateAction<string>>
  isGenerating: boolean
  isLoading: boolean
  contextTabs: ContextTab[]
  addContextTab: (newTab: ContextTab) => void
  removeContextTab: (id: string) => void
  sendMessage: (message: string, context?: string) => Promise<void>
  stopGeneration: () => void
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

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [contextTabs, setContextTabs] = useState<ContextTab[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)

  const addContextTab = (newTab: ContextTab) => {
    setContextTabs((prev) => [...prev, newTab])
  }

  const removeContextTab = (id: string) => {
    setContextTabs((prev) => prev.filter((tab) => tab.id !== id))
  }

  const sendMessage = async (message: string) => {
    if (!message.trim()) return
    const userMessage: Message = {
      role: "user",
      content: message,
      context: contextTabs,
    }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setContextTabs([])
    setInput("")
    setIsGenerating(true)
    setIsLoading(true)
    const contextContent = await getCombinedContext({
      contextTabs,
      queryClient,
      projectId,
      drafts,
    })
    abortControllerRef.current = new AbortController()
    try {
      const { output } = await streamChat(updatedMessages, {
        templateType: projectType,
        activeFileContent,
        fileTree,
        contextContent,
        projectId,
        projectName,
        fileName: activeFileName,
      })
      const assistantMessage: Message = { role: "assistant", content: "" }
      setMessages([...updatedMessages, assistantMessage])
      let buffer = ""
      let firstChunk = true
      for await (const chunk of readStreamableValue(output)) {
        if (abortControllerRef.current?.signal.aborted) break
        buffer += chunk
        if (firstChunk) {
          setIsLoading(false)
          firstChunk = false
        }
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1].content = buffer
          return updated
        })
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Generation aborted")
      } else {
        console.error("Error:", error)
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1].content =
            error.message || "Sorry, an error occurred."
          return updated
        })
      }
    } finally {
      setIsGenerating(false)
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const stopGeneration = () => {
    abortControllerRef.current?.abort()
  }

  return (
    <ChatContext.Provider
      value={{
        activeFileContent,
        activeFileName,
        messages,
        setMessages,
        input,
        setInput,
        isGenerating,
        isLoading,
        contextTabs,
        addContextTab,
        removeContextTab,
        sendMessage,
        stopGeneration,
      }}
    >
      {children}
    </ChatContext.Provider>
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
