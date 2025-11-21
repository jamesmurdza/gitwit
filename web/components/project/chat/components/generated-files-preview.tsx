import { Button } from "@/components/ui/button"
import { cn, extractFilePathFromCode } from "@/lib/utils"
import { Check, ChevronDown, Info, X } from "lucide-react"
import React from "react"
import type { Message } from "../lib/types"
import { useChat } from "../providers/chat-provider"

type GeneratedFile = {
  id: string
  name: string
  additions: number
}

type GeneratedFilesPreviewProps = {
  files?: GeneratedFile[]
  className?: string
}

const HARDCODED_ADDITIONS = 3

export function GeneratedFilesPreview({
  files,
  className,
}: GeneratedFilesPreviewProps) {
  const { messages } = useChat()
  const [isOpen, setIsOpen] = React.useState(true)

  const derivedFiles = React.useMemo(() => {
    if (files?.length) {
      return files
    }
    return extractFilesFromMessages(messages)
  }, [files, messages])

  if (!derivedFiles.length) {
    return null
  }

  return (
    <div
      className={cn(
        "mb-2 rounded-md border border-border/70 bg-background/70 p-2 shadow-[0_1px_4px_rgba(0,0,0,0.04)]",
        className
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1 text-muted-foreground">
          <button
            type="button"
            aria-label={isOpen ? "Collapse files" : "Expand files"}
            onClick={() => setIsOpen((prev) => !prev)}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full border border-border transition-colors",
              "hover:border-foreground/40"
            )}
          >
            <ChevronDown
              className={cn(
                "size-3 transition-transform",
                isOpen ? "duration-700 rotate-0" : "duration-500 -rotate-90"
              )}
            />
          </button>
          <Info className="size-3.5" />
          <span className="font-medium">
            {derivedFiles.length} File{derivedFiles.length > 1 ? "s" : ""}{" "}
            Edited
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <Button size="xs" className="h-5 px-2 text-[10px]">
            Keep All
          </Button>
          <Button
            variant="destructive"
            size="xs"
            className="h-5 px-2 text-[10px] text-destructive hover:text-destructive"
          >
            Reject
          </Button>
        </div>
      </div>
      <div
        className={cn(
          "space-y-1 overflow-hidden transition-all ease-out",
          isOpen
            ? "max-h-48 opacity-100 duration-700"
            : "max-h-0 opacity-0 duration-500"
        )}
      >
        {derivedFiles.map((file) => (
          <div
            key={file.id}
            className="group relative flex items-center gap-2 rounded-md border border-transparent bg-muted/30 px-2 py-1 text-[11px] transition hover:border-border hover:bg-background"
          >
            <div className="flex flex-1 items-center gap-2">
              <Info className="size-3.5 text-muted-foreground" />
              <span className="text-[11px] font-medium text-foreground">
                {file.name}
              </span>
            </div>
            <span className="text-[10px] font-semibold text-emerald-500 transition group-hover:opacity-0">
              +{file.additions}
            </span>
            <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
              <HoverIconButton aria-label="Keep file">
                <Check className="size-3.5 text-emerald-500" />
              </HoverIconButton>
              <HoverIconButton aria-label="Reject file">
                <X className="size-3.5 text-red-500" />
              </HoverIconButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function extractFilesFromMessages(messages: Message[]): GeneratedFile[] {
  if (!messages.length) return []

  const latestAssistant = [...messages]
    .reverse()
    .find(
      (message) => message.role === "assistant" && !!message.content?.trim()
    )

  if (!latestAssistant?.content) return []

  const files = extractFilesFromMarkdown(latestAssistant.content)
  return files.map((name) => ({
    id: name,
    name,
    additions: HARDCODED_ADDITIONS,
  }))
}

function extractFilesFromMarkdown(markdown: string): string[] {
  if (!markdown) return []

  const fileSet = new Set<string>()
  const codeBlockFileMap = new Map<string, string>()
  const codeBlockRegex = /```[\s\S]*?```/g
  let match

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const codeBlock = match[0]
    const code = stripCodeFence(codeBlock)
    if (!code.trim()) continue

    const filePath = extractFilePathFromCode(code, markdown, codeBlockFileMap)
    if (filePath) {
      fileSet.add(getDisplayName(filePath))
    }
  }

  if (!fileSet.size) {
    const filePattern = /File:\s*([^\n]+)/gi
    let fallbackMatch
    while ((fallbackMatch = filePattern.exec(markdown)) !== null) {
      const cleanPath = fallbackMatch[1]
        .replace(/\s*\(new file\)\s*$/i, "")
        .trim()
      if (cleanPath) {
        fileSet.add(getDisplayName(cleanPath))
      }
    }
  }

  return Array.from(fileSet)
}

function stripCodeFence(codeBlock: string) {
  return codeBlock.replace(/^```[\w-]*\s*\n?/, "").replace(/```\s*$/, "")
}

function getDisplayName(path: string) {
  const parts = path.split("/")
  return parts[parts.length - 1] || path
}

function HoverIconButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background shadow-sm transition hover:border-foreground/40"
      {...props}
    >
      {children}
    </button>
  )
}
