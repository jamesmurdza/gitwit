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
      <div className="group relative">
        <div
          className={cn(
            "overflow-clip my-4 h-auto rounded-lg border [&>pre]:p-4 [&>pre]:overflow-x-auto",
            className
          )}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: "this is needed."
          dangerouslySetInnerHTML={{ __html: html }}
          {...props}
        />
        {children}
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
        "absolute top-2 right-2 shrink-0 rounded-md size-7 flex items-center justify-center opacity-0 transition-all",
        "hover:bg-secondary group-hover:opacity-100 active:scale-95",
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
