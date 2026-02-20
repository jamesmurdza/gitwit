"use client"

import { ChatProvider } from "./chat/providers/chat-provider"
import { Dock } from "./layout"
import { StatusBar } from "./layout/components/status-bar"

export default function Project() {
  return (
    <ChatProvider>
      <Dock />
      <StatusBar />
    </ChatProvider>
  )
}
