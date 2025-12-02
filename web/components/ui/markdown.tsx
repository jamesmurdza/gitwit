"use client"

import { cn, extractFilePathFromCode, isNewFile } from "@/lib/utils"
import {
  type ComponentProps,
  isValidElement,
  memo,
  useMemo,
  useRef,
} from "react"
import { BundledLanguage } from "shiki"
import { Streamdown } from "streamdown"
import { CodeBlock, CodeBlockCopyButton } from "./code-block"
import { CodeBlockActions } from "./code-block-actions"
type MarkdownProps = ComponentProps<typeof Streamdown>

export const Markdown = memo(
  ({ className, ...props }: MarkdownProps) => {
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

    // Use refs to store dynamic data without causing re-renders
    const markdownTextRef = useRef(markdownText)
    markdownTextRef.current = markdownText

    const codeBlockFileMapRef = useRef<Map<string, string>>(new Map())
    const lastMarkdownLengthRef = useRef(0)

    if (markdownText.length < lastMarkdownLengthRef.current * 0.5) {
      codeBlockFileMapRef.current.clear()
    }
    lastMarkdownLengthRef.current = markdownText.length

    // Create stable components that don't depend on changing markdownText
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

            // Extract file path for THIS specific code block
            const intendedFile = extractFilePathFromCode(
              code,
              markdownTextRef.current,
              codeBlockFileMapRef.current
            )

            currentIntendedFileRef.current = intendedFile

            // Determine a filename for the toolbar from the intended file path
            const filename = intendedFile
              ? intendedFile.split("/").pop() || intendedFile
              : undefined

            // Check if this is a new file
            const fileIsNew = isNewFile(
              intendedFile,
              code,
              markdownTextRef.current
            )

            return (
              <CodeBlock
                className={cn(className)}
                code={code}
                language={language}
                filename={filename}
                isNewFile={fileIsNew}
                showToolbar
              >
                {/* Toolbar actions (Apply, Reject, Copy) */}
                <CodeBlockActions
                  code={code}
                  language={language}
                  intendedFile={intendedFile}
                  placement="toolbar"
                />
                <CodeBlockCopyButton className="size-7" />
              </CodeBlock>
            )
          },
          p: ({ node, children, ...props }) => {
            // Keep this simple — don't mutate shared refs here
            return <p {...props}>{children}</p>
          },
        }
      }, [])

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
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
)

Markdown.displayName = "Markdown"

export default Markdown
