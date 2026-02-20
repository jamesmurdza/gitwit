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
  ChevronLeft,
  ChevronRight,
  Copy,
  RefreshCcw,
} from "lucide-react"
import * as React from "react"
import type { UIMessage } from "ai"
import { CodeApplyProvider } from "../contexts/code-apply-context"
import { stringifyContent } from "../lib/utils"
import { useChat } from "../providers/chat-provider"
import { ContextTab } from "./context-tab"
import { ToolInvocation } from "./tool-invocation"

export type MessageProps = {
  messageId?: string
  role: "user" | "assistant"
  children: React.ReactNode
  className?: string
  context?: ContextTab[]
  /** For assistant messages, the ID of the user message that triggered this response */
  precedingUserMsgId?: string
  onApplyCode?: (code: string, language?: string) => Promise<void>
  onRejectCode?: () => void
  onOpenFile?: (filePath: string) => void
} & React.HTMLProps<HTMLDivElement>

export type MessageContextValue = {
  role: "user" | "assistant"
  context?: ContextTab[]
  messageId?: string
  precedingUserMsgId?: string
  onOpenFile?: (filePath: string) => void
}

const MessageContext = React.createContext<MessageContextValue | undefined>(
  undefined,
)
const useMessage = () => {
  const context = React.useContext(MessageContext)
  if (!context) {
    throw new Error("useMessageContext must be used within a MessageProvider")
  }
  return context
}
const Message = ({
  messageId,
  children,
  className,
  role,
  context,
  precedingUserMsgId,
  onApplyCode,
  onRejectCode,
  onOpenFile,
  ...props
}: MessageProps) => {
  return (
    <MessageContext.Provider
      value={{ role, context, messageId, precedingUserMsgId, onOpenFile }}
    >
      <div
        className={cn(
          "flex gap-3",
          role === "user" ? "justify-end" : "justify-start",
          className,
        )}
        {...props}
      >
        {role === "assistant" && onApplyCode && onRejectCode ? (
          <CodeApplyProvider
            onApplyCode={onApplyCode}
            onRejectCode={onRejectCode}
            messageId={messageId}
          >
            {children}
          </CodeApplyProvider>
        ) : (
          children
        )}
      </div>
    </MessageContext.Provider>
  )
}

export type MessageAvatarProps = {
  src: string
  alt: string
  fallback?: string
  delayMs?: number
  className?: string
}

const MessageAvatar = ({ src, alt, className }: MessageAvatarProps) => {
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
  parts?: UIMessage["parts"]
} & React.ComponentProps<typeof Markdown> &
  React.HTMLProps<HTMLDivElement>

const MessageContent = ({
  children,
  className,
  parts,
  ...props
}: MessageContentProps) => {
  const { role, context, onOpenFile } = useMessage()
  const isAssistant = role === "assistant"
  const hasContext = context ? context.length > 0 : false
  const stringifiedContent = React.useMemo(() => {
    return stringifyContent(children)
  }, [children])

  const classNames = cn(
    "text-sm rounded-lg p-2 break-words whitespace-normal w-full rounded-lg p-2",
    isAssistant
      ? "bg-background text-foreground"
      : "bg-secondary text-secondary-foreground",
    className,
  )

  // For assistant messages with parts, render each part individually
  const isToolPart = (type: string) =>
    type === "dynamic-tool" || type.startsWith("tool-")
  const hasToolParts =
    isAssistant &&
    parts &&
    parts.some((p) => isToolPart(p.type))


  const renderedContent = React.useMemo(() => {
    if (hasToolParts && parts) {
      // Separate tool parts from text parts so we can render them distinctly
      const elements: React.ReactNode[] = []
      let toolGroup: React.ReactNode[] = []

      const flushToolGroup = () => {
        if (toolGroup.length > 0) {
          elements.push(
            <div key={`tools-${elements.length}`} className="flex flex-col gap-0.5 py-1.5 px-2">
              {toolGroup}
            </div>,
          )
          toolGroup = []
        }
      }

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (part.type === "text") {
          flushToolGroup()
          if (!part.text) continue
          elements.push(
            <Markdown
              key={i}
              className={classNames}
              onOpenFile={onOpenFile}
              {...props}
            >
              {part.text}
            </Markdown>,
          )
        } else if (isToolPart(part.type)) {
          const toolPart = part as unknown as {
            type: string
            toolName: string
            toolCallId: string
            state: string
            input?: Record<string, unknown>
            output?: unknown
            errorText?: string
          }
          const toolName =
            toolPart.toolName ?? part.type.replace(/^tool-/, "")
          toolGroup.push(
            <ToolInvocation
              key={toolPart.toolCallId}
              part={{ ...toolPart, toolName }}
            />,
          )
        }
        // skip step-start and other non-renderable parts
      }
      flushToolGroup()

      return <div className="flex flex-col w-full">{elements}</div>
    }

    if (isAssistant) {
      return (
        <Markdown className={classNames} onOpenFile={onOpenFile} {...props}>
          {children as string}
        </Markdown>
      )
    }

    return (
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
  }, [hasToolParts, parts, classNames, isAssistant, onOpenFile, props, children])

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 max-w-full sm:max-w-full group pb-1",
        role === "assistant" ? "items-start" : "items-end",
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
          "opacity-0 transition-opacity duration-150 group-hover:opacity-100 flex-row-reverse",
        )}
      >
        <CopyMessageAction content={stringifiedContent} />
        {isAssistant && <RetryAction />}
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

function RetryAction() {
  const { retry, isGenerating, getVariantInfo, navigateVariant } = useChat()
  const { precedingUserMsgId } = useMessage()
  const variantInfo = precedingUserMsgId
    ? getVariantInfo(precedingUserMsgId)
    : null

  return (
    <div className="flex items-center gap-0.5">
      {variantInfo && (
        <>
          <MessageAction
            label="Previous variant"
            onClick={() => navigateVariant(precedingUserMsgId!, "prev")}
            disabled={variantInfo.current === 0}
          >
            <ChevronLeft size={14} />
          </MessageAction>
          <span className="text-xs text-muted-foreground tabular-nums px-0.5">
            {variantInfo.current + 1}/{variantInfo.total}
          </span>
          <MessageAction
            label="Next variant"
            onClick={() => navigateVariant(precedingUserMsgId!, "next")}
            disabled={variantInfo.current === variantInfo.total - 1}
          >
            <ChevronRight size={14} />
          </MessageAction>
        </>
      )}
      <MessageAction label="Regenerate" onClick={retry} disabled={isGenerating}>
        <RefreshCcw size={14} />
      </MessageAction>
    </div>
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

export interface MessageActionProps extends React.ComponentProps<
  typeof Button
> {
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
