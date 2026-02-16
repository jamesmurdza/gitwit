"use client"

import { ChatProvider } from "./chat/providers/chat-provider"
import { Dock } from "./layout"

export default function Project() {
  return (
    <ChatProvider>
      <Dock />
    </ChatProvider>
  )
}
