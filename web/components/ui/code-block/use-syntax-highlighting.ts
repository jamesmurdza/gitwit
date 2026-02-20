import type { HighlightResult } from "@streamdown/code"
import { use, useContext, useEffect, useMemo, useState } from "react"
import type { BundledLanguage } from "shiki"
import { StreamdownContext } from "streamdown"
import { CodePluginContext } from "../markdown"

/**
 * Manages syntax highlighting for a code block via the Streamdown code plugin.
 *
 * Returns a HighlightResult with tokenized + colored spans. Falls back to
 * plain-text tokens while Shiki loads the grammar asynchronously, ensuring
 * streaming code is never blank.
 */
export function useSyntaxHighlighting(
  displayCode: string,
  language: string,
): HighlightResult {
  const { shikiTheme } = useContext(StreamdownContext)
  const { codePlugin } = use(CodePluginContext)!

  // Plain-text fallback tokens — used until Shiki finishes highlighting
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

  const [result, setResult] = useState<HighlightResult>(raw)

  useEffect(() => {
    if (!codePlugin) {
      setResult(raw)
      return
    }

    // Ask the plugin for cached tokens, or subscribe for async delivery
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
      setResult(cachedResult)
      return
    }

    // Not cached — show raw tokens while waiting (prevents stale content during streaming)
    setResult(raw)
  }, [displayCode, language, shikiTheme, codePlugin, raw])

  return result
}
