"use client"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/context"
import { ChatThread } from "@/store/slices/chat"
import { formatDistanceToNow } from "date-fns"
import { History, MessageSquare, Plus, Trash2 } from "lucide-react"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"
import { ChatContainerAction } from "./chat-container"

interface HistoryItemProps {
  thread: ChatThread
  isActive: boolean
  onSwitch: (threadId: string) => void
  onDelete: (threadId: string, e: React.MouseEvent) => void
}

function HistoryItem({
  thread,
  isActive,
  onSwitch,
  onDelete,
}: HistoryItemProps) {
  const messageCount = thread.messages.length
  const timeAgo = formatDistanceToNow(new Date(thread.updatedAt), {
    addSuffix: true,
  })

  return (
    <div
      className={cn(
        "group relative rounded-lg px-2 py-1 mb-2 cursor-pointer transition-colors",
        isActive ? "bg-accent/50 border border-border" : "hover:bg-accent/20",
      )}
      onClick={() => onSwitch(thread.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium truncate">{thread.title}</h4>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{messageCount} messages</span>
            <span>•</span>
            <span>{timeAgo}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => onDelete(thread.id, e)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete thread</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}

export function ChatHistory() {
  const params = useParams()
  const createThread = useAppStore((s) => s.createThread)
  const projectId = params.id as string
  const threads = useAppStore((s) => s.threads)
  const [open, setOpen] = useState(false)

  const sortedThreads = useMemo(() => {
    return Object.values(threads)
      .filter((t: ChatThread) => t.projectId === projectId)
      .sort(
        (a: ChatThread, b: ChatThread) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
  }, [threads, projectId])
  const handleNewThread = () => {
    createThread(projectId)
  }
  const activeThreadId = useAppStore((s) => s.activeThreadId)
  const setActiveThread = useAppStore((s) => s.setActiveThread)
  const deleteThread = useAppStore((s) => s.deleteThread)

  const handleSwitchThread = (threadId: string) => {
    setActiveThread(threadId)
    setOpen(false)
  }

  const handleDeleteThread = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteThread(threadId)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ChatContainerAction label="Chat History">
          <History className="h-4 w-4" />
        </ChatContainerAction>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="start"
        sideOffset={12}
        collisionPadding={12}
      >
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="grid gap-0.55">
            <h3 className="font-medium text-sm">Chat History</h3>
          </div>
          <ChatContainerAction label="New chat" onClick={handleNewThread}>
            <Plus className="h-4 w-4" />
          </ChatContainerAction>
        </div>
        <ScrollArea className="h-[300px]">
          {sortedThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No chat history</p>
              <p className="text-xs text-muted-foreground mt-1">
                Start a conversation to see it here
              </p>
            </div>
          ) : (
            <div className="p-2">
              {sortedThreads.map((thread: ChatThread) => (
                <HistoryItem
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === activeThreadId}
                  onSwitch={handleSwitchThread}
                  onDelete={handleDeleteThread}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
