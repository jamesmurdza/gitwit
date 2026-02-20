import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { useEditor } from "@/context/editor-context"
import { useSocket } from "@/context/SocketContext"
import { useTerminal } from "@/context/TerminalContext"
import type { IWatermarkPanelProps } from "dockview"
import { Loader2, TerminalSquare } from "lucide-react"

export function MainWatermark(_props: IWatermarkPanelProps) {
  const { gridRef, terminalRef } = useEditor()
  const { creatingTerminal, createNewTerminal } = useTerminal()
  const { isReady: isSocketReady } = useSocket()

  function toggleAIChat() {
    const panel = gridRef.current?.getPanel("chat")
    panel?.api.setVisible(!panel.api.isVisible)
  }

  function toggleTerminal() {
    const panel = gridRef.current?.getPanel("terminal")
    if (!panel) return
    const isVisible = panel.api.isVisible
    panel.api.setVisible(!isVisible)
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
  }

  return (
    <div className="watermark space-y-4">
      <div className="letterpress" />
      <div className="flex flex-col gap-1 w-full">
        <button
          onClick={toggleAIChat}
          className="flex justify-between w-full items-center"
          style={{ opacity: 1 }}
        >
          <span className="text-xs text-muted-foreground">Open AI Chat</span>
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>L</Kbd>
          </KbdGroup>
        </button>
        <button
          onClick={toggleTerminal}
          className="flex justify-between w-full items-center"
          style={{ opacity: 1 }}
        >
          <span className="text-xs text-muted-foreground">Open Terminal</span>
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>`</Kbd>
          </KbdGroup>
        </button>
      </div>
    </div>
  )
}
export function TerminalWatermark(_props: IWatermarkPanelProps) {
  const { creatingTerminal } = useTerminal()

  return (
    <div className="watermark">
      {creatingTerminal ? (
        <div className="w-full h-full flex items-center justify-center text-lg font-medium text-muted-foreground/50 select-none">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Creating terminal...
        </div>
      ) : (
        <div className="flex flex-col gap-4 w-full">
          <div className="flex items-center justify-center text-lg font-medium text-muted-foreground/50 select-none">
            <TerminalSquare className="w-4 h-4 mr-2" />
            No terminals open.
          </div>
          <button
            disabled
            aria-disabled="true"
            className="flex justify-between w-full items-center"
            style={{ opacity: 1 }}
          >
            <span className="text-xs text-muted-foreground">New Terminal</span>
            <KbdGroup>
              <Kbd>⌃</Kbd>
              <Kbd>⇧</Kbd>
              <Kbd>`</Kbd>
            </KbdGroup>
          </button>
        </div>
      )}
    </div>
  )
}
