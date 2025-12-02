"use client"

import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import { CheckIcon, CopyIcon } from "lucide-react"
import {
  type ComponentProps,
  createContext,
  type HTMLAttributes,
  useContext,
  useEffect,
  useState,
} from "react"
import { type BundledLanguage, codeToHtml } from "shiki"

type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string
  language: BundledLanguage
  filename?: string
  showToolbar?: boolean
  isNewFile?: boolean
}

type CodeBlockContextType = {
  code: string
}

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: "",
})

export async function highlightCode(code: string, language: BundledLanguage) {
  return await codeToHtml(code, {
    lang: language,
    themes: {
      light: "github-light",
      dark: "github-dark-default",
    },
  })
}

const CodeBlock = ({
  code,
  language,
  filename,
  showToolbar = false,
  isNewFile = false,
  className,
  children,
  ...props
}: CodeBlockProps) => {
  const [html, setHtml] = useState<string>("")

  useEffect(() => {
    let isMounted = true

    highlightCode(code, language).then((result) => {
      if (isMounted) {
        setHtml(result)
      }
    })

    return () => {
      isMounted = false
    }
  }, [code, language])

  return (
    <CodeBlockContext.Provider value={{ code }}>
      <div className="group relative my-4 rounded-lg border overflow-hidden">
        {showToolbar && (
          <div className="flex items-center justify-between px-3 py-1 border-b bg-muted/40">
            <div className="text-xs font-medium truncate max-w-[60%] flex items-center gap-2">
              <span>{filename ?? "code"}</span>
              {isNewFile && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium">
                  new file
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">{children}</div>
          </div>
        )}
        <div
          className={cn(
            "overflow-x-auto h-auto [&>pre]:p-4 [&>pre]:overflow-x-auto [&>pre]:min-w-0",
            !showToolbar && "rounded-lg border",
            className
          )}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: "this is needed."
          dangerouslySetInnerHTML={{ __html: html }}
          {...props}
        />
        {!showToolbar && children}
      </div>
    </CodeBlockContext.Provider>
  )
}

export type CodeBlockCopyButtonProps = ComponentProps<"button"> & {
  onCopy?: () => void
  onError?: (error: Error) => void
  timeout?: number
}
const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false)
  const { code } = useContext(CodeBlockContext)

  const copyToClipboard = async () => {
    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
      onError?.(new Error("Clipboard API not available"))
      return
    }

    try {
      await navigator.clipboard.writeText(code)
      setIsCopied(true)
      onCopy?.()
      setTimeout(() => setIsCopied(false), timeout)
    } catch (error) {
      onError?.(error as Error)
    }
  }

  return (
    <button
      className={cn(
        "rounded-md size-7 flex items-center justify-center transition-all hover:bg-secondary active:scale-95",
        className
      )}
      onClick={copyToClipboard}
      type="button"
      {...props}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {isCopied ? (
          <motion.div
            key="check"
            initial={{ opacity: 0.4, scale: 0.9, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0.4, scale: 0.9, filter: "blur(4px)" }}
            transition={{ duration: 0.3 }}
          >
            <CheckIcon size={14} className="text-green-500" />
          </motion.div>
        ) : (
          <motion.div
            key="copy"
            initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
            transition={{ duration: 0.3 }}
          >
            <CopyIcon size={14} />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  )
}

export { CodeBlock, CodeBlockCopyButton }
