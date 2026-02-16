import { useEditor } from "@/context/editor-context"
import { useSocket } from "@/context/SocketContext"
import { useTerminal } from "@/context/TerminalContext"
import { DockviewApi, GridviewApi } from "dockview"
import { editor, KeyCode, KeyMod } from "monaco-editor"
import { MutableRefObject, useEffect } from "react"

/**
 * Hook to manage global keyboard shortcuts for the editor layout
 */
export function useGlobalShortcut() {
  const { gridRef, terminalRef, dockRef } = useEditor()
  const { creatingTerminal, createNewTerminal } = useTerminal()
  const { isReady: isSocketReady } = useSocket()

  useEffect(() => {
    const controller = new AbortController()
    // listen for cmd L to toggle chat panel visibility
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
        e.preventDefault()
        const chatPanel = gridRef.current?.getPanel("chat")
        if (chatPanel) {
          const isVisible = chatPanel.api.isVisible
          chatPanel.api.setVisible(!isVisible)
        }
      }
      // listen for ctrl ` to toggle terminal
      if (e.ctrlKey && e.key === "`") {
        e.preventDefault()
        const terminalPanel = gridRef.current?.getPanel("terminal")
        const existingTerminals = Boolean(terminalRef.current?.panels.length)

        if (terminalPanel) {
          const isVisible = terminalPanel.api.isVisible
          terminalPanel.api.setVisible(!isVisible)
          if (!existingTerminals && isSocketReady) {
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
      }
      // listen for cmd B to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault()
        const sidebarPanel = gridRef.current?.getPanel("sidebar")
        if (sidebarPanel) {
          const isVisible = sidebarPanel.api.isVisible
          sidebarPanel.api.setVisible(!isVisible)
        }
      }

      //   listen for Ctrl Shift ` for new terminal
      if (e.ctrlKey && e.shiftKey && e.key === "`") {
        e.preventDefault()
        gridRef.current?.getPanel("terminal")?.api.setVisible(true)
        if (!creatingTerminal) {
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
    }
    window.addEventListener("keydown", handleKeyDown, {
      signal: controller.signal,
    })
    return () => {
      controller.abort()
    }
  }, [gridRef, terminalRef, creatingTerminal, createNewTerminal, isSocketReady])
  // Handle browser beforeunload event for unsaved changes
  useEffect(() => {
    const controller = new AbortController()

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasUnsavedFiles = dockRef.current?.panels.some(
        (panel) => !panel.params?.saved,
      )
      if (hasUnsavedFiles) {
        e.preventDefault()
        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?"
        return e.returnValue
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload, {
      signal: controller.signal,
    })
    return () => controller.abort()
  }, [dockRef])
}

export function enableEditorShortcuts({
  monaco,
  gridRef,
  terminalRef,
  createNewTerminal,
  isCreatingTerminal,
  saveFile,
}: {
  monaco: editor.IStandaloneCodeEditor
  gridRef: MutableRefObject<GridviewApi | undefined>
  terminalRef: MutableRefObject<DockviewApi | undefined>
  createNewTerminal: () => Promise<string | null>
  isCreatingTerminal: boolean
  saveFile: () => void
}) {
  // listen for cmd L to toggle chat panel visibility
  monaco.addCommand(KeyMod.CtrlCmd | KeyCode.KeyL, () => {
    const chatPanel = gridRef.current?.getPanel("chat")
    if (chatPanel) {
      const isVisible = chatPanel.api.isVisible
      chatPanel.api.setVisible(!isVisible)
    }
  })
  // listen for ctrl ` to toggle terminal
  monaco.addCommand(KeyMod.CtrlCmd | KeyCode.Backquote, () => {
    const terminalPanel = gridRef.current?.getPanel("terminal")
    if (terminalPanel) {
      const isVisible = terminalPanel.api.isVisible
      terminalPanel.api.setVisible(!isVisible)
    }
  })
  // listen for cmd B to toggle sidebar
  monaco.addCommand(KeyMod.CtrlCmd | KeyCode.KeyB, () => {
    const sidebarPanel = gridRef.current?.getPanel("sidebar")
    if (sidebarPanel) {
      const isVisible = sidebarPanel.api.isVisible
      sidebarPanel.api.setVisible(!isVisible)
    }
  })

  //   listen for Ctrl Shift ` for new terminal
  monaco.addCommand(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Backquote, () => {
    gridRef.current?.getPanel("terminal")?.api.setVisible(true)
    if (!isCreatingTerminal) {
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
  })
  // listen for cmd S to save file
  monaco.addCommand(KeyMod.CtrlCmd | KeyCode.KeyS, () => {
    saveFile()
  })
}
