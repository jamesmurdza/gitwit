import { useTerminal } from "@/context/TerminalContext"
import { cn } from "@/lib/utils"
import { Loader2, PlayIcon } from "lucide-react"
import { ComponentProps, useContext, useEffect, useState } from "react"
import { toast } from "sonner"
import { StreamdownContext } from "streamdown"
import { useCodeBlockContext } from "./context"

export type CodeBlockRunButtonProps = ComponentProps<"button"> & {
  language?: string
}

// Languages that can be executed in a terminal
const TERMINAL_LANGUAGES = new Set([
  "bash",
  "sh",
  "shell",
  "zsh",
  "powershell",
  "ps1",
  "cmd",
  "bat",
  "batch",
  "fish",
  "ksh",
  "csh",
  "tcsh",
])

const isTerminalLanguage = (lang?: string) =>
  lang ? TERMINAL_LANGUAGES.has(lang.toLowerCase()) : false

export const CodeBlockRunButton = ({
  language,
  className,
  children,
  ...props
}: CodeBlockRunButtonProps) => {
  const { code: contextCode } = useCodeBlockContext()
  const { isAnimating } = useContext(StreamdownContext)
  const {
    createNewTerminal,
    terminals,
    creatingTerminal,
    isTerminalBusy,
    terminalExists,
    sendCommandToTerminal,
  } = useTerminal()
  // Store the last terminal ID used by this button
  const [lastTerminalId, setLastTerminalId] = useState<string | null>(null)
  // Track if THIS button triggered the current execution
  const [isExecuting, setIsExecuting] = useState(false)

  const canRun = isTerminalLanguage(language)

  // Reset executing state when our terminal becomes idle
  useEffect(() => {
    if (lastTerminalId && isExecuting) {
      const terminal = terminals.find((t) => t.id === lastTerminalId)
      if (terminal && !terminal.isBusy) {
        setIsExecuting(false)
      }
    }
  }, [lastTerminalId, terminals, isExecuting])

  // Find an idle terminal from existing ones
  const findIdleTerminal = (): string | null => {
    // First check if our last used terminal is still idle
    if (
      lastTerminalId &&
      terminalExists(lastTerminalId) &&
      !isTerminalBusy(lastTerminalId)
    ) {
      return lastTerminalId
    }
    // Otherwise find any idle terminal
    for (const terminal of terminals) {
      if (!terminal.isBusy) {
        return terminal.id
      }
    }
    return null
  }

  const handleRun = async () => {
    if (!canRun || !contextCode?.trim() || isExecuting) return

    const command = contextCode.trim()
    setIsExecuting(true)

    try {
      const idleTerminalId = findIdleTerminal()

      if (idleTerminalId) {
        // Reuse idle terminal
        sendCommandToTerminal(idleTerminalId, command)
        setLastTerminalId(idleTerminalId)
        toast.success("Command executed in terminal")
      } else {
        // No idle terminals, create new one if under limit
        if (terminals.length >= 4) {
          toast.error("All terminals are busy")
          setIsExecuting(false)
          return
        }

        const newId = await createNewTerminal(command)
        if (newId) {
          setLastTerminalId(newId)
          toast.success("Command executed in new terminal")
        } else {
          setIsExecuting(false)
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to run command",
      )
      setIsExecuting(false)
    }
  }

  // Only show button for terminal-runnable languages
  if (!canRun) return null

  // Check if all terminals are busy (at max capacity and none idle)
  const allTerminalsBusy =
    terminals.length >= 4 && terminals.every((t) => t.isBusy)
  const isDisabled =
    isAnimating || creatingTerminal || isExecuting || allTerminalsBusy

  return (
    <button
      className={cn(
        "cursor-pointer flex items-center justify-center rounded-md size-7 hover:bg-secondary active:scale-95 text-muted-foreground transition-all hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      data-streamdown="code-block-run-button"
      disabled={isDisabled}
      onClick={handleRun}
      title={allTerminalsBusy ? "All terminals are busy" : "Run in terminal"}
      type="button"
      {...props}
    >
      {isExecuting ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        (children ?? <PlayIcon size={14} />)
      )}
    </button>
  )
}
