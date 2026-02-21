import { cn } from "@/lib/utils"
import type { HighlightResult } from "@streamdown/code"
import { type ComponentProps, memo, useMemo } from "react"
import type { DiffLineType } from "./context"

type CodeBlockBodyProps = ComponentProps<"pre"> & {
  result: HighlightResult
  language: string
  diffLineTypes?: DiffLineType[]
}


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

// Match the editor's diff decoration styles
const DIFF_LINE_STYLES: Record<DiffLineType, React.CSSProperties> = {
  context: {},
  added: {
    backgroundColor: "rgba(0, 255, 0, 0.1)",
    borderLeft: "3px solid #28a745",
    paddingLeft: "8px",
  },
  removed: {
    backgroundColor: "rgba(255, 0, 0, 0.1)",
    borderLeft: "3px solid #dc3545",
    paddingLeft: "8px",
    opacity: 0.7,
  },
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
                className={isDiff ? "block" : LINE_NUMBER_CLASSES}
                style={isDiff ? DIFF_LINE_STYLES[lineType] : undefined}
                {...(isDiff ? { "data-diff-line": lineType } : {})}
                // biome-ignore lint/suspicious/noArrayIndexKey: "This is a stable key."
                key={index}
              >
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
