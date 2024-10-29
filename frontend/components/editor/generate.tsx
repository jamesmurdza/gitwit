"use client"

import { User } from "@/lib/types"
import { Editor } from "@monaco-editor/react"
import { Check, Loader2, RotateCw, Sparkles, X } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { Socket } from "socket.io-client"
import { toast } from "sonner"
import { Button } from "../ui/button"
// import monaco from "monaco-editor"

export default function GenerateInput({
  user,
  socket,
  width,
  data,
  editor,
  onExpand,
  onAccept,
  onClose,
}: {
  user: User
  socket: Socket
  width: number
  data: {
    fileName: string
    code: string
    line: number
  }
  editor: {
    language: string
  }
  onExpand: () => void
  onAccept: (code: string) => void
  onClose: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [code, setCode] = useState("")
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState({
    generate: false,
    regenerate: false,
  })
  const [input, setInput] = useState("")
  const [currentPrompt, setCurrentPrompt] = useState("")

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }, [inputRef.current])

  const handleGenerate = async ({
    regenerate = false,
  }: {
    regenerate?: boolean
  }) => {
    if (user.generations >= 1000) {
      toast.error("You reached the maximum # of generations.")
      return
    }

    setLoading({ generate: !regenerate, regenerate })
    setCurrentPrompt(input)
    socket.emit(
      "generateCode",
      {
        fileName: data.fileName,
        code: data.code,
        line: data.line,
        instructions: regenerate ? currentPrompt : input
      },
      (res: { response: string; success: boolean }) => {
        console.log("Generated code", res.response, res.success)
        // if (!res.success) {
        //   toast.error("Failed to generate code.");
        //   return;
        // }

        setCode(res.response)
        router.refresh()
      }
    )
  }
  const handleGenerateForm = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      handleGenerate({ regenerate: false })
    },
    [input, currentPrompt]
  )

  useEffect(() => {
    if (code) {
      setExpanded(true)
      onExpand()
      setLoading({ generate: false, regenerate: false })
    }
  }, [code])

  useEffect(() => {
    //listen to when Esc key is pressed and close the modal
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <div className="w-full pr-4 space-y-2">
      <form
        onSubmit={handleGenerateForm}
        className="flex items-center font-sans space-x-2"
      >
        <input
          ref={inputRef}
          style={{
            width: width + "px",
          }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Generate code with a prompt"
          className="h-8 w-full rounded-md border border-muted-foreground bg-transparent px-3 py-1 text-sm shadow-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />

        <Button
          size="sm"
          type="submit"
          disabled={loading.generate || loading.regenerate || input === ""}
        >
          {loading.generate ? (
            <>
              <Loader2 className="animate-spin h-3 w-3 mr-2" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3 mr-2" />
              Generate Code
            </>
          )}
        </Button>
        <Button
          onClick={onClose}
          type="button"
          variant="outline"
          size="smIcon"
          className="bg-transparent shrink-0 border-muted-foreground"
        >
          <X className="h-3 w-3" />
        </Button>
      </form>
      {expanded ? (
        <>
          <div className="rounded-md border border-muted-foreground w-full h-28 overflow-y-scroll p-2">
            <Editor
              height="100%"
              defaultLanguage={editor.language}
              value={code}
              options={{
                minimap: {
                  enabled: false,
                },
                scrollBeyondLastLine: false,
                fontFamily: "var(--font-geist-mono)",
                domReadOnly: true,
                readOnly: true,
                lineNumbers: "off",
                glyphMargin: false,
                folding: false,
                // Undocumented see https://github.com/Microsoft/vscode/issues/30795#issuecomment-410998882
                lineDecorationsWidth: 0,
                lineNumbersMinChars: 0,
              }}
              theme="vs-dark"
            />
          </div>
          <div className="flex space-x-2 font-sans">
            <Button
              disabled={loading.generate || loading.regenerate}
              onClick={() => onAccept(code)}
              size="sm"
            >
              <Check className="h-3 w-3 mr-2" />
              Accept
            </Button>
            <Button
              onClick={() => handleGenerate({ regenerate: true })}
              disabled={loading.generate || loading.regenerate}
              variant="outline"
              size="sm"
              className="bg-transparent border-muted-foreground"
            >
              {loading.regenerate ? (
                <>
                  <Loader2 className="animate-spin h-3 w-3 mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <RotateCw className="h-3 w-3 mr-2" />
                  Re-Generate
                </>
              )}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
