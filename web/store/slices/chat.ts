import { createId } from "@paralleldrive/cuid2"
import { StateCreator } from ".."
import type { Message } from "../../components/project/chat/lib/types"

export interface ChatThread {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  projectId: string
}

interface ChatSlice {
  // State
  threads: Record<string, ChatThread>
  activeThreadId: string | null

  // Actions
  createThread: (projectId: string, initialMessage?: Message) => string
  deleteThread: (threadId: string) => void
  setActiveThread: (threadId: string | null) => void
  addMessage: (threadId: string, message: Message) => void
  updateMessage: (
    threadId: string,
    messageIndex: number,
    content: string
  ) => void
  clearThread: (threadId: string) => void
  updateThreadTitle: (threadId: string, title: string) => void

  // Hydration for persistence
  _hasHydrated: boolean
  setHasHydrated: (state: boolean) => void
}

const createChatSlice: StateCreator<ChatSlice> = (set, get) => ({
  // State
  threads: {},
  activeThreadId: null,
  _hasHydrated: false,

  // Actions
  createThread: (projectId, initialMessage) => {
    const id = createId()
    const now = Date.now()

    const newThread: ChatThread = {
      id,
      title: initialMessage?.content.slice(0, 50) || "New Chat",
      messages: initialMessage ? [initialMessage] : [],
      createdAt: now,
      updatedAt: now,
      projectId,
    }

    set((state) => ({
      threads: {
        ...state.threads,
        [id]: newThread,
      },
      activeThreadId: id,
    }))

    return id
  },

  deleteThread: (threadId) => {
    set((state) => {
      const { [threadId]: _, ...remainingThreads } = state.threads
      const newActiveThreadId =
        state.activeThreadId === threadId
          ? Object.keys(remainingThreads)[0] || null
          : state.activeThreadId

      return {
        threads: remainingThreads,
        activeThreadId: newActiveThreadId,
      }
    })
  },

  setActiveThread: (threadId) => {
    set({ activeThreadId: threadId })
  },

  addMessage: (threadId, message) => {
    set((state) => {
      const thread = state.threads[threadId]
      if (!thread) return state

      const updatedThread: ChatThread = {
        ...thread,
        messages: [...thread.messages, message],
        updatedAt: Date.now(),
        title:
          thread.title === "New Chat" && message.role === "user"
            ? message.content.slice(0, 50) +
              (message.content.length > 50 ? "..." : "")
            : thread.title,
      }

      return {
        threads: {
          ...state.threads,
          [threadId]: updatedThread,
        },
      }
    })
  },

  updateMessage: (threadId, messageIndex, content) => {
    set((state) => {
      const thread = state.threads[threadId]
      if (!thread || !thread.messages[messageIndex]) return state

      const updatedMessages = [...thread.messages]
      updatedMessages[messageIndex] = {
        ...updatedMessages[messageIndex],
        content,
      }

      return {
        threads: {
          ...state.threads,
          [threadId]: {
            ...thread,
            messages: updatedMessages,
            updatedAt: Date.now(),
          },
        },
      }
    })
  },

  clearThread: (threadId) => {
    set((state) => {
      const thread = state.threads[threadId]
      if (!thread) return state

      return {
        threads: {
          ...state.threads,
          [threadId]: {
            ...thread,
            messages: [],
            title: "New Chat",
            updatedAt: Date.now(),
          },
        },
      }
    })
  },

  updateThreadTitle: (threadId, title) => {
    set((state) => {
      const thread = state.threads[threadId]
      if (!thread) return state

      return {
        threads: {
          ...state.threads,
          [threadId]: {
            ...thread,
            title,
            updatedAt: Date.now(),
          },
        },
      }
    })
  },

  setHasHydrated: (state) => {
    set({ _hasHydrated: state })
  },
})

export { createChatSlice, type ChatSlice }
