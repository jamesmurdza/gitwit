"use client"

import { cn } from "@/lib/utils"
import {
  AlertCircle,
  Check,
  ChevronRight,
  FileText,
  FolderTree,
  Globe,
  Loader2,
  Search,
} from "lucide-react"
import { useState } from "react"

export type ToolPart = {
  type: string
  toolName: string
  toolCallId: string
  state: string
  input?: Record<string, unknown>
  output?: unknown
  errorText?: string
}

function getToolLabel(toolName: string, input?: Record<string, unknown>) {
  switch (toolName) {
    case "readFile":
      return input?.filePath ? String(input.filePath) : "file"
    case "listFiles":
      return "project files"
    case "searchFiles":
      return String(input?.pattern ?? input?.query ?? "files")
    case "webSearch":
      return String(input?.query ?? "the web")
    default:
      return toolName
  }
}

function getToolVerb(toolName: string, isDone: boolean) {
  switch (toolName) {
    case "readFile":
      return isDone ? "Read" : "Reading"
    case "listFiles":
      return isDone ? "Listed" : "Listing"
    case "searchFiles":
      return isDone ? "Searched" : "Searching"
    case "webSearch":
      return isDone ? "Searched" : "Searching"
    default:
      return isDone ? "Ran" : "Running"
  }
}

function getToolIcon(toolName: string) {
  switch (toolName) {
    case "readFile":
      return FileText
    case "listFiles":
      return FolderTree
    case "searchFiles":
      return Search
    case "webSearch":
      return Globe
    default:
      return FileText
  }
}

export function ToolInvocation({ part }: { part: ToolPart }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = getToolIcon(part.toolName)
  const label = getToolLabel(part.toolName, part.input)
  const isLoading =
    part.state === "input-available" || part.state === "input-streaming"
  const isError = part.state === "output-error"
  const isDone = part.state === "output-available"
  const verb = getToolVerb(part.toolName, isDone || isError)

  return (
    <div className="group/tool">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {isLoading && (
          <Loader2 size={12} className="shrink-0 animate-spin" />
        )}
        {isDone && <Icon size={12} className="shrink-0 text-muted-foreground" />}
        {isError && (
          <AlertCircle size={12} className="shrink-0 text-destructive" />
        )}
        <span>
          {verb}{" "}
          <code className="text-[11px] font-mono text-muted-foreground">
            {label}
          </code>
        </span>
        <ChevronRight
          size={10}
          className={cn(
            "shrink-0 transition-transform opacity-0 group-hover/tool:opacity-100",
            expanded && "rotate-90 opacity-100",
          )}
        />
      </button>
      {expanded && (
        <div className="ml-4 mt-1 mb-1 border-l border-border pl-3 text-xs">
          {part.input && (
            <pre className="rounded-md bg-muted/60 p-2 overflow-x-auto text-[11px] font-mono text-muted-foreground">
              {JSON.stringify(part.input, null, 2)}
            </pre>
          )}
          {isDone && part.output != null && (
            <pre className="mt-1 rounded-md bg-muted/60 p-2 overflow-x-auto max-h-48 overflow-y-auto text-[11px] font-mono text-muted-foreground">
              {typeof part.output === "string"
                ? part.output
                : JSON.stringify(part.output, null, 2)}
            </pre>
          )}
          {isError && part.errorText && (
            <p className="text-destructive mt-1">{part.errorText}</p>
          )}
        </div>
      )}
    </div>
  )
}
