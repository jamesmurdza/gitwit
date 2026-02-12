import { useContainer } from "@/context/container-context"
import { useSocket } from "@/context/SocketContext"
import { useTerminal } from "@/context/TerminalContext"
import {
  DockviewDidDropEvent,
  DockviewDndOverlayEvent,
  DockviewReact,
  GridviewReact,
  IDockviewPanelProps,
  IGridviewPanelProps,
  Orientation,
  themeDark,
  themeLight,
} from "dockview"
import { useTheme } from "next-themes"
import { useCallback, useEffect, type FunctionComponent } from "react"
import { useEditorSocket } from "../hooks/useEditorSocket"
import { ChatPanel } from "./components/chat-panel"
import { EditorPanel } from "./components/editor-panel"
import { PreviewPanel } from "./components/preview-panel"
import { TerminalRightHeaderActions } from "./components/right-header-actions"
import { SideBarPanel } from "./components/sidebar-panel"
import { tabComponents } from "./components/tab-components"
import { TerminalPanel } from "./components/terminal-panel"
import { MainWatermark, TerminalWatermark } from "./components/watermark"
import { useChatPanelHandlers } from "./hooks/useChatPanelHandlers"
import { handleTerminalDrop, loadDefaultGridviewLayout } from "./utils"
import { useGlobalShortcut } from "./utils/shortcuts"

type PanelCollection<T> = Record<string, FunctionComponent<T>>

interface DockProps {}

export function Dock(_props: DockProps) {
  const { resolvedTheme } = useTheme()
  const { gridRef, dockRef, terminalRef } = useContainer()
  const { isReady: isSocketReady } = useSocket()
  const { creatingTerminal, createNewTerminal } = useTerminal()
  const chatHandlers = useChatPanelHandlers()

  useEditorSocket()
  useGlobalShortcut()

  // Handler to accept drag events from file explorer and terminal panels
  const handleDockUnhandledDragOver = useCallback(
    (event: DockviewDndOverlayEvent) => {
      // Accept all drags - this allows dropping into empty containers
      event.accept()
    },
    [],
  )

  // Handler for terminal panel drops from terminal container to dock
  const handleDockDidDrop = useCallback(
    (event: DockviewDidDropEvent) => {
      const result = handleTerminalDrop({
        event,
        sourceContainerRef: terminalRef,
        targetContainerRef: dockRef,
      })

      if (result.handled) {
        // If terminal container is now empty, hide the terminal grid panel
        if (terminalRef.current?.panels.length === 0) {
          const terminalGridPanel = gridRef.current?.getPanel("terminal")
          if (terminalGridPanel) {
            terminalGridPanel.api.setVisible(false)
          }
        }
      }
    },
    [terminalRef, dockRef, gridRef],
  )

  // Handler for terminal panel drops from dock back to terminal container
  const handleTerminalDidDrop = useCallback(
    (event: DockviewDidDropEvent) => {
      const result = handleTerminalDrop({
        event,
        sourceContainerRef: dockRef,
        targetContainerRef: terminalRef,
      })

      if (result.handled) {
        // Drop handled
      }
    },
    [dockRef, terminalRef],
  )

  // components
  const dockComponents: PanelCollection<IDockviewPanelProps> = {
    terminal: TerminalPanel,
    editor: EditorPanel,
    preview: PreviewPanel,
  }
  const terminalComponents: PanelCollection<IDockviewPanelProps> = {
    terminal: TerminalPanel,
  }
  const gridComponents: PanelCollection<IGridviewPanelProps> = {
    dock: (props: IGridviewPanelProps) => {
      const { resolvedTheme } = useTheme()

      return (
        <DockviewReact
          theme={resolvedTheme === "dark" ? themeDark : themeLight}
          tabComponents={tabComponents}
          watermarkComponent={MainWatermark}
          components={dockComponents}
          onReady={(event) => {
            dockRef.current = event.api
            // Set up handler for external drag events (from file explorer)
            event.api.onUnhandledDragOverEvent(handleDockUnhandledDragOver)
          }}
          onDidDrop={handleDockDidDrop}
        />
      )
    },

    terminal: (props: IGridviewPanelProps) => {
      const { resolvedTheme } = useTheme()

      return (
        <DockviewReact
          theme={resolvedTheme === "dark" ? themeDark : themeLight}
          tabComponents={tabComponents}
          watermarkComponent={TerminalWatermark}
          components={terminalComponents}
          rightHeaderActionsComponent={TerminalRightHeaderActions}
          onReady={(event) => {
            terminalRef.current = event.api
            // Accept drags from dock to allow terminal panels back
            event.api.onUnhandledDragOverEvent(handleDockUnhandledDragOver)
          }}
          onDidDrop={handleTerminalDidDrop}
        />
      )
    },
    sidebar: SideBarPanel,
    chat: (props: IGridviewPanelProps) => (
      <ChatPanel
        {...props}
        params={{
          onApplyCode: chatHandlers.onApplyCode,
          onRejectCode: chatHandlers.onRejectCode,
          precomputeMergeForFile: chatHandlers.precomputeMergeForFile,
          applyPrecomputedMerge: chatHandlers.applyPrecomputedMerge,
          restoreOriginalFile: chatHandlers.restoreOriginalFile,
          getCurrentFileContent: chatHandlers.getCurrentFileContent,
          onOpenFile: chatHandlers.onOpenFile,
        }}
      />
    ),
  }

  useEffect(() => {
    if (resolvedTheme) {
      gridRef.current
        ?.getPanel("dock")
        ?.api.updateParameters({ theme: resolvedTheme })
    }
  }, [resolvedTheme, gridRef])

  useEffect(() => {
    if (!isSocketReady) return
    // create terminal on load if none exist
    if (!creatingTerminal && terminalRef.current) {
      const existingTerminals = terminalRef.current.panels.length
      if (existingTerminals === 0) {
        createNewTerminal().then((id) => {
          if (!id) return
          // add terminal panel
          terminalRef.current?.addPanel({
            id: `terminal-${id}`,
            component: "terminal",
            title: "Shell",
            tabComponent: "terminal",
          })
        })
      }
    }
  }, [isSocketReady])
  return (
    <div className="max-h-full overflow-hidden w-full h-full">
      <GridviewReact
        orientation={Orientation.HORIZONTAL}
        components={gridComponents}
        className={
          (resolvedTheme === "dark" ? themeDark : themeLight).className
        }
        proportionalLayout={false}
        onReady={(event) => {
          gridRef.current = event.api
          loadDefaultGridviewLayout({
            grid: event.api,
          })
        }}
      />
    </div>
  )
}
