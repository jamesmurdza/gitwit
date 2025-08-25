"use client"

import { cn } from "@/lib/utils"
import { type ComponentProps, isValidElement, memo } from "react"
import { BundledLanguage } from "shiki"
import { Streamdown } from "streamdown"
import { CodeBlock, CodeBlockCopyButton } from "./code-block"

type MarkdownProps = ComponentProps<typeof Streamdown>
const components: MarkdownProps["components"] = {
  pre: ({ node, className, children }) => {
    let language: BundledLanguage = "javascript"

    if (typeof node?.properties?.className === "string") {
      language = node.properties.className.replace(
        "language-",
        ""
      ) as BundledLanguage
    }

    // Extract code content from children safely
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
      <CodeBlock className={cn(className)} code={code} language={language}>
        <CodeBlockCopyButton />
      </CodeBlock>
    )
  },
}
export const Markdown = memo(
  ({ className, ...props }: MarkdownProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      components={components}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
)

Markdown.displayName = "Markdown"
