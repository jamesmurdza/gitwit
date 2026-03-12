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

const CodeBlock = lazy(() =>
  import("./code-block/index").then((mod) => ({ default: mod.CodeBlock })),
) as React.LazyExoticComponent<
  React.ComponentType<
    React.HTMLAttributes<HTMLPreElement> & {
      code: string
      language: string
      filename?: string
      filePath?: string | null
      isNewFile?: boolean
      onOpenFile?: (filePath: string) => void
      collapsible?: boolean
    }
  >
>

// Types
type MarkdownProps = ComponentProps<typeof Streamdown> & {
  onOpenFile?: (filePath: string) => void
  collapsibleCodeBlocks?: boolean
}

interface MarkdownContextType {
  onOpenFile?: (filePath: string) => void
  collapsibleCodeBlocks?: boolean
}

// Constants
const LANGUAGE_REGEX = /language-([^\s]+)/
const FILE_LINE_REGEX = /^File:\s*[^\n]+\n/gm
const SDFILE_MARKER = /^__SDFILE__:([^:\n]+)(?::(\w+))?\n/

const codePlugin = createCodePlugin({
  themes: ["github-light", "github-dark-default"],
})

export const CodePluginContext = createContext<
  { codePlugin: ReturnType<typeof createCodePlugin> } | undefined
>(undefined)

const MarkdownContext = createContext<MarkdownContextType | null>(null)

// Utility Functions

/**
 * Embeds file path info as a `__SDFILE__` marker on the first line of each
 * code block that follows a `File:` line, then strips leftover `File:` lines.
 *
 * The marker lives *inside* the code content so it always travels with the
 * HAST node — no external map or position calculation needed. The
 * `CodeComponent` strips it before rendering.
 */
function prepareMarkdown(markdown: string): string {
  const embedded = markdown.replace(
    /^File:\s*([^\s(]+)((?:\s*\(new file\))?)[^\n]*\n(```\w*\n)/gm,
    (_, filePath: string, newMarker: string, codeFence: string) => {
      const flag = newMarker.trim() ? ":new" : ""
      return `${codeFence}__SDFILE__:${filePath}${flag}\n`
    },
  )
  return embedded.replace(FILE_LINE_REGEX, "")
}

/** Walk a HAST node tree and collect all text content. */
function getNodeText(node: Element): string {
  let text = ""
  for (const child of node.children) {
    if (child.type === "text") {
      text += child.value
    } else if (child.type === "element") {
      text += getNodeText(child)
    }
  }
  return text
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

  let rawCode = node ? getNodeText(node) : ""
  if (!rawCode) {
    if (
      isValidElement(children) &&
      children.props &&
      typeof children.props === "object" &&
      "children" in children.props &&
      typeof (children.props as { children?: unknown }).children === "string"
    ) {
      rawCode = (children.props as { children: string }).children
    } else if (typeof children === "string") {
      rawCode = children
    }
  }

  const marker = rawCode.match(SDFILE_MARKER)
  const code = marker ? rawCode.replace(SDFILE_MARKER, "") : rawCode
  const filePath = marker?.[1] ?? null
  const fileName = filePath?.split("/").pop() ?? undefined
  const isNewFile = marker?.[2] === "new"

  const showCodeControls = shouldShowControls(controlsConfig, "code")
  const onOpenFile = markdownCtx?.onOpenFile

  return (
    <Suspense fallback={<CodeBlockSkeleton />}>
      <CodeBlock
        className={cn("overflow-x-auto border-border border-t", className)}
        code={code.trim()}
        language={language}
        filename={fileName}
        filePath={filePath}
        isNewFile={isNewFile}
        onOpenFile={onOpenFile}
        collapsible={markdownCtx?.collapsibleCodeBlocks}
      >
        {showCodeControls && (
          <>
            <CodeBlockRunButton language={language} />
            <CodeBlockDownloadButton code={code.trim()} language={language} />
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
  ({ className, children, onOpenFile, collapsibleCodeBlocks, ...props }: MarkdownProps) => {
    const rawMarkdown = typeof children === "string" ? children : ""

    const strippedMarkdown = useMemo(
      () => prepareMarkdown(rawMarkdown),
      [rawMarkdown],
    )

    return (
      <MarkdownContext.Provider value={{ onOpenFile, collapsibleCodeBlocks }}>
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
  (prev, next) =>
    prev.children === next.children && prev.onOpenFile === next.onOpenFile && prev.collapsibleCodeBlocks === next.collapsibleCodeBlocks,
)

Markdown.displayName = "Markdown"

export default Markdown
