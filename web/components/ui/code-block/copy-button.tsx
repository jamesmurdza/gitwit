import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import { CheckIcon, CopyIcon } from "lucide-react"
import {
  type ComponentProps,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { StreamdownContext } from "streamdown"
import { useCodeBlockContext } from "./context"

export type CodeBlockCopyButtonProps = ComponentProps<"button"> & {
  onCopy?: () => void
  onError?: (error: Error) => void
  timeout?: number
}

export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  code: propCode,
  ...props
}: CodeBlockCopyButtonProps & { code?: string }) => {
  const [isCopied, setIsCopied] = useState(false)
  const timeoutRef = useRef(0)
  const { code: contextCode } = useCodeBlockContext()
  const { isAnimating } = useContext(StreamdownContext)
  const code = propCode ?? contextCode

  const copyToClipboard = async () => {
    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
      onError?.(new Error("Clipboard API not available"))
      return
    }

    try {
      if (!isCopied) {
        await navigator.clipboard.writeText(code)
        setIsCopied(true)
        onCopy?.()
        timeoutRef.current = window.setTimeout(
          () => setIsCopied(false),
          timeout,
        )
      }
    } catch (error) {
      onError?.(error as Error)
    }
  }

  useEffect(
    () => () => {
      window.clearTimeout(timeoutRef.current)
    },
    [],
  )

  const Icon = isCopied ? CheckIcon : CopyIcon

  return (
    <button
      className={cn(
        "group disabled:cursor-not-allowed disabled:opacity-50 rounded-md size-7 flex items-center justify-center transition-all hover:bg-secondary active:scale-95",
        className,
      )}
      data-streamdown="code-block-copy-button"
      disabled={isAnimating}
      onClick={copyToClipboard}
      title="Copy Code"
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
            <CopyIcon
              className="text-muted-foreground group-hover:text-foreground"
              size={14}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  )
}
