"use client"

import { cn } from "@/lib/utils"
import { type ComponentProps, isValidElement, useMemo, useRef } from "react"
import { BundledLanguage } from "shiki"
import { Streamdown } from "streamdown"
import { CodeBlock, CodeBlockCopyButton } from "./code-block"
import { CodeBlockActions } from "./code-block-actions"
type MarkdownProps = ComponentProps<typeof Streamdown>

export const Markdown = ({ className, ...props }: MarkdownProps) => {
  // Use a ref to persist the intended file across renders
  const currentIntendedFileRef = useRef<string | null>(null)
  // Extract intended file from markdown content once at component level
  const extractMarkdownText = (children: any) => {
    if (typeof children === "string") return children
    if (Array.isArray(children)) {
      return children
        .map((c) => (typeof c === "string" ? c : c?.props?.children ?? ""))
        .join("")
    }
    if (children && typeof children === "object" && "props" in children) {
      return children.props?.children ?? ""
    }
    return ""
  }

  const markdownText = extractMarkdownText(props.children)

  // Use same regex to get the first file path
  const filePattern =
    /(?:^|\s)([a-zA-Z0-9._\/-]+\.(?:html|js|ts|tsx|jsx|css|scss|sass|less|json|md|txt|py|java|cpp|c|h|php|rb|go|rs|swift|kt|dart|vue|svelte))(?:\s|$)/i
  const firstMatch = markdownText.match(filePattern)
  // Keep the AI-provided path as-is (no stripping). Trust relative path from response.
  const firstIntendedFile = firstMatch ? firstMatch[1].trim() : null

  // Keep a ref if you still want it elsewhere
  currentIntendedFileRef.current = firstIntendedFile
  const componentsWithIntendedFile: MarkdownProps["components"] =
    useMemo(() => {
      return {
        pre: ({ node, className, children }) => {
          let language: BundledLanguage = "javascript"
          if (typeof node?.properties?.className === "string") {
            language = node.properties.className.replace(
              "language-",
              ""
            ) as BundledLanguage
          }

          // Extract code safely (same as before)
          let code = ""
          if (
            isValidElement(children) &&
            children.props &&
            typeof children.props === "object" &&
            "children" in children.props &&
            typeof children.props.children === "string"
          ) {
            code = children.props.children
          } else if (typeof children === "string") {
            code = children
          }

          return (
            <CodeBlock
              className={cn(className)}
              code={code}
              language={language}
            >
              <CodeBlockCopyButton />
              {/* Pass the precomputed intended file directly */}
              <CodeBlockActions
                code={code}
                language={language}
                intendedFile={firstIntendedFile}
              />
            </CodeBlock>
          )
        },
        p: ({ node, children, ...props }) => {
          // Keep this simple — don't mutate shared refs here
          return <p {...props}>{children}</p>
        },
      }
    }, [firstIntendedFile])

  return (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      components={componentsWithIntendedFile}
      {...props}
    />
  )
}

Markdown.displayName = "Markdown"
