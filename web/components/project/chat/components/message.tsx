import Avatar from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Markdown } from "@/components/ui/markdown"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import {
  Check,
  Copy,
  CornerUpLeft,
  RefreshCcw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"
import * as React from "react"
// import { type ContextTab } from "../lib/types"
import { CodeApplyProvider } from "../contexts/code-apply-context"
import { stringifyContent } from "../lib/utils"
import { ContextTab } from "./context-tab"

export type MessageProps = {
  role: "user" | "assistant"
  children: React.ReactNode
  className?: string
  context?: ContextTab[]
  onApplyCode?: (code: string, language?: string) => void
  onRejectCode?: () => void
} & React.HTMLProps<HTMLDivElement>

export type MessageContextValue = {
  role: "user" | "assistant"
  context?: ContextTab[]
}

const MessageContext = React.createContext<MessageContextValue | undefined>(
  undefined
)
const useMessage = () => {
  const context = React.useContext(MessageContext)
  if (!context) {
    throw new Error("useMessageContext must be used within a MessageProvider")
  }
  return context
}
const Message = ({
  children,
  className,
  role,
  context,
  onApplyCode,
  onRejectCode,
  ...props
}: MessageProps) => (
  <MessageContext.Provider value={{ role, context }}>
    <div
      className={cn(
        "flex gap-3",
        role === "user" ? "justify-end" : "justify-start",
        className
      )}
      {...props}
    >
      {role === "assistant" && onApplyCode && onRejectCode ? (
        <CodeApplyProvider
          onApplyCode={onApplyCode}
          onRejectCode={onRejectCode}
        >
          {children}
        </CodeApplyProvider>
      ) : (
        children
      )}
    </div>
  </MessageContext.Provider>
)

export type MessageAvatarProps = {
  src: string
  alt: string
  fallback?: string
  delayMs?: number
  className?: string
}

const MessageAvatar = ({
  src,
  alt,
  fallback,
  delayMs,
  className,
}: MessageAvatarProps) => {
  return (
    <Avatar
      avatarUrl={src}
      name={alt}
      className={cn("h-8 w-8 shrink-0", className)}
    />
  )
}

export type MessageContentProps = {
  children: React.ReactNode
  className?: string
} & React.ComponentProps<typeof Markdown> &
  React.HTMLProps<HTMLDivElement>

const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => {
  const { role, context } = useMessage()
  const isAssistant = role === "assistant"
  const hasContext = context ? context.length > 0 : false
  const stringifiedContent = React.useMemo(() => {
    return stringifyContent(children)
  }, [children])
  const renderedContent = React.useMemo(() => {
    const classNames = cn(
      "text-sm rounded-lg p-2 break-words whitespace-normal w-full rounded-lg p-2",
      isAssistant
        ? "bg-background text-foreground"
        : "bg-secondary text-secondary-foreground",
      className
    )
    return isAssistant ? (
      <Markdown className={classNames} {...props}>
        {children as string}
      </Markdown>
    ) : (
      <div className="relative">
        <svg
          width="16"
          height="16"
          fill="hsl(var(--secondary))"
          className="absolute -top-[6px] right-0"
        >
          <path d="M0 6.194c8 0 12-2.065 16-6.194 0 6.71 0 13.5-6 16L0 6.194Z" />
        </svg>
        <div className={classNames} {...props}>
          {children}
        </div>
      </div>
    )
  }, [role, className, children, props])

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 max-w-full sm:max-w-full group pb-1",
        role === "assistant" ? "items-start" : "items-end"
      )}
    >
      {hasContext && (
        <div className="flex gap-2 w-full flex-wrap justify-end mb-1">
          {context?.map((context) => (
            <ContextTab key={context.id} {...context} />
          ))}
        </div>
      )}
      {renderedContent}

      <MessageActions
        className={cn(
          "opacity-0 transition-opacity duration-150 group-hover:opacity-100 flex-row-reverse"
        )}
      >
        {isAssistant ? (
          <>
            <MessageAction label="Retry">
              <RefreshCcw size={16} />
            </MessageAction>
            <CopyMessageAction content={stringifiedContent} />
            <MessageAction label="downvote">
              <ThumbsDown size={16} />
            </MessageAction>
            <MessageAction label="upvote">
              <ThumbsUp size={16} />
            </MessageAction>
          </>
        ) : (
          <>
            <MessageAction label="Ask about">
              <CornerUpLeft size={16} />
            </MessageAction>
            <CopyMessageAction content={stringifiedContent} />
          </>
        )}
      </MessageActions>
    </div>
  )
}

function CopyMessageAction({ content }: { content: string }) {
  const [isCopied, setIsCopied] = React.useState(false)
  const handleCopy = () => {
    if (isCopied) return
    navigator.clipboard.writeText(content)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }
  return (
    <MessageAction label={isCopied ? "Copied!" : "Copy"} onClick={handleCopy}>
      <AnimatePresence initial={false} mode="popLayout">
        {isCopied ? (
          <motion.div
            key="check"
            initial={{ opacity: 0.4, scale: 0.9, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0.4, scale: 0.9, filter: "blur(4px)" }}
            transition={{ duration: 0.3 }}
          >
            <Check size={16} className="text-green-500" />
          </motion.div>
        ) : (
          <motion.div
            key="copy"
            initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
            transition={{ duration: 0.3 }}
          >
            <Copy size={16} />
          </motion.div>
        )}
      </AnimatePresence>
    </MessageAction>
  )
}

export type MessageActionsProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLProps<HTMLDivElement>

const MessageActions = ({
  children,
  className,
  ...props
}: MessageActionsProps) => (
  <div
    className={cn("text-muted-foreground flex items-center gap-1", className)}
    {...props}
  >
    {children}
  </div>
)

export interface MessageActionProps
  extends React.ComponentProps<typeof Button> {
  label: React.ReactNode
}

const MessageAction = ({
  label,
  children,
  className,
  ...props
}: MessageActionProps) => {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="smIcon"
            className={cn("h-6 w-6", className)}
            {...props}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side={"bottom"}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { Message, MessageAction, MessageActions, MessageAvatar, MessageContent }
