"use client"

import { FitAddon } from "@xterm/addon-fit"
import { Terminal } from "@xterm/xterm"
import "./xterm.css"

import { debounce } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import { useTheme } from "next-themes"
import { ElementRef, useEffect, useRef } from "react"
import { Socket } from "socket.io-client"

export default function EditorTerminal({
  socket,
  id,
  term,
  setTerm,
  visible,
}: {
  socket: Socket
  id: string
  term: Terminal | null
  setTerm: (term: Terminal) => void
  visible: boolean
}) {
  const { resolvedTheme: theme } = useTheme()
  const terminalContainerRef = useRef<ElementRef<"div">>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const lineBufferRef = useRef<string>("")
  const expectedEchoLineRef = useRef<string>("")
  const expectedEchoIndexRef = useRef<number>(0)
  const dropEchoNewlineOnceRef = useRef<boolean>(false)

  useEffect(() => {
    if (!terminalContainerRef.current) return

    const terminal = new Terminal({
      cursorBlink: true,
      theme: theme === "light" ? lightTheme : darkTheme,
      fontFamily: "var(--font-geist-mono)",
      fontSize: 14,
      lineHeight: 1.5,
      letterSpacing: 0,
      allowTransparency: true,
      rightClickSelectsWord: true,
      allowProposedApi: true,
    })

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      navigator.clipboard.readText().then((text) => {
        if (!text) return
        for (const ch of text) {
          const code = ch.charCodeAt(0)
          if (code >= 32 && code <= 126) {
            terminal.write(ch)
            lineBufferRef.current += ch
          }
        }
      })
    }

    terminalContainerRef.current.addEventListener(
      "contextmenu",
      handleContextMenu
    )

    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.type === "keydown") {
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "v"
        ) {
          event.preventDefault()
          navigator.clipboard.readText().then((text) => {
            if (!text) return
            for (const ch of text) {
              const code = ch.charCodeAt(0)
              if (code >= 32 && code <= 126) {
                terminal.write(ch)
                lineBufferRef.current += ch
              }
            }
          })
          return false
        }
      }
      return true
    })

    setTerm(terminal)

    return () => {
      terminal.dispose()
      terminalContainerRef.current?.removeEventListener(
        "contextmenu",
        handleContextMenu
      )
    }
  }, [])

  useEffect(() => {
    if (term) {
      term.options.theme = theme === "light" ? lightTheme : darkTheme
    }
  }, [theme])

  useEffect(() => {
    if (!term) return

    if (!terminalContainerRef.current) return
    if (!fitAddonRef.current) {
      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(terminalContainerRef.current)
      fitAddon.fit()
      fitAddonRef.current = fitAddon
    }

    const disposableOnData = term.onData((data) => {
      for (const char of data) {
        const code = char.charCodeAt(0)

        if (code >= 32 && code <= 126) {
          term.write(char)
          lineBufferRef.current += char
          continue
        }

        if (char === "\x7f" || char === "\b") {
          if (lineBufferRef.current.length > 0) {
            term.write("\b \b")
            lineBufferRef.current = lineBufferRef.current.slice(0, -1)
          }
          continue
        }

        if (char === "\r") {
          term.write("\r\n")
          const toSend = lineBufferRef.current + "\r"
          expectedEchoLineRef.current = lineBufferRef.current
          expectedEchoIndexRef.current = 0
          dropEchoNewlineOnceRef.current = true
          socket.emit("terminalData", { id, data: toSend })
          lineBufferRef.current = ""
          continue
        }

        socket.emit("terminalData", { id, data: char })
      }
    })

    const disposableOnResize = term.onResize((dimensions) => {
      fitAddonRef.current?.fit()
      socket.emit("terminalResize", { dimensions })
    })
    const resizeObserver = new ResizeObserver(
      debounce((entries) => {
        if (!fitAddonRef.current || !terminalContainerRef.current) return

        const entry = entries[0]
        if (!entry) return

        const { width, height } = entry.contentRect

        if (
          width !== terminalContainerRef.current.offsetWidth ||
          height !== terminalContainerRef.current.offsetHeight
        ) {
          fitAddonRef.current.fit()
        }
      }, 50)
    )

    resizeObserver.observe(terminalContainerRef.current)
    return () => {
      disposableOnData.dispose()
      disposableOnResize.dispose()
      resizeObserver.disconnect()
    }
  }, [term, terminalContainerRef.current])

  useEffect(() => {
    if (!term) return
    const handleTerminalResponse = (response: { id: string; data: string }) => {
      if (response.id !== id) {
        return
      }

      let output = response.data

      while (
        expectedEchoIndexRef.current < expectedEchoLineRef.current.length &&
        output.length > 0 &&
        output[0] === expectedEchoLineRef.current[expectedEchoIndexRef.current]
      ) {
        output = output.slice(1)
        expectedEchoIndexRef.current += 1
      }

      if (
        expectedEchoIndexRef.current < expectedEchoLineRef.current.length &&
        output.length > 0 &&
        output[0] !== expectedEchoLineRef.current[expectedEchoIndexRef.current]
      ) {
        expectedEchoLineRef.current = ""
        expectedEchoIndexRef.current = 0
        dropEchoNewlineOnceRef.current = false
      }

      if (expectedEchoIndexRef.current === expectedEchoLineRef.current.length) {
        if (dropEchoNewlineOnceRef.current) {
          if (output.startsWith("\r")) output = output.slice(1)
          if (output.startsWith("\n")) output = output.slice(1)
          dropEchoNewlineOnceRef.current = false
        }
        expectedEchoLineRef.current = ""
        expectedEchoIndexRef.current = 0
      }

      if (output.length > 0) {
        term.write(output)
      }
    }
    socket.on("terminalResponse", handleTerminalResponse)

    return () => {
      socket.off("terminalResponse", handleTerminalResponse)
    }
  }, [term, id, socket])

  return (
    <>
      <div
        ref={terminalContainerRef}
        style={{ display: visible ? "block" : "none" }}
        className="w-full h-full text-left [&>div]:h-full"
        tabIndex={0}
      >
        {term === null ? (
          <div className="flex items-center text-muted-foreground p-2">
            <Loader2 className="animate-spin mr-2 h-4 w-4" />
            <span>Connecting to terminal...</span>
          </div>
        ) : null}
      </div>
    </>
  )
}

const lightTheme = {
  foreground: "#2e3436",
  background: "#ffffff",
  black: "#2e3436",
  brightBlack: "#555753",
  red: "#cc0000",
  brightRed: "#ef2929",
  green: "#4e9a06",
  brightGreen: "#8ae234",
  yellow: "#c4a000",
  brightYellow: "#fce94f",
  blue: "#3465a4",
  brightBlue: "#729fcf",
  magenta: "#75507b",
  brightMagenta: "#ad7fa8",
  cyan: "#06989a",
  brightCyan: "#34e2e2",
  white: "#d3d7cf",
  brightWhite: "#eeeeec",
  cursor: "#2e3436",
  cursorAccent: "#ffffff",
  selectionBackground: "#3465a4",
  selectionForeground: "#ffffff",
  selectionInactiveBackground: "#264973",
}

// Dark Theme
const darkTheme = {
  foreground: "#f8f8f2",
  background: "#0a0a0a",
  black: "#21222c",
  brightBlack: "#6272a4",
  red: "#ff5555",
  brightRed: "#ff6e6e",
  green: "#50fa7b",
  brightGreen: "#69ff94",
  yellow: "#f1fa8c",
  brightYellow: "#ffffa5",
  blue: "#bd93f9",
  brightBlue: "#d6acff",
  magenta: "#ff79c6",
  brightMagenta: "#ff92df",
  cyan: "#8be9fd",
  brightCyan: "#a4ffff",
  white: "#f8f8f2",
  brightWhite: "#ffffff",
  cursor: "#f8f8f2",
  cursorAccent: "#0a0a0a",
  selectionBackground: "#264973",
  selectionForeground: "#ffffff",
  selectionInactiveBackground: "#1a3151",
}
