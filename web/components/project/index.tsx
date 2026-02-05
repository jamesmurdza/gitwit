"use client"

import { EditorHandlersProvider } from "@/context/editor-handlers-context"
import { ChatProvider } from "./chat/providers/chat-provider"
import { Dock } from "./layout"

export default function Project() {
  return (
    <EditorHandlersProvider>
      <ChatProvider>
        <Dock />
      </ChatProvider>
    </EditorHandlersProvider>
  )
}
