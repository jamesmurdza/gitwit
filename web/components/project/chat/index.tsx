import { cn } from "@/lib/utils"
import { Brain } from "lucide-react"
import React from "react"
import {
  ChatContainerActions,
  ChatContainerCollapse,
  ChatContainerContent,
  ChatContainerEmpty,
  ChatContainerHeader,
  ChatContainerMaximizeToggle,
  ChatContainerRoot,
  ChatContainerSettings,
  ChatContainerTitle,
  ChatScrollContainer,
  ScrollButton,
} from "./components/chat-container"
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
import { Message, MessageContent } from "./components/message"
import { useChat } from "./providers/chat-provider"

export const AIChat = React.memo(() => {
  return (
    <ChatContainerRoot>
      <ChatContainerHeader>
        <ChatContainerTitle>Chat</ChatContainerTitle>
        <ChatContainerActions>
          <ChatContainerSettings />
          <ChatContainerMaximizeToggle />
          <ChatContainerCollapse />
        </ChatContainerActions>
      </ChatContainerHeader>
      <MainChatContent />
      <MainChatInput />
    </ChatContainerRoot>
  )
})
function MainChatContent() {
  const { messages, isLoading } = useChat()
  const isEmpty = messages.length === 0

  if (isEmpty) {
    return <ChatContainerEmpty />
  }
  return (
    <ChatScrollContainer className="flex-1 relative max-w-4xl mx-auto">
      <ChatContainerContent className="px-2 py-4  overflow-x-hidden">
        {messages.map((message, i) => {
          return (
            <Message role={message.role} context={message.context} key={i}>
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
          "animate-[shimmer_4s_infinite_linear] text-sm"
        )}
      >
        Gitwit is thinking...
      </div>
    </div>
  )
}
function MainChatInput() {
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
      <ChatInput
        value={input}
        onValueChange={handleValueChange}
        isLoading={isGenerating || isLoading}
        onSubmit={handleSubmit}
        className="w-full max-w-4xl mx-auto"
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
  const { contextTabs, removeContextTab } = useChat()
  return (
    <div className="flex gap-2 w-full flex-wrap">
      {contextTabs.map((tab) => (
        <ContextTab key={tab.id} {...tab} removeContext={removeContextTab} />
      ))}
    </div>
  )
}
