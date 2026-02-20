import { cn } from "@/lib/utils"
import type { HighlightResult } from "@streamdown/code"
import { type ComponentProps, memo, useMemo } from "react"
import type { DiffLineType } from "./context"

type CodeBlockBodyProps = ComponentProps<"pre"> & {
  result: HighlightResult
  language: string
  diffLineTypes?: DiffLineType[]
}


// For diff blocks: no CSS counter line numbers, just block display
const DIFF_LINE_CLASSES_BLOCK = "block"

// Memoize line numbers class string since it's constant
const LINE_NUMBER_CLASSES = cn(
  "block",
  "before:content-[counter(line)]",
  "before:inline-block",
  "before:[counter-increment:line]",
  "before:w-6",
  "before:mr-4",
  "before:text-[13px]",
  "before:text-right",
  "before:text-muted-foreground/50",
  "before:font-mono",
  "before:select-none",
)

const DIFF_LINE_STYLES: Record<DiffLineType, React.CSSProperties> = {
  context: {},
  added: { backgroundColor: "rgba(34, 197, 94, 0.15)" },
  removed: { backgroundColor: "rgba(239, 68, 68, 0.15)", textDecoration: "line-through", textDecorationColor: "rgba(239, 68, 68, 0.4)" },
}

const DIFF_GUTTER_STYLES: Record<DiffLineType, React.CSSProperties> = {
  context: { color: "inherit" },
  added: { color: "rgba(34, 197, 94, 0.8)" },
  removed: { color: "rgba(239, 68, 68, 0.8)" },
}

export const CodeBlockBody = memo(
  ({ children, result, language, diffLineTypes, className, ...rest }: CodeBlockBodyProps) => {
    const isDiff = !!diffLineTypes
    return (
      <pre
        className={cn(className, "p-2 text-sm shiki")}
        data-language={language}
        data-streamdown="code-block-body"
        style={{
          backgroundColor: result.bg,
          color: result.fg,
        }}
        {...rest}
      >
        <code className="[counter-increment:line_0] [counter-reset:line]">
          {result.tokens.map((row, index) => {
            const lineType = diffLineTypes?.[index] ?? "context"
            return (
              <span
                className={isDiff ? DIFF_LINE_CLASSES_BLOCK : LINE_NUMBER_CLASSES}
                style={isDiff ? DIFF_LINE_STYLES[lineType] : undefined}
                {...(isDiff ? { "data-diff-line": lineType } : {})}
                // biome-ignore lint/suspicious/noArrayIndexKey: "This is a stable key."
                key={index}
              >
                {isDiff && (
                  <span
                    key="gutter"
                    className="inline-block w-4 mr-2 text-[13px] text-right select-none font-bold"
                    style={DIFF_GUTTER_STYLES[lineType]}
                  >
                    {lineType === "added" ? "+" : lineType === "removed" ? "-" : " "}
                  </span>
                )}
                {row.map((token, tokenIndex) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: "This is a stable key."
                    key={tokenIndex}
                    style={{
                      color: token.color,
                      backgroundColor: token.bgColor,
                      ...token.htmlStyle,
                    }}
                    {...token.htmlAttrs}
                  >
                    {token.content}
                  </span>
                ))}
              </span>
            )
          })}
        </code>
      </pre>
    )
  },
  (prevProps, nextProps) => {
    return (
      prevProps.result === nextProps.result &&
      prevProps.language === nextProps.language &&
      prevProps.className === nextProps.className &&
      prevProps.diffLineTypes === nextProps.diffLineTypes
    )
  },
)
