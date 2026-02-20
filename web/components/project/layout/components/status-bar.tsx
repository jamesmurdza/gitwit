"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useEditor } from "@/context/editor-context"
import { useSocket } from "@/context/SocketContext"
import { useTerminal } from "@/context/TerminalContext"
import { cn } from "@/lib/utils"
import { useCallback, useEffect, useMemo, useState } from "react"

function useIsMac() {
  return useMemo(() => {
    if (typeof navigator === "undefined") return true
    return navigator.platform?.startsWith("Mac") || navigator.platform === "iPhone"
  }, [])
}

function StatusBarButton({
  label,
  shortcut,
  active,
  onClick,
}: {
  label: string
  shortcut: string
  active: boolean
  onClick: () => void
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded-sm transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <kbd className="text-[10px] border border-muted-foreground/40 rounded px-1 leading-4">
              {shortcut}
            </kbd>
            <span>{label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {label} ({shortcut})
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function StatusBar() {
  const { gridRef, terminalRef, setIsAIChatOpen } = useEditor()
  const { creatingTerminal, createNewTerminal } = useTerminal()
  const { isReady: isSocketReady } = useSocket()
  const isMac = useIsMac()

  const mod = isMac ? "⌘" : "Ctrl+"
  const ctrl = isMac ? "⌃" : "Ctrl+"

  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [terminalVisible, setTerminalVisible] = useState(true)
  const [chatVisible, setChatVisible] = useState(false)

  // Track panel visibility reactively via Dockview events
  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const disposables: { dispose: () => void }[] = []

    const sidebarPanel = grid.getPanel("sidebar")
    if (sidebarPanel) {
      setSidebarVisible(sidebarPanel.api.isVisible)
      disposables.push(
        sidebarPanel.api.onDidVisibilityChange(({ isVisible }) =>
          setSidebarVisible(isVisible)
        )
      )
    }

    const terminalPanel = grid.getPanel("terminal")
    if (terminalPanel) {
      setTerminalVisible(terminalPanel.api.isVisible)
      disposables.push(
        terminalPanel.api.onDidVisibilityChange(({ isVisible }) =>
          setTerminalVisible(isVisible)
        )
      )
    }

    const chatPanel = grid.getPanel("chat")
    if (chatPanel) {
      setChatVisible(chatPanel.api.isVisible)
      disposables.push(
        chatPanel.api.onDidVisibilityChange(({ isVisible }) => {
          setChatVisible(isVisible)
          setIsAIChatOpen(isVisible)
        })
      )
    }

    return () => disposables.forEach((d) => d.dispose())
  }, [gridRef.current, setIsAIChatOpen])

  const toggleSidebar = useCallback(() => {
    const panel = gridRef.current?.getPanel("sidebar")
    if (panel) {
      panel.api.setVisible(!panel.api.isVisible)
    }
  }, [gridRef])

  const toggleTerminal = useCallback(() => {
    const panel = gridRef.current?.getPanel("terminal")
    if (!panel) return

    const isVisible = panel.api.isVisible
    panel.api.setVisible(!isVisible)

    // If showing terminal and no terminals exist, create one
    if (!isVisible && isSocketReady) {
      const existingTerminals = Boolean(terminalRef.current?.panels.length)
      if (!existingTerminals && !creatingTerminal) {
        createNewTerminal().then((id) => {
          if (!id) return
          terminalRef.current?.addPanel({
            id: `terminal-${id}`,
            component: "terminal",
            title: "Shell",
            tabComponent: "terminal",
          })
        })
      }
    }
  }, [gridRef, terminalRef, isSocketReady, creatingTerminal, createNewTerminal])

  const toggleChat = useCallback(() => {
    const panel = gridRef.current?.getPanel("chat")
    if (panel) {
      panel.api.setVisible(!panel.api.isVisible)
    }
  }, [gridRef])

  return (
    <div className="h-7 px-2 flex items-center justify-between border-t bg-background text-xs select-none">
      <div className="flex items-center gap-0.5">
        <StatusBarButton
          label="Sidebar"
          shortcut={`${mod}B`}
          active={sidebarVisible}
          onClick={toggleSidebar}
        />
        <StatusBarButton
          label="Terminal"
          shortcut={`${ctrl}\``}
          active={terminalVisible}
          onClick={toggleTerminal}
        />
      </div>
      <div className="flex items-center gap-0.5">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-muted-foreground">
                <kbd className="text-[10px] border border-muted-foreground/40 rounded px-1 leading-4">
                  {mod}G
                </kbd>
                <span>AI Edit</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              AI Edit ({mod}G) — select code in editor
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <StatusBarButton
          label="AI Chat"
          shortcut={`${mod}L`}
          active={chatVisible}
          onClick={toggleChat}
        />
      </div>
    </div>
  )
}
