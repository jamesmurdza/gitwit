"use client"

import { Button } from "@/components/ui/button"
import { useEditor } from "@/context/editor-context"
import { useTerminal } from "@/context/TerminalContext"
import { Sandbox } from "@/lib/types"
import { templateConfigs } from "@gitwit/templates"
import { LoaderCircle, Play, StopCircle } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

export default function RunButtonModal({
  isRunning,
  setIsRunning,
  sandboxData,
}: {
  isRunning: boolean
  setIsRunning: (running: boolean) => void
  sandboxData: Sandbox
}) {
  const { gridRef, dockRef, terminalRef } = useEditor()
  const { resolvedTheme } = useTheme()
  const {
    createNewTerminal,
    closeTerminal,
    terminals,
    creatingTerminal,
    closingTerminal,
  } = useTerminal()
  // Ref to keep track of the last created terminal's ID
  const lastCreatedTerminalRef = useRef<string | null>(null)
  // Disable button when creating or closing a terminal
  const isTransitioning = creatingTerminal || !!closingTerminal

  // Effect to update the lastCreatedTerminalRef when a new terminal is added
  useEffect(() => {
    if (terminals.length > 0 && !isRunning) {
      const latestTerminal = terminals[terminals.length - 1]
      if (
        latestTerminal &&
        latestTerminal.id !== lastCreatedTerminalRef.current
      ) {
        lastCreatedTerminalRef.current = latestTerminal.id
      }
    }
  }, [terminals, isRunning])
  // commands to run in the terminal
  const handleRun = async () => {
    // Guard against rapid clicks during state transitions
    if (isTransitioning) return

    if (isRunning && lastCreatedTerminalRef.current) {
      // Stop: Close the terminal (panel will auto-hide if it's the last one)
      await closeTerminal(lastCreatedTerminalRef.current)
      lastCreatedTerminalRef.current = null

      // Close preview panel if it exists
      const previewPanel = dockRef.current?.panels.find(
        (panel) => panel.id === "preview",
      )
      if (previewPanel) {
        previewPanel.api.close()
      }
    } else if (!isRunning && terminals.length < 4) {
      const command =
        templateConfigs[sandboxData.type]?.runCommand || "npm run dev"

      try {
        // Show terminal panel if hidden
        const terminalPanel = gridRef.current?.getPanel("terminal")
        if (terminalPanel && !terminalPanel.api.isVisible) {
          terminalPanel.api.setVisible(true)
        }

        // Create a new terminal with the appropriate command
        const terminalId = await createNewTerminal(command)
        if (!terminalId) {
          throw new Error("Failed to create terminal")
        }

        // Add terminal panel to the terminal container
        terminalRef.current?.addPanel({
          id: `terminal-${terminalId}`,
          component: "terminal",
          title: "Shell",
          tabComponent: "terminal",
          params: {
            dockRef,
            terminalRef,
            theme: resolvedTheme,
          },
        })
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to create new terminal",
        )
        return
      }
    } else if (!isRunning) {
      toast.error("You've reached the maximum number of terminals.")
      return
    }

    setIsRunning(!isRunning)
  }

  return (
    <Button variant="outline" onClick={handleRun} disabled={isTransitioning}>
      {isTransitioning ? (
        <LoaderCircle className="size-4 mr-2 animate-spin" />
      ) : isRunning ? (
        <StopCircle className="size-4 mr-2" />
      ) : (
        <Play className="size-4 mr-2" />
      )}
      {isRunning ? "Stop" : "Run"}
    </Button>
  )
}
