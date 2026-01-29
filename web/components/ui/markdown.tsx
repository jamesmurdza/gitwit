"use client"
import { cn } from "@/lib/utils"
import { createCodePlugin } from "@streamdown/code"
import type { Element } from "hast"
import React, {
  type ComponentProps,
  createContext,
  type DetailedHTMLProps,
  type HTMLAttributes,
  isValidElement,
  lazy,
  memo,
  Suspense,
  use,
  useMemo,
} from "react"
import { type BundledLanguage, Streamdown, StreamdownContext } from "streamdown"
import { CodeBlockCopyButton } from "./code-block/copy-button"
import { CodeBlockDownloadButton } from "./code-block/download-button"
import { CodeBlockRunButton } from "./code-block/run-button"
import { CodeBlockSkeleton } from "./code-block/skeleton"

// Lazy load heavy components
const CodeBlock = lazy(() =>
  import("./code-block").then((mod) => ({ default: mod.CodeBlock })),
) as React.LazyExoticComponent<
  React.ComponentType<
    React.HTMLAttributes<HTMLPreElement> & {
      code: string
      language: string
      filename?: string
      isNewFile?: boolean
    }
  >
>

// Types
type MarkdownProps = ComponentProps<typeof Streamdown>

interface ExtractedFileInfo {
  filePath: string
  fileName: string | null
  isNewFile: boolean
}

interface MarkdownContextType {
  fileInfoMap: Map<string, ExtractedFileInfo>
}

// Constants
const LANGUAGE_REGEX = /language-([^\s]+)/
const FILE_WITH_CODE_REGEX =
  /^File:\s*([^\s(]+)(?:\s*\(new file\))?\s*\n```\w*\n([\s\S]*?)```/gm
const FILE_LINE_REGEX = /^File:\s*[^\n]+\n/gm

const codePlugin = createCodePlugin({
  themes: ["github-light", "github-dark-default"],
})

export const CodePluginContext = createContext<
  { codePlugin: ReturnType<typeof createCodePlugin> } | undefined
>(undefined)

const MarkdownContext = createContext<MarkdownContextType | null>(null)

// Utility Functions

/**
 * Parses markdown: extracts file info and strips "File:" lines in one pass
 */
function parseMarkdownFileInfo(markdown: string) {
  const fileInfoMap = new Map<string, ExtractedFileInfo>()
  let match: RegExpExecArray | null

  while ((match = FILE_WITH_CODE_REGEX.exec(markdown)) !== null) {
    const filePath = match[1]
    const codeContent = match[2].trim()
    fileInfoMap.set(codeContent, {
      filePath,
      fileName: filePath.split("/").pop() || null,
      isNewFile: match[0].includes("(new file)"),
    })
  }

  // Reset regex lastIndex for reuse
  FILE_WITH_CODE_REGEX.lastIndex = 0

  return {
    fileInfoMap,
    strippedMarkdown: markdown.replace(FILE_LINE_REGEX, ""),
  }
}

const shouldShowControls = (
  config:
    | boolean
    | { table?: boolean; code?: boolean; mermaid?: boolean | object },
  type: "table" | "code" | "mermaid",
) => (typeof config === "boolean" ? config : config[type] !== false)

function sameNodePosition(
  prev?: {
    position?: {
      start?: { line?: number; column?: number }
      end?: { line?: number; column?: number }
    }
  },
  next?: {
    position?: {
      start?: { line?: number; column?: number }
      end?: { line?: number; column?: number }
    }
  },
): boolean {
  const ps = prev?.position,
    ns = next?.position
  if (!ps && !ns) return true
  if (!ps || !ns) return false
  return (
    ps.start?.line === ns.start?.line &&
    ps.start?.column === ns.start?.column &&
    ps.end?.line === ns.end?.line &&
    ps.end?.column === ns.end?.column
  )
}

// Components
const CodeComponent = ({
  node,
  className,
  children,
  ...props
}: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  node?: Element
}) => {
  const inline = node?.position?.start.line === node?.position?.end.line
  const { controls: controlsConfig } = use(StreamdownContext)
  const markdownCtx = use(MarkdownContext)

  if (inline) {
    return (
      <code
        className={cn(
          "rounded bg-muted px-1.5 py-0.5 font-mono text-sm",
          className,
        )}
        data-streamdown="inline-code"
        {...props}
      >
        {children}
      </code>
    )
  }

  const language = (className?.match(LANGUAGE_REGEX)?.[1] ??
    "") as BundledLanguage

  // Extract code content from children
  let code = ""
  if (
    isValidElement(children) &&
    children.props &&
    typeof children.props === "object" &&
    "children" in children.props &&
    typeof (children.props as { children?: unknown }).children === "string"
  ) {
    code = (children.props as { children: string }).children
  } else if (typeof children === "string") {
    code = children
  }

  const fileInfo = markdownCtx?.fileInfoMap.get(code.trim())
  const showCodeControls = shouldShowControls(controlsConfig, "code")

  return (
    <Suspense fallback={<CodeBlockSkeleton />}>
      <CodeBlock
        className={cn("overflow-x-auto border-border border-t", className)}
        code={code}
        language={language}
        filename={fileInfo?.fileName ?? undefined}
        isNewFile={fileInfo?.isNewFile}
      >
        {showCodeControls && (
          <>
            <CodeBlockRunButton language={language} />
            <CodeBlockDownloadButton code={code} language={language} />
            <CodeBlockCopyButton />
          </>
        )}
      </CodeBlock>
    </Suspense>
  )
}

const MemoCode = memo(
  CodeComponent,
  (p, n) => p.className === n.className && sameNodePosition(p.node, n.node),
) as React.ComponentType<
  DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
    node?: Element
  }
>
MemoCode.displayName = "MarkdownCode"

export const Markdown = memo(
  ({ className, children, ...props }: MarkdownProps) => {
    const rawMarkdown = typeof children === "string" ? children : ""

    const { fileInfoMap, strippedMarkdown } = useMemo(
      () => parseMarkdownFileInfo(rawMarkdown),
      [rawMarkdown],
    )

    return (
      <MarkdownContext.Provider value={{ fileInfoMap }}>
        <CodePluginContext.Provider value={{ codePlugin }}>
          <Streamdown
            className={cn(
              "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
              className,
            )}
            plugins={{ code: codePlugin }}
            components={{ code: MemoCode }}
            {...props}
          >
            {strippedMarkdown}
          </Streamdown>
        </CodePluginContext.Provider>
      </MarkdownContext.Provider>
    )
  },
  (prev, next) => prev.children === next.children,
)

Markdown.displayName = "Markdown"

export default Markdown
