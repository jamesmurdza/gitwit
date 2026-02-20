// Acknowledgment: This code is adapted from the Streamdown project(stremadown.ai).
import { type HTMLAttributes, useMemo } from "react"
import { CodeBlockBody } from "./body"
import { CollapsibleCode } from "./collapsible-code"
import { CodeBlockContainer } from "./container"
import { CodeBlockContext } from "./context"
import { parseAiderDiff } from "./diff"
import { CodeBlockHeader } from "./header"
import { useSyntaxHighlighting } from "./use-syntax-highlighting"

type CodeBlockProps = HTMLAttributes<HTMLPreElement> & {
  code: string
  language: string
  filename?: string
  filePath?: string | null
  isNewFile?: boolean
  onOpenFile?: (filePath: string) => void
  collapsible?: boolean
}

export const CodeBlock = ({
  code,
  language,
  filename,
  filePath,
  isNewFile,
  onOpenFile,
  collapsible,
  className,
  children,
  ...rest
}: CodeBlockProps) => {
  // ── Diff parsing ─────────────────────────────────────────────────────────
  // Parse aider SEARCH/REPLACE markers into per-line diff annotations.
  // The raw `code` is kept in context for apply/copy actions.
  const diffParsed = useMemo(() => parseAiderDiff(code), [code])
  const displayCode = diffParsed?.displayCode ?? code
  const diffLineTypes = diffParsed?.lineTypes

  // ── Syntax highlighting ──────────────────────────────────────────────────
  // Returns Shiki-highlighted tokens when ready, plain-text tokens while loading.
  const result = useSyntaxHighlighting(displayCode, language)

  // ── Render ───────────────────────────────────────────────────────────────
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
        <CollapsibleCode
          enabled={collapsible}
          code={code}
          displayCode={displayCode}
          result={result}
        >
          <CodeBlockBody
            className={className}
            language={language}
            result={result}
            diffLineTypes={diffLineTypes}
            {...rest}
          />
        </CollapsibleCode>
      </CodeBlockContainer>
    </CodeBlockContext.Provider>
  )
}
