"use client"

import { useSocket } from "@/context/SocketContext"
import {
  closeTerminal as closeTerminalHelper,
  createTerminal as createTerminalHelper,
} from "@/lib/api/terminal"
import { Terminal } from "@xterm/xterm"
import React, { createContext, useContext, useState } from "react"
import { toast } from "sonner"

interface TerminalContextType {
  terminals: { id: string; terminal: Terminal | null }[]
  setTerminals: React.Dispatch<
    React.SetStateAction<{ id: string; terminal: Terminal | null }[]>
  >
  activeTerminalId: string
  setActiveTerminalId: React.Dispatch<React.SetStateAction<string>>
  creatingTerminal: boolean
  setCreatingTerminal: React.Dispatch<React.SetStateAction<boolean>>
  closingTerminal: string
  createNewTerminal: (command?: string) => Promise<void>
  closeTerminal: (id: string) => Promise<void>
  deploy: (callback: () => void) => void
  getAppExists:
    | ((appName: string) => Promise<{ success: boolean; exists?: boolean }>)
    | null
}

const TerminalContext = createContext<TerminalContextType | undefined>(
  undefined
)

export const TerminalProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { socket } = useSocket()
  const [terminals, setTerminals] = useState<
    { id: string; terminal: Terminal | null }[]
  >([])
  const [activeTerminalId, setActiveTerminalId] = useState<string>("")
  const [creatingTerminal, setCreatingTerminal] = useState<boolean>(false)
  const [closingTerminal, setClosingTerminal] = useState<string>("")
  const [isSocketReady, setIsSocketReady] = useState<boolean>(false)

  // Listen for the "ready" signal from the socket
  React.useEffect(() => {
    if (socket) {
      socket.on("ready", () => {
        setIsSocketReady(true)
      })
    }
    return () => {
      if (socket) socket.off("ready")
    }
  }, [socket])

  const createNewTerminal = async (command?: string): Promise<void> => {
    if (!socket) return
    if (creatingTerminal) return // Guard against creating while another create is in progress
    try {
      await createTerminalHelper({
        setTerminals,
        setActiveTerminalId,
        setCreatingTerminal,
        command,
        socket,
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create new terminal"
      )
    }
  }

  const closeTerminal = async (id: string): Promise<void> => {
    if (!socket) return
    if (closingTerminal) return // Guard against closing while another close is in progress
    const terminalToClose = terminals.find((term) => term.id === id)
    if (terminalToClose) {
      await closeTerminalHelper({
        term: terminalToClose,
        terminals,
        setTerminals,
        setActiveTerminalId,
        setClosingTerminal,
        socket,
        activeTerminalId,
      })
    }
  }

  const deploy = (callback: () => void) => {
    if (!socket) console.error("Couldn't deploy: No socket")
    socket?.emit("deploy", {}, () => {
      callback()
    })
  }

  const getAppExists = async (
    appName: string
  ): Promise<{ success: boolean; exists?: boolean }> => {
    if (!socket) {
      console.error("Couldn't check if app exists: No socket")
      return { success: false }
    }
    const response: { success: boolean; exists?: boolean } = await new Promise(
      (resolve) => socket.emit("getAppExists", { appName }, resolve)
    )
    return response
  }

  const value = {
    terminals,
    setTerminals,
    activeTerminalId,
    setActiveTerminalId,
    creatingTerminal,
    setCreatingTerminal,
    closingTerminal,
    createNewTerminal,
    closeTerminal,
    deploy,
    getAppExists: isSocketReady ? getAppExists : null,
  }

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  )
}

export const useTerminal = (): TerminalContextType => {
  const context = useContext(TerminalContext)
  if (!context) {
    throw new Error("useTerminal must be used within a TerminalProvider")
  }
  return context
}
