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
import { CodeBlockContext } from "./context"
import { CodeBlockHeader } from "./header"

type CodeBlockProps = HTMLAttributes<HTMLPreElement> & {
  code: string
  language: string
  filename?: string
  isNewFile?: boolean
}

export const CodeBlock = ({
  code,
  language,
  filename,
  isNewFile,
  className,
  children,
  ...rest
}: CodeBlockProps) => {
  const { shikiTheme } = useContext(StreamdownContext)
  const { codePlugin } = use(CodePluginContext)!

  // Memoize the raw fallback tokens to avoid recomputing on every render
  const raw: HighlightResult = useMemo(
    () => ({
      bg: "transparent",
      fg: "inherit",
      tokens: code.split("\n").map((line) => [
        {
          content: line,
          color: "inherit",
          bgColor: "transparent",
          htmlStyle: {},
          offset: 0,
        },
      ]),
    }),
    [code],
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
        code,
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
  }, [code, language, shikiTheme, codePlugin, raw])

  return (
    <CodeBlockContext.Provider value={{ code }}>
      <CodeBlockContainer language={language}>
        <CodeBlockHeader
          language={language}
          filename={filename}
          isNewFile={isNewFile}
        >
          {children}
        </CodeBlockHeader>
        <CodeBlockBody
          className={className}
          language={language}
          result={result}
          {...rest}
        />
      </CodeBlockContainer>
    </CodeBlockContext.Provider>
  )
}
