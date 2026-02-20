// Acknowledgment: This code is adapted from the Streamdown project(stremadown.ai).
import type { HighlightResult } from "@streamdown/code"
import {} from "@streamdown/code"
import {
  type HTMLAttributes,
  use,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type { BundledLanguage } from "shiki"
import { StreamdownContext } from "streamdown"
import { CodePluginContext } from "../markdown"
import { CodeBlockBody } from "./body"
import { CodeBlockContainer } from "./container"
import { CodeBlockContext, type DiffLineType } from "./context"
import { CodeBlockHeader } from "./header"

type CodeBlockProps = HTMLAttributes<HTMLPreElement> & {
  code: string
  language: string
  filename?: string
  filePath?: string | null
  isNewFile?: boolean
  onOpenFile?: (filePath: string) => void
}

/**
 * Parse aider diff markers into displayable code with per-line diff annotations.
 * SEARCH lines become "removed", REPLACE lines become "added", rest is "context".
 * Returns null if no markers found (not a diff block).
 */
function parseAiderDiff(code: string): { displayCode: string; lineTypes: DiffLineType[] } | null {
  if (!code.includes("<<<<<<< SEARCH")) return null

  const lines = code.split("\n")
  const output: string[] = []
  const lineTypes: DiffLineType[] = []
  let section: "outside" | "search" | "replace" = "outside"

  for (const line of lines) {
    const trimmed = line.trimEnd()
    if (trimmed === "<<<<<<< SEARCH") { section = "search"; continue }
    if (trimmed === "=======" && section === "search") { section = "replace"; continue }
    if (trimmed === ">>>>>>> REPLACE") { section = "outside"; continue }

    output.push(line)
    lineTypes.push(section === "search" ? "removed" : section === "replace" ? "added" : "context")
  }

  return { displayCode: output.join("\n"), lineTypes }
}

export const CodeBlock = ({
  code,
  language,
  filename,
  filePath,
  isNewFile,
  onOpenFile,
  className,
  children,
  ...rest
}: CodeBlockProps) => {
  const { shikiTheme } = useContext(StreamdownContext)
  const { codePlugin } = use(CodePluginContext)!

  // Parse diff markers for display — raw code stays in context for apply/copy
  const diffParsed = useMemo(() => parseAiderDiff(code), [code])
  const displayCode = diffParsed?.displayCode ?? code
  const diffLineTypes = diffParsed?.lineTypes

  // Memoize the raw fallback tokens to avoid recomputing on every render
  const raw: HighlightResult = useMemo(
    () => ({
      bg: "transparent",
      fg: "inherit",
      tokens: displayCode.split("\n").map((line) => [
        {
          content: line,
          color: "inherit",
          bgColor: "transparent",
          htmlStyle: {},
          offset: 0,
        },
      ]),
    }),
    [displayCode],
  )

  // Use raw as initial state
  const [result, setResult] = useState<HighlightResult>(raw)

  // Try to get cached result or subscribe to highlighting
  useEffect(() => {
    // If no code plugin, just use raw tokens (plain text)
    if (!codePlugin) {
      setResult(raw)
      return
    }

    const cachedResult = codePlugin.highlight(
      {
        code: displayCode,
        language: language as BundledLanguage,
        themes: shikiTheme,
      },
      (highlightedResult) => {
        setResult(highlightedResult)
      },
    )

    if (cachedResult) {
      // Already cached, use it immediately
      setResult(cachedResult)
      return
    }

    // Not cached - reset to raw tokens while waiting for highlighting
    // This is critical for streaming: ensures we show current code, not stale tokens
    setResult(raw)
  }, [displayCode, language, shikiTheme, codePlugin, raw])

  return (
    <CodeBlockContext.Provider value={{ code }}>
      <CodeBlockContainer language={language}>
        <CodeBlockHeader
          language={language}
          filename={filename}
          filePath={filePath}
          isNewFile={isNewFile}
          onOpenFile={onOpenFile}
        >
          {children}
        </CodeBlockHeader>
        <CodeBlockBody
          className={className}
          language={language}
          result={result}
          diffLineTypes={diffLineTypes}
          {...rest}
        />
      </CodeBlockContainer>
    </CodeBlockContext.Provider>
  )
}
